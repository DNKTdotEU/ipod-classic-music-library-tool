import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";
import {
  DuplicateRepository,
  QuarantineRepository,
  DashboardRepository,
  HistoryRepository,
  TrackRepository
} from "../../electron/db/repositories";
import type Database from "better-sqlite3";

function createTestDb(): Database.Database {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "repo-test-"));
  const db = getDatabase(path.join(tmp, "test.db"));
  runMigrations(db);
  return db;
}

describe("DuplicateRepository", () => {
  let repo: DuplicateRepository;

  beforeEach(() => {
    repo = new DuplicateRepository(createTestDb());
  });

  it("starts with empty list", () => {
    expect(repo.list()).toEqual([]);
  });

  it("replaces demo groups and lists them", () => {
    repo.replaceDemoGroups([{
      id: "g1", type: "exact", confidence: 1.0, status: "unreviewed",
      title: "Song", artist: "Artist",
      candidates: [{ id: "c1", path: "/a.mp3", format: "mp3", bitrate: 128000, durationSec: 200, sizeBytes: 5000000, metadataCompleteness: 0.9, hasArtwork: true }]
    }]);
    const list = repo.list();
    expect(list.length).toBe(1);
    expect(list[0]!.title).toBe("Song");
    expect(list[0]!.candidates.length).toBe(1);
  });

  it("markResolved returns false for unknown group", () => {
    expect(repo.markResolved("nonexistent")).toBe(false);
  });

  it("markResolved updates status", () => {
    repo.replaceDemoGroups([{ id: "g1", type: "exact", confidence: 1.0, status: "unreviewed", title: "S", artist: "A", candidates: [] }]);
    expect(repo.markResolved("g1")).toBe(true);
    expect(repo.list()[0]!.status).toBe("user_resolved");
  });

  it("removeCandidate removes a candidate and returns true", () => {
    repo.replaceDemoGroups([{
      id: "g1", type: "exact", confidence: 1.0, status: "unreviewed", title: "S", artist: "A",
      candidates: [
        { id: "c1", path: "/a.mp3", format: "mp3", bitrate: 128000, durationSec: 200, sizeBytes: 5000000, metadataCompleteness: 0.9, hasArtwork: false },
        { id: "c2", path: "/b.mp3", format: "mp3", bitrate: 128000, durationSec: 200, sizeBytes: 5000000, metadataCompleteness: 0.9, hasArtwork: false }
      ]
    }]);
    expect(repo.removeCandidate("g1", "c1")).toBe(true);
    expect(repo.list()[0]!.candidates.length).toBe(1);
  });

  it("removeCandidate deletes group when last candidate is removed", () => {
    repo.replaceDemoGroups([{
      id: "g1", type: "exact", confidence: 1.0, status: "unreviewed", title: "S", artist: "A",
      candidates: [{ id: "c1", path: "/a.mp3", format: "mp3", bitrate: 128000, durationSec: 200, sizeBytes: 5000000, metadataCompleteness: 0.9, hasArtwork: false }]
    }]);
    expect(repo.removeCandidate("g1", "c1")).toBe(true);
    expect(repo.list().length).toBe(0);
  });

  it("handles corrupt JSON summary gracefully", () => {
    const db = createTestDb();
    db.prepare("INSERT INTO duplicate_groups (id, duplicate_type, confidence, status, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("g1", "exact", 1.0, "unreviewed", "NOT VALID JSON", new Date().toISOString(), new Date().toISOString());
    const r = new DuplicateRepository(db);
    const list = r.list();
    expect(list.length).toBe(1);
    expect(list[0]!.title).toBe("Unknown");
  });
});

describe("QuarantineRepository", () => {
  let repo: QuarantineRepository;

  beforeEach(() => {
    repo = new QuarantineRepository(createTestDb());
  });

  it("starts with empty list", () => {
    expect(repo.list()).toEqual([]);
  });

  it("move creates item and list returns it", () => {
    const item = repo.move("/original/file.mp3", "/quarantine/abc", "duplicate");
    expect(item.originalPath).toBe("/original/file.mp3");
    expect(repo.list().length).toBe(1);
  });

  it("restore marks item as restored", () => {
    const item = repo.move("/original/file.mp3", "/quarantine/abc", "duplicate");
    expect(repo.restore(item.id)).toBe(true);
    expect(repo.list().length).toBe(0);
  });

  it("getById returns null for unknown id", () => {
    expect(repo.getById("nonexistent")).toBeNull();
  });

  it("deletePermanently marks item", () => {
    const item = repo.move("/original/file.mp3", "/quarantine/abc", "duplicate");
    expect(repo.deletePermanently(item.id)).toBe(true);
    expect(repo.list().length).toBe(0);
  });
});

describe("DashboardRepository", () => {
  it("returns zero metrics on empty db", () => {
    const db = createTestDb();
    const repo = new DashboardRepository(db);
    const m = repo.getMetrics();
    expect(m.exactDuplicates).toBe(0);
    expect(m.likelyDuplicates).toBe(0);
    expect(m.quarantinedFiles).toBe(0);
    expect(m.resolvedGroups).toBe(0);
    expect(m.unresolvedGroups).toBe(0);
  });
});

describe("HistoryRepository", () => {
  it("records and lists events", () => {
    const db = createTestDb();
    const repo = new HistoryRepository(db);
    repo.record("test_event", "Test message", { key: "value" });
    const { items, total } = repo.list(10, 0);
    expect(total).toBe(1);
    expect(items[0]!.eventType).toBe("test_event");
    expect(items[0]!.message).toBe("Test message");
    expect(items[0]!.payload).toEqual({ key: "value" });
  });

  it("paginates correctly", () => {
    const db = createTestDb();
    const repo = new HistoryRepository(db);
    for (let i = 0; i < 5; i++) {
      repo.record("evt", `Message ${i}`);
    }
    const { items, total } = repo.list(2, 0);
    expect(total).toBe(5);
    expect(items.length).toBe(2);
    const page2 = repo.list(2, 2);
    expect(page2.items.length).toBe(2);
  });
});

describe("TrackRepository", () => {
  it("upsertBatch inserts tracks and file copies", () => {
    const db = createTestDb();
    const repo = new TrackRepository(db);

    repo.upsertBatch([{
      id: "t1", title: "Test Song", artists: "Test Artist", album: "Test Album",
      albumArtist: null, trackNumber: 1, discNumber: 1, canonicalDurationSec: 200,
      year: 2024, genre: "Rock", compilation: false, artworkRef: null,
      fileCopy: {
        id: "fc1", path: "/music/test.mp3", filename: "test.mp3", format: "mp3",
        codec: "mp3", bitrate: 320000, sampleRate: 44100, channels: 2,
        durationSec: 200, sizeBytes: 8000000, modifiedAt: new Date().toISOString(),
        metadataCompleteness: 0.95, fingerprintHash: "abc123", artworkHash: null, hasArtwork: false
      }
    }]);

    expect(repo.totalTracks()).toBe(1);
    expect(repo.totalFileCopies()).toBe(1);
  });

  it("upsert updates existing record on same path", () => {
    const db = createTestDb();
    const repo = new TrackRepository(db);
    const base = {
      id: "t1", title: "Song", artists: "Artist", album: null,
      albumArtist: null, trackNumber: null, discNumber: null, canonicalDurationSec: 200,
      year: null, genre: null, compilation: false, artworkRef: null,
      fileCopy: {
        id: "fc1", path: "/music/test.mp3", filename: "test.mp3", format: "mp3",
        codec: "mp3", bitrate: 128000, sampleRate: 44100, channels: 2,
        durationSec: 200, sizeBytes: 4000000, modifiedAt: new Date().toISOString(),
        metadataCompleteness: 0.5, fingerprintHash: "abc", artworkHash: null, hasArtwork: false
      }
    };

    repo.upsertBatch([base]);
    repo.upsertBatch([{ ...base, id: "t2", title: "Updated Song", fileCopy: { ...base.fileCopy, id: "fc2", bitrate: 320000 } }]);
    expect(repo.totalTracks()).toBe(1);
    expect(repo.totalFileCopies()).toBe(1);
  });
});
