import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import type { JobType, PickPathsResult, ProgressEvent, ScanMode, UserSettings } from "../ipc/types";
import { isTerminalProgress } from "../ipc/progressUtils";
import { JobProgressCard } from "./JobProgressCard";
import { DuplicatesView } from "./DuplicatesView";
import { SettingsView } from "./SettingsView";
import { HistoryView } from "./HistoryView";
import { DevicesView } from "./DevicesView";
import { ExplorerView } from "./ExplorerView";
import { JOB_PANEL_TITLE, PHASE_LABEL } from "./progressLabels";

type DashboardMetrics = {
  exactDuplicates: number;
  likelyDuplicates: number;
  metadataIssues: number;
  artworkIssues: number;
  quarantinedFiles: number;
  resolvedGroups: number;
  unresolvedGroups: number;
};

type Candidate = {
  id: string;
  path: string;
  format: string;
  bitrate: number;
  durationSec: number;
  sizeBytes: number;
  metadataCompleteness: number;
  hasArtwork: boolean;
};

type DuplicateGroup = {
  id: string;
  title: string;
  artist: string;
  type: "exact" | "likely";
  confidence: number;
  status: string;
  candidates: Candidate[];
};

type QuarantineItem = {
  id: string;
  originalPath: string;
  reason: string;
  createdAt: string;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const nav = ["Dashboard", "Scan", "Duplicates", "Quarantine", "History", "Explorer", "Devices", "Settings"] as const;

const METRIC_LABELS: Record<string, { label: string; tab?: (typeof nav)[number] }> = {
  exactDuplicates: { label: "Exact Duplicates", tab: "Duplicates" },
  likelyDuplicates: { label: "Likely Duplicates", tab: "Duplicates" },
  quarantinedFiles: { label: "Quarantined Files", tab: "Quarantine" },
  resolvedGroups: { label: "Resolved Groups", tab: "Duplicates" },
  unresolvedGroups: { label: "Unresolved Groups", tab: "Duplicates" }
};

const STATUS_AUTO_CLEAR_MS = 8000;
const normalizeFolderKey = (p: string): string => p.replace(/[\\/]+$/, "").toLowerCase();

export function App(): ReactElement {
  const api = window.appApi;
  const [active, setActive] = useState<(typeof nav)[number]>("Dashboard");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineItem[]>([]);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [message, setMessage] = useState("Ready.");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [scanFolders, setScanFolders] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("balanced");
  const [activeJobIds, setActiveJobIds] = useState<Partial<Record<JobType, string>>>({});
  const [suppressKeepConfirm, setSuppressKeepConfirm] = useState(false);
  const [suppressDeleteConfirm, setSuppressDeleteConfirm] = useState(false);
  const [suppressExperimentalDevicesNotice, setSuppressExperimentalDevicesNotice] = useState(false);
  const devicesNoticeShownRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((msg: string, type: "info" | "success" | "error" = "info") => {
    setMessage(msg);
    setMessageType(type);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (type !== "error") {
      statusTimerRef.current = setTimeout(() => setMessage(""), STATUS_AUTO_CLEAR_MS);
    }
  }, []);

  const applySettingsFromServer = useCallback((settings: UserSettings) => {
    setScanMode(settings.defaultScanMode);
    setScanFolders(settings.lastScanFolders);
    setSuppressKeepConfirm(settings.suppressKeepConfirm);
    setSuppressDeleteConfirm(settings.suppressDeleteConfirm);
    setSuppressExperimentalDevicesNotice(settings.suppressExperimentalDevicesNotice);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const dashboard = (await api.getDashboard()) as Envelope<DashboardMetrics>;
      const duplicateList = (await api.getDuplicates()) as Envelope<DuplicateGroup[]>;
      const quarantineList = (await api.getQuarantine()) as Envelope<QuarantineItem[]>;
      if (dashboard.ok) setMetrics(dashboard.data); else showStatus(`Dashboard: ${dashboard.error.message}`, "error");
      if (duplicateList.ok) setGroups(duplicateList.data); else showStatus(`Duplicates: ${duplicateList.error.message}`, "error");
      if (quarantineList.ok) setQuarantine(quarantineList.data); else showStatus(`Quarantine: ${quarantineList.error.message}`, "error");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      showStatus(`Failed to load data: ${text}`, "error");
    }
  }, [api, showStatus]);

  useEffect(() => {
    if (!api?.getSettings) return;
    void (async () => {
      const res = (await api.getSettings()) as Envelope<UserSettings>;
      if (res.ok) applySettingsFromServer(res.data);
    })();
  }, [api, applySettingsFromServer]);

  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.onProgress((event) => {
      setProgress(event);
      setMessage((prev) => (messageType === "error" ? prev : event.message));
      setMessageType((prev) => (prev === "error" ? prev : "info"));
      if (isTerminalProgress(event)) {
        setActiveJobIds((prev) => {
          if (prev[event.jobType] !== event.jobId) return prev;
          const next = { ...prev };
          delete next[event.jobType];
          return next;
        });
        void refresh();
      }
    });
    void refresh();
    return unsubscribe;
  }, [api, messageType, refresh]);

  const scanRunning = activeJobIds.scan !== undefined;
  const bulkDuplicateRunning = activeJobIds.bulk_duplicate !== undefined;
  const exportRunning = progress?.jobId === "ipod-export" && progress.status === "running";
  const isAppBusy = scanRunning || bulkDuplicateRunning || exportRunning;

  const guardIfBusy = useCallback((): boolean => {
    if (!isAppBusy) return false;
    showStatus("Process running, please wait", "info");
    return true;
  }, [isAppBusy, showStatus]);

  const liveScanProgress =
    scanRunning && activeJobIds.scan && progress && progress.jobId === activeJobIds.scan && progress.jobType === "scan"
      ? progress
      : null;

  const liveBulkDuplicateProgress =
    bulkDuplicateRunning &&
    activeJobIds.bulk_duplicate &&
    progress &&
    progress.jobId === activeJobIds.bulk_duplicate &&
    progress.jobType === "bulk_duplicate"
      ? progress
      : null;

  async function addScanFolders() {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const result = (await api.pickPaths({
        mode: "directory",
        multiple: true,
        title: "Select music library folder(s)"
      })) as Envelope<PickPathsResult>;
      if (!result.ok) {
        showStatus(result.error.message, "error");
        return;
      }
      if (result.data.dismissed) return;
      if (result.data.paths.length === 0) {
        showStatus("No folders selected.", "info");
        return;
      }
      setScanFolders((prev) => {
        const seen = new Set(prev.map((p) => normalizeFolderKey(p)));
        const additions: string[] = [];
        for (const candidate of result.data.paths) {
          const key = normalizeFolderKey(candidate);
          if (!seen.has(key)) {
            seen.add(key);
            additions.push(candidate);
          }
        }
        const merged = [...prev, ...additions];
        const addedNew = additions.length;
        showStatus(`Added ${addedNew} folder(s). (${merged.length} in list)`, "success");
        return merged;
      });
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  function removeScanFolder(path: string) {
    setScanFolders((prev) => prev.filter((p) => p !== path));
  }

  function clearScanFolders() {
    setScanFolders([]);
    showStatus("Cleared folder list.", "info");
  }

  async function startLibraryScan() {
    if (guardIfBusy()) return;
    if (!api || scanFolders.length === 0) return;
    try {
      const result = (await api.startScan(scanFolders, scanMode)) as Envelope<{ jobId: string }>;
      if (result.ok) {
        setActiveJobIds((p) => ({ ...p, scan: result.data.jobId }));
        showStatus(`Scan started (${result.data.jobId.slice(0, 8)}…)`, "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function stopScan() {
    if (!api) return;
    const jobId = activeJobIds.scan;
    if (!jobId) return;
    try {
      const result = (await api.cancelJob(jobId)) as Envelope<{ cancelled: boolean }>;
      if (!result.ok) {
        showStatus(result.error.message, "error");
        return;
      }
      showStatus(result.data.cancelled ? "Scan stop requested." : "Scan already finished.", "info");
      setActiveJobIds((p) => {
        const n = { ...p };
        delete n.scan;
        return n;
      });
      await refresh();
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function resetScanData() {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const confirm = (await api.confirmDialog({
        message: "Clear all scan data?",
        detail: "This will remove all indexed tracks, file records, and duplicate groups from the database. No files on disk will be affected. You will need to run a new scan afterward.",
        confirmButton: "Clear data"
      })) as Envelope<{ confirmed: boolean }>;
      if (!confirm.ok || !confirm.data.confirmed) return;
      const result = (await api.resetScanData()) as Envelope<{ cleared: boolean }>;
      if (result.ok) {
        showStatus("Scan data cleared. Run a new scan to re-index your library.", "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function startBulkDuplicateRefresh() {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const result = (await api.startBulkDuplicateRefresh()) as Envelope<{ jobId: string }>;
      if (result.ok) {
        setActiveJobIds((p) => ({ ...p, bulk_duplicate: result.data.jobId }));
        showStatus(`Duplicate refresh started (${result.data.jobId.slice(0, 8)}…)`, "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function stopBulkDuplicateRefresh() {
    if (!api) return;
    const jobId = activeJobIds.bulk_duplicate;
    if (!jobId) return;
    try {
      const result = (await api.cancelJob(jobId)) as Envelope<{ cancelled: boolean }>;
      if (!result.ok) {
        showStatus(result.error.message, "error");
        return;
      }
      showStatus(result.data.cancelled ? "Duplicate refresh stop requested." : "Duplicate refresh already finished.", "info");
      setActiveJobIds((p) => {
        const n = { ...p };
        delete n.bulk_duplicate;
        return n;
      });
      await refresh();
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function applyKeep(groupId: string, keepFileId: string) {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const group = groups.find((g) => g.id === groupId);
      const othersCount = group ? group.candidates.filter((c) => c.id !== keepFileId).length : 0;

      if (!suppressKeepConfirm && othersCount > 0) {
        const otherPaths = group!.candidates
          .filter((c) => c.id !== keepFileId)
          .map((c) => c.path)
          .join("\n");
        const confirm = (await api.confirmDialog({
          message: `Keep this file and delete ${othersCount} other(s) from disk?`,
          detail: `The following file(s) will be permanently deleted:\n${otherPaths}`,
          confirmButton: "Keep and delete others",
          checkboxLabel: "Do not ask again"
        })) as Envelope<{ confirmed: boolean; checkboxChecked: boolean }>;
        if (!confirm.ok) {
          showStatus(confirm.error.message, "error");
          return;
        }
        if (!confirm.data.confirmed) return;
        if (confirm.data.checkboxChecked) {
          setSuppressKeepConfirm(true);
          void api.setSettings({ suppressKeepConfirm: true });
        }
      }

      const result = (await api.applyDecision(groupId, keepFileId)) as Envelope<{
        applied: boolean;
        deleted: string[];
        failed: string[];
        resolved: boolean;
      }>;
      if (result.ok) {
        const msg = `Kept file, deleted ${result.data.deleted.length} file(s).`;
        const failMsg = result.data.failed.length > 0 ? ` ${result.data.failed.length} file(s) could not be deleted.` : "";
        const unresolvedMsg = result.data.resolved ? "" : " Group remains unresolved due to remaining files.";
        showStatus(msg + failMsg, result.data.failed.length > 0 ? "error" : "success");
        if (!result.data.resolved) showStatus(msg + failMsg + unresolvedMsg, "error");
      } else {
        showStatus(result.error.message, "error");
      }
      await refresh();
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function skipDuplicateGroup(groupId: string) {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const result = (await api.skipDuplicateGroup(groupId)) as Envelope<{ skipped: boolean }>;
      if (result.ok) {
        showStatus("Group marked as resolved.", "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function deleteDuplicateCandidate(groupId: string, fileId: string) {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      if (!suppressDeleteConfirm) {
        const confirm = (await api.confirmDialog({
          message: "Permanently delete this file from disk?",
          detail: "This cannot be undone. The duplicate list will be updated.",
          confirmButton: "Delete permanently",
          checkboxLabel: "Do not ask again"
        })) as Envelope<{ confirmed: boolean; checkboxChecked: boolean }>;
        if (!confirm.ok) {
          showStatus(confirm.error.message, "error");
          return;
        }
        if (!confirm.data.confirmed) return;
        if (confirm.data.checkboxChecked) {
          setSuppressDeleteConfirm(true);
          void api.setSettings({ suppressDeleteConfirm: true });
        }
      }

      const result = (await api.deleteDuplicateCandidate(groupId, fileId)) as Envelope<{ deleted: boolean }>;
      if (result.ok) {
        showStatus("File removed from disk.", "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function revealInFolder(filePath: string) {
    if (!api) return;
    try {
      const result = (await api.showItemInFolder(filePath)) as Envelope<{ shown: boolean }>;
      if (!result.ok) showStatus(result.error.message, "error");
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function restoreItem(itemId: string) {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const result = (await api.restoreQuarantine(itemId)) as Envelope<{ restored: boolean }>;
      showStatus(result.ok ? "Restored from quarantine." : result.error.message, result.ok ? "success" : "error");
      await refresh();
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function deleteQuarantinePermanently(itemId: string) {
    if (guardIfBusy()) return;
    if (!api) return;
    try {
      const confirm = (await api.confirmDialog({
        message: "Permanently delete this quarantined file?",
        detail: "The file will be removed from disk and cannot be recovered.",
        confirmButton: "Delete permanently"
      })) as Envelope<{ confirmed: boolean }>;
      if (!confirm.ok) {
        showStatus(confirm.error.message, "error");
        return;
      }
      if (!confirm.data.confirmed) return;
      const result = (await api.deleteQuarantine(itemId)) as Envelope<{ deleted: boolean }>;
      if (result.ok) {
        showStatus("File permanently deleted.", "success");
        await refresh();
      } else {
        showStatus(result.error.message, "error");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  if (!api) {
    return (
      <div style={{ padding: 24, color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ marginTop: 0 }}>Desktop API unavailable</h1>
        <p>
          The Electron preload bridge did not expose <code>window.appApi</code>. Open this app with{" "}
          <code>npm run dev</code> (or your packaged build), not as a plain browser tab.
        </p>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <h1>iPod Tool</h1>
        {nav.map((item) => (
          <button
            key={item}
            className={active === item ? "nav active" : "nav"}
            aria-current={active === item ? "page" : undefined}
            onClick={async () => {
              if (isAppBusy) {
                showStatus("Process running, please wait", "info");
                return;
              }
              if (item === "Devices" && !suppressExperimentalDevicesNotice && !devicesNoticeShownRef.current) {
                devicesNoticeShownRef.current = true;
                const confirm = (await api.confirmDialog({
                  message: "Experimental Feature",
                  detail: "The Devices tab is experimental and may not work correctly with all iPod models. Data on your device could be affected. Proceed with caution.",
                  confirmButton: "Continue",
                  checkboxLabel: "Do not show again"
                })) as Envelope<{ confirmed: boolean; checkboxChecked: boolean }>;
                if (!confirm.ok || !confirm.data.confirmed) {
                  devicesNoticeShownRef.current = false;
                  return;
                }
                if (confirm.data.checkboxChecked) {
                  setSuppressExperimentalDevicesNotice(true);
                  void api.setSettings({ suppressExperimentalDevicesNotice: true });
                }
              }
              setActive(item);
            }}
          >
            {item}
            {item === "Devices" && <span className="experimental-badge">Experimental</span>}
          </button>
        ))}
      </aside>

      <main className="content">
        <header>
          <h2>{active}</h2>
          {message && (
            <p className={`status-message status-${messageType}`} aria-live="polite">
              {message}
            </p>
          )}
          {active !== "Scan" &&
            progress &&
            (active !== "Duplicates" || progress.jobType === "bulk_duplicate") && (
              <p className="header-progress-line">
                {JOB_PANEL_TITLE[progress.jobType]} &middot; {PHASE_LABEL[progress.phase]} &middot; {progress.processed}/
                {progress.total}
              </p>
            )}
        </header>

        {active === "Dashboard" &&
          (metrics ? (
            <section className="cards">
              {Object.entries(metrics)
                .filter(([key]) => METRIC_LABELS[key])
                .map(([key, value]) => {
                  const meta = METRIC_LABELS[key]!;
                  return (
                    <article
                      key={key}
                      className={`card ${meta.tab ? "card-clickable" : ""}`}
                      onClick={meta.tab ? () => setActive(meta.tab!) : undefined}
                      role={meta.tab ? "button" : undefined}
                      tabIndex={meta.tab ? 0 : undefined}
                      onKeyDown={meta.tab ? (e) => { if (e.key === "Enter" || e.key === " ") setActive(meta.tab!); } : undefined}
                    >
                      <h3>{meta.label}</h3>
                      <strong>{value}</strong>
                    </article>
                  );
                })}
            </section>
          ) : (
            <section>
              <p>Loading library metrics…</p>
            </section>
          ))}

        {active === "Scan" && (
          <section className="scan-panel">
            <p>
              Add one or more library folders. Each time you add folders, new paths are merged into the list — remove
              any row if you picked one by mistake, or clear the whole list.
            </p>
            <p className="muted">
              Default mode and folder list are loaded from Settings when the app starts. Starting a scan saves your
              current choices back to Settings.
            </p>

            {liveScanProgress && (
              <JobProgressCard title={JOB_PANEL_TITLE.scan} progress={liveScanProgress} />
            )}

            <div className="scan-toolbar">
              <button type="button" onClick={() => void addScanFolders()} disabled={scanRunning}>
                Add folders…
              </button>
              <button type="button" onClick={() => clearScanFolders()} disabled={scanRunning || scanFolders.length === 0}>
                Clear all
              </button>
              <label className="scan-mode">
                Mode
                <select
                  value={scanMode}
                  onChange={(e) => setScanMode(e.target.value as ScanMode)}
                  disabled={scanRunning}
                >
                  <option value="strict">Strict</option>
                  <option value="balanced">Balanced</option>
                  <option value="loose">Loose</option>
                </select>
              </label>
            </div>

            {scanFolders.length > 0 ? (
              <ul className="folder-list">
                {scanFolders.map((p) => (
                  <li key={p}>
                    <span className="folder-path" title={p}>
                      {p}
                    </span>
                    <button type="button" disabled={scanRunning} onClick={() => removeScanFolder(p)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No folders selected yet.</p>
            )}

            <div className="scan-actions">
              <button
                type="button"
                onClick={() => void startLibraryScan()}
                disabled={scanRunning || scanFolders.length === 0}
              >
                Start scan
              </button>
              <button type="button" onClick={() => void stopScan()} disabled={!scanRunning}>
                Stop scan
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => void resetScanData()}
                disabled={scanRunning || bulkDuplicateRunning}
                title="Remove all indexed tracks, file records, and duplicate groups"
              >
                Clear scan data
              </button>
            </div>
          </section>
        )}

        {active === "Duplicates" && api && (
          <DuplicatesView
            groups={groups}
            liveBulkDuplicateProgress={liveBulkDuplicateProgress}
            bulkDuplicateRunning={bulkDuplicateRunning}
            onStartBulkRefresh={() => void startBulkDuplicateRefresh()}
            onStopBulkRefresh={() => void stopBulkDuplicateRefresh()}
            onApplyKeep={(gid, fid) => applyKeep(gid, fid)}
            onDeleteCandidate={(gid, fid) => deleteDuplicateCandidate(gid, fid)}
            onSkipGroup={(gid) => skipDuplicateGroup(gid)}
            onRevealInFolder={(p) => revealInFolder(p)}
            pathToMediaUrl={(p) => api.pathToMediaUrl(p)}
            busy={isAppBusy}
          />
        )}

        {active === "Quarantine" && (
          <section>
            {quarantine.length === 0 ? (
              <p className="muted">No quarantined files.</p>
            ) : (
              <>
                <p className="muted">{quarantine.length} file{quarantine.length !== 1 ? "s" : ""} in quarantine</p>
                {quarantine.map((item) => (
                  <article key={item.id} className="card quarantine-card">
                    <h3 className="quarantine-path" title={item.originalPath}>{item.originalPath}</h3>
                    <p className="quarantine-meta">
                      {item.reason} &middot; {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <div className="quarantine-actions">
                      <button type="button" onClick={() => void restoreItem(item.id)}>Restore</button>
                      <button type="button" className="btn-danger" onClick={() => void deleteQuarantinePermanently(item.id)}>
                        Delete permanently
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
          </section>
        )}

        {active === "History" && <HistoryView onStatus={showStatus} />}
        {active === "Explorer" && <ExplorerView onStatus={showStatus} busy={isAppBusy} />}
        {active === "Devices" && <DevicesView onStatus={showStatus} busy={isAppBusy} />}
        {active === "Settings" && <SettingsView onApplied={applySettingsFromServer} onStatus={(msg) => showStatus(msg, "info")} />}
      </main>
      {isAppBusy && (
        <div
          className="global-busy-overlay"
          role="status"
          aria-live="polite"
          onClick={() => showStatus("Process running, please wait", "info")}
        >
          <div className="global-busy-dialog">
            <div className="global-busy-spinner" />
            <p>Processing... Please wait</p>
          </div>
        </div>
      )}
    </div>
  );
}
