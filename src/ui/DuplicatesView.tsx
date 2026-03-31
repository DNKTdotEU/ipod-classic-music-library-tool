import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { ProgressEvent } from "../ipc/types";
import { JobProgressCard } from "./JobProgressCard";
import { JOB_PANEL_TITLE } from "./progressLabels";
import { isMediaFilePath, isVideoFilePath } from "../media/fileMedia";

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

type Props = {
  groups: DuplicateGroup[];
  liveBulkDuplicateProgress: ProgressEvent | null;
  bulkDuplicateRunning: boolean;
  onStartBulkRefresh: () => void;
  onStopBulkRefresh: () => void;
  onApplyKeep: (groupId: string, fileId: string) => Promise<void>;
  onDeleteCandidate: (groupId: string, fileId: string) => Promise<void>;
  onSkipGroup: (groupId: string) => Promise<void>;
  onRevealInFolder: (filePath: string) => Promise<void>;
  pathToMediaUrl: (absolutePath: string) => string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DuplicatesView({
  groups,
  liveBulkDuplicateProgress,
  bulkDuplicateRunning,
  onStartBulkRefresh,
  onStopBulkRefresh,
  onApplyKeep,
  onDeleteCandidate,
  onSkipGroup,
  onRevealInFolder,
  pathToMediaUrl
}: Props): ReactElement {
  const [groupIndex, setGroupIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(true);

  const filteredGroups = showUnresolvedOnly
    ? groups.filter((g) => g.status !== "user_resolved")
    : groups;

  const unresolvedCount = groups.filter((g) => g.status !== "user_resolved").length;

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setGroupIndex(0);
      setCandidateIndex(0);
      return;
    }
    setGroupIndex((i) => Math.min(i, Math.max(0, filteredGroups.length - 1)));
  }, [filteredGroups.length]);

  const current = filteredGroups[groupIndex];

  useEffect(() => {
    if (!current) {
      setCandidateIndex(0);
      return;
    }
    setCandidateIndex((i) => Math.min(i, Math.max(0, current.candidates.length - 1)));
  }, [current, groupIndex]);

  const selected = current?.candidates[candidateIndex];
  const previewUrl = selected && isMediaFilePath(selected.path) ? pathToMediaUrl(selected.path) : null;

  const goPrevGroup = useCallback(() => {
    setGroupIndex((i) => {
      if (filteredGroups.length <= 1) return 0;
      return (i - 1 + filteredGroups.length) % filteredGroups.length;
    });
  }, [filteredGroups.length]);

  const goNextGroup = useCallback(() => {
    setGroupIndex((i) => {
      if (filteredGroups.length <= 1) return 0;
      return (i + 1) % filteredGroups.length;
    });
  }, [filteredGroups.length]);

  const goPrevCandidate = useCallback(() => {
    if (!current || current.candidates.length <= 1) return;
    setCandidateIndex((i) => (i - 1 + current.candidates.length) % current.candidates.length);
  }, [current]);

  const goNextCandidate = useCallback(() => {
    if (!current || current.candidates.length <= 1) return;
    setCandidateIndex((i) => (i + 1) % current.candidates.length);
  }, [current]);

  return (
    <section className="duplicates-view">
      <p className="duplicates-intro">
        Step through duplicate groups and candidates. Preview and play <strong>audio/video</strong> files in-app.{" "}
        <strong>Keep This</strong> keeps the selected file and permanently deletes all other copies in the group from
        disk. <strong>Delete file</strong> removes only the currently viewed copy. <strong>Skip</strong> marks the group
        as resolved without deleting anything. Both destructive actions ask for confirmation (you can suppress this in
        Settings).
      </p>

      {liveBulkDuplicateProgress && (
        <JobProgressCard title={JOB_PANEL_TITLE.bulk_duplicate} progress={liveBulkDuplicateProgress} />
      )}

      <div className="scan-actions duplicates-toolbar">
        <button type="button" onClick={() => void onStartBulkRefresh()} disabled={bulkDuplicateRunning}>
          Refresh duplicate index
        </button>
        <button type="button" onClick={() => void onStopBulkRefresh()} disabled={!bulkDuplicateRunning}>
          Stop refresh
        </button>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showUnresolvedOnly}
            onChange={(e) => {
              setShowUnresolvedOnly(e.target.checked);
              setGroupIndex(0);
            }}
          />
          Show unresolved only ({unresolvedCount})
        </label>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="muted">
          {groups.length === 0
            ? "No duplicate groups in the library."
            : "All duplicate groups have been resolved."}
        </p>
      ) : (
        <>
          <div className="duplicate-nav duplicate-nav-groups">
            <button type="button" onClick={goPrevGroup} disabled={filteredGroups.length <= 1}>
              &larr; Previous group
            </button>
            <span className="duplicate-nav-label">
              Group {groupIndex + 1} of {filteredGroups.length}
              {!showUnresolvedOnly && unresolvedCount > 0 ? ` (${unresolvedCount} unresolved)` : ""}
            </span>
            <button type="button" onClick={goNextGroup} disabled={filteredGroups.length <= 1}>
              Next group &rarr;
            </button>
          </div>

          {current && (
            <article className="card duplicate-detail">
              <h3>
                {current.title} &mdash; {current.artist}
              </h3>
              <p className="duplicate-meta">
                {current.type} ({Math.round(current.confidence * 100)}%) &middot; {current.status}
              </p>

              <div className="duplicate-nav duplicate-nav-candidates">
                <button type="button" onClick={goPrevCandidate} disabled={current.candidates.length <= 1}>
                  &larr; Previous file
                </button>
                <span className="duplicate-nav-label">
                  File {candidateIndex + 1} of {current.candidates.length}
                </span>
                <button type="button" onClick={goNextCandidate} disabled={current.candidates.length <= 1}>
                  Next file &rarr;
                </button>
              </div>

              {selected && (
                <div className="duplicate-preview-block">
                  <div className="duplicate-path-row">
                    <code className="duplicate-path" title={selected.path}>
                      {selected.path}
                    </code>
                  </div>

                  <div className="duplicate-file-info">
                    <span>{selected.format.toUpperCase()}</span>
                    <span>{selected.bitrate > 0 ? `${Math.round(selected.bitrate / 1000)} kbps` : "—"}</span>
                    <span>{selected.durationSec > 0 ? formatDuration(selected.durationSec) : "—"}</span>
                    <span>{formatBytes(selected.sizeBytes)}</span>
                    <span>Quality: {Math.round(selected.metadataCompleteness * 100)}%</span>
                    <span>{selected.hasArtwork ? "Has artwork" : "No artwork"}</span>
                  </div>

                  {previewUrl ? (
                    <div className="media-preview">
                      {isVideoFilePath(selected.path) ? (
                        <video key={selected.id} className="media-preview-video" src={previewUrl} controls playsInline />
                      ) : (
                        <audio key={selected.id} className="media-preview-audio" src={previewUrl} controls />
                      )}
                    </div>
                  ) : (
                    <p className="muted">Preview is only available for supported audio/video formats.</p>
                  )}

                  <div className="duplicate-actions">
                    <button type="button" onClick={() => void onApplyKeep(current.id, selected.id)}>
                      Keep This
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => void onDeleteCandidate(current.id, selected.id)}
                      disabled={!isMediaFilePath(selected.path)}
                      title={
                        isMediaFilePath(selected.path)
                          ? "Permanently delete this file from disk"
                          : "Only audio/video files can be deleted from this view"
                      }
                    >
                      Delete file…
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void onSkipGroup(current.id)}
                      title="Mark this group as resolved without deleting any files"
                    >
                      Skip
                    </button>
                    <button type="button" onClick={() => void onRevealInFolder(selected.path)}>
                      Show in folder
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}
