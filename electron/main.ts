import { app, BrowserWindow, dialog, net, protocol } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import { registerHandlers } from "./ipc/registerHandlers.js";
import { getDatabase } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { createConfig } from "./core/config.js";
import { runStartupHealthChecks } from "./core/health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: { secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, standard: true }
  }
]);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, "../dist/index.html")}`;
  void win.loadURL(url);
  return win;
}

app.whenReady().then(() => {
  protocol.handle("media", async (request) => {
    const u = new URL(request.url);
    const raw = u.searchParams.get("path");
    if (!raw) {
      return new Response("Missing path", { status: 400 });
    }
    const filePath = decodeURIComponent(raw);
    try {
      const s = await stat(filePath);
      if (!s.isFile()) {
        return new Response("Not a file", { status: 400 });
      }
    } catch {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });

  try {
    const config = createConfig(app.getPath("userData"));
    const db = getDatabase(config.dbPath);
    runMigrations(db);
    runStartupHealthChecks(db, config);
    registerHandlers(db, app.getPath("userData"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      "iPod Tool — Startup Error",
      `The application failed to initialize.\n\n${message}\n\nThe app will now quit.`
    );
    app.quit();
    return;
  }

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
