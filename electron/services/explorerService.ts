import fs from "node:fs/promises";
import path from "node:path";
// @ts-expect-error — music-metadata conditional exports resolve to the node entry at runtime
import { parseFile } from "music-metadata";
import { isAudioFilePath, isMediaFilePath } from "../media/fileMedia.js";
import type { HistoryRepository, TrackRepository } from "../db/repositories.js";
import type { QuarantineService } from "./quarantineService.js";

export type ExplorerListEntry = {
  name: string;
  type: "directory" | "file";
  sizeBytes: number;
  modifiedAt: string;
};

export type ExplorerMetadata = {
  relativePath: string;
  absolutePath: string;
  type: "file" | "directory";
  sizeBytes: number;
  modifiedAt: string;
  media: {
    title: string | null;
    artist: string | null;
    album: string | null;
    genre: string | null;
    durationSec: number | null;
    bitrate: number | null;
    sampleRate: number | null;
    codec: string | null;
    hasArtwork: boolean;
  } | null;
};

type SmartPreset = "missing_tags" | "low_bitrate" | "short_duration" | "duplicate_like_name" | "non_audio" | "genre";

export class ExplorerService {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly quarantineService: QuarantineService,
    private readonly historyRepository: HistoryRepository
  ) {}

  resolveWithinRoot(rootPath: string, relativePath: string): string {
    const root = path.resolve(rootPath);
    const target = path.resolve(root, relativePath || "");
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (target !== root && !target.startsWith(rootWithSep)) {
      throw new Error("Path escapes selected root");
    }
    return target;
  }

  toRelative(rootPath: string, absolutePath: string): string {
    return path.relative(path.resolve(rootPath), absolutePath).replace(/\\/g, "/");
  }

  async list(rootPath: string, relativePath: string): Promise<ExplorerListEntry[]> {
    const target = this.resolveWithinRoot(rootPath, relativePath);
    const entries = await fs.readdir(target, { withFileTypes: true });
    const rows = await Promise.all(entries.map(async (entry) => {
      const full = path.join(target, entry.name);
      let sizeBytes = 0;
      let modifiedAt = "";
      try {
        const st = await fs.stat(full);
        sizeBytes = st.size;
        modifiedAt = st.mtime.toISOString();
      } catch {
        // unreadable file metadata - keep defaults
      }
      return {
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        sizeBytes,
        modifiedAt
      } satisfies ExplorerListEntry;
    }));
    rows.sort((a, b) => (a.type !== b.type ? (a.type === "directory" ? -1 : 1) : a.name.localeCompare(b.name)));
    return rows;
  }

  async getMetadata(rootPath: string, relativePath: string): Promise<ExplorerMetadata> {
    const abs = this.resolveWithinRoot(rootPath, relativePath);
    const st = await fs.stat(abs);
    const type = st.isDirectory() ? "directory" : "file";
    let media: ExplorerMetadata["media"] = null;
    if (type === "file" && isMediaFilePath(abs)) {
      try {
        const metadata = await parseFile(abs);
        media = {
          title: metadata.common.title ?? null,
          artist: metadata.common.artist ?? null,
          album: metadata.common.album ?? null,
          genre: metadata.common.genre?.[0] ?? null,
          durationSec: metadata.format.duration ?? null,
          bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate) : null,
          sampleRate: metadata.format.sampleRate ?? null,
          codec: metadata.format.codec ?? null,
          hasArtwork: (metadata.common.picture?.length ?? 0) > 0
        };
      } catch {
        media = null;
      }
    }
    return {
      relativePath,
      absolutePath: abs,
      type,
      sizeBytes: st.size,
      modifiedAt: st.mtime.toISOString(),
      media
    };
  }

  async delete(rootPath: string, relativePaths: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const rel of relativePaths) {
      try {
        const target = this.resolveWithinRoot(rootPath, rel);
        await fs.rm(target, { recursive: true, force: false });
        this.trackRepository.removeFileCopyByPath(target);
        deleted.push(rel);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push(`${rel} (${msg})`);
      }
    }
    this.historyRepository.record("explorer_delete", "Explorer batch delete executed", { deleted, failed });
    return { deleted, failed };
  }

  quarantine(rootPath: string, relativePaths: string[]): { moved: string[]; failed: string[] } {
    const moved: string[] = [];
    const failed: string[] = [];
    for (const rel of relativePaths) {
      try {
        const target = this.resolveWithinRoot(rootPath, rel);
        this.quarantineService.move(target, "Explorer cleanup action");
        this.trackRepository.removeFileCopyByPath(target);
        moved.push(rel);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push(`${rel} (${msg})`);
      }
    }
    this.historyRepository.record("explorer_quarantine", "Explorer batch quarantine executed", { moved, failed });
    return { moved, failed };
  }

  async bulkRename(
    rootPath: string,
    items: Array<{ fromRelativePath: string; toFilename: string }>,
    dryRun: boolean
  ): Promise<{ renamed: Array<{ from: string; to: string }>; failed: string[] }> {
    const planned: Array<{ from: string; to: string }> = [];
    const failed: string[] = [];
    const usedTargets = new Set<string>();
    const fileExists = async (p: string): Promise<boolean> => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    };

    const splitName = (fileName: string): { stem: string; ext: string } => {
      const ext = path.extname(fileName);
      return { stem: ext ? fileName.slice(0, -ext.length) : fileName, ext };
    };

    const uniqueTargetFor = async (candidateAbs: string): Promise<string> => {
      const dir = path.dirname(candidateAbs);
      const { stem, ext } = splitName(path.basename(candidateAbs));
      let n = 1;
      let next = candidateAbs;
      while (usedTargets.has(next) || (!dryRun && await fileExists(next))) {
        n += 1;
        next = path.join(dir, `${stem} (${n})${ext}`);
      }
      return next;
    };

    for (const item of items) {
      try {
        if (item.toFilename.includes("/") || item.toFilename.includes("\\")) {
          throw new Error("target filename cannot include path separators");
        }
        const fromAbs = this.resolveWithinRoot(rootPath, item.fromRelativePath);
        const fromDir = path.dirname(fromAbs);
        const requestedAbs = this.resolveWithinRoot(rootPath, this.toRelative(rootPath, path.join(fromDir, item.toFilename)));
        const toAbs = await uniqueTargetFor(requestedAbs);
        if (fromAbs === toAbs) continue;
        usedTargets.add(toAbs);
        await fs.access(fromAbs);
        planned.push({ from: item.fromRelativePath, to: this.toRelative(rootPath, toAbs) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push(`${item.fromRelativePath} (${msg})`);
      }
    }

    const renamed: Array<{ from: string; to: string }> = [];
    if (!dryRun) {
      for (const r of planned) {
        const fromAbs = this.resolveWithinRoot(rootPath, r.from);
        const toAbs = this.resolveWithinRoot(rootPath, r.to);
        try {
          await fs.rename(fromAbs, toAbs);
          renamed.push(r);
        } catch (err) {
          failed.push(`${r.from} (${err instanceof Error ? err.message : String(err)})`);
        }
      }
    } else {
      renamed.push(...planned);
    }
    this.historyRepository.record("explorer_rename", dryRun ? "Explorer rename preview generated" : "Explorer batch rename executed", {
      dryRun,
      renamed,
      failed
    });
    return { renamed, failed };
  }

  async applySmartFilter(
    rootPath: string,
    relativePath: string,
    preset: SmartPreset,
    genre?: string,
    lowBitrateKbps = 128,
    shortDurationSec = 30
  ): Promise<string[]> {
    const dir = this.resolveWithinRoot(rootPath, relativePath);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
    const out: string[] = [];
    const seenNameKey = new Set<string>();
    for (const abs of files) {
      const rel = this.toRelative(rootPath, abs);
      if (preset === "non_audio") {
        if (!isAudioFilePath(abs)) out.push(rel);
        continue;
      }
      if (!isMediaFilePath(abs)) continue;
      let md: Awaited<ReturnType<typeof parseFile>> | null = null;
      try {
        md = await parseFile(abs);
      } catch {
        md = null;
      }
      if (!md) {
        if (preset === "missing_tags") out.push(rel);
        continue;
      }
      if (preset === "missing_tags") {
        if (!md.common.title || !md.common.artist || !md.common.album) out.push(rel);
      } else if (preset === "genre") {
        const g = (md.common.genre?.[0] ?? "").trim().toLowerCase();
        const want = (genre ?? "").trim().toLowerCase();
        if (want.length > 0 && g.includes(want)) out.push(rel);
      } else if (preset === "low_bitrate") {
        const kbps = md.format.bitrate ? md.format.bitrate / 1000 : 0;
        if (kbps > 0 && kbps < lowBitrateKbps) out.push(rel);
      } else if (preset === "short_duration") {
        if ((md.format.duration ?? 0) > 0 && (md.format.duration ?? 0) < shortDurationSec) out.push(rel);
      } else if (preset === "duplicate_like_name") {
        const t = (md.common.title ?? path.basename(abs, path.extname(abs))).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const a = (md.common.artist ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const key = `${t}|${a}`;
        if (seenNameKey.has(key)) out.push(rel); else seenNameKey.add(key);
      }
    }
    return out;
  }
}

