/** Mirror of main-process progress payloads (renderer must not import from `electron/`). */
export type JobType = "scan" | "bulk_duplicate" | "metadata_batch" | "artwork_batch";

export type ProgressPhase =
  | "scan"
  | "analyze"
  | "group"
  | "finalize"
  | "prepare"
  | "process"
  | "commit";

export type ProgressStatus = "running" | "completed" | "cancelled" | "error";

export type ProgressEvent = {
  jobId: string;
  jobType: JobType;
  phase: ProgressPhase;
  processed: number;
  total: number;
  message: string;
  status: ProgressStatus;
};

/** Matches `scanModeSchema` in the main process. */
export type ScanMode = "strict" | "balanced" | "loose";

/** Matches `logLevelSchema` in the main process. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Matches `userSettingsSchema` in the main process. */
export type UserSettings = {
  defaultScanMode: ScanMode;
  lastScanFolders: string[];
  logLevel: LogLevel;
  suppressKeepConfirm: boolean;
  suppressDeleteConfirm: boolean;
  suppressExperimentalDevicesNotice: boolean;
};

export type UserSettingsPatch = Partial<UserSettings>;

/** Payload from `GET_APP_PATHS`. */
export type AppPathsInfo = {
  userDataPath: string;
  dbPath: string;
  quarantineDir: string;
  preferencesPath: string;
};

export type PickPathsOptions = {
  mode: "directory" | "file";
  multiple: boolean;
  title?: string;
};

export type PickPathsResult = {
  paths: string[];
  dismissed: boolean;
};

/** @deprecated Use PickPathsResult — kept for call sites. */
export type PickScanFoldersResult = PickPathsResult;

/* ── iPod / Devices types ── */

export type IpodDevice = {
  id: string;
  mountPath: string;
  modelName: string;
  modelNumber: string;
  generation: string;
  firmwareVersion: string;
  serialNumber: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
};

export type IpodTrack = {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  composer: string;
  filePath: string;
  durationMs: number;
  trackNumber: number;
  year: number;
  bitrate: number;
  sampleRate: number;
  sizeBytes: number;
  playCount: number;
  rating: number;
  mediaType: string;
};

export type IpodLibrary = {
  version: number;
  tracks: IpodTrack[];
};

export type FsEntry = {
  name: string;
  type: "directory" | "file";
  sizeBytes: number;
  modifiedAt: string;
};
