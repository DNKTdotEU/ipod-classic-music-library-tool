import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { DashboardMetrics, DuplicateGroup, QuarantineItem } from "../services/types.js";

type GroupSummary = {
  title: string;
  artist: string;
  candidates: DuplicateGroup["candidates"];
};

export class DuplicateRepository {
  constructor(private readonly db: Database.Database) {}

  replaceDemoGroups(groups: DuplicateGroup[]) {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM duplicate_group_items").run();
      this.db.prepare("DELETE FROM duplicate_groups").run();
      for (const group of groups) {
        this.db.prepare(
          "INSERT INTO duplicate_groups (id, duplicate_type, confidence, status, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          group.id,
          group.type,
          group.confidence,
          group.status,
          JSON.stringify({ title: group.title, artist: group.artist, candidates: group.candidates } satisfies GroupSummary),
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    });
    tx();
  }

  list(): DuplicateGroup[] {
    const rows = this.db.prepare("SELECT id, duplicate_type, confidence, status, summary FROM duplicate_groups").all() as Array<{
      id: string;
      duplicate_type: "exact" | "likely";
      confidence: number;
      status: DuplicateGroup["status"];
      summary: string | null;
    }>;
    return rows.map((row) => {
      let parsed: GroupSummary = { title: "Unknown", artist: "Unknown", candidates: [] };
      if (row.summary) {
        try {
          parsed = JSON.parse(row.summary) as GroupSummary;
        } catch {
          /* corrupt JSON — use defaults */
        }
      }
      return {
        id: row.id,
        type: row.duplicate_type,
        confidence: row.confidence,
        status: row.status,
        title: parsed.title,
        artist: parsed.artist,
        candidates: parsed.candidates
      };
    });
  }

  /**
   * Marks group as user-resolved. Returns false only if the group id does not exist.
   * (SQLite can report 0 rows changed when status was already user_resolved — we still treat that as success.)
   */
  markResolved(groupId: string): boolean {
    const exists = this.db.prepare("SELECT 1 FROM duplicate_groups WHERE id = ?").get(groupId);
    if (!exists) return false;
    this.db
      .prepare("UPDATE duplicate_groups SET status = 'user_resolved', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), groupId);
    return true;
  }

  /** Remove one candidate from the JSON summary, or delete the row if none remain. */
  removeCandidate(groupId: string, fileId: string): boolean {
    const row = this.db.prepare("SELECT id, duplicate_type, confidence, status, summary FROM duplicate_groups WHERE id = ?").get(groupId) as
      | {
          id: string;
          duplicate_type: "exact" | "likely";
          confidence: number;
          status: DuplicateGroup["status"];
          summary: string | null;
        }
      | undefined;
    if (!row) return false;
    let parsed: GroupSummary = { title: "Unknown", artist: "Unknown", candidates: [] };
    if (row.summary) {
      try {
        parsed = JSON.parse(row.summary) as GroupSummary;
      } catch {
        /* corrupt JSON — treat as empty */
      }
    }
    const nextCandidates = parsed.candidates.filter((c) => c.id !== fileId);
    if (nextCandidates.length === parsed.candidates.length) return false;
    this.db.prepare("DELETE FROM duplicate_group_items WHERE group_id = ? AND file_copy_id = ?").run(groupId, fileId);
    if (nextCandidates.length < 2) {
      this.db.prepare("DELETE FROM duplicate_groups WHERE id = ?").run(groupId);
      return true;
    }
    const updated: GroupSummary = { ...parsed, candidates: nextCandidates };
    this.db
      .prepare("UPDATE duplicate_groups SET summary = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(updated), new Date().toISOString(), groupId);
    return true;
  }

  replaceCandidates(groupId: string, candidates: DuplicateGroup["candidates"], status: DuplicateGroup["status"]): boolean {
    const row = this.db.prepare("SELECT id, summary FROM duplicate_groups WHERE id = ?").get(groupId) as
      | { id: string; summary: string | null }
      | undefined;
    if (!row) return false;
    let parsed: GroupSummary = { title: "Unknown", artist: "Unknown", candidates: [] };
    if (row.summary) {
      try {
        parsed = JSON.parse(row.summary) as GroupSummary;
      } catch {
        /* corrupt JSON — use defaults */
      }
    }
    const updated: GroupSummary = { ...parsed, candidates };
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM duplicate_group_items WHERE group_id = ?").run(groupId);
      const insertItem = this.db.prepare("INSERT INTO duplicate_group_items (group_id, file_copy_id) VALUES (?, ?)");
      for (const candidate of candidates) {
        insertItem.run(groupId, candidate.id);
      }
      this.db
        .prepare("UPDATE duplicate_groups SET summary = ?, status = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(updated), status, new Date().toISOString(), groupId);
    });
    tx();
    return true;
  }
}

export class QuarantineRepository {
  constructor(private readonly db: Database.Database) {}

