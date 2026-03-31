import { randomUUID } from "node:crypto";
import type { QuarantineItem } from "./types";
import { HistoryRepository, QuarantineRepository } from "../db/repositories";
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
    const quarantinedPath = path.join(this.quarantineDir, randomUUID());
    const item = this.quarantineRepository.move(originalPath, quarantinedPath, reason);
    this.historyRepository.record("quarantine_move", "File moved to quarantine", item);
    return item;
  }

  restore(itemId: string): boolean {
    const restored = this.quarantineRepository.restore(itemId);
    if (restored) {
      this.historyRepository.record("quarantine_restore", "File restored from quarantine", { itemId });
    }
    return restored;
  }
}
