import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import type { FsEntry, IpodDevice, IpodLibrary, IpodTrack } from "../ipc/types";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type SubTab = "library" | "explorer" | "info";

type Props = {
  onStatus: (message: string, type: "info" | "success" | "error") => void;
};

const ALL_GENRES = "__all_genres__";
const UNKNOWN_GENRE = "__unknown_genre__";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileExtension(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot >= 0 ? filePath.slice(dot) : "";
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeGenre(value: string | null | undefined): string {
  const genre = normalizeText(value);
  return genre.length > 0 ? genre : UNKNOWN_GENRE;
}

export function DevicesView({ onStatus }: Props): ReactElement {
  const api = window.appApi;
  const [devices, setDevices] = useState<IpodDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<IpodDevice | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("library");

  const [library, setLibrary] = useState<IpodLibrary | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>(ALL_GENRES);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());

  const [fsEntries, setFsEntries] = useState<FsEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [explorerLoading, setExplorerLoading] = useState(false);

  const scanForDevices = useCallback(async () => {
    if (!api) return;
    setScanning(true);
    try {
      const result = (await api.detectIpods()) as Envelope<IpodDevice[]>;
      if (result.ok) {
        setDevices(result.data);
        if (result.data.length === 0) {
          onStatus("No iPod devices found. Make sure your iPod is connected and in disk mode.", "info");
        } else {
          onStatus(`Found ${result.data.length} iPod device(s).`, "success");
        }
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setScanning(false);
    }
  }, [api, onStatus]);

  useEffect(() => {
    void scanForDevices();
  }, [scanForDevices]);

  const selectDevice = useCallback((device: IpodDevice) => {
    setSelectedDevice(device);
    setLibrary(null);
    setFsEntries([]);
    setCurrentPath("");
    setLibraryFilter("");
    setSelectedGenre(ALL_GENRES);
    setSelectedTrackIds(new Set());
    setSubTab("library");
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!api || !selectedDevice) return;
    setLibraryLoading(true);
    try {
      const result = (await api.getIpodLibrary(selectedDevice.mountPath)) as Envelope<IpodLibrary>;
      if (result.ok) {
        setLibrary(result.data);
        setSelectedTrackIds(new Set());
        setLibraryFilter("");
        setSelectedGenre(ALL_GENRES);
        onStatus(`Loaded ${result.data.tracks.length} tracks from iPod library.`, "success");
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLibraryLoading(false);
    }
  }, [api, selectedDevice, onStatus]);

  useEffect(() => {
    if (selectedDevice && subTab === "library" && !library) {
      void loadLibrary();
    }
  }, [selectedDevice, subTab, library, loadLibrary]);

  const browsePath = useCallback(async (relativePath: string) => {
    if (!api || !selectedDevice) return;
    setExplorerLoading(true);
    try {
      const result = (await api.browseIpod(selectedDevice.mountPath, relativePath)) as Envelope<FsEntry[]>;
      if (result.ok) {
        setFsEntries(result.data);
        setCurrentPath(relativePath);
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setExplorerLoading(false);
    }
  }, [api, selectedDevice, onStatus]);

  useEffect(() => {
    if (selectedDevice && subTab === "explorer") {
      void browsePath("");
    }
  }, [selectedDevice, subTab, browsePath]);

  async function exportSelected() {
    if (!api || !selectedDevice || !library) return;
    const tracksToExport = library.tracks.filter((t) => selectedTrackIds.has(t.id));
    if (tracksToExport.length === 0) {
      onStatus("No tracks selected for export.", "info");
      return;
    }
    try {
      const pickResult = (await api.pickPaths({ mode: "directory", multiple: false, title: "Select export destination" })) as Envelope<{ paths: string[]; dismissed: boolean }>;
      if (!pickResult.ok || pickResult.data.dismissed || pickResult.data.paths.length === 0) return;
      const destDir = pickResult.data.paths[0];
      const payload = tracksToExport.map((t) => ({
        filePath: t.filePath,
        title: t.title,
        artist: t.artist,
        ext: fileExtension(t.filePath)
      }));
      const result = (await api.exportIpodTracks(selectedDevice.mountPath, payload, destDir)) as Envelope<{ exported: string[]; failed: string[] }>;
      if (result.ok) {
        const msg = `Exported ${result.data.exported.length} track(s).`;
        const failMsg = result.data.failed.length > 0 ? ` ${result.data.failed.length} failed.` : "";
        onStatus(msg + failMsg, result.data.failed.length > 0 ? "error" : "success");
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function exportAll() {
    if (!api || !selectedDevice || !library || library.tracks.length === 0) return;
    try {
      const pickResult = (await api.pickPaths({ mode: "directory", multiple: false, title: "Select export destination" })) as Envelope<{ paths: string[]; dismissed: boolean }>;
      if (!pickResult.ok || pickResult.data.dismissed || pickResult.data.paths.length === 0) return;
      const destDir = pickResult.data.paths[0];
      const payload = library.tracks.map((t) => ({
        filePath: t.filePath,
        title: t.title,
        artist: t.artist,
        ext: fileExtension(t.filePath)
      }));
      const result = (await api.exportIpodTracks(selectedDevice.mountPath, payload, destDir)) as Envelope<{ exported: string[]; failed: string[] }>;
      if (result.ok) {
        const msg = `Exported ${result.data.exported.length} track(s).`;
        const failMsg = result.data.failed.length > 0 ? ` ${result.data.failed.length} failed.` : "";
        onStatus(msg + failMsg, result.data.failed.length > 0 ? "error" : "success");
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function copyFilesToDevice() {
    if (!api || !selectedDevice) return;
    try {
      const pickResult = (await api.pickPaths({ mode: "file", multiple: true, title: "Select files to copy to iPod" })) as Envelope<{ paths: string[]; dismissed: boolean }>;
      if (!pickResult.ok || pickResult.data.dismissed || pickResult.data.paths.length === 0) return;
      const result = (await api.copyToIpod(selectedDevice.mountPath, currentPath, pickResult.data.paths)) as Envelope<{ copied: string[]; failed: string[] }>;
      if (result.ok) {
        const failMsg = result.data.failed.length > 0 ? ` ${result.data.failed.length} failed.` : "";
        onStatus(`Copied ${result.data.copied.length} file(s) to device.${failMsg}`, result.data.failed.length > 0 ? "error" : "success");
        void browsePath(currentPath);
      } else {
        onStatus(result.error.message, "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  async function deleteFile(entry: FsEntry) {
    if (!api || !selectedDevice) return;
    try {
      const confirm = (await api.confirmDialog({
        message: `Delete "${entry.name}" from device?`,
        detail: "This cannot be undone.",
        confirmButton: "Delete"
      })) as Envelope<{ confirmed: boolean; checkboxChecked: boolean }>;
      if (!confirm.ok || !confirm.data.confirmed) return;
      const rel = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      const result = (await api.deleteFromIpod(selectedDevice.mountPath, [rel])) as Envelope<{ deleted: string[]; failed: string[] }>;
      if (result.ok && result.data.deleted.length > 0) {
        onStatus("File deleted.", "success");
        void browsePath(currentPath);
      } else {
        onStatus("Failed to delete file.", "error");
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e), "error");
    }
  }

  function toggleTrack(id: number) {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const tracks = useMemo(() => library?.tracks ?? [], [library]);
  const normalizedQuery = libraryFilter.trim().toLowerCase();

  const genreOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const track of tracks) {
      const genre = normalizeGenre(track.genre);
      seen.add(genre);
    }
    const sorted = Array.from(seen)
      .filter((genre) => genre !== UNKNOWN_GENRE)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    if (seen.has(UNKNOWN_GENRE)) sorted.push(UNKNOWN_GENRE);
    return sorted;
  }, [tracks]);

  const filteredTracks = useMemo<IpodTrack[]>(() => {
    if (!library) return [];
    return tracks.filter((track) => {
      const title = normalizeText(track.title).toLowerCase();
      const artist = normalizeText(track.artist).toLowerCase();
      const album = normalizeText(track.album).toLowerCase();
      const genre = normalizeText(track.genre).toLowerCase();
      const normalizedTrackGenre = normalizeGenre(track.genre);
      const matchesText = !normalizedQuery
        || title.includes(normalizedQuery)
        || artist.includes(normalizedQuery)
        || album.includes(normalizedQuery)
        || genre.includes(normalizedQuery);
      const matchesGenre = selectedGenre === ALL_GENRES || normalizedTrackGenre === selectedGenre;
      return matchesText && matchesGenre;
    });
  }, [library, tracks, normalizedQuery, selectedGenre]);

  const visibleTrackIdSet = useMemo(() => new Set(filteredTracks.map((t) => t.id)), [filteredTracks]);
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const id of selectedTrackIds) {
      if (visibleTrackIdSet.has(id)) count++;
    }
    return count;
  }, [selectedTrackIds, visibleTrackIdSet]);
  const allVisibleSelected = filteredTracks.length > 0 && selectedVisibleCount === filteredTracks.length;
  const hasHiddenSelected = selectedTrackIds.size > selectedVisibleCount;

  function toggleAllTracks() {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      const everyVisibleSelected = filteredTracks.length > 0 && filteredTracks.every((track) => next.has(track.id));
      for (const track of filteredTracks) {
        if (everyVisibleSelected) next.delete(track.id);
        else next.add(track.id);
      }
      return next;
    });
  }

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const usedPct = selectedDevice && selectedDevice.totalBytes > 0
    ? Math.round((selectedDevice.usedBytes / selectedDevice.totalBytes) * 100)
    : 0;

  return (
    <section className="devices-view">
      <div className="devices-toolbar">
        <button type="button" onClick={() => void scanForDevices()} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan for devices"}
        </button>
      </div>

      {devices.length > 0 && (
        <div className="device-list">
          {devices.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`device-card ${selectedDevice?.id === d.id ? "device-card-selected" : ""}`}
              onClick={() => selectDevice(d)}
            >
              <strong className="device-card-name">{d.modelName}</strong>
              <span className="device-card-storage">{formatBytes(d.freeBytes)} free of {formatBytes(d.totalBytes)}</span>
            </button>
          ))}
        </div>
      )}

      {devices.length === 0 && !scanning && (
        <p className="muted">
          No iPod devices detected. Connect your iPod in disk mode and click &ldquo;Scan for devices&rdquo;.
        </p>
      )}

      {selectedDevice && (
        <>
          <nav className="device-sub-nav">
            {(["library", "explorer", "info"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`device-sub-nav-btn ${subTab === tab ? "active" : ""}`}
                onClick={() => setSubTab(tab)}
              >
                {tab === "library" ? "Library" : tab === "explorer" ? "File Explorer" : "Device Info"}
              </button>
            ))}
          </nav>

          {subTab === "library" && (
            <div className="device-library-panel">
              {libraryLoading ? (
                <p className="muted">Reading iPod library…</p>
              ) : library ? (
                <>
                  <div className="library-toolbar">
                    <input
                      type="text"
                      className="library-filter"
                      placeholder="Search tracks…"
                      value={libraryFilter}
                      onChange={(e) => setLibraryFilter(e.target.value)}
                    />
                    <select
                      className="library-filter library-genre-filter"
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                    >
                      <option value={ALL_GENRES}>All genres</option>
                      {genreOptions.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre === UNKNOWN_GENRE ? "Unknown / Unspecified" : genre}
                        </option>
                      ))}
                    </select>
                    {(libraryFilter || selectedGenre !== ALL_GENRES) && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setLibraryFilter("");
                          setSelectedGenre(ALL_GENRES);
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                    <span className="library-count">
                      {filteredTracks.length} visible / {tracks.length} total
                    </span>
                    {selectedTrackIds.size > 0 && (
                      <span className="library-count">
                        Selected {selectedVisibleCount} visible / {selectedTrackIds.size} total{hasHiddenSelected ? " (includes hidden matches)" : ""}
                      </span>
                    )}
                    <button type="button" onClick={() => void exportSelected()} disabled={selectedTrackIds.size === 0}>
                      Export selected ({selectedTrackIds.size})
                    </button>
                    <button type="button" onClick={() => void exportAll()}>
                      Export all
                    </button>
                    <button type="button" onClick={() => void loadLibrary()}>Reload</button>
                  </div>
                  <div className="ipod-library-table-wrap">
                    <table className="ipod-library-table">
                      <thead>
                        <tr>
                          <th className="col-checkbox">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleAllTracks}
                            />
                          </th>
                          <th>Title</th>
                          <th>Artist</th>
                          <th>Album</th>
                          <th>Genre</th>
                          <th>Duration</th>
                          <th>Bitrate</th>
                          <th>Plays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTracks.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="library-empty">
                              No tracks match the current filters.
                            </td>
                          </tr>
                        ) : (
                          filteredTracks.map((t) => (
                            <tr key={t.id} className={selectedTrackIds.has(t.id) ? "row-selected" : ""}>
                              <td className="col-checkbox">
                                <input type="checkbox" checked={selectedTrackIds.has(t.id)} onChange={() => toggleTrack(t.id)} />
                              </td>
                              <td title={t.title}>{t.title || "(untitled)"}</td>
                              <td title={t.artist}>{t.artist || "—"}</td>
                              <td title={t.album}>{t.album || "—"}</td>
                              <td title={t.genre}>{normalizeGenre(t.genre) === UNKNOWN_GENRE ? "Unknown / Unspecified" : t.genre}</td>
                              <td>{t.durationMs > 0 ? formatDuration(t.durationMs) : "—"}</td>
                              <td>{t.bitrate > 0 ? `${t.bitrate} kbps` : "—"}</td>
                              <td>{t.playCount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted">Could not load iPod library.</p>
              )}
            </div>
          )}

          {subTab === "explorer" && (
            <div className="file-explorer">
              <div className="explorer-breadcrumbs">
                <button type="button" onClick={() => void browsePath("")} className="breadcrumb-btn">/</button>
                {breadcrumbs.map((seg, i) => {
                  const pathUpTo = breadcrumbs.slice(0, i + 1).join("/");
                  return (
                    <span key={pathUpTo}>
                      <span className="breadcrumb-sep">/</span>
                      <button type="button" onClick={() => void browsePath(pathUpTo)} className="breadcrumb-btn">{seg}</button>
                    </span>
                  );
                })}
              </div>

              <div className="explorer-toolbar">
                <button type="button" onClick={() => void copyFilesToDevice()}>
                  Copy files to device…
                </button>
                <button type="button" onClick={() => void browsePath(currentPath)} disabled={explorerLoading}>
                  Refresh
                </button>
              </div>

              {explorerLoading ? (
                <p className="muted">Loading…</p>
              ) : (
                <div className="explorer-list">
                  {currentPath && (
                    <button
                      type="button"
                      className="explorer-entry explorer-entry-dir"
                      onClick={() => {
                        const parts = currentPath.split("/").filter(Boolean);
                        parts.pop();
                        void browsePath(parts.join("/"));
                      }}
                    >
                      <span className="entry-icon">📁</span>
                      <span className="entry-name">..</span>
                      <span className="entry-size"></span>
                      <span className="entry-date"></span>
                    </button>
                  )}
                  {fsEntries.map((entry) => (
                    <div key={entry.name} className={`explorer-entry ${entry.type === "directory" ? "explorer-entry-dir" : "explorer-entry-file"}`}>
                      {entry.type === "directory" ? (
                        <button
                          type="button"
                          className="entry-link"
                          onClick={() => void browsePath(currentPath ? `${currentPath}/${entry.name}` : entry.name)}
                        >
                          <span className="entry-icon">📁</span>
                          <span className="entry-name">{entry.name}</span>
                        </button>
                      ) : (
                        <>
                          <span className="entry-icon">📄</span>
                          <span className="entry-name" title={entry.name}>{entry.name}</span>
                        </>
                      )}
                      <span className="entry-size">{entry.type === "file" ? formatBytes(entry.sizeBytes) : ""}</span>
                      <span className="entry-date">{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleDateString() : ""}</span>
                      {entry.type === "file" && (
                        <button type="button" className="btn-danger entry-delete" onClick={() => void deleteFile(entry)}>
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                  {fsEntries.length === 0 && <p className="muted">Empty directory.</p>}
                </div>
              )}
            </div>
          )}

          {subTab === "info" && (
            <div className="device-info-panel">
              <article className="card device-info-card">
                <h3>{selectedDevice.modelName}</h3>
                <dl className="device-info-dl">
                  <div><dt>Model Number</dt><dd>{selectedDevice.modelNumber || "—"}</dd></div>
                  <div><dt>Generation</dt><dd>{selectedDevice.generation}</dd></div>
                  <div><dt>Serial Number</dt><dd>{selectedDevice.serialNumber || "—"}</dd></div>
                  <div><dt>Firmware</dt><dd>{selectedDevice.firmwareVersion}</dd></div>
                  <div><dt>Mount Path</dt><dd><code>{selectedDevice.mountPath}</code></dd></div>
                </dl>

                <h4>Storage</h4>
                <div className="storage-bar" title={`${usedPct}% used`}>
                  <div className="storage-bar-used" style={{ width: `${usedPct}%` }}></div>
                </div>
                <div className="storage-labels">
                  <span>{formatBytes(selectedDevice.usedBytes)} used</span>
                  <span>{formatBytes(selectedDevice.freeBytes)} free</span>
                  <span>{formatBytes(selectedDevice.totalBytes)} total</span>
                </div>
              </article>
            </div>
          )}
        </>
      )}
    </section>
  );
}