  list(): QuarantineItem[] {
    const rows = this.db
      .prepare(
        "SELECT id, original_path, quarantined_path, reason, created_at FROM quarantine_items WHERE restored_at IS NULL AND deleted_permanently_at IS NULL ORDER BY created_at DESC"
      )
      .all() as Array<{
      id: string;
      original_path: string;
      quarantined_path: string;
      reason: string;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      originalPath: row.original_path,
      quarantinedPath: row.quarantined_path,
      reason: row.reason,
      createdAt: row.created_at
    }));
  }

  move(originalPath: string, quarantinedPath: string, reason: string): QuarantineItem {
    const id = randomUUID();
    const ts = new Date().toISOString();
    this.db.prepare(
      "INSERT INTO quarantine_items (id, original_path, quarantined_path, reason, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, originalPath, quarantinedPath, reason, ts);
    return { id, originalPath, quarantinedPath, reason, createdAt: ts };
  }

  getById(itemId: string): QuarantineItem | null {
    const row = this.db
      .prepare("SELECT id, original_path, quarantined_path, reason, created_at FROM quarantine_items WHERE id = ? AND restored_at IS NULL AND deleted_permanently_at IS NULL")
      .get(itemId) as { id: string; original_path: string; quarantined_path: string; reason: string; created_at: string } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      originalPath: row.original_path,
      quarantinedPath: row.quarantined_path,
      reason: row.reason,
      createdAt: row.created_at
    };
  }

  restore(itemId: string): boolean {
    const result = this.db
      .prepare("UPDATE quarantine_items SET restored_at = ? WHERE id = ? AND restored_at IS NULL")
      .run(new Date().toISOString(), itemId);
    return result.changes > 0;
  }

  deletePermanently(itemId: string): boolean {
    const result = this.db
      .prepare("UPDATE quarantine_items SET deleted_permanently_at = ? WHERE id = ? AND deleted_permanently_at IS NULL")
      .run(new Date().toISOString(), itemId);
    return result.changes > 0;
  }
}

export class TrackRepository {
  constructor(private readonly db: Database.Database) {}

  upsertBatch(
    tracks: Array<{
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
    }>
  ): void {
    const insertTrack = this.db.prepare(`
      INSERT INTO tracks (id, title, artists, album, album_artist, track_number, disc_number, canonical_duration_sec, year, genre, compilation, artwork_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, artists=excluded.artists, album=excluded.album, album_artist=excluded.album_artist, track_number=excluded.track_number, disc_number=excluded.disc_number, canonical_duration_sec=excluded.canonical_duration_sec, year=excluded.year, genre=excluded.genre, compilation=excluded.compilation, artwork_ref=excluded.artwork_ref, updated_at=excluded.updated_at
    `);
    const findExistingCopy = this.db.prepare("SELECT id, track_id FROM file_copies WHERE path = ?");
    const insertCopy = this.db.prepare(`
      INSERT INTO file_copies (id, track_id, path, filename, format, codec, bitrate, sample_rate, channels, duration_sec, size_bytes, modified_at, metadata_completeness, fingerprint_hash, artwork_hash, has_artwork)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET track_id=excluded.track_id, filename=excluded.filename, format=excluded.format, codec=excluded.codec, bitrate=excluded.bitrate, sample_rate=excluded.sample_rate, channels=excluded.channels, duration_sec=excluded.duration_sec, size_bytes=excluded.size_bytes, modified_at=excluded.modified_at, metadata_completeness=excluded.metadata_completeness, fingerprint_hash=excluded.fingerprint_hash, artwork_hash=excluded.artwork_hash, has_artwork=excluded.has_artwork
    `);

    const tx = this.db.transaction(() => {
      const now = new Date().toISOString();
      for (const t of tracks) {
        const existing = findExistingCopy.get(t.fileCopy.path) as { id: string; track_id: string } | undefined;
        const trackId = existing?.track_id ?? t.id;

        insertTrack.run(
          trackId, t.title, t.artists, t.album, t.albumArtist,
          t.trackNumber, t.discNumber, t.canonicalDurationSec,
          t.year, t.genre, t.compilation ? 1 : 0, t.artworkRef,
          now, now
        );
        insertCopy.run(
          existing?.id ?? t.fileCopy.id, trackId, t.fileCopy.path, t.fileCopy.filename,
          t.fileCopy.format, t.fileCopy.codec, t.fileCopy.bitrate,
          t.fileCopy.sampleRate, t.fileCopy.channels, t.fileCopy.durationSec,
          t.fileCopy.sizeBytes, t.fileCopy.modifiedAt, t.fileCopy.metadataCompleteness,
          t.fileCopy.fingerprintHash, t.fileCopy.artworkHash, t.fileCopy.hasArtwork ? 1 : 0
        );
      }
    });
    tx();
  }

