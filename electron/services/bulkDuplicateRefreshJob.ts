import type { ProgressPayload } from "../ipc/contracts.js";
import type { HistoryRepository } from "../db/repositories.js";
import { DuplicateDetectionService } from "./duplicateDetectionService.js";

export async function runBulkDuplicateRefresh(
  jobId: string,
  duplicateDetectionService: DuplicateDetectionService,
  historyRepository: HistoryRepository,
  onProgress: (event: ProgressPayload) => void,
  isCancelled: () => boolean
): Promise<void> {
  if (isCancelled()) {
    onProgress({ phase: "prepare", processed: 0, total: 1, message: "Refresh cancelled", status: "cancelled" });
    return;
  }

  onProgress({ phase: "prepare", processed: 0, total: 1, message: "Re-analyzing duplicate groups…" });

  const result = duplicateDetectionService.detect(onProgress, isCancelled);

  if (isCancelled()) {
    onProgress({ phase: "commit", processed: 1, total: 1, message: "Refresh cancelled", status: "cancelled" });
    return;
  }

  historyRepository.record("duplicate_index_refreshed", "Duplicate index refreshed", {
    jobId,
    exactGroups: result.exactGroups,
    likelyGroups: result.likelyGroups
  });

  onProgress({
    phase: "commit",
    processed: 1,
    total: 1,
    message: `Refresh complete — ${result.exactGroups} exact and ${result.likelyGroups} likely duplicate groups.`,
    status: "completed"
  });
}
