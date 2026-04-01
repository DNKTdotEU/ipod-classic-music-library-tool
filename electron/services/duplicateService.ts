import fs from "node:fs/promises";

import type { DuplicateGroup } from "./types.js";
import { DuplicateRepository, HistoryRepository, TrackRepository } from "../db/repositories.js";
import { isMediaFilePath } from "../media/fileMedia.js";

export class DuplicateService {
  constructor(
    private readonly duplicateRepository: DuplicateRepository,
    private readonly historyRepository: HistoryRepository,
    private readonly trackRepository: TrackRepository
  ) {}

  getGroups(): DuplicateGroup[] {
    return this.duplicateRepository.list();
  }

  async applyDecision(
    groupId: string,
    keepFileId: string
  ): Promise<{ ok: true; deleted: string[]; failed: string[]; resolved: boolean } | { ok: false; reason: string }> {
    const group = this.duplicateRepository.list().find((item) => item.id === groupId);
    if (!group) return { ok: false, reason: "Group not found" };
    const keepExists = group.candidates.some((item) => item.id === keepFileId);
    if (!keepExists) return { ok: false, reason: "Keep file not found in group" };

    const others = group.candidates.filter((c) => c.id !== keepFileId);
    const deleted: string[] = [];
    const failed: string[] = [];
    const failedIds = new Set<string>();

    for (const candidate of others) {
      try {
        await fs.unlink(candidate.path);
        this.trackRepository.removeFileCopyByPath(candidate.path);
        deleted.push(candidate.path);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failed.push(`${candidate.path} (${reason})`);
        failedIds.add(candidate.id);
      }
    }

    const remainingCount = 1 + failed.length;
    const resolved = remainingCount < 2;
    const remainingCandidates = group.candidates.filter((candidate) => candidate.id === keepFileId || failedIds.has(candidate.id));
    this.duplicateRepository.replaceCandidates(groupId, remainingCandidates, resolved ? "user_resolved" : "unreviewed");
    this.historyRepository.record("decision_applied", "Duplicate decision applied — kept file, deleted others", {
      groupId,
      keepFileId,
      deleted,
      failed,
      resolved
    });
    return { ok: true, deleted, failed, resolved };
  }

  skipGroup(groupId: string): { ok: true } | { ok: false; reason: string } {
    const group = this.duplicateRepository.list().find((g) => g.id === groupId);
    if (!group) return { ok: false, reason: "Group not found" };
    this.duplicateRepository.markResolved(groupId);
    this.historyRepository.record("group_skipped", "Duplicate group skipped — no files deleted", { groupId });
    return { ok: true };
  }

  /**
   * Permanently delete a duplicate candidate file from disk and update the group.
   * Only audio/video paths are allowed.
   */
  async deleteCandidateFile(groupId: string, fileId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const group = this.duplicateRepository.list().find((g) => g.id === groupId);
    if (!group) return { ok: false, reason: "Group not found" };
    const candidate = group.candidates.find((c) => c.id === fileId);
    if (!candidate) return { ok: false, reason: "File not found in group" };
    if (!isMediaFilePath(candidate.path)) {
      return { ok: false, reason: "Only audio/video files can be removed from this view" };
    }
    try {
      await fs.unlink(candidate.path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Could not delete file: ${msg}` };
    }
    this.trackRepository.removeFileCopyByPath(candidate.path);
    const updated = this.duplicateRepository.removeCandidate(groupId, fileId);
    if (!updated) return { ok: false, reason: "Failed to update library after delete" };
    this.historyRepository.record("duplicate_file_deleted", "Removed duplicate candidate file from disk", {
      groupId,
      fileId,
      path: candidate.path
    });
    return { ok: true };
  }
}
