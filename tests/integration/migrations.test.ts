import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDatabase } from "../../electron/db/client";
import { runMigrations } from "../../electron/db/migrate";

describe("migrations", () => {
  it("applies initial schema", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ipod-tool-"));
    const db = getDatabase(path.join(tmp, "test.db"));
    runMigrations(db);
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tracks'").all();
    expect(rows.length).toBe(1);
    const applied = db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number };
    expect(applied.c).toBeGreaterThan(0);
  });
});
