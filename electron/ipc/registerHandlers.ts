import { BrowserWindow, ipcMain } from "electron";
import type Database from "better-sqlite3";
import { IPC_CHANNELS, startScanRequestSchema } from "./contracts";
import { ScanService } from "../services/scanService";
import { DashboardService } from "../services/dashboardService";
import { DuplicateService } from "../services/duplicateService";
import { QuarantineService } from "../services/quarantineService";
import { DashboardRepository, DuplicateRepository, HistoryRepository, QuarantineRepository } from "../db/repositories";
import { createConfig } from "../core/config";
import { Logger } from "../core/logger";
import { fail, mapError, ok } from "../core/errors";
import { JobCoordinator } from "../core/jobCoordinator";

export function registerHandlers(window: BrowserWindow, db: Database.Database, userDataPath: string): void {
  const config = createConfig(userDataPath);
  const logger = new Logger(config.logLevel);
  const jobs = new JobCoordinator();
  const historyRepository = new HistoryRepository(db);
  const duplicateRepository = new DuplicateRepository(db);
  const quarantineRepository = new QuarantineRepository(db);
  const dashboardService = new DashboardService(new DashboardRepository(db));
  const duplicateService = new DuplicateService(duplicateRepository, historyRepository);
  const quarantineService = new QuarantineService(quarantineRepository, historyRepository, config.quarantineDir);
  const scanService = new ScanService(duplicateRepository, historyRepository);

  ipcMain.handle(IPC_CHANNELS.START_SCAN, async (_event, input) => {
    try {
      const parsed = startScanRequestSchema.safeParse(input);
      if (!parsed.success) return fail(parsed.error.message);
      const jobId = jobs.run(
        async (runtimeJobId, emit) => {
          await scanService.runScan(runtimeJobId, (progress) => emit(progress));
        },
        (progress) => window.webContents.send(IPC_CHANNELS.ON_PROGRESS, progress)
      );
      logger.info("Scan job started", { jobId, folders: parsed.data.folders.length, mode: parsed.data.mode });
      return ok({ jobId });
    } catch (error) {
      logger.error("Failed to start scan", { error: String(error) });
      return mapError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_JOB, (_event, jobId: string) => ok({ cancelled: jobs.cancel(jobId) }));

  ipcMain.handle(IPC_CHANNELS.GET_DASHBOARD, () => ok(dashboardService.getMetrics()));
  ipcMain.handle(IPC_CHANNELS.GET_DUPLICATES, () => ok(duplicateService.getGroups()));

  ipcMain.handle(IPC_CHANNELS.APPLY_DECISION, (_event, args: { groupId: string; keepFileId: string }) => {
    const result = duplicateService.applyDecision(args.groupId, args.keepFileId);
    return result ? ok({ applied: true }) : fail("Unable to apply decision", "CONFLICT");
  });

  ipcMain.handle(IPC_CHANNELS.GET_QUARANTINE, () => ok(quarantineService.getItems()));
  ipcMain.handle(IPC_CHANNELS.RESTORE_QUARANTINE, (_event, itemId: string) => {
    const restored = quarantineService.restore(itemId);
    return restored ? ok({ restored: true }) : fail("Quarantine item not found", "NOT_FOUND");
  });
}
