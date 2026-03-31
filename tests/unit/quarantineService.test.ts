import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";
import { QuarantineRepository, HistoryRepository } from "../../electron/db/repositories";
import { QuarantineService } from "../../electron/services/quarantineService";

describe("QuarantineService", () => {
  let service: QuarantineService;
  let tmpDir: string;
  let quarantineDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "q-svc-test-"));
    quarantineDir = path.join(tmpDir, "quarantine");
    const dbPath = path.join(tmpDir, "test.db");
    const db = getDatabase(dbPath);
    runMigrations(db);
    const quarantineRepo = new QuarantineRepository(db);
    const historyRepo = new HistoryRepository(db);
    service = new QuarantineService(quarantineRepo, historyRepo, quarantineDir);
  });

  it("move copies file to quarantine and removes original", () => {
    const original = path.join(tmpDir, "song.mp3");
    fs.writeFileSync(original, "fake audio data");
    const item = service.move(original, "duplicate");
    expect(fs.existsSync(original)).toBe(false);
    expect(fs.existsSync(item.quarantinedPath)).toBe(true);
    expect(item.reason).toBe("duplicate");
  });

  it("restore copies file back and removes quarantined copy", () => {
    const original = path.join(tmpDir, "song.mp3");
    fs.writeFileSync(original, "fake audio data");
    const item = service.move(original, "duplicate");
    expect(fs.existsSync(original)).toBe(false);

    const result = service.restore(item.id);
    expect(result).toEqual({ ok: true });
    expect(fs.existsSync(original)).toBe(true);
    expect(fs.existsSync(item.quarantinedPath)).toBe(false);
  });

  it("restore returns error for unknown item", () => {
    const result = service.restore("nonexistent");
    expect(result).toEqual({ ok: false, reason: "Quarantine item not found" });
  });

  it("deletePermanently removes quarantined file", () => {
    const original = path.join(tmpDir, "song.mp3");
    fs.writeFileSync(original, "fake audio data");
    const item = service.move(original, "duplicate");
    const result = service.deletePermanently(item.id);
    expect(result).toEqual({ ok: true });
    expect(fs.existsSync(item.quarantinedPath)).toBe(false);
  });

  it("getItems returns active quarantine items", () => {
    const original = path.join(tmpDir, "song.mp3");
    fs.writeFileSync(original, "fake audio data");
    service.move(original, "duplicate");
    expect(service.getItems().length).toBe(1);
  });
});
