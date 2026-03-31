import { describe, expect, it, vi } from "vitest";
import { JobCoordinator } from "../../electron/core/jobCoordinator";
import type { ProgressEvent } from "../../electron/ipc/contracts";

describe("JobCoordinator", () => {
  it("returns a job id and emits progress events", async () => {
    const coordinator = new JobCoordinator();
    const events: ProgressEvent[] = [];

    const jobId = coordinator.run(
      "scan",
      async (_id, emit) => {
        emit({ phase: "scan", processed: 1, total: 2, message: "step 1" });
        emit({ phase: "finalize", processed: 2, total: 2, message: "done", status: "completed" });
      },
      (event) => events.push(event)
    );

    expect(jobId).toBeTruthy();
    await vi.waitFor(() => expect(events.length).toBe(2));
    expect(events[0]!.jobId).toBe(jobId);
    expect(events[0]!.jobType).toBe("scan");
    expect(events[0]!.status).toBe("running");
    expect(events[1]!.status).toBe("completed");
  });

  it("supports cancellation", async () => {
    const coordinator = new JobCoordinator();
    const events: ProgressEvent[] = [];

    const jobId = coordinator.run(
      "scan",
      async (_id, emit, isCancelled) => {
        emit({ phase: "scan", processed: 1, total: 2, message: "step 1" });
        await new Promise((r) => setTimeout(r, 50));
        if (isCancelled()) return;
        emit({ phase: "finalize", processed: 2, total: 2, message: "done" });
      },
      (event) => events.push(event)
    );

    expect(coordinator.cancel(jobId)).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(events.length).toBe(1);
  });

  it("cancel returns false for unknown job", () => {
    const coordinator = new JobCoordinator();
    expect(coordinator.cancel("nonexistent")).toBe(false);
  });

  it("emits error event when task throws", async () => {
    const coordinator = new JobCoordinator();
    const events: ProgressEvent[] = [];

    coordinator.run(
      "scan",
      async () => {
        throw new Error("Test failure");
      },
      (event) => events.push(event)
    );

    await vi.waitFor(() => expect(events.length).toBe(1));
    expect(events[0]!.status).toBe("error");
    expect(events[0]!.message).toContain("Test failure");
  });
});
