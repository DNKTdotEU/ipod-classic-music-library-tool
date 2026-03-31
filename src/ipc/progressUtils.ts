import type { ProgressEvent } from "./types";

export function isTerminalProgress(event: ProgressEvent): boolean {
  return event.status === "completed" || event.status === "cancelled" || event.status === "error";
}
