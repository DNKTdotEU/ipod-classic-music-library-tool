import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerHandlers } from "./ipc/registerHandlers";
import { getDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { createConfig } from "./core/config";
import { runStartupHealthChecks } from "./core/health";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, "../dist/index.html")}`;
  win.loadURL(url);
  const config = createConfig(app.getPath("userData"));
  const db = getDatabase(config.dbPath);
  registerHandlers(win, db, app.getPath("userData"));
  return win;
}

app.whenReady().then(() => {
  const config = createConfig(app.getPath("userData"));
  const db = getDatabase(config.dbPath);
  runMigrations(db);
  runStartupHealthChecks(db, config);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