  removeFileCopyByPath(filePath: string): boolean {
    const tx = this.db.transaction(() => {
      const deleted = this.db.prepare("DELETE FROM file_copies WHERE path = ?").run(filePath);
      if (deleted.changes === 0) return false;
      this.db.prepare("DELETE FROM tracks WHERE id NOT IN (SELECT DISTINCT track_id FROM file_copies)").run();
      return true;
    });
    return tx();
  }

  /**
   * Delete file_copies whose paths are not in the valid set, then delete
   * orphan tracks with no remaining file_copies. Returns the number of
   * pruned file_copy rows.
   */
  pruneStaleFileCopies(validPaths: Set<string>): number {
    const allCopies = this.db.prepare("SELECT id, path FROM file_copies").all() as Array<{ id: string; path: string }>;
    const staleIds = allCopies.filter((row) => !validPaths.has(row.path)).map((row) => row.id);
    if (staleIds.length === 0) return 0;

    const tx = this.db.transaction(() => {
      const del = this.db.prepare("DELETE FROM file_copies WHERE id = ?");
      for (const id of staleIds) del.run(id);
      this.db.prepare("DELETE FROM tracks WHERE id NOT IN (SELECT DISTINCT track_id FROM file_copies)").run();
    });
    tx();
    return staleIds.length;
  }

  clearAll(): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM duplicate_group_items").run();
      this.db.prepare("DELETE FROM duplicate_groups").run();
      this.db.prepare("DELETE FROM file_copies").run();
      this.db.prepare("DELETE FROM tracks").run();
    });
    tx();
  }

  totalTracks(): number {
    return (this.db.prepare("SELECT COUNT(*) as c FROM tracks").get() as { c: number }).c;
  }

  totalFileCopies(): number {
    return (this.db.prepare("SELECT COUNT(*) as c FROM file_copies").get() as { c: number }).c;
  }
}

export class DashboardRepository {
  constructor(private readonly db: Database.Database) {}

  getMetrics(): DashboardMetrics {
    const dupCounts = this.db.prepare("SELECT duplicate_type as type, COUNT(*) as count FROM duplicate_groups GROUP BY duplicate_type").all() as Array<{ type: "exact" | "likely"; count: number }>;
    const unresolved = (this.db.prepare("SELECT COUNT(*) as c FROM duplicate_groups WHERE status != 'user_resolved'").get() as { c: number }).c;
    const resolved = (this.db.prepare("SELECT COUNT(*) as c FROM duplicate_groups WHERE status = 'user_resolved'").get() as { c: number }).c;
    const quarantined = (this.db.prepare("SELECT COUNT(*) as c FROM quarantine_items WHERE restored_at IS NULL AND deleted_permanently_at IS NULL").get() as { c: number }).c;
    return {
      exactDuplicates: dupCounts.find((x) => x.type === "exact")?.count ?? 0,
      likelyDuplicates: dupCounts.find((x) => x.type === "likely")?.count ?? 0,
      metadataIssues: 0,
      artworkIssues: 0,
      quarantinedFiles: quarantined,
      resolvedGroups: resolved,
      unresolvedGroups: unresolved
    };
  }
}

export type HistoryEvent = {
  id: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

export class HistoryRepository {
  constructor(private readonly db: Database.Database) {}

  record(eventType: string, message: string, payload?: unknown): void {
    this.db.prepare(
      "INSERT INTO history_events (id, event_type, actor, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), eventType, "system", message, payload ? JSON.stringify(payload) : null, new Date().toISOString());
  }

  list(limit: number, offset: number): { items: HistoryEvent[]; total: number } {
    const total = (this.db.prepare("SELECT COUNT(*) as c FROM history_events").get() as { c: number }).c;
    const rows = this.db
      .prepare("SELECT id, event_type, actor, message, payload_json, created_at FROM history_events ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(limit, offset) as Array<{
        id: string;
        event_type: string;
        actor: string;
        message: string;
        payload_json: string | null;
        created_at: string;
      }>;
    return {
      total,
      items: rows.map((row) => {
        let payload: unknown = null;
        if (row.payload_json) {
          try { payload = JSON.parse(row.payload_json); } catch { /* ignore */ }
        }
        return {
          id: row.id,
          eventType: row.event_type,
          actor: row.actor,
          message: row.message,
          payload,
          createdAt: row.created_at
        };
      })
    };
  }
}
