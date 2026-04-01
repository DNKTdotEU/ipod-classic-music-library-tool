import { app, BrowserWindow, dialog, net, protocol } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
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

function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3": return "audio/mpeg";
    case ".m4a": return "audio/mp4";
    case ".aac": return "audio/aac";
    case ".flac": return "audio/flac";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".opus": return "audio/ogg";
    case ".mp4": return "video/mp4";
    case ".m4v": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    case ".mkv": return "video/x-matroska";
    default: return "application/octet-stream";
  }
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
    const range = request.headers.get("range");
    if (!range) {
      return net.fetch(pathToFileURL(filePath).href);
    }

    // Support byte-range requests so media scrubbing does not restart playback.
    const fileStat = await stat(filePath);
    const size = fileStat.size;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if (!match) {
      return new Response("Invalid range", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes"
        }
      });
    }

    const startRaw = match[1];
    const endRaw = match[2];
    let start = startRaw === "" ? 0 : Number.parseInt(startRaw, 10);
    let end = endRaw === "" ? size - 1 : Number.parseInt(endRaw, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
      return new Response("Unsatisfiable range", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes"
        }
      });
    }
    if (end >= size) end = size - 1;

    const stream = createReadStream(filePath, { start, end });
    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": mimeForPath(filePath),
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
        "Cache-Control": "no-cache"
      }
    });
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
