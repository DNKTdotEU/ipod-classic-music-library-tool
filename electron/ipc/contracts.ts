import { z } from "zod";

export const scanModeSchema = z.enum(["strict", "balanced", "loose"]);
export const scanReconcileModeSchema = z.enum(["full", "incremental"]);

export const startScanRequestSchema = z.object({
  folders: z.array(z.string()).min(1),
  mode: scanModeSchema
});

export const jobTypeSchema = z.enum(["scan", "bulk_duplicate", "metadata_batch", "artwork_batch"]);

export const progressPhaseSchema = z.enum([
  "scan",
  "analyze",
  "group",
  "finalize",
  "prepare",
  "process",
  "commit"
]);

export const progressStatusSchema = z.enum(["running", "completed", "cancelled", "error"]);

export const progressEventSchema = z.object({
  jobId: z.string(),
  jobType: jobTypeSchema,
  phase: progressPhaseSchema,
  processed: z.number().nonnegative(),
  total: z.number().positive(),
  message: z.string(),
  status: progressStatusSchema
});

export const pickPathsRequestSchema = z.object({
  mode: z.enum(["directory", "file"]),
  multiple: z.boolean(),
  title: z.string().optional()
});

export const applyDecisionSchema = z.object({
  groupId: z.string().min(1),
  keepFileId: z.string().min(1)
});

export const deleteDuplicateCandidateSchema = z.object({
  groupId: z.string().min(1),
  fileId: z.string().min(1)
});

export const skipDuplicateGroupSchema = z.object({
  groupId: z.string().min(1)
});

export const dialogConfirmSchema = z.object({
  message: z.string().min(1),
  detail: z.string().optional(),
  confirmButton: z.string().optional(),
  checkboxLabel: z.string().optional()
});

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const userSettingsSchema = z.object({
  defaultScanMode: scanModeSchema,
  scanReconcileMode: scanReconcileModeSchema,
  likelyMinConfidence: z.number().min(0.5).max(0.99),
  likelyDurationThresholdSec: z.number().min(0).max(30),
  lastScanFolders: z.array(z.string()),
  logLevel: logLevelSchema,
  suppressKeepConfirm: z.boolean(),
  suppressDeleteConfirm: z.boolean(),
  suppressExperimentalDevicesNotice: z.boolean(),
  ignoredExplorerPaths: z.array(z.string())
});

export const userSettingsPatchSchema = z.object({
  defaultScanMode: scanModeSchema.optional(),
  scanReconcileMode: scanReconcileModeSchema.optional(),
  likelyMinConfidence: z.number().min(0.5).max(0.99).optional(),
  likelyDurationThresholdSec: z.number().min(0).max(30).optional(),
  lastScanFolders: z.array(z.string()).optional(),
  logLevel: logLevelSchema.optional(),
  suppressKeepConfirm: z.boolean().optional(),
  suppressDeleteConfirm: z.boolean().optional(),
  suppressExperimentalDevicesNotice: z.boolean().optional(),
  ignoredExplorerPaths: z.array(z.string()).optional()
});

export const browseDeviceSchema = z.object({
  mountPath: z.string().min(1),
  relativePath: z.string()
});

export const queryIpodLibraryTracksSchema = z.object({
  mountPath: z.string().min(1),
  search: z.string().optional(),
  genre: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional()
});

export const exportTracksSchema = z.object({
  mountPath: z.string().min(1),
  tracks: z.array(z.object({
    filePath: z.string(),
    title: z.string(),
    artist: z.string(),
    ext: z.string()
  })),
  destDir: z.string().min(1)
});

export const copyToDeviceSchema = z.object({
  mountPath: z.string().min(1),
  destRelative: z.string(),
  sourcePaths: z.array(z.string()).min(1)
});

export const deleteFromDeviceSchema = z.object({
  mountPath: z.string().min(1),
  relativePaths: z.array(z.string()).min(1)
});

export const explorerListSchema = z.object({
  rootPath: z.string().min(1),
  relativePath: z.string().default("")
});

export const explorerDeleteSchema = z.object({
  rootPath: z.string().min(1),
  relativePaths: z.array(z.string()).min(1)
});

export const explorerGetMetadataSchema = z.object({
  rootPath: z.string().min(1),
  relativePath: z.string().min(1)
});

export const explorerQuarantineSchema = z.object({
  rootPath: z.string().min(1),
  relativePaths: z.array(z.string()).min(1)
});

export const explorerIgnoreSchema = z.object({
  rootPath: z.string().min(1),
  relativePaths: z.array(z.string()),
  mode: z.enum(["add", "remove", "replace"])
});

export const explorerBulkRenameItemSchema = z.object({
  fromRelativePath: z.string().min(1),
  toFilename: z.string().min(1)
});

export const explorerBulkRenameSchema = z.object({
  rootPath: z.string().min(1),
  items: z.array(explorerBulkRenameItemSchema).min(1),
  dryRun: z.boolean().default(false)
});

export const explorerSmartFilterSchema = z.object({
  rootPath: z.string().min(1),
  relativePath: z.string().default(""),
  preset: z.enum(["missing_tags", "low_bitrate", "short_duration", "duplicate_like_name", "non_audio"]),
  lowBitrateKbps: z.number().int().min(32).max(512).optional(),
  shortDurationSec: z.number().int().min(5).max(120).optional()
});

export const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional()
});

export type ScanMode = z.infer<typeof scanModeSchema>;
export type StartScanRequest = z.infer<typeof startScanRequestSchema>;
export type JobType = z.infer<typeof jobTypeSchema>;
export type ProgressPhase = z.infer<typeof progressPhaseSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type ProgressPayload = Omit<ProgressEvent, "jobId" | "jobType" | "status"> & { status?: ProgressEvent["status"] };
export type PickPathsRequest = z.infer<typeof pickPathsRequestSchema>;
export type DeleteDuplicateCandidateRequest = z.infer<typeof deleteDuplicateCandidateSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type UserSettingsPatch = z.infer<typeof userSettingsPatchSchema>;
export type AppError = z.infer<typeof appErrorSchema>;

export type Envelope<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: AppError;
};

export { IPC_CHANNELS } from "./channels.js";
