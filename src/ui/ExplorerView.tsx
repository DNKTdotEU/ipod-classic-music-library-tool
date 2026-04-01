import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { isMediaFilePath, isVideoFilePath } from "../media/fileMedia";
import type { ExplorerMetadata } from "../ipc/types";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
type Entry = { name: string; type: "directory" | "file"; sizeBytes: number; modifiedAt: string };

type SmartPreset = "missing_tags" | "low_bitrate" | "short_duration" | "duplicate_like_name" | "non_audio" | "genre";

type Props = {
  onStatus: (message: string, type: "info" | "success" | "error") => void;
  busy: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const n = bytes / Math.pow(1024, idx);
  return `${n.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function splitName(filePath: string): { stem: string; ext: string } {
  const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const filename = slash >= 0 ? filePath.slice(slash + 1) : filePath;
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, dot), ext: filename.slice(dot) };
}

function safeTokenValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

export function ExplorerView({ onStatus, busy }: Props): ReactElement {
  const api = window.appApi;
  const [rootPath, setRootPath] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "file" | "directory">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string>("");
  const [metadata, setMetadata] = useState<ExplorerMetadata | null>(null);
  const [renamePattern, setRenamePattern] = useState("{artist} - {title}");
  const [genreFilter, setGenreFilter] = useState("");
  const [genreFilteredPaths, setGenreFilteredPaths] = useState<Set<string> | null>(null);
  const [previewingRename, setPreviewingRename] = useState(false);
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      const rel = currentPath ? `${currentPath}/${e.name}` : e.name;
      if (genreFilteredPaths && !genreFilteredPaths.has(rel)) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q);
    });
  }, [entries, search, filter, currentPath, genreFilteredPaths]);

  const rankedVisible = useMemo(() => {
    return [...visible].sort((a, b) => {
      const relA = currentPath ? `${currentPath}/${a.name}` : a.name;
      const relB = currentPath ? `${currentPath}/${b.name}` : b.name;
      const aSelected = selected.has(relA);
      const bSelected = selected.has(relB);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [visible, currentPath, selected]);

  const visibleRelativePaths = useMemo(
    () => rankedVisible.map((entry) => (currentPath ? `${currentPath}/${entry.name}` : entry.name)),
    [rankedVisible, currentPath]
  );

  const selectedVisibleCount = useMemo(
    () => visibleRelativePaths.filter((rel) => selected.has(rel)).length,
    [visibleRelativePaths, selected]
  );

  const allVisibleSelected = visibleRelativePaths.length > 0 && selectedVisibleCount === visibleRelativePaths.length;
  const uiBusy = busy || loading || previewingRename || actionLoading !== null;

  async function withActionLoading(label: string, action: () => Promise<void>) {
    setActionLoading(label);
    onStatus(`${label}...`, "info");
    try {
      await action();
    } finally {
      setActionLoading(null);
    }
  }

  function keepListScrollStable(update: () => void) {
    const list = listRef.current;
    const previousTop = list?.scrollTop ?? 0;
    update();
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = previousTop;
    });
  }

  function scrollToActiveFile() {
    if (!activeFile) return;
    const rel = currentPath ? `${currentPath}/${activeFile}` : activeFile;
    rowRefs.current[rel]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function pickRoot() {
    if (!api) return;
    const picked = (await api.pickPaths({
      mode: "directory",
      multiple: false,
      title: "Select explorer root folder"
    })) as Envelope<{ paths: string[]; dismissed: boolean }>;
    if (!picked.ok) {
      onStatus(picked.error.message, "error");
      return;
    }
    if (picked.data.dismissed || picked.data.paths.length === 0) return;
    const root = picked.data.paths[0]!;
    setRootPath(root);
    setCurrentPath("");
    setSelected(new Set());
    await browse(root, "");
  }

  async function browse(root: string, rel: string) {
    if (!api) return;
    setLoading(true);
    try {
      const res = (await api.explorerList(root, rel)) as Envelope<Entry[]>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      setEntries(res.data);
      setCurrentPath(rel);
      setSelected(new Set());
      setActiveFile("");
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!rootPath || uiBusy) return;
    await browse(rootPath, currentPath);
  }

  async function cleanupSelected() {
    if (!api || !rootPath || selected.size === 0 || uiBusy) return;
    await withActionLoading("Deleting selected items", async () => {
      const relPaths = Array.from(selected);
      const confirm = (await api.confirmDialog({
        message: `Delete ${relPaths.length} selected item(s)?`,
        detail: "This permanently deletes files/folders from disk.",
        confirmButton: "Delete selected"
      })) as Envelope<{ confirmed: boolean }>;
      if (!confirm.ok || !confirm.data.confirmed) return;
      const res = (await api.explorerDelete(rootPath, relPaths)) as Envelope<{ deleted: string[]; failed: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      const failed = res.data.failed.length;
      onStatus(
        `Deleted ${res.data.deleted.length} item(s).${failed > 0 ? ` ${failed} failed.` : ""}`,
        failed > 0 ? "error" : "success"
      );
      await refresh();
    });
  }

  async function moveSelectedToQuarantine() {
    if (!api || !rootPath || selected.size === 0 || uiBusy) return;
    await withActionLoading("Moving selected items to quarantine", async () => {
      const relPaths = Array.from(selected);
      const confirm = (await api.confirmDialog({
        message: `Move ${relPaths.length} selected item(s) to quarantine?`,
        detail: "Files will be moved out of your library and can be restored from Quarantine.",
        confirmButton: "Move to quarantine"
      })) as Envelope<{ confirmed: boolean }>;
      if (!confirm.ok || !confirm.data.confirmed) return;
      const res = (await api.explorerQuarantine(rootPath, relPaths)) as Envelope<{ moved: string[]; failed: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      const failed = res.data.failed.length;
      onStatus(`Moved ${res.data.moved.length} item(s) to quarantine.${failed > 0 ? ` ${failed} failed.` : ""}`, failed > 0 ? "error" : "success");
      await refresh();
    });
  }

  async function addToIgnore() {
    if (!api || !rootPath || selected.size === 0 || uiBusy) return;
    await withActionLoading("Updating ignore list", async () => {
      const relPaths = Array.from(selected);
      const res = (await api.explorerIgnore(rootPath, relPaths, "add")) as Envelope<{ ignoredExplorerPaths: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      setIgnoredPaths(res.data.ignoredExplorerPaths);
      onStatus(`Added ${relPaths.length} path(s) to ignore list.`, "success");
    });
  }

  async function runSmartFilter(preset: SmartPreset) {
    if (!api || !rootPath || uiBusy) return;
    await withActionLoading("Applying smart filter", async () => {
      const res = (await api.explorerSmartFilter(rootPath, currentPath, preset, undefined, 128, 30)) as Envelope<{ relativePaths: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      const filtered = res.data.relativePaths.filter((rel) => {
        if (!currentPath) return true;
        return rel.startsWith(`${currentPath}/`);
      });
      setSelected(new Set(filtered));
      onStatus(`Smart filter selected ${filtered.length} item(s).`, "info");
    });
  }

  async function applyGenreFilter() {
    if (!api || !rootPath || uiBusy) return;
    await withActionLoading("Applying genre filter", async () => {
      if (!genreFilter.trim()) {
        setGenreFilteredPaths(null);
        onStatus("Genre filter cleared.", "info");
        return;
      }
      const res = (await api.explorerSmartFilter(rootPath, currentPath, "genre", genreFilter.trim())) as Envelope<{ relativePaths: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      setGenreFilteredPaths(new Set(res.data.relativePaths));
      onStatus(`Genre filter applied: ${res.data.relativePaths.length} match(es).`, "info");
    });
  }

  async function previewBulkRename() {
    if (!api || !rootPath || selected.size === 0 || uiBusy) return;
    setPreviewingRename(true);
    await withActionLoading("Preparing rename preview", async () => {
      try {
        const relPaths = Array.from(selected).sort();
        const items = await Promise.all(relPaths.map(async (rel, idx) => {
          const { stem, ext } = splitName(rel);
          const md = (await api.explorerGetMetadata(rootPath, rel)) as Envelope<ExplorerMetadata>;
          const title = safeTokenValue(md.ok ? md.data.media?.title : null) || stem;
          const artist = safeTokenValue(md.ok ? md.data.media?.artist : null) || "Unknown Artist";
          const album = safeTokenValue(md.ok ? md.data.media?.album : null) || "Unknown Album";
          const genre = safeTokenValue(md.ok ? md.data.media?.genre : null) || "";
          const rendered = renamePattern
            .replaceAll("{index}", String(idx + 1))
            .replaceAll("{name}", stem)
            .replaceAll("{ext}", ext ? ext.slice(1) : "")
            .replaceAll("{title}", title)
            .replaceAll("{artist}", artist)
            .replaceAll("{album}", album)
            .replaceAll("{genre}", genre)
            .trim();
          const base = rendered.length > 0 ? rendered : stem;
          const target = base.includes(".") || ext.length === 0 ? base : `${base}${ext}`;
          return { fromRelativePath: rel, toFilename: target };
        }));
        const res = (await api.explorerBulkRename(rootPath, items, true)) as Envelope<{ renamed: Array<{ from: string; to: string }>; failed: string[] }>;
        if (!res.ok) {
          onStatus(res.error.message, "error");
          return;
        }
        onStatus(`Rename preview: ${res.data.renamed.length} item(s) ready.${res.data.failed.length ? ` ${res.data.failed.length} invalid.` : ""}`, "info");
      } finally {
        setPreviewingRename(false);
      }
    });
  }

  async function applyBulkRename() {
    if (!api || !rootPath || selected.size === 0 || uiBusy) return;
    await withActionLoading("Applying bulk rename", async () => {
      const relPaths = Array.from(selected).sort();
      const items = await Promise.all(relPaths.map(async (rel, idx) => {
        const { stem, ext } = splitName(rel);
        const md = (await api.explorerGetMetadata(rootPath, rel)) as Envelope<ExplorerMetadata>;
        const title = safeTokenValue(md.ok ? md.data.media?.title : null) || stem;
        const artist = safeTokenValue(md.ok ? md.data.media?.artist : null) || "Unknown Artist";
        const album = safeTokenValue(md.ok ? md.data.media?.album : null) || "Unknown Album";
        const genre = safeTokenValue(md.ok ? md.data.media?.genre : null) || "";
        const rendered = renamePattern
          .replaceAll("{index}", String(idx + 1))
          .replaceAll("{name}", stem)
          .replaceAll("{ext}", ext ? ext.slice(1) : "")
          .replaceAll("{title}", title)
          .replaceAll("{artist}", artist)
          .replaceAll("{album}", album)
          .replaceAll("{genre}", genre)
          .trim();
        const base = rendered.length > 0 ? rendered : stem;
        const target = base.includes(".") || ext.length === 0 ? base : `${base}${ext}`;
        return { fromRelativePath: rel, toFilename: target };
      }));
      const res = (await api.explorerBulkRename(rootPath, items, false)) as Envelope<{ renamed: Array<{ from: string; to: string }>; failed: string[] }>;
      if (!res.ok) {
        onStatus(res.error.message, "error");
        return;
      }
      onStatus(`Renamed ${res.data.renamed.length} item(s).${res.data.failed.length ? ` ${res.data.failed.length} failed.` : ""}`, res.data.failed.length ? "error" : "success");
      await refresh();
    });
  }

  function toggleSelectAllVisible() {
    keepListScrollStable(() => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) {
          for (const rel of visibleRelativePaths) next.delete(rel);
        } else {
          for (const rel of visibleRelativePaths) next.add(rel);
        }
        return next;
      });
    });
  }

  useEffect(() => {
    if (!api || !rootPath || !activeFile) return;
    void (async () => {
      const rel = currentPath ? `${currentPath}/${activeFile}` : activeFile;
      const res = (await api.explorerGetMetadata(rootPath, rel)) as Envelope<ExplorerMetadata>;
      if (res.ok) {
        setMetadata(res.data);
      }
    })();
  }, [api, rootPath, currentPath, activeFile]);

  useEffect(() => {
    if (!api) return;
    void (async () => {
      const settings = (await api.getSettings()) as Envelope<{ ignoredExplorerPaths?: string[] }>;
      if (settings.ok) setIgnoredPaths(settings.data.ignoredExplorerPaths ?? []);
    })();
  }, [api]);

  const crumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  if (!api) {
    return <section className="explorer-view"><p className="muted">Explorer API unavailable.</p></section>;
  }

  return (
    <section className="explorer-view explorer-split">
      <div className="explorer-header">
        <button type="button" onClick={() => void pickRoot()} disabled={uiBusy}>Choose root folder…</button>
        <button type="button" onClick={() => void refresh()} disabled={!rootPath || uiBusy}>Refresh</button>
        <button type="button" onClick={() => void moveSelectedToQuarantine()} disabled={selected.size === 0 || uiBusy}>Move to quarantine</button>
        <button type="button" onClick={() => void addToIgnore()} disabled={selected.size === 0 || uiBusy}>Ignore in scans</button>
        <button type="button" className="btn-danger" onClick={() => void cleanupSelected()} disabled={selected.size === 0 || uiBusy}>
          Cleanup selected ({selected.size})
        </button>
      </div>
      {rootPath ? (
        <>
          <p className="muted">Root: <code>{rootPath}</code></p>
          <div className="explorer-breadcrumbs">
            <button type="button" className="breadcrumb-btn" onClick={() => void browse(rootPath, "")}>/</button>
            {crumbs.map((seg, idx) => {
              const rel = crumbs.slice(0, idx + 1).join("/");
              return (
                <span key={rel}>
                  <span className="breadcrumb-sep">/</span>
                  <button type="button" className="breadcrumb-btn" onClick={() => void browse(rootPath, rel)}>{seg}</button>
                </span>
              );
            })}
          </div>
          <div className="library-toolbar">
            <input
              className="library-filter"
              value={search}
              disabled={uiBusy}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search current folder..."
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "file" | "directory")} className="library-filter" disabled={uiBusy}>
              <option value="all">All</option>
              <option value="file">Files</option>
              <option value="directory">Folders</option>
            </select>
            <span className="library-count">{visible.length} item(s)</span>
            <input
              className="library-filter"
              value={genreFilter}
              disabled={uiBusy}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="Filter by genre (e.g. rock)"
            />
            <button type="button" onClick={() => void applyGenreFilter()} disabled={uiBusy}>
              Apply genre
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setGenreFilter("");
                setGenreFilteredPaths(null);
              }}
              disabled={uiBusy || (!genreFilter && !genreFilteredPaths)}
            >
              Clear genre
            </button>
            <button
              type="button"
              onClick={() => toggleSelectAllVisible()}
              disabled={uiBusy || visibleRelativePaths.length === 0}
            >
              {allVisibleSelected ? "Clear visible selection" : "Select all visible"}
            </button>
          </div>
          <div className="explorer-smart-filters">
            <button type="button" onClick={() => void runSmartFilter("missing_tags")} disabled={uiBusy}>Missing tags</button>
            <button type="button" onClick={() => void runSmartFilter("low_bitrate")} disabled={uiBusy}>Low bitrate</button>
            <button type="button" onClick={() => void runSmartFilter("short_duration")} disabled={uiBusy}>Short songs</button>
            <button type="button" onClick={() => void runSmartFilter("duplicate_like_name")} disabled={uiBusy}>Duplicate-like names</button>
            <button type="button" onClick={() => void runSmartFilter("non_audio")} disabled={uiBusy}>Non-audio</button>
          </div>
          <div className="explorer-rename-toolbar">
            <input
              className="library-filter"
              value={renamePattern}
              onChange={(e) => setRenamePattern(e.target.value)}
              disabled={uiBusy}
              placeholder="Rename pattern, e.g. Track {index}"
            />
            <span className="muted">Tokens: {"{index}"}, {"{name}"}, {"{title}"}, {"{artist}"}, {"{album}"}, {"{genre}"}, {"{ext}"}</span>
            <button type="button" onClick={() => void previewBulkRename()} disabled={selected.size === 0 || previewingRename || uiBusy}>Preview rename</button>
            <button type="button" onClick={() => void applyBulkRename()} disabled={selected.size === 0 || uiBusy}>Apply rename</button>
          </div>
          <p className="muted">Ignored paths: {ignoredPaths.length}</p>
          {actionLoading && (
            <p className="explorer-action-loading" aria-live="polite">
              <span className="global-busy-spinner explorer-inline-spinner" />
              {actionLoading}...
            </p>
          )}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="explorer-main">
              {actionLoading && <div className="explorer-main-busy-overlay" />}
              <div className="explorer-list" ref={listRef}>
              {currentPath && (
                <button
                  type="button"
                  className="explorer-entry explorer-entry-dir"
                  onClick={() => {
                    const parts = currentPath.split("/").filter(Boolean);
                    parts.pop();
                    void browse(rootPath, parts.join("/"));
                  }}
                >
                  <span className="entry-icon">📁</span>
                  <span className="entry-name">..</span>
                </button>
              )}
              {rankedVisible.map((entry) => {
                const rel = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                const isSelected = selected.has(rel);
                return (
                  <div
                    key={rel}
                    ref={(el) => { rowRefs.current[rel] = el; }}
                    className={`explorer-entry ${entry.type === "directory" ? "explorer-entry-dir" : "explorer-entry-file"} ${activeFile === entry.name ? "explorer-entry-active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        keepListScrollStable(() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(rel); else next.delete(rel);
                            return next;
                          });
                        });
                      }}
                    />
                    {entry.type === "directory" ? (
                      <button type="button" className="entry-link" onClick={() => void browse(rootPath, rel)}>
                        <span className="entry-icon">📁</span>
                        <span className="entry-name">{entry.name}</span>
                      </button>
                    ) : (
                      <button type="button" className="entry-link" onClick={() => setActiveFile(entry.name)}>
                        <span className="entry-icon">📄</span>
                        <span className="entry-name">{entry.name}</span>
                      </button>
                    )}
                    <span className="entry-size">{entry.type === "file" ? formatBytes(entry.sizeBytes) : ""}</span>
                    <span className="entry-date">{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleDateString() : ""}</span>
                  </div>
                );
              })}
              </div>
              <aside className="explorer-preview-panel">
                {!metadata ? (
                  <p className="muted">Select a file to preview media and inspect metadata.</p>
                ) : (
                  <>
                    <h3>{metadata.relativePath}</h3>
                    <p className="muted">{formatBytes(metadata.sizeBytes)} · {new Date(metadata.modifiedAt).toLocaleString()}</p>
                    {metadata.type === "file" && isMediaFilePath(metadata.absolutePath) ? (
                      <div className="media-preview">
                        {isVideoFilePath(metadata.absolutePath) ? (
                          <video src={api.pathToMediaUrl(metadata.absolutePath)} controls className="media-preview-video" />
                        ) : (
                          <audio src={api.pathToMediaUrl(metadata.absolutePath)} controls className="media-preview-audio" />
                        )}
                      </div>
                    ) : (
                      <p className="muted">Preview unavailable for this file type.</p>
                    )}
                    <div className="explorer-metadata-grid">
                      <span>Title</span><strong>{metadata.media?.title ?? "—"}</strong>
                      <span>Artist</span><strong>{metadata.media?.artist ?? "—"}</strong>
                      <span>Album</span><strong>{metadata.media?.album ?? "—"}</strong>
                      <span>Genre</span><strong>{metadata.media?.genre ?? "—"}</strong>
                      <span>Duration</span><strong>{metadata.media?.durationSec ? `${Math.round(metadata.media.durationSec)} sec` : "—"}</strong>
                      <span>Bitrate</span><strong>{metadata.media?.bitrate ? `${Math.round(metadata.media.bitrate / 1000)} kbps` : "—"}</strong>
                      <span>Sample rate</span><strong>{metadata.media?.sampleRate ? `${metadata.media.sampleRate} Hz` : "—"}</strong>
                      <span>Codec</span><strong>{metadata.media?.codec ?? "—"}</strong>
                      <span>Artwork</span><strong>{metadata.media?.hasArtwork ? "Yes" : "No"}</strong>
                    </div>
                    <div className="duplicate-actions">
                      <button type="button" onClick={() => scrollToActiveFile()}>Go to selected in list</button>
                      <button type="button" onClick={() => void api.showItemInFolder(metadata.absolutePath)}>Show in folder</button>
                    </div>
                  </>
                )}
              </aside>
            </div>
          )}
        </>
      ) : (
        <p className="muted">Choose a root folder to start exploring, searching, filtering, and cleaning up files.</p>
      )}
    </section>
  );
}

