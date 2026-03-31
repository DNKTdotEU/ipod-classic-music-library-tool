import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AppConfig } from "./config";

export function runStartupHealthChecks(db: Database.Database, config: AppConfig): void {
  const dbDir = path.dirname(config.dbPath);
  fs.mkdirSync(dbDir, { recursive: true });
  fs.accessSync(dbDir, fs.constants.R_OK | fs.constants.W_OK);

  fs.mkdirSync(config.quarantineDir, { recursive: true });
  fs.accessSync(config.quarantineDir, fs.constants.R_OK | fs.constants.W_OK);

  db.prepare("SELECT 1").get();
  db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get();
}
