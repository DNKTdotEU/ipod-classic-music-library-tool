import { randomUUID } from "node:crypto";
import type { JobType, ProgressEvent, ProgressPayload } from "../ipc/contracts.js";

type JobTask = (
  jobId: string,
  emit: (event: ProgressPayload) => void,
  isCancelled: () => boolean
) => Promise<void>;

export class JobCoordinator {
  private readonly jobs = new Map<string, { cancelled: boolean }>();

  run(jobType: JobType, task: JobTask, onEvent: (event: ProgressEvent) => void): string {
    const jobId = randomUUID();
    this.jobs.set(jobId, { cancelled: false });
    const emit = (event: ProgressPayload) => {
      if (this.jobs.get(jobId)?.cancelled) return;
      onEvent({ ...event, jobId, jobType, status: event.status ?? "running" });
    };
    task(jobId, emit, () => this.jobs.get(jobId)?.cancelled === true)
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({
          jobId,
          jobType,
          phase: "finalize",
          processed: 0,
          total: 1,
          message: `Job failed: ${message}`,
          status: "error"
        });
      })
      .finally(() => this.jobs.delete(jobId));
    return jobId;
  }

  cancel(jobId: string): boolean {
    const found = this.jobs.get(jobId);
    if (!found) return false;
    found.cancelled = true;
    return true;
  }
}
