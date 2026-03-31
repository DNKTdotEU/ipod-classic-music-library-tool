import type { PickPathsOptions, ProgressEvent, ScanMode, UserSettingsPatch } from "../ipc/types";

declare global {
  interface Window {
    /** Undefined if preload failed or contextIsolation blocked the bridge. */
    appApi?: {
      pickPaths: (options: PickPathsOptions) => Promise<unknown>;
      pickScanFolders: () => Promise<unknown>;
      startScan: (folders: string[], mode: ScanMode) => Promise<unknown>;
      resetScanData: () => Promise<unknown>;
      startBulkDuplicateRefresh: () => Promise<unknown>;
      cancelJob: (jobId: string) => Promise<unknown>;
      getDashboard: () => Promise<unknown>;
      getDuplicates: () => Promise<unknown>;
      applyDecision: (groupId: string, keepFileId: string) => Promise<unknown>;
      deleteDuplicateCandidate: (groupId: string, fileId: string) => Promise<unknown>;
      skipDuplicateGroup: (groupId: string) => Promise<unknown>;
      pathToMediaUrl: (absolutePath: string) => string;
      showItemInFolder: (filePath: string) => Promise<unknown>;
      confirmDialog: (opts: { message: string; detail?: string; confirmButton?: string; checkboxLabel?: string }) => Promise<unknown>;
      getQuarantine: () => Promise<unknown>;
      restoreQuarantine: (itemId: string) => Promise<unknown>;
      deleteQuarantine: (itemId: string) => Promise<unknown>;
      getHistory: (limit?: number, offset?: number) => Promise<unknown>;
      getSettings: () => Promise<unknown>;
      setSettings: (patch: UserSettingsPatch) => Promise<unknown>;
      getAppPaths: () => Promise<unknown>;
      detectIpods: () => Promise<unknown>;
      getIpodLibrary: (mountPath: string) => Promise<unknown>;
      browseIpod: (mountPath: string, relativePath: string) => Promise<unknown>;
      exportIpodTracks: (mountPath: string, tracks: { filePath: string; title: string; artist: string; ext: string }[], destDir: string) => Promise<unknown>;
      copyToIpod: (mountPath: string, destRelative: string, sourcePaths: string[]) => Promise<unknown>;
      deleteFromIpod: (mountPath: string, relativePaths: string[]) => Promise<unknown>;
      onProgress: (listener: (event: ProgressEvent) => void) => () => void;
    };
  }
}

export {};
