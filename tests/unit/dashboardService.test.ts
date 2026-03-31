import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";
import { DashboardRepository, DuplicateRepository, QuarantineRepository } from "../../electron/db/repositories";
import { DashboardService } from "../../electron/services/dashboardService";
import type Database from "better-sqlite3";

describe("DashboardService", () => {
  let db: Database.Database;
  let service: DashboardService;

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash-test-"));
    db = getDatabase(path.join(tmp, "test.db"));
    runMigrations(db);
    service = new DashboardService(new DashboardRepository(db));
  });

  it("returns all-zero metrics on empty database", () => {
    const m = service.getMetrics();
    expect(m.exactDuplicates).toBe(0);
    expect(m.likelyDuplicates).toBe(0);
    expect(m.quarantinedFiles).toBe(0);
    expect(m.resolvedGroups).toBe(0);
    expect(m.unresolvedGroups).toBe(0);
  });

  it("counts duplicate groups by type", () => {
    const dupRepo = new DuplicateRepository(db);
    dupRepo.replaceDemoGroups([
      { id: "g1", type: "exact", confidence: 1.0, status: "unreviewed", title: "S", artist: "A", candidates: [] },
      { id: "g2", type: "likely", confidence: 0.9, status: "unreviewed", title: "S", artist: "A", candidates: [] }
    ]);
    const m = service.getMetrics();
    expect(m.exactDuplicates).toBe(1);
    expect(m.likelyDuplicates).toBe(1);
    expect(m.unresolvedGroups).toBe(2);
  });

  it("counts quarantined files", () => {
    const qRepo = new QuarantineRepository(db);
    qRepo.move("/a.mp3", "/q/a", "dup");
    qRepo.move("/b.mp3", "/q/b", "dup");
    const m = service.getMetrics();
    expect(m.quarantinedFiles).toBe(2);
  });
});
