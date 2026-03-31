import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
// @ts-expect-error — music-metadata conditional exports resolve to the node entry at runtime
import { parseFile } from "music-metadata";
import type { ProgressPayload, ScanMode } from "../ipc/contracts.js";
import { isMediaFilePath } from "../media/fileMedia.js";
import { HistoryRepository, TrackRepository } from "../db/repositories.js";
import { DuplicateDetectionService } from "./duplicateDetectionService.js";

const BATCH_SIZE = 50;

export async function discoverFiles(
  folders: string[],
  onProgress: (event: ProgressPayload) => void,
  isCancelled: () => boolean
): Promise<string[]> {
  const files: string[] = [];
  const visited = new Set<string>();

  async function walk(dir: string): Promise<void> {
    if (isCancelled()) return;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (isCancelled()) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!visited.has(fullPath)) {
          visited.add(fullPath);
          await walk(fullPath);
        }
      } else if (entry.isFile() && isMediaFilePath(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  for (const folder of folders) {
    if (isCancelled()) break;
    onProgress({ phase: "scan", processed: files.length, total: 1, message: `Scanning ${folder}…` });
    await walk(folder);
  }
  return files;
}

async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function computeMetadataCompleteness(meta: {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  hasArtwork: boolean;
}): number {
  const fields = [
    meta.title,
    meta.artist,
    meta.album,
    meta.year != null ? String(meta.year) : undefined,
    meta.genre,
    meta.hasArtwork ? "yes" : undefined
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100) / 100;
}

export class ScanService {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly duplicateDetectionService: DuplicateDetectionService
  ) {}

  async runScan(
    jobId: string,
    folders: string[],
    _mode: ScanMode,
    onProgress: (event: ProgressPayload) => void,
    isCancelled: () => boolean
  ): Promise<void> {
    onProgress({ phase: "scan", processed: 0, total: 1, message: "Discovering audio files…" });
    const files = await discoverFiles(folders, onProgress, isCancelled);

    if (isCancelled()) {
      this.historyRepository.record("scan_cancelled", "Scan stopped by user", { jobId, folders });
      onProgress({ phase: "scan", processed: 0, total: 1, message: "Scan cancelled", status: "cancelled" });
      return;
    }

    const totalFiles = files.length;
    if (totalFiles === 0) {
      this.historyRepository.record("scan_completed", "Scan found no media files", { jobId, folders });
      onProgress({ phase: "finalize", processed: 1, total: 1, message: "No media files found in the selected folders.", status: "completed" });
      return;
    }

    onProgress({ phase: "analyze", processed: 0, total: totalFiles, message: `Analyzing ${totalFiles} files…` });

    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      if (isCancelled()) {
        this.historyRepository.record("scan_cancelled", "Scan stopped by user", { jobId, folders, processed: i });
        onProgress({ phase: "analyze", processed: i, total: totalFiles, message: "Scan cancelled", status: "cancelled" });
        return;
      }

      const batch = files.slice(i, i + BATCH_SIZE);
      const tracks: Array<{
        id: string;
        title: string;
        artists: string;
        album: string | null;
        albumArtist: string | null;
        trackNumber: number | null;
        discNumber: number | null;
        canonicalDurationSec: number | null;
        year: number | null;
        genre: string | null;
        compilation: boolean;
        artworkRef: string | null;
        fileCopy: {
          id: string;
          path: string;
          filename: string;
          format: string;
          codec: string | null;
          bitrate: number | null;
          sampleRate: number | null;
          channels: number | null;
          durationSec: number;
          sizeBytes: number;
          modifiedAt: string;
          metadataCompleteness: number;
          fingerprintHash: string | null;
          artworkHash: string | null;
          hasArtwork: boolean;
        };
      }> = [];

      for (const filePath of batch) {
        if (isCancelled()) break;
        try {
          const stats = await fsp.stat(filePath);
          const metadata = await parseFile(filePath);
          const common = metadata.common;
          const fmt = metadata.format;

          const title = common.title?.trim() || path.basename(filePath, path.extname(filePath));
          const artists = common.artist?.trim() || "Unknown Artist";
          const album = common.album?.trim() || null;
          const hasArtwork = (common.picture?.length ?? 0) > 0;

          let artworkHash: string | null = null;
          if (hasArtwork && common.picture?.[0]) {
            artworkHash = createHash("md5").update(common.picture[0].data).digest("hex");
          }

          const fingerprintHash = await computeFileHash(filePath);

          const completeness = computeMetadataCompleteness({
            title: common.title,
            artist: common.artist,
            album: common.album,
            year: common.year,
            genre: common.genre?.[0],
            hasArtwork
          });

          tracks.push({
            id: randomUUID(),
            title,
            artists,
            album,
            albumArtist: common.albumartist?.trim() || null,
            trackNumber: common.track?.no ?? null,
            discNumber: common.disk?.no ?? null,
            canonicalDurationSec: fmt.duration ?? null,
            year: common.year ?? null,
            genre: common.genre?.[0] ?? null,
            compilation: common.compilation ?? false,
            artworkRef: null,
            fileCopy: {
              id: randomUUID(),
              path: filePath,
              filename: path.basename(filePath),
              format: path.extname(filePath).slice(1).toLowerCase(),
              codec: fmt.codec ?? null,
              bitrate: fmt.bitrate ? Math.round(fmt.bitrate) : null,
              sampleRate: fmt.sampleRate ?? null,
              channels: fmt.numberOfChannels ?? null,
              durationSec: fmt.duration ?? 0,
              sizeBytes: stats.size,
              modifiedAt: stats.mtime.toISOString(),
              metadataCompleteness: completeness,
              fingerprintHash,
              artworkHash,
              hasArtwork
            }
          });
        } catch {
          /* skip unreadable files */
        }
      }

      if (tracks.length > 0) {
        this.trackRepository.upsertBatch(tracks);
      }

      const processed = Math.min(i + BATCH_SIZE, totalFiles);
      onProgress({
        phase: "analyze",
        processed,
        total: totalFiles,
        message: `Processed ${processed} of ${totalFiles} files…`
      });
    }

    if (isCancelled()) {
      this.historyRepository.record("scan_cancelled", "Scan stopped by user", { jobId, folders });
      onProgress({ phase: "analyze", processed: totalFiles, total: totalFiles, message: "Scan cancelled", status: "cancelled" });
      return;
    }

    const validPaths = new Set(files);
    const pruned = this.trackRepository.pruneStaleFileCopies(validPaths);
    if (pruned > 0) {
      onProgress({ phase: "analyze", processed: totalFiles, total: totalFiles, message: `Removed ${pruned} stale record(s) for files no longer on disk.` });
    }

    onProgress({ phase: "group", processed: 0, total: totalFiles, message: "Detecting duplicates…" });

    const result = this.duplicateDetectionService.detect(onProgress, isCancelled);

    if (isCancelled()) {
      this.historyRepository.record("scan_cancelled", "Scan stopped by user", { jobId, folders });
      onProgress({ phase: "group", processed: totalFiles, total: totalFiles, message: "Scan cancelled", status: "cancelled" });
      return;
    }

    this.historyRepository.record("scan_completed", "Scan completed successfully", {
      jobId,
      folders,
      totalFiles,
      exactGroups: result.exactGroups,
      likelyGroups: result.likelyGroups
    });

    onProgress({
      phase: "finalize",
      processed: totalFiles,
      total: totalFiles,
      message: `Scan complete — ${totalFiles} files indexed, ${result.exactGroups} exact and ${result.likelyGroups} likely duplicate groups found.`,
      status: "completed"
    });
  }
}
