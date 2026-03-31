import type { JobType, ProgressPhase } from "../ipc/types";

export const PHASE_LABEL: Record<ProgressPhase, string> = {
  scan: "Scan",
  analyze: "Analyze",
  group: "Group",
  finalize: "Finalize",
  prepare: "Prepare",
  process: "Process",
  commit: "Commit"
};

export const JOB_PANEL_TITLE: Record<JobType, string> = {
  scan: "Library scan",
  bulk_duplicate: "Duplicate index refresh",
  metadata_batch: "Metadata batch",
  artwork_batch: "Artwork batch"
};
