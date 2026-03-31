import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import type Database from "better-sqlite3";
import {
  IPC_CHANNELS,
  applyDecisionSchema,
  browseDeviceSchema,
  copyToDeviceSchema,
  deleteFromDeviceSchema,
  deleteDuplicateCandidateSchema,
  skipDuplicateGroupSchema,
  dialogConfirmSchema,
  exportTracksSchema,
  pickPathsRequestSchema,
  startScanRequestSchema,
  userSettingsPatchSchema
} from "./contracts.js";
import { ScanService } from "../services/scanService.js";
import { DashboardService } from "../services/dashboardService.js";
import { DuplicateService } from "../services/duplicateService.js";
import { QuarantineService } from "../services/quarantineService.js";
import { DashboardRepository, DuplicateRepository, HistoryRepository, QuarantineRepository, TrackRepository } from "../db/repositories.js";
import { createConfig } from "../core/config.js";
import { Logger } from "../core/logger.js";
import { getPreferencesFilePath, loadPreferences, savePreferences } from "../services/preferencesStore.js";
import { fail, mapError, ok } from "../core/errors.js";
import { JobCoordinator } from "../core/jobCoordinator.js";
import { runBulkDuplicateRefresh } from "../services/bulkDuplicateRefreshJob.js";
import { DuplicateDetectionService } from "../services/duplicateDetectionService.js";
import * as ipodService from "../services/ipod/ipodService.js";

/**
 * Register IPC handlers once per app lifecycle. Do not call per BrowserWindow
 * (Electron rejects duplicate channel registration).
 */
