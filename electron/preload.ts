import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./ipc/channels.js";
import type { PickPathsRequest, ProgressEvent, ScanMode, UserSettingsPatch } from "./ipc/contracts.js";

const api = {
  pickPaths: (options: PickPathsRequest) => ipcRenderer.invoke(IPC_CHANNELS.PICK_PATHS, options),
  pickScanFolders: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PICK_PATHS, {
      mode: "directory",
      multiple: true,
      title: "Select music library folder(s)"
    }),
  startScan: (folders: string[], mode: ScanMode) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_SCAN, { folders, mode }),
  resetScanData: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_SCAN_DATA),
  startBulkDuplicateRefresh: () => ipcRenderer.invoke(IPC_CHANNELS.START_BULK_DUPLICATE_REFRESH),
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_JOB, jobId),
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DASHBOARD),
  getDuplicates: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DUPLICATES),
  applyDecision: (groupId: string, keepFileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.APPLY_DECISION, { groupId, keepFileId }),
  deleteDuplicateCandidate: (groupId: string, fileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_DUPLICATE_CANDIDATE, { groupId, fileId }),
  skipDuplicateGroup: (groupId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SKIP_DUPLICATE_GROUP, { groupId }),
  pathToMediaUrl: (absolutePath: string) =>
    `media://localhost/?path=${encodeURIComponent(absolutePath)}`,
  showItemInFolder: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_ITEM_IN_FOLDER, filePath),
  confirmDialog: (opts: { message: string; detail?: string; confirmButton?: string; checkboxLabel?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_CONFIRM, opts),
  getQuarantine: () => ipcRenderer.invoke(IPC_CHANNELS.GET_QUARANTINE),
  restoreQuarantine: (itemId: string) => ipcRenderer.invoke(IPC_CHANNELS.RESTORE_QUARANTINE, itemId),
  deleteQuarantine: (itemId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_QUARANTINE, itemId),
  getHistory: (limit?: number, offset?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY, { limit, offset }),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  setSettings: (patch: UserSettingsPatch) => ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, patch),
  getAppPaths: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_PATHS),
  detectIpods: () => ipcRenderer.invoke(IPC_CHANNELS.DETECT_IPODS),
  getIpodLibrary: (mountPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_IPOD_LIBRARY, mountPath),
  browseIpod: (mountPath: string, relativePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.BROWSE_IPOD, { mountPath, relativePath }),
  exportIpodTracks: (mountPath: string, tracks: { filePath: string; title: string; artist: string; ext: string }[], destDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_IPOD_TRACKS, { mountPath, tracks, destDir }),
  copyToIpod: (mountPath: string, destRelative: string, sourcePaths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_IPOD, { mountPath, destRelative, sourcePaths }),
  deleteFromIpod: (mountPath: string, relativePaths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_FROM_IPOD, { mountPath, relativePaths }),
  onProgress: (listener: (event: ProgressEvent) => void) => {
    const wrapped = (_: unknown, data: ProgressEvent) => listener(data);
    ipcRenderer.on(IPC_CHANNELS.ON_PROGRESS, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ON_PROGRESS, wrapped);
  }
};

contextBridge.exposeInMainWorld("appApi", api);
