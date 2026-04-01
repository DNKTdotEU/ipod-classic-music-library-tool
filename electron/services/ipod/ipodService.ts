import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readSysInfo } from "./sysInfoParser.js";
import { parseItunesDb, type IpodLibrary } from "./itunesDbParser.js";

export type IpodDevice = {
  id: string;
  mountPath: string;
  modelName: string;
  modelNumber: string;
  generation: string;
  firmwareVersion: string;
  serialNumber: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
};

export type FsEntry = {
  name: string;
  type: "directory" | "file";
  sizeBytes: number;
  modifiedAt: string;
};

export type IpodLibraryQuery = {
  search?: string;
  genre?: string;
  limit?: number;
  offset?: number;
};

export type IpodLibraryQueryResult = {
  tracks: IpodLibrary["tracks"];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  availableGenres: string[];
};

const UNKNOWN_GENRE = "__unknown_genre__";
const IPOD_MARKER = path.join("iPod_Control", "iTunes", "iTunesDB");

function mountPointCandidates(): string[] {
  const platform = process.platform;
  if (platform === "darwin") {
    return ["/Volumes"];
  }
  if (platform === "linux") {
    const user = process.env.USER ?? process.env.LOGNAME ?? "";
    const dirs: string[] = [];
    if (user) {
      dirs.push(`/media/${user}`, `/run/media/${user}`);
    }
    dirs.push("/mnt");
    return dirs;
  }
  if (platform === "win32") {
    return "DEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `${l}:\\`);
  }
  return [];
}

async function isIpod(mountPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(mountPath, IPOD_MARKER));
    return true;
  } catch {
    return false;
  }
}

async function getStorageInfo(mountPath: string): Promise<{ total: number; free: number; used: number }> {
  try {
    const stats = await fs.statfs(mountPath);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return { total, free, used: total - free };
  } catch {
    return { total: 0, free: 0, used: 0 };
  }
}

export async function detectIpods(): Promise<IpodDevice[]> {
  const candidates = mountPointCandidates();
  const devices: IpodDevice[] = [];

  for (const base of candidates) {
    let entries: string[];
    try {
      entries = await fs.readdir(base);
    } catch {
      continue;
    }

    if (process.platform === "win32") {
      if (await isIpod(base)) {
        const device = await buildDeviceInfo(base);
        if (device) devices.push(device);
      }
      continue;
    }

    for (const entry of entries) {
      const mountPath = path.join(base, entry);
      try {
        const stat = await fs.stat(mountPath);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }
      if (await isIpod(mountPath)) {
        const device = await buildDeviceInfo(mountPath);
        if (device) devices.push(device);
      }
    }
  }

  return devices;
}

async function buildDeviceInfo(mountPath: string): Promise<IpodDevice | null> {
  const sysInfo = await readSysInfo(mountPath);
  const storage = await getStorageInfo(mountPath);
  return {
    id: crypto.createHash("sha256").update(mountPath).digest("hex").slice(0, 16),
    mountPath,
    modelName: sysInfo.modelInfo.name,
    modelNumber: sysInfo.modelNumber,
    generation: sysInfo.modelInfo.generation,
    firmwareVersion: sysInfo.firmwareVersion,
    serialNumber: sysInfo.serialNumber,
    totalBytes: storage.total,
    usedBytes: storage.used,
    freeBytes: storage.free
  };
}

function assertWithinMount(mountPath: string, targetPath: string): void {
  const resolved = path.resolve(mountPath, targetPath);
  const normalizedMount = path.resolve(mountPath);
  if (!resolved.startsWith(normalizedMount + path.sep) && resolved !== normalizedMount) {
    throw new Error("Path traversal detected: target is outside the mount point");
  }
}

