import { randomUUID } from "node:crypto";
import type { QuarantineItem } from "./types.js";
import { HistoryRepository, QuarantineRepository } from "../db/repositories.js";
import fs from "node:fs";
import path from "node:path";

export class QuarantineService {
  constructor(
    private readonly quarantineRepository: QuarantineRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly quarantineDir: string
  ) {}

  getItems(): QuarantineItem[] {
    return this.quarantineRepository.list();
  }

  move(originalPath: string, reason: string): QuarantineItem {
    fs.mkdirSync(this.quarantineDir, { recursive: true });
    const ext = path.extname(originalPath);
    const quarantinedPath = path.join(this.quarantineDir, randomUUID() + ext);
    fs.copyFileSync(originalPath, quarantinedPath);
    fs.unlinkSync(originalPath);
    const item = this.quarantineRepository.move(originalPath, quarantinedPath, reason);
    this.historyRepository.record("quarantine_move", "File moved to quarantine", item);
    return item;
  }

  restore(itemId: string): { ok: true } | { ok: false; reason: string } {
    const item = this.quarantineRepository.getById(itemId);
    if (!item) return { ok: false, reason: "Quarantine item not found" };
    if (!fs.existsSync(item.quarantinedPath)) {
      return { ok: false, reason: "Quarantined file no longer exists on disk" };
    }
    const destDir = path.dirname(item.originalPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(item.quarantinedPath, item.originalPath);
    fs.unlinkSync(item.quarantinedPath);
    this.quarantineRepository.restore(itemId);
    this.historyRepository.record("quarantine_restore", "File restored from quarantine", { itemId });
    return { ok: true };
  }

  deletePermanently(itemId: string): { ok: true } | { ok: false; reason: string } {
    const item = this.quarantineRepository.getById(itemId);
    if (!item) return { ok: false, reason: "Quarantine item not found" };
    if (fs.existsSync(item.quarantinedPath)) {
      fs.unlinkSync(item.quarantinedPath);
    }
    this.quarantineRepository.deletePermanently(itemId);
    this.historyRepository.record("quarantine_delete", "File permanently deleted from quarantine", { itemId, originalPath: item.originalPath });
    return { ok: true };
  }
}
