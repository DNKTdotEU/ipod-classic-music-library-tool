import { randomUUID } from "node:crypto";
import type { ProgressEvent } from "../ipc/contracts";

type JobTask = (jobId: string, emit: (event: Omit<ProgressEvent, "jobId">) => void) => Promise<void>;

export class JobCoordinator {
  private readonly jobs = new Map<string, { cancelled: boolean }>();

  run(task: JobTask, onEvent: (event: ProgressEvent) => void): string {
    const jobId = randomUUID();
    this.jobs.set(jobId, { cancelled: false });
    void task(jobId, (event) => {
      if (this.jobs.get(jobId)?.cancelled) return;
      onEvent({ ...event, jobId });
    }).finally(() => this.jobs.delete(jobId));
    return jobId;
  }

  cancel(jobId: string): boolean {
    const found = this.jobs.get(jobId);
    if (!found) return false;
    found.cancelled = true;
    return true;
  }
}
