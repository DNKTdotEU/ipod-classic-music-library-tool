import type { Envelope } from "../ipc/contracts.js";

export class AppRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: string
  ) {
    super(message);
  }
}

export const ok = <T>(data: T): Envelope<T> => ({ ok: true, data });

export function fail(message: string, code = "BAD_REQUEST", details?: string): Envelope<never> {
  return { ok: false, error: { code, message, details } };
}

export function mapError(error: unknown): Envelope<never> {
  if (error instanceof AppRuntimeError) {
    return fail(error.message, error.code, error.details);
  }
  if (error instanceof Error) {
    return fail(error.message, "INTERNAL_ERROR");
  }
  return fail("Unknown error", "INTERNAL_ERROR");
}
