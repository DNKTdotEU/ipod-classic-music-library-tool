import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { AppPathsInfo, LogLevel, ScanMode, UserSettings } from "../ipc/types";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type Props = {
  /** Called after a successful save so the Scan tab can stay in sync. */
  onApplied: (settings: UserSettings) => void;
  onStatus: (message: string) => void;
};

export function SettingsView({ onApplied, onStatus }: Props): ReactElement {
  const api = window.appApi;
  const [paths, setPaths] = useState<AppPathsInfo | null>(null);
  const [defaultScanMode, setDefaultScanMode] = useState<ScanMode>("balanced");
  const [logLevel, setLogLevel] = useState<LogLevel>("info");
  const [foldersText, setFoldersText] = useState("");
  const [suppressKeepConfirm, setSuppressKeepConfirm] = useState(false);
  const [suppressDeleteConfirm, setSuppressDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!api?.getSettings || !api?.getAppPaths) {
      onStatus("Update the app build (preload) to use Settings.");
      return;
    }
    try {
      const [s, p] = await Promise.all([
        api.getSettings() as Promise<Envelope<UserSettings>>,
        api.getAppPaths() as Promise<Envelope<AppPathsInfo>>
      ]);
      if (s.ok) {
        setDefaultScanMode(s.data.defaultScanMode);
        setLogLevel(s.data.logLevel);
        setFoldersText(s.data.lastScanFolders.join("\n"));
        setSuppressKeepConfirm(s.data.suppressKeepConfirm);
        setSuppressDeleteConfirm(s.data.suppressDeleteConfirm);
      } else {
        onStatus(s.error.message);
      }
      if (p.ok) {
        setPaths(p.data);
      } else {
        onStatus(p.error.message);
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e));
    }
  }, [api, onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!api?.setSettings) {
      onStatus("Update the app build (preload) to use Settings.");
      return;
    }
    const lines = foldersText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setSaving(true);
    try {
      const result = (await api.setSettings({
        defaultScanMode,
        logLevel,
        lastScanFolders: lines
      })) as Envelope<UserSettings>;
      if (result.ok) {
        onApplied(result.data);
        onStatus("Settings saved.");
      } else {
        onStatus(result.error.message);
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <p className="settings-intro">
        Defaults apply when you open the app. The Scan tab uses the same values; starting a scan also updates your
        saved default mode and last folder list.
      </p>

      <div className="settings-grid">
        <label className="settings-field">
          Default scan mode
          <select
            value={defaultScanMode}
            onChange={(e) => setDefaultScanMode(e.target.value as ScanMode)}
            className="settings-select"
          >
            <option value="strict">Strict — slower analysis, stricter duplicate matching</option>
            <option value="balanced">Balanced — recommended</option>
            <option value="loose">Loose — faster, more candidate matches</option>
          </select>
        </label>

        <label className="settings-field">
          Log level
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value as LogLevel)}
            className="settings-select"
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </label>

        <label className="settings-field settings-field-full">
          Last scan folders (one path per line)
          <textarea
            className="settings-textarea"
            rows={6}
            value={foldersText}
            onChange={(e) => setFoldersText(e.target.value)}
            spellCheck={false}
            placeholder={"/Music/Master\n/Archive/FLAC"}
          />
        </label>
      </div>

      <h3 className="settings-section-title">Confirmation dialogs</h3>
      <div className="settings-grid">
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={!suppressKeepConfirm}
            onChange={async (e) => {
              const value = !e.target.checked;
              setSuppressKeepConfirm(value);
              if (api?.setSettings) {
                const res = (await api.setSettings({ suppressKeepConfirm: value })) as Envelope<UserSettings>;
                if (res.ok) onApplied(res.data);
              }
            }}
          />
          Ask before &ldquo;Keep This&rdquo; deletes other duplicates
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={!suppressDeleteConfirm}
            onChange={async (e) => {
              const value = !e.target.checked;
              setSuppressDeleteConfirm(value);
              if (api?.setSettings) {
                const res = (await api.setSettings({ suppressDeleteConfirm: value })) as Envelope<UserSettings>;
                if (res.ok) onApplied(res.data);
              }
            }}
          />
          Ask before deleting individual duplicate files
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={saving}>
          Reload
        </button>
      </div>

      {paths && (
        <div className="settings-paths">
          <h3 className="settings-paths-title">App data locations</h3>
          <dl className="settings-paths-dl">
            <div>
              <dt>User data</dt>
              <dd>
                <code>{paths.userDataPath}</code>
              </dd>
            </div>
            <div>
              <dt>Library database</dt>
              <dd>
                <code>{paths.dbPath}</code>
              </dd>
            </div>
            <div>
              <dt>Quarantine</dt>
              <dd>
                <code>{paths.quarantineDir}</code>
              </dd>
            </div>
            <div>
              <dt>Preferences file</dt>
              <dd>
                <code>{paths.preferencesPath}</code>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
