import type { ReactElement } from "react";
import type { ProgressEvent } from "../ipc/types";
import { PHASE_LABEL } from "./progressLabels";

type Props = {
  title: string;
  progress: ProgressEvent;
};

export function JobProgressCard({ title, progress }: Props): ReactElement {
  const total = Math.max(1, progress.total);
  const pct = Math.min(100, (progress.processed / total) * 100);

  return (
    <div className="job-progress" aria-live="polite">
      <div className="job-progress-header">
        <h3 className="job-progress-title">{title}</h3>
        <span className="job-progress-step">
          Step {progress.processed} of {progress.total}
        </span>
      </div>
      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={progress.processed}
        aria-label={title}
      >
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="job-progress-phase">{PHASE_LABEL[progress.phase]}</p>
      <p className="job-progress-message">{progress.message}</p>
    </div>
  );
}