export async function listDirectory(mountPath: string, relativePath: string): Promise<FsEntry[]> {
  assertWithinMount(mountPath, relativePath);
  const fullPath = path.resolve(mountPath, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const results: FsEntry[] = [];

  for (const entry of entries) {
    try {
      const entryPath = path.join(fullPath, entry.name);
      const stat = await fs.stat(entryPath);
      results.push({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    } catch {
      results.push({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        sizeBytes: 0,
        modifiedAt: ""
      });
    }
  }

  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

export async function readLibrary(mountPath: string): Promise<IpodLibrary> {
  const dbPath = path.join(mountPath, "iPod_Control", "iTunes", "iTunesDB");
  const buf = await fs.readFile(dbPath);
  return parseItunesDb(buf);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeGenre(value: string | null | undefined): string {
  const genre = normalizeText(value);
  return genre.length > 0 ? genre : UNKNOWN_GENRE;
}

export async function queryLibraryTracks(mountPath: string, query: IpodLibraryQuery): Promise<IpodLibraryQueryResult> {
  const library = await readLibrary(mountPath);
  const search = normalizeText(query.search).toLowerCase();
  const requestedGenre = normalizeText(query.genre);
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(1000, Math.max(1, query.limit ?? 250));

  const genreSet = new Set<string>();
  for (const track of library.tracks) {
    genreSet.add(normalizeGenre(track.genre));
  }
  const availableGenres = Array.from(genreSet)
    .filter((genre) => genre !== UNKNOWN_GENRE)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (genreSet.has(UNKNOWN_GENRE)) availableGenres.push(UNKNOWN_GENRE);

  const filtered = library.tracks.filter((track) => {
    const title = normalizeText(track.title).toLowerCase();
    const artist = normalizeText(track.artist).toLowerCase();
    const album = normalizeText(track.album).toLowerCase();
    const genre = normalizeText(track.genre).toLowerCase();
    const normalizedTrackGenre = normalizeGenre(track.genre);
    const matchesSearch = !search
      || title.includes(search)
      || artist.includes(search)
      || album.includes(search)
      || genre.includes(search);
    const matchesGenre = !requestedGenre || normalizedTrackGenre === requestedGenre;
    return matchesSearch && matchesGenre;
  });

  const tracks = filtered.slice(offset, offset + limit);
  return {
    tracks,
    total: filtered.length,
    offset,
    limit,
    hasMore: offset + tracks.length < filtered.length,
    availableGenres
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "untitled";
}

export async function exportTracks(
  mountPath: string,
  tracks: { filePath: string; title: string; artist: string; ext: string }[],
  destDir: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ exported: string[]; failed: string[] }> {
  await fs.mkdir(destDir, { recursive: true });
  const exported: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const sourcePath = path.join(mountPath, t.filePath);
    const safeName = sanitizeFilename(
      t.artist && t.title ? `${t.artist} - ${t.title}` : t.title || path.basename(t.filePath, t.ext)
    );
    let destPath = path.join(destDir, `${safeName}${t.ext}`);

    let counter = 1;
    while (fsSync.existsSync(destPath)) {
      destPath = path.join(destDir, `${safeName} (${counter++})${t.ext}`);
    }

    try {
      await fs.copyFile(sourcePath, destPath);
      exported.push(destPath);
    } catch {
      failed.push(t.filePath);
    }

    onProgress?.(i + 1, tracks.length);
  }

  return { exported, failed };
}

export async function copyToDevice(
  mountPath: string,
  destRelative: string,
  sourcePaths: string[]
): Promise<{ copied: string[]; failed: string[] }> {
  assertWithinMount(mountPath, destRelative);
  const destDir = path.resolve(mountPath, destRelative);
  await fs.mkdir(destDir, { recursive: true });
  const copied: string[] = [];
  const failed: string[] = [];

  for (const src of sourcePaths) {
    try {
      const dest = path.join(destDir, path.basename(src));
      await fs.copyFile(src, dest);
      copied.push(dest);
    } catch {
      failed.push(src);
    }
  }

  return { copied, failed };
}

export async function deleteFromDevice(
  mountPath: string,
  relativePaths: string[]
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const rel of relativePaths) {
    assertWithinMount(mountPath, rel);
    const fullPath = path.resolve(mountPath, rel);
    try {
      await fs.unlink(fullPath);
      deleted.push(rel);
    } catch {
      failed.push(rel);
    }
  }

  return { deleted, failed };
}
