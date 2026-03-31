import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { DashboardMetrics, DuplicateGroup, QuarantineItem } from "../services/types";

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
      const parsed = row.summary ? (JSON.parse(row.summary) as GroupSummary) : { title: "Unknown", artist: "Unknown", candidates: [] };
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

  markResolved(groupId: string): boolean {
    const result = this.db
      .prepare("UPDATE duplicate_groups SET status = 'user_resolved', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), groupId);
    return result.changes > 0;
  }
}

export class QuarantineRepository {
  constructor(private readonly db: Database.Database) {}

  list(): QuarantineItem[] {
    return this.db.prepare("SELECT id, original_path, quarantined_path, reason, created_at FROM quarantine_items WHERE restored_at IS NULL AND deleted_permanently_at IS NULL ORDER BY created_at DESC").all().map((row) => {
      const r = row as {
        id: string;
        original_path: string;
        quarantined_path: string;
        reason: string;
        created_at: string;
      };
      return {
        id: r.id,
        originalPath: r.original_path,
        quarantinedPath: r.quarantined_path,
        reason: r.reason,
        createdAt: r.created_at
      };
    });
  }

  move(originalPath: string, quarantinedPath: string, reason: string): QuarantineItem {
    const id = randomUUID();
    const ts = new Date().toISOString();
    this.db.prepare(
      "INSERT INTO quarantine_items (id, original_path, quarantined_path, reason, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, originalPath, quarantinedPath, reason, ts);
    return { id, originalPath, quarantinedPath, reason, createdAt: ts };
  }

  restore(itemId: string): boolean {
    const result = this.db
      .prepare("UPDATE quarantine_items SET restored_at = ? WHERE id = ? AND restored_at IS NULL")
      .run(new Date().toISOString(), itemId);
    return result.changes > 0;
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

export class HistoryRepository {
  constructor(private readonly db: Database.Database) {}

  record(eventType: string, message: string, payload?: unknown): void {
    this.db.prepare(
      "INSERT INTO history_events (id, event_type, actor, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), eventType, "system", message, payload ? JSON.stringify(payload) : null, new Date().toISOString());
  }
}
