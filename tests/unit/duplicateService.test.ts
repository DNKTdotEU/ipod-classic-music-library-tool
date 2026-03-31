import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";
import { DuplicateRepository, HistoryRepository } from "../../electron/db/repositories";
import { DuplicateService } from "../../electron/services/duplicateService";
import type { DuplicateGroup } from "../../electron/services/types";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dup-svc-test-"));
}

function makeCandidate(id: string, filePath: string) {
  return {
    id,
    path: filePath,
    format: "mp3",
    bitrate: 128000,
    durationSec: 180,
    sizeBytes: 4_000_000,
    metadataCompleteness: 1,
    hasArtwork: false
  };
}

describe("DuplicateService", () => {
  let service: DuplicateService;
  let duplicateRepository: DuplicateRepository;
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
    const dbPath = path.join(tmp, "test.db");
    const db = getDatabase(dbPath);
    runMigrations(db);
    duplicateRepository = new DuplicateRepository(db);
    const historyRepository = new HistoryRepository(db);
    service = new DuplicateService(duplicateRepository, historyRepository);
  });

  describe("applyDecision", () => {
    it("returns error for unknown group", async () => {
      const result = await service.applyDecision("none", "none");
      expect(result).toEqual({ ok: false, reason: "Group not found" });
    });

    it("returns error when keepFileId not in group", async () => {
      const group: DuplicateGroup = {
        id: "g1",
        type: "likely",
        confidence: 0.9,
        status: "unreviewed",
        title: "t",
        artist: "a",
        candidates: [makeCandidate("f1", "/x")]
      };
      duplicateRepository.replaceDemoGroups([group]);
      const result = await service.applyDecision("g1", "unknown-id");
      expect(result).toEqual({ ok: false, reason: "Keep file not found in group" });
    });

    it("deletes other candidates from disk and marks group resolved", async () => {
      const keepFile = path.join(tmp, "keep.mp3");
      const deleteFile1 = path.join(tmp, "delete1.mp3");
      const deleteFile2 = path.join(tmp, "delete2.mp3");
      fs.writeFileSync(keepFile, "keep");
      fs.writeFileSync(deleteFile1, "del1");
      fs.writeFileSync(deleteFile2, "del2");

      const group: DuplicateGroup = {
        id: "g1",
        type: "exact",
        confidence: 1,
        status: "unreviewed",
        title: "Song",
        artist: "Artist",
        candidates: [
          makeCandidate("f-keep", keepFile),
          makeCandidate("f-del1", deleteFile1),
          makeCandidate("f-del2", deleteFile2)
        ]
      };
      duplicateRepository.replaceDemoGroups([group]);

      const result = await service.applyDecision("g1", "f-keep");
      expect(result).toEqual({
        ok: true,
        deleted: [deleteFile1, deleteFile2],
        failed: []
      });

      expect(fs.existsSync(keepFile)).toBe(true);
      expect(fs.existsSync(deleteFile1)).toBe(false);
      expect(fs.existsSync(deleteFile2)).toBe(false);

      const updated = duplicateRepository.list().find((g) => g.id === "g1");
      expect(updated?.status).toBe("user_resolved");
    });

    it("reports failed paths when files cannot be deleted", async () => {
      const keepFile = path.join(tmp, "keep.mp3");
      fs.writeFileSync(keepFile, "keep");
      const missingFile = path.join(tmp, "does-not-exist.mp3");

      const group: DuplicateGroup = {
        id: "g1",
        type: "exact",
        confidence: 1,
        status: "unreviewed",
        title: "Song",
        artist: "Artist",
        candidates: [
          makeCandidate("f-keep", keepFile),
          makeCandidate("f-missing", missingFile)
        ]
      };
      duplicateRepository.replaceDemoGroups([group]);

      const result = await service.applyDecision("g1", "f-keep");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deleted).toEqual([]);
        expect(result.failed).toEqual([missingFile]);
      }

      const updated = duplicateRepository.list().find((g) => g.id === "g1");
      expect(updated?.status).toBe("user_resolved");
    });

    it("still succeeds when group was already user_resolved", async () => {
      const group: DuplicateGroup = {
        id: "g2",
        type: "likely",
        confidence: 0.9,
        status: "user_resolved",
        title: "t",
        artist: "a",
        candidates: [makeCandidate("f1", "/x")]
      };
      duplicateRepository.replaceDemoGroups([group]);
      const result = await service.applyDecision("g2", "f1");
      expect(result.ok).toBe(true);
    });
  });

  describe("deleteCandidateFile", () => {
    it("deletes an existing media file and updates the group", async () => {
      const filePath = path.join(tmp, "track.mp3");
      fs.writeFileSync(filePath, "audio data");

      const group: DuplicateGroup = {
        id: "g1",
        type: "exact",
        confidence: 1,
        status: "unreviewed",
        title: "Song",
        artist: "Artist",
        candidates: [
          makeCandidate("f1", filePath),
          makeCandidate("f2", path.join(tmp, "other.mp3"))
        ]
      };
      duplicateRepository.replaceDemoGroups([group]);

      const result = await service.deleteCandidateFile("g1", "f1");
      expect(result).toEqual({ ok: true });
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("returns error for unknown group", async () => {
      const result = await service.deleteCandidateFile("none", "none");
      expect(result).toEqual({ ok: false, reason: "Group not found" });
    });
  });
});
