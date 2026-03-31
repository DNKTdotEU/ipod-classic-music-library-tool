import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";
import { DuplicateDetectionService } from "../../electron/services/duplicateDetectionService";
import type Database from "better-sqlite3";

function createTestDb(): Database.Database {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dup-detect-"));
  const db = getDatabase(path.join(tmp, "test.db"));
  runMigrations(db);
  return db;
}

function insertTrackAndCopy(
  db: Database.Database,
  trackId: string,
  copyId: string,
  opts: { title: string; artist: string; path: string; hash: string; duration: number; album?: string }
): void {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO tracks (id, title, artists, album, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(trackId, opts.title, opts.artist, opts.album ?? null, now, now);
  db.prepare(
    "INSERT INTO file_copies (id, track_id, path, filename, format, duration_sec, size_bytes, modified_at, metadata_completeness, fingerprint_hash, has_artwork) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(copyId, trackId, opts.path, path.basename(opts.path), "mp3", opts.duration, 5000000, now, 0.9, opts.hash, 0);
}

describe("DuplicateDetectionService", () => {
  let db: Database.Database;
  let service: DuplicateDetectionService;

  beforeEach(() => {
    db = createTestDb();
    service = new DuplicateDetectionService(db);
  });

  it("returns zero groups on empty database", () => {
    const result = service.detect();
    expect(result.exactGroups).toBe(0);
    expect(result.likelyGroups).toBe(0);
  });

  it("detects exact duplicates by hash", () => {
    insertTrackAndCopy(db, "t1", "c1", { title: "Song", artist: "Artist", path: "/a.mp3", hash: "same_hash", duration: 200 });
    insertTrackAndCopy(db, "t1", "c2", { title: "Song", artist: "Artist", path: "/b.mp3", hash: "same_hash", duration: 200 });

    const result = service.detect();
    expect(result.exactGroups).toBe(1);

    const groups = db.prepare("SELECT * FROM duplicate_groups WHERE duplicate_type = 'exact'").all();
    expect(groups.length).toBe(1);

    const items = db.prepare("SELECT * FROM duplicate_group_items").all();
    expect(items.length).toBe(2);
  });

  it("detects likely duplicates by title+artist", () => {
    insertTrackAndCopy(db, "t1", "c1", { title: "Song", artist: "Artist", path: "/a.mp3", hash: "hash1", duration: 200 });
    insertTrackAndCopy(db, "t2", "c2", { title: "Song", artist: "Artist", path: "/b.flac", hash: "hash2", duration: 201 });

    const result = service.detect();
    expect(result.exactGroups).toBe(0);
    expect(result.likelyGroups).toBe(1);
  });

  it("does not create groups for single files", () => {
    insertTrackAndCopy(db, "t1", "c1", { title: "Song A", artist: "Artist A", path: "/a.mp3", hash: "hash1", duration: 200 });
    insertTrackAndCopy(db, "t2", "c2", { title: "Song B", artist: "Artist B", path: "/b.mp3", hash: "hash2", duration: 300 });

    const result = service.detect();
    expect(result.exactGroups).toBe(0);
    expect(result.likelyGroups).toBe(0);
  });

  it("files in exact groups are excluded from likely groups", () => {
    insertTrackAndCopy(db, "t1", "c1", { title: "Song", artist: "Artist", path: "/a.mp3", hash: "same_hash", duration: 200 });
    insertTrackAndCopy(db, "t1", "c2", { title: "Song", artist: "Artist", path: "/b.mp3", hash: "same_hash", duration: 200 });

    const result = service.detect();
    expect(result.exactGroups).toBe(1);
    expect(result.likelyGroups).toBe(0);
  });
});
