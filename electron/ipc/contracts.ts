import { z } from "zod";

export const scanModeSchema = z.enum(["strict", "balanced", "loose"]);

export const startScanRequestSchema = z.object({
  folders: z.array(z.string()).min(1),
  mode: scanModeSchema
});

export const progressEventSchema = z.object({
  jobId: z.string(),
  phase: z.enum(["scan", "analyze", "group", "finalize"]),
  processed: z.number().nonnegative(),
  total: z.number().positive(),
  message: z.string()
});

export const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional()
});

export type ScanMode = z.infer<typeof scanModeSchema>;
export type StartScanRequest = z.infer<typeof startScanRequestSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type AppError = z.infer<typeof appErrorSchema>;

export type Envelope<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: AppError;
};

export const IPC_CHANNELS = {
  START_SCAN: "scan:start",
  CANCEL_JOB: "jobs:cancel",
  GET_DASHBOARD: "dashboard:get",
  GET_DUPLICATES: "duplicates:get",
  APPLY_DECISION: "duplicates:decision",
  GET_QUARANTINE: "quarantine:get",
  RESTORE_QUARANTINE: "quarantine:restore",
  ON_PROGRESS: "jobs:progress"
} as const;
