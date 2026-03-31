import { describe, expect, it } from "vitest";
import { isTerminalProgress } from "../../src/ipc/progressUtils";
import type { ProgressEvent } from "../../src/ipc/types";

function makeEvent(overrides: Partial<ProgressEvent> = {}): ProgressEvent {
  return {
    jobId: "j1",
    jobType: "scan",
    phase: "scan",
    processed: 1,
    total: 1,
    message: "test",
    status: "running",
    ...overrides
  };
}

describe("isTerminalProgress", () => {
  it("returns false for running status", () => {
    expect(isTerminalProgress(makeEvent({ status: "running" }))).toBe(false);
  });

  it("returns true for completed status", () => {
    expect(isTerminalProgress(makeEvent({ status: "completed" }))).toBe(true);
  });

  it("returns true for cancelled status", () => {
    expect(isTerminalProgress(makeEvent({ status: "cancelled" }))).toBe(true);
  });

  it("returns true for error status", () => {
    expect(isTerminalProgress(makeEvent({ status: "error" }))).toBe(true);
  });
});
