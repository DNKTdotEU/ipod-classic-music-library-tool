import type { DuplicateGroup } from "./types";
import { DuplicateRepository, HistoryRepository } from "../db/repositories";

export class DuplicateService {
  constructor(
    private readonly duplicateRepository: DuplicateRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  getGroups(): DuplicateGroup[] {
    return this.duplicateRepository.list();
  }

  applyDecision(groupId: string, keepFileId: string): boolean {
    const group = this.duplicateRepository.list().find((item) => item.id === groupId);
    if (!group) return false;
    const keepExists = group.candidates.some((item) => item.id === keepFileId);
    if (!keepExists) return false;
    const changed = this.duplicateRepository.markResolved(groupId);
    if (changed) {
      this.historyRepository.record("decision_applied", "Duplicate decision applied", { groupId, keepFileId });
    }
    return changed;
  }
}
