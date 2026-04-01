import type {
  IpodLibraryTrackQuery,
  PickPathsOptions,
  ProgressEvent,
  ScanMode,
  UserSettingsPatch
} from "../ipc/types";

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
      explorerList: (rootPath: string, relativePath: string) => Promise<unknown>;
      explorerDelete: (rootPath: string, relativePaths: string[]) => Promise<unknown>;
      explorerGetMetadata: (rootPath: string, relativePath: string) => Promise<unknown>;
      explorerQuarantine: (rootPath: string, relativePaths: string[]) => Promise<unknown>;
      explorerIgnore: (rootPath: string, relativePaths: string[], mode: "add" | "remove" | "replace") => Promise<unknown>;
      explorerBulkRename: (
        rootPath: string,
        items: Array<{ fromRelativePath: string; toFilename: string }>,
        dryRun?: boolean
      ) => Promise<unknown>;
      explorerSmartFilter: (
        rootPath: string,
        relativePath: string,
        preset: "missing_tags" | "low_bitrate" | "short_duration" | "duplicate_like_name" | "non_audio",
        lowBitrateKbps?: number,
        shortDurationSec?: number
      ) => Promise<unknown>;
      detectIpods: () => Promise<unknown>;
      getIpodLibrary: (mountPath: string) => Promise<unknown>;
      queryIpodLibraryTracks: (query: IpodLibraryTrackQuery) => Promise<unknown>;
      browseIpod: (mountPath: string, relativePath: string) => Promise<unknown>;
      exportIpodTracks: (mountPath: string, tracks: { filePath: string; title: string; artist: string; ext: string }[], destDir: string) => Promise<unknown>;
      copyToIpod: (mountPath: string, destRelative: string, sourcePaths: string[]) => Promise<unknown>;
      deleteFromIpod: (mountPath: string, relativePaths: string[]) => Promise<unknown>;
      onProgress: (listener: (event: ProgressEvent) => void) => () => void;
    };
  }
}

export {};
