import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ProgressPayload } from "../ipc/contracts.js";

const DEFAULT_DURATION_THRESHOLD_SEC = 2;

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

function computeLikelyConfidence(
  copies: FileCopyRow[],
  tracks: Map<string, TrackRow>,
  durationThreshold: number
): number {
  if (copies.length < 2) return 0;
  let score = 0.7;

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

  return Math.min(0.99, Math.round(score * 100) / 100);
}

export class DuplicateDetectionService {
  constructor(private readonly db: Database.Database) {}

  /**
   * Run full duplicate detection: exact (by hash) and likely (by title+artist).
   * Clears existing groups and repopulates from file_copies + tracks tables.
   */
  detect(
    onProgress?: (event: ProgressPayload) => void,
    isCancelled?: () => boolean
  ): { exactGroups: number; likelyGroups: number } {
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

    const byNormalizedKey = new Map<string, FileCopyRow[]>();
    for (const copy of allCopies) {
      if (inExactGroup.has(copy.id)) continue;
      const track = trackMap.get(copy.track_id);
      if (!track) continue;
      const key = `${normalizeForComparison(track.title)}::${normalizeForComparison(track.artists)}`;
      const existing = byNormalizedKey.get(key);
      if (existing) {
        existing.push(copy);
      } else {
        byNormalizedKey.set(key, [copy]);
      }
    }

    const likelyGroupEntries: Array<{
      id: string;
      type: "likely";
      confidence: number;
      copies: FileCopyRow[];
      track: TrackRow | undefined;
    }> = [];

    for (const [, copies] of byNormalizedKey) {
      if (copies.length < 2) continue;
      const confidence = computeLikelyConfidence(copies, trackMap, DEFAULT_DURATION_THRESHOLD_SEC);
      if (confidence < 0.7) continue;
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

        insertGroup.run(group.id, group.type, group.confidence, "unreviewed", summary, now, now);
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
