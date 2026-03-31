import type { ProgressEvent, ScanMode } from "../../electron/ipc/contracts";

declare global {
  interface Window {
    appApi: {
      startScan: (folders: string[], mode: ScanMode) => Promise<unknown>;
      cancelJob: (jobId: string) => Promise<unknown>;
      getDashboard: () => Promise<unknown>;
      getDuplicates: () => Promise<unknown>;
      applyDecision: (groupId: string, keepFileId: string) => Promise<unknown>;
      getQuarantine: () => Promise<unknown>;
      restoreQuarantine: (itemId: string) => Promise<unknown>;
      onProgress: (listener: (event: ProgressEvent) => void) => () => void;
    };
  }
}

export {};
