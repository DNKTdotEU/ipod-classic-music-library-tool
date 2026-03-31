import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type ProgressEvent, type ScanMode } from "./ipc/contracts";

const api = {
  startScan: (folders: string[], mode: ScanMode) =>
    ipcRenderer.invoke(IPC_CHANNELS.START_SCAN, { folders, mode }),
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_JOB, jobId),
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DASHBOARD),
  getDuplicates: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DUPLICATES),
  applyDecision: (groupId: string, keepFileId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.APPLY_DECISION, { groupId, keepFileId }),
  getQuarantine: () => ipcRenderer.invoke(IPC_CHANNELS.GET_QUARANTINE),
  restoreQuarantine: (itemId: string) => ipcRenderer.invoke(IPC_CHANNELS.RESTORE_QUARANTINE, itemId),
  onProgress: (listener: (event: ProgressEvent) => void) => {
    const wrapped = (_: unknown, data: ProgressEvent) => listener(data);
    ipcRenderer.on(IPC_CHANNELS.ON_PROGRESS, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ON_PROGRESS, wrapped);
  }
};

contextBridge.exposeInMainWorld("appApi", api);