export function registerHandlers(db: Database.Database, userDataPath: string): void {
  const config = createConfig(userDataPath);
  let userSettings = loadPreferences(userDataPath);
  const logger = new Logger(userSettings.logLevel);
  const jobs = new JobCoordinator();
  const historyRepository = new HistoryRepository(db);
  const duplicateRepository = new DuplicateRepository(db);
  const quarantineRepository = new QuarantineRepository(db);
  const dashboardService = new DashboardService(new DashboardRepository(db));
  const duplicateService = new DuplicateService(duplicateRepository, historyRepository);
  const quarantineService = new QuarantineService(quarantineRepository, historyRepository, config.quarantineDir);
  const trackRepository = new TrackRepository(db);
  const duplicateDetectionService = new DuplicateDetectionService(db);
  const scanService = new ScanService(trackRepository, historyRepository, duplicateDetectionService);

  ipcMain.handle(IPC_CHANNELS.PICK_PATHS, async (event, raw: unknown) => {
    const parsed = pickPathsRequestSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return fail("No BrowserWindow for sender", "INTERNAL_ERROR");
    const { mode, multiple, title } = parsed.data;
    const properties: Array<"openFile" | "openDirectory" | "multiSelections"> =
      mode === "directory"
        ? multiple
          ? ["openDirectory", "multiSelections"]
          : ["openDirectory"]
        : multiple
          ? ["openFile", "multiSelections"]
          : ["openFile"];
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: title ?? (mode === "directory" ? "Select folder" : "Select file"),
      properties
    });
    if (canceled) return ok({ paths: [] as string[], dismissed: true });
    return ok({ paths: filePaths, dismissed: false });
  });

  ipcMain.handle(IPC_CHANNELS.START_SCAN, async (event, input) => {
    try {
      const parsed = startScanRequestSchema.safeParse(input);
      if (!parsed.success) return fail(parsed.error.message);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return fail("No BrowserWindow for sender", "INTERNAL_ERROR");

      const jobId = jobs.run(
        "scan",
        async (runtimeJobId, emit, isCancelled) => {
          await scanService.runScan(runtimeJobId, parsed.data.folders, parsed.data.mode, emit, isCancelled);
        },
        (progress) => win.webContents.send(IPC_CHANNELS.ON_PROGRESS, progress)
      );
      userSettings = savePreferences(userDataPath, {
        lastScanFolders: parsed.data.folders,
        defaultScanMode: parsed.data.mode
      });
      logger.info("Scan job started", { jobId, folders: parsed.data.folders.length, mode: parsed.data.mode });
      return ok({ jobId });
    } catch (error) {
      logger.error("Failed to start scan", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RESET_SCAN_DATA, () => {
    try {
      trackRepository.clearAll();
      historyRepository.record("scan_reset", "All scan data cleared by user");
      logger.info("Scan data reset by user");
      return ok({ cleared: true });
    } catch (error) {
      logger.error("Failed to reset scan data", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_JOB, (_event, jobId: string) => ok({ cancelled: jobs.cancel(jobId) }));

  ipcMain.handle(IPC_CHANNELS.START_BULK_DUPLICATE_REFRESH, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return fail("No BrowserWindow for sender", "INTERNAL_ERROR");
      const jobId = jobs.run(
        "bulk_duplicate",
        async (runtimeJobId, emit, isCancelled) => {
          await runBulkDuplicateRefresh(runtimeJobId, duplicateDetectionService, historyRepository, emit, isCancelled);
        },
        (progress) => win.webContents.send(IPC_CHANNELS.ON_PROGRESS, progress)
      );
      logger.info("Bulk duplicate refresh started", { jobId });
      return ok({ jobId });
    } catch (error) {
      logger.error("Failed to start duplicate refresh", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_DASHBOARD, () => {
    try {
      return ok(dashboardService.getMetrics());
    } catch (error) {
      logger.error("Failed to get dashboard", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_DUPLICATES, () => {
    try {
      return ok(duplicateService.getGroups());
    } catch (error) {
      logger.error("Failed to get duplicates", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.APPLY_DECISION, async (_event, raw: unknown) => {
    try {
      const parsed = applyDecisionSchema.safeParse(raw);
      if (!parsed.success) return fail(parsed.error.message);
      const result = await duplicateService.applyDecision(parsed.data.groupId, parsed.data.keepFileId);
      if (!result.ok) return fail(result.reason, "CONFLICT");
      return ok({ applied: true, deleted: result.deleted, failed: result.failed });
    } catch (error) {
      logger.error("Failed to apply decision", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DUPLICATE_CANDIDATE, async (_event, raw: unknown) => {
    const parsed = deleteDuplicateCandidateSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message);
    const result = await duplicateService.deleteCandidateFile(parsed.data.groupId, parsed.data.fileId);
    if (result.ok) return ok({ deleted: true });
    return fail(result.reason, "BAD_REQUEST");
  });

  ipcMain.handle(IPC_CHANNELS.SKIP_DUPLICATE_GROUP, (_event, raw: unknown) => {
    const parsed = skipDuplicateGroupSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message);
    const result = duplicateService.skipGroup(parsed.data.groupId);
    if (result.ok) return ok({ skipped: true });
    return fail(result.reason, "BAD_REQUEST");
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_ITEM_IN_FOLDER, (_event, filePath: string) => {
    if (typeof filePath !== "string" || filePath.length === 0) return fail("Invalid path", "BAD_REQUEST");
    shell.showItemInFolder(filePath);
    return ok({ shown: true });
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_CONFIRM, async (event, raw: unknown) => {
    const parsed = dialogConfirmSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return fail("No BrowserWindow for sender", "INTERNAL_ERROR");
    const cancelLabel = "Cancel";
    const okLabel = parsed.data.confirmButton ?? "OK";
    const opts: Electron.MessageBoxOptions = {
      type: "warning",
      message: parsed.data.message,
      detail: parsed.data.detail,
      buttons: [cancelLabel, okLabel],
      defaultId: 0,
      cancelId: 0
    };
    if (parsed.data.checkboxLabel) {
      opts.checkboxLabel = parsed.data.checkboxLabel;
      opts.checkboxChecked = false;
    }
    const result = await dialog.showMessageBox(win, opts);
    return ok({ confirmed: result.response === 1, checkboxChecked: result.checkboxChecked ?? false });
  });

  ipcMain.handle(IPC_CHANNELS.GET_QUARANTINE, () => {
    try {
      return ok(quarantineService.getItems());
    } catch (error) {
      logger.error("Failed to get quarantine", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RESTORE_QUARANTINE, (_event, itemId: string) => {
    try {
      if (typeof itemId !== "string" || itemId.length === 0) return fail("Invalid item ID", "BAD_REQUEST");
      const result = quarantineService.restore(itemId);
      if (!result.ok) return fail(result.reason, "NOT_FOUND");
      return ok({ restored: true });
    } catch (error) {
      logger.error("Failed to restore quarantine item", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_QUARANTINE, (_event, itemId: string) => {
    try {
      if (typeof itemId !== "string" || itemId.length === 0) return fail("Invalid item ID", "BAD_REQUEST");
      const result = quarantineService.deletePermanently(itemId);
      if (!result.ok) return fail(result.reason, "NOT_FOUND");
      return ok({ deleted: true });
    } catch (error) {
      logger.error("Failed to permanently delete quarantine item", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, (_event, args?: { limit?: number; offset?: number }) => {
    try {
      const limit = Math.min(args?.limit ?? 50, 200);
      const offset = Math.max(args?.offset ?? 0, 0);
      return ok(historyRepository.list(limit, offset));
    } catch (error) {
      logger.error("Failed to get history", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => ok(userSettings));

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, raw: unknown) => {
    const parsed = userSettingsPatchSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.message);
    userSettings = savePreferences(userDataPath, parsed.data);
    logger.setLevel(userSettings.logLevel);
    return ok(userSettings);
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_PATHS, () =>
    ok({
      userDataPath,
      dbPath: config.dbPath,
      quarantineDir: config.quarantineDir,
      preferencesPath: getPreferencesFilePath(userDataPath)
    })
  );

  ipcMain.handle(IPC_CHANNELS.DETECT_IPODS, async () => {
    try {
      const devices = await ipodService.detectIpods();
      return ok(devices);
    } catch (error) {
      logger.error("Failed to detect iPods", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_IPOD_LIBRARY, async (_event, mountPath: string) => {
    try {
      if (typeof mountPath !== "string" || mountPath.length === 0) return fail("Invalid mount path", "BAD_REQUEST");
      const library = await ipodService.readLibrary(mountPath);
      return ok(library);
    } catch (error) {
      logger.error("Failed to read iPod library", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.BROWSE_IPOD, async (_event, raw: unknown) => {
    try {
      const parsed = browseDeviceSchema.safeParse(raw);
      if (!parsed.success) return fail(parsed.error.message);
      const entries = await ipodService.listDirectory(parsed.data.mountPath, parsed.data.relativePath);
      return ok(entries);
    } catch (error) {
      logger.error("Failed to browse iPod", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_IPOD_TRACKS, async (event, raw: unknown) => {
    try {
      const parsed = exportTracksSchema.safeParse(raw);
      if (!parsed.success) return fail(parsed.error.message);
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await ipodService.exportTracks(
        parsed.data.mountPath,
        parsed.data.tracks,
        parsed.data.destDir,
        (done, total) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.ON_PROGRESS, {
              jobId: "ipod-export",
              jobType: "scan",
              phase: "process",
              processed: done,
              total,
              message: `Exporting tracks: ${done}/${total}`,
              status: done >= total ? "completed" : "running"
            });
          }
        }
      );
      return ok(result);
    } catch (error) {
      logger.error("Failed to export iPod tracks", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.COPY_TO_IPOD, async (_event, raw: unknown) => {
    try {
      const parsed = copyToDeviceSchema.safeParse(raw);
      if (!parsed.success) return fail(parsed.error.message);
      const result = await ipodService.copyToDevice(parsed.data.mountPath, parsed.data.destRelative, parsed.data.sourcePaths);
      return ok(result);
    } catch (error) {
      logger.error("Failed to copy files to iPod", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_FROM_IPOD, async (_event, raw: unknown) => {
    try {
      const parsed = deleteFromDeviceSchema.safeParse(raw);
      if (!parsed.success) return fail(parsed.error.message);
      const result = await ipodService.deleteFromDevice(parsed.data.mountPath, parsed.data.relativePaths);
      return ok(result);
    } catch (error) {
      logger.error("Failed to delete files from iPod", { error: String(error) });
      return mapError(error);
    }
  });
}
