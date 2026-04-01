import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ProgressPayload } from "../ipc/contracts.js";

const DEFAULT_DURATION_THRESHOLD_SEC = 2;
const DEFAULT_MIN_CONFIDENCE = 0.7;

type FileCopyRow = {
  id: string;
  track_id: string;
  path: string;
  filename: string;
  format: string;
  codec: string | null;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  duration_sec: number;
  size_bytes: number;
  metadata_completeness: number;
  fingerprint_hash: string | null;
  artwork_hash: string | null;
  has_artwork: number;
};

type TrackRow = {
  id: string;
  title: string;
  artists: string;
  album: string | null;
  canonical_duration_sec: number | null;
};

function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function normalizeTitleForComparison(s: string): string {
  // Strip common filename-style prefixes and remix/version suffixes for robust metadata matching.
  return s
    .toLowerCase()
    .replace(/^\s*\d+\s*[-_.)\]]\s*/g, "")
    .replace(/\((remaster|remastered|live|radio edit|edit|mix|version)[^)]+\)/g, "")
    .replace(/\[(remaster|remastered|live|radio edit|edit|mix|version)[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function normalizeArtistForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(feat|ft|featuring)\b.*$/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAlbumForComparison(s: string | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\((deluxe|expanded|remaster|remastered)[^)]+\)/g, "")
    .replace(/\[(deluxe|expanded|remaster|remastered)[^\]]+\]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function durationBucketSeconds(duration: number | null): string {
  if (duration == null || duration <= 0) return "unknown";
  return String(Math.round(duration / 5) * 5);
}

function titleTokenSignature(titleNorm: string): string {
  const STOPWORDS = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with"]);
  const tokens = titleNorm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  if (tokens.length === 0) return titleNorm;
  return Array.from(new Set(tokens)).sort().join(" ");
}

function buildLikelyKeys(
  track: TrackRow,
  allowTitleOnlyLikely: boolean,
  requireArtistForLikely: boolean
): Array<{ key: string; keyType: "title_artist" | "title_only" | "title_album_duration" }> {
  const titleNorm = normalizeTitleForComparison(track.title);
  if (titleNorm.length === 0) return [];
  const titleSig = titleTokenSignature(titleNorm);
  const artistNorm = normalizeArtistForComparison(track.artists);
  const albumNorm = normalizeAlbumForComparison(track.album);
  const durBucket = durationBucketSeconds(track.canonical_duration_sec);
  const hasUsableArtist = artistNorm.length > 0 && artistNorm !== "unknown artist" && artistNorm !== "unknownartist";
  if (requireArtistForLikely && !hasUsableArtist) return [];

  const keys = new Map<string, "title_artist" | "title_only" | "title_album_duration">();
  if (hasUsableArtist) {
    keys.set(`ta:${titleNorm}::${artistNorm}`, "title_artist");
    keys.set(`tas:${titleSig}::${artistNorm}`, "title_artist");
  }
  if (albumNorm.length > 0) {
    keys.set(`tad:${titleSig}::${albumNorm}::${durBucket}`, "title_album_duration");
  } else {
    keys.set(`td:${titleSig}::${durBucket}`, "title_album_duration");
  }
  if (allowTitleOnlyLikely) {
    keys.set(`t:${titleSig}`, "title_only");
  }
  return Array.from(keys, ([key, keyType]) => ({ key, keyType }));
}

function signatureForCopyIds(ids: string[]): string {
  return ids.slice().sort().join("|");
}

function computeLikelyConfidence(
  copies: FileCopyRow[],
  tracks: Map<string, TrackRow>,
  durationThreshold: number,
  keyType: "title_artist" | "title_only" | "title_album_duration"
): number {
  if (copies.length < 2) return 0;
  let score = keyType === "title_artist" ? 0.78 : keyType === "title_album_duration" ? 0.72 : 0.64;

  const durations = copies.map((c) => c.duration_sec).filter((d) => d > 0);
  if (durations.length >= 2) {
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    if (maxDur - minDur <= durationThreshold) {
      score += 0.15;
    } else if (maxDur - minDur <= durationThreshold * 2) {
      score += 0.05;
    }
  }

  const albums = new Set(copies.map((c) => tracks.get(c.track_id)?.album).filter(Boolean));
  if (albums.size === 1) {
    score += 0.1;
  }

  const sizes = copies.map((c) => c.size_bytes).filter((s) => s > 0);
  if (sizes.length >= 2) {
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    if (minSize / maxSize > 0.8) {
      score += 0.05;
    }
  }

  return Math.min(0.99, Math.max(0, Math.round(score * 100) / 100));
}

export class DuplicateDetectionService {
  constructor(private readonly db: Database.Database) {}

  /**
   * Run full duplicate detection: exact (by hash) and likely (by title+artist).
   * Clears existing groups and repopulates from file_copies + tracks tables.
   */
  detect(
    optionsOrOnProgress?:
      | {
          durationThresholdSec?: number;
          likelyMinConfidence?: number;
          preserveResolved?: boolean;
          allowTitleOnlyLikely?: boolean;
          requireArtistForLikely?: boolean;
        }
      | ((event: ProgressPayload) => void),
    onProgressOrCancelled?: ((event: ProgressPayload) => void) | (() => boolean),
    isCancelledArg?: () => boolean
  ): { exactGroups: number; likelyGroups: number } {
    const options =
      typeof optionsOrOnProgress === "function" || !optionsOrOnProgress
        ? undefined
        : optionsOrOnProgress;
    const onProgress =
      typeof optionsOrOnProgress === "function"
        ? optionsOrOnProgress
        : (typeof onProgressOrCancelled === "function" && onProgressOrCancelled.length > 0
            ? (onProgressOrCancelled as (event: ProgressPayload) => void)
            : undefined);
    const isCancelled =
      typeof optionsOrOnProgress === "function"
        ? (typeof onProgressOrCancelled === "function" && onProgressOrCancelled.length === 0
            ? (onProgressOrCancelled as () => boolean)
            : isCancelledArg)
        : isCancelledArg;
    const durationThreshold = options?.durationThresholdSec ?? DEFAULT_DURATION_THRESHOLD_SEC;
    const likelyMinConfidence = options?.likelyMinConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const preserveResolved = options?.preserveResolved ?? true;
    const allowTitleOnlyLikely = options?.allowTitleOnlyLikely ?? true;
    const requireArtistForLikely = options?.requireArtistForLikely ?? false;

    const allCopies = this.db.prepare("SELECT * FROM file_copies").all() as FileCopyRow[];
    const allTracks = this.db.prepare("SELECT id, title, artists, album, canonical_duration_sec FROM tracks").all() as TrackRow[];
    const trackMap = new Map(allTracks.map((t) => [t.id, t]));

    onProgress?.({ phase: "group", processed: 0, total: allCopies.length, message: "Detecting exact duplicates…" });

    if (isCancelled?.()) return { exactGroups: 0, likelyGroups: 0 };

    const byHash = new Map<string, FileCopyRow[]>();
    for (const copy of allCopies) {
      if (copy.fingerprint_hash) {
        const existing = byHash.get(copy.fingerprint_hash);
        if (existing) {
          existing.push(copy);
        } else {
          byHash.set(copy.fingerprint_hash, [copy]);
        }
      }
    }

    const exactGroupEntries: Array<{
      id: string;
      type: "exact";
      confidence: number;
      copies: FileCopyRow[];
      track: TrackRow | undefined;
    }> = [];

    const inExactGroup = new Set<string>();
    for (const [, copies] of byHash) {
      if (copies.length < 2) continue;
      const track = trackMap.get(copies[0]!.track_id);
      exactGroupEntries.push({
        id: randomUUID(),
        type: "exact",
        confidence: 1.0,
        copies,
        track
      });
      for (const c of copies) inExactGroup.add(c.id);
    }

    if (isCancelled?.()) return { exactGroups: 0, likelyGroups: 0 };

    onProgress?.({
      phase: "group",
      processed: Math.floor(allCopies.length / 2),
      total: allCopies.length,
      message: "Detecting likely duplicates…"
    });

    const byNormalizedKey = new Map<string, { copies: FileCopyRow[]; keyType: "title_artist" | "title_only" | "title_album_duration" }>();
    for (const copy of allCopies) {
      if (inExactGroup.has(copy.id)) continue;
      const track = trackMap.get(copy.track_id);
      if (!track) continue;
      const keys = buildLikelyKeys(track, allowTitleOnlyLikely, requireArtistForLikely);
      for (const { key, keyType } of keys) {
        const existing = byNormalizedKey.get(key);
        if (existing) {
          existing.copies.push(copy);
        } else {
          byNormalizedKey.set(key, { copies: [copy], keyType });
        }
      }
    }

    const likelyGroupEntries: Array<{
      id: string;
      type: "likely";
      confidence: number;
      copies: FileCopyRow[];
      track: TrackRow | undefined;
    }> = [];

    for (const [, entry] of byNormalizedKey) {
      const { copies, keyType } = entry;
      if (copies.length < 2) continue;
      const confidence = computeLikelyConfidence(copies, trackMap, durationThreshold, keyType);
      if (confidence < likelyMinConfidence) continue;
      const track = trackMap.get(copies[0]!.track_id);
      likelyGroupEntries.push({
        id: randomUUID(),
        type: "likely",
        confidence,
        copies,
        track
      });
    }

    if (isCancelled?.()) return { exactGroups: 0, likelyGroups: 0 };

    onProgress?.({
      phase: "group",
      processed: allCopies.length,
      total: allCopies.length,
      message: "Persisting duplicate groups…"
    });

    const tx = this.db.transaction(() => {
      const preservedResolved = new Set<string>();
      if (preserveResolved) {
        const previous = this.db.prepare("SELECT duplicate_type, status, summary FROM duplicate_groups WHERE status = 'user_resolved'").all() as Array<{
          duplicate_type: "exact" | "likely";
          status: string;
          summary: string | null;
        }>;
        for (const row of previous) {
          if (!row.summary) continue;
          try {
            const parsed = JSON.parse(row.summary) as { candidates?: Array<{ id: string }> };
            const ids = (parsed.candidates ?? []).map((c) => c.id);
            if (ids.length >= 2) {
              preservedResolved.add(`${row.duplicate_type}:${signatureForCopyIds(ids)}`);
            }
          } catch {
            /* ignore malformed summary */
          }
        }
      }
      this.db.prepare("DELETE FROM duplicate_group_items").run();
      this.db.prepare("DELETE FROM duplicate_groups").run();

      const insertGroup = this.db.prepare(
        "INSERT INTO duplicate_groups (id, duplicate_type, confidence, status, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      const insertItem = this.db.prepare(
        "INSERT INTO duplicate_group_items (group_id, file_copy_id) VALUES (?, ?)"
      );
      const now = new Date().toISOString();

      const allGroups = [
        ...exactGroupEntries,
        ...likelyGroupEntries
      ];

      for (const group of allGroups) {
        const summary = JSON.stringify({
          title: group.track?.title ?? "Unknown",
          artist: group.track?.artists ?? "Unknown",
          candidates: group.copies.map((c) => ({
            id: c.id,
            path: c.path,
            format: c.format,
            bitrate: c.bitrate ?? 0,
            durationSec: c.duration_sec,
            sizeBytes: c.size_bytes,
            metadataCompleteness: c.metadata_completeness,
            hasArtwork: c.has_artwork === 1
          }))
        });

        const status = preservedResolved.has(`${group.type}:${signatureForCopyIds(group.copies.map((c) => c.id))}`)
          ? "user_resolved"
          : "unreviewed";
        insertGroup.run(group.id, group.type, group.confidence, status, summary, now, now);
        for (const copy of group.copies) {
          insertItem.run(group.id, copy.id);
        }
      }
    });
    tx();

    return {
      exactGroups: exactGroupEntries.length,
      likelyGroups: likelyGroupEntries.length
    };
  }
}
