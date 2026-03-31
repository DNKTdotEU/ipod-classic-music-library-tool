import fs from "node:fs";
import path from "node:path";
import type { ScanMode } from "../ipc/contracts.js";

export type StoredUserSettings = {
  defaultScanMode: ScanMode;
  lastScanFolders: string[];
  logLevel: "debug" | "info" | "warn" | "error";
  suppressKeepConfirm: boolean;
  suppressDeleteConfirm: boolean;
  suppressExperimentalDevicesNotice: boolean;
};

const DEFAULTS: StoredUserSettings = {
  defaultScanMode: "balanced",
  lastScanFolders: [],
  logLevel: "info",
  suppressKeepConfirm: false,
  suppressDeleteConfirm: false,
  suppressExperimentalDevicesNotice: false
};

function preferencesPath(userDataPath: string): string {
  return path.join(userDataPath, "preferences.json");
}

function merge(base: StoredUserSettings, patch: Partial<StoredUserSettings>): StoredUserSettings {
  return {
    defaultScanMode: patch.defaultScanMode ?? base.defaultScanMode,
    lastScanFolders: patch.lastScanFolders ?? base.lastScanFolders,
    logLevel: patch.logLevel ?? base.logLevel,
    suppressKeepConfirm: patch.suppressKeepConfirm ?? base.suppressKeepConfirm,
    suppressDeleteConfirm: patch.suppressDeleteConfirm ?? base.suppressDeleteConfirm,
    suppressExperimentalDevicesNotice: patch.suppressExperimentalDevicesNotice ?? base.suppressExperimentalDevicesNotice
  };
}

export function loadPreferences(userDataPath: string): StoredUserSettings {
  const file = preferencesPath(userDataPath);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
    const o = parsed as Record<string, unknown>;
    const lastScanFolders = Array.isArray(o.lastScanFolders)
      ? o.lastScanFolders.filter((x): x is string => typeof x === "string")
      : DEFAULTS.lastScanFolders;
    const defaultScanMode =
      o.defaultScanMode === "strict" || o.defaultScanMode === "balanced" || o.defaultScanMode === "loose"
        ? o.defaultScanMode
        : DEFAULTS.defaultScanMode;
    const logLevel =
      o.logLevel === "debug" || o.logLevel === "info" || o.logLevel === "warn" || o.logLevel === "error"
        ? o.logLevel
        : DEFAULTS.logLevel;
    const suppressKeepConfirm = typeof o.suppressKeepConfirm === "boolean" ? o.suppressKeepConfirm : DEFAULTS.suppressKeepConfirm;
    const suppressDeleteConfirm = typeof o.suppressDeleteConfirm === "boolean" ? o.suppressDeleteConfirm : DEFAULTS.suppressDeleteConfirm;
    const suppressExperimentalDevicesNotice = typeof o.suppressExperimentalDevicesNotice === "boolean" ? o.suppressExperimentalDevicesNotice : DEFAULTS.suppressExperimentalDevicesNotice;
    return merge(DEFAULTS, { defaultScanMode, lastScanFolders, logLevel, suppressKeepConfirm, suppressDeleteConfirm, suppressExperimentalDevicesNotice });
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(userDataPath: string, patch: Partial<StoredUserSettings>): StoredUserSettings {
  const current = loadPreferences(userDataPath);
  const next = merge(current, patch);
  const file = preferencesPath(userDataPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function getPreferencesFilePath(userDataPath: string): string {
  return preferencesPath(userDataPath);
}
