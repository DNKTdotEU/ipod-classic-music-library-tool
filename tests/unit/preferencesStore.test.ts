import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { loadPreferences, savePreferences, getPreferencesFilePath } from "../../electron/services/preferencesStore";

describe("preferencesStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prefs-test-"));
  });

  it("returns defaults when no file exists", () => {
    const prefs = loadPreferences(tmpDir);
    expect(prefs.defaultScanMode).toBe("balanced");
    expect(prefs.scanReconcileMode).toBe("full");
    expect(prefs.likelyMinConfidence).toBe(0.7);
    expect(prefs.likelyDurationThresholdSec).toBe(2);
    expect(prefs.lastScanFolders).toEqual([]);
    expect(prefs.logLevel).toBe("info");
    expect(prefs.suppressKeepConfirm).toBe(false);
    expect(prefs.suppressDeleteConfirm).toBe(false);
  });

  it("saves and loads preferences", () => {
    savePreferences(tmpDir, { defaultScanMode: "strict" });
    const prefs = loadPreferences(tmpDir);
    expect(prefs.defaultScanMode).toBe("strict");
  });

  it("merges partial updates", () => {
    savePreferences(tmpDir, {
      defaultScanMode: "strict",
      scanReconcileMode: "incremental",
      likelyMinConfidence: 0.8,
      likelyDurationThresholdSec: 5,
      lastScanFolders: ["/music"]
    });
    savePreferences(tmpDir, { logLevel: "debug" });
    const prefs = loadPreferences(tmpDir);
    expect(prefs.defaultScanMode).toBe("strict");
    expect(prefs.scanReconcileMode).toBe("incremental");
    expect(prefs.likelyMinConfidence).toBe(0.8);
    expect(prefs.likelyDurationThresholdSec).toBe(5);
    expect(prefs.lastScanFolders).toEqual(["/music"]);
    expect(prefs.logLevel).toBe("debug");
  });

  it("returns defaults when file is corrupt", () => {
    const filePath = getPreferencesFilePath(tmpDir);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "NOT VALID JSON");
    const prefs = loadPreferences(tmpDir);
    expect(prefs.defaultScanMode).toBe("balanced");
  });

  it("saves and loads suppress flags", () => {
    savePreferences(tmpDir, { suppressKeepConfirm: true });
    const prefs = loadPreferences(tmpDir);
    expect(prefs.suppressKeepConfirm).toBe(true);
    expect(prefs.suppressDeleteConfirm).toBe(false);
  });

  it("merges suppress flags with other settings", () => {
    savePreferences(tmpDir, { suppressDeleteConfirm: true, defaultScanMode: "loose" });
    savePreferences(tmpDir, { suppressKeepConfirm: true });
    const prefs = loadPreferences(tmpDir);
    expect(prefs.suppressKeepConfirm).toBe(true);
    expect(prefs.suppressDeleteConfirm).toBe(true);
    expect(prefs.defaultScanMode).toBe("loose");
  });

  it("getPreferencesFilePath returns a path", () => {
    const p = getPreferencesFilePath(tmpDir);
    expect(p).toContain("preferences.json");
  });
});
