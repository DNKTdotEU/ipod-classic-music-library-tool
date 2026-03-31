import { useEffect, useMemo, useState } from "react";
import type { ProgressEvent } from "../../electron/ipc/contracts";

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

const nav = ["Dashboard", "Scan", "Duplicates", "Quarantine", "History", "Settings"] as const;

export function App(): JSX.Element {
  const [active, setActive] = useState<(typeof nav)[number]>("Dashboard");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineItem[]>([]);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [message, setMessage] = useState("Ready.");

  async function refresh() {
    const dashboard = (await window.appApi.getDashboard()) as Envelope<DashboardMetrics>;
    const duplicateList = (await window.appApi.getDuplicates()) as Envelope<DuplicateGroup[]>;
    const quarantineList = (await window.appApi.getQuarantine()) as Envelope<QuarantineItem[]>;
    if (dashboard.ok) setMetrics(dashboard.data);
    if (duplicateList.ok) setGroups(duplicateList.data);
    if (quarantineList.ok) setQuarantine(quarantineList.data);
  }

  useEffect(() => {
    const unsubscribe = window.appApi.onProgress((event) => {
      setProgress(event);
      setMessage(event.message);
    });
    void refresh();
    return unsubscribe;
  }, []);

  const unresolved = useMemo(() => groups.filter((g) => g.status !== "user_resolved"), [groups]);

  async function runDemoScan() {
    const result = (await window.appApi.startScan(["/music"], "balanced")) as Envelope<{ jobId: string }>;
    if (result.ok) {
      setMessage(`Scan started (${result.data.jobId.slice(0, 8)})`);
      await refresh();
    } else {
      setMessage(result.error.message);
    }
  }

  async function applyKeep(groupId: string, keepFileId: string) {
    const result = (await window.appApi.applyDecision(groupId, keepFileId)) as Envelope<{ applied: boolean }>;
    setMessage(result.ok ? "Decision applied." : result.error.message);
    await refresh();
  }

  async function restoreItem(itemId: string) {
    const result = (await window.appApi.restoreQuarantine(itemId)) as Envelope<{ restored: boolean }>;
    setMessage(result.ok ? "Restored from quarantine." : result.error.message);
    await refresh();
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>iPod Tool</h1>
        {nav.map((item) => (
          <button
            key={item}
            className={active === item ? "nav active" : "nav"}
            onClick={() => setActive(item)}
          >
            {item}
          </button>
        ))}
      </aside>

      <main className="content">
        <header>
          <h2>{active}</h2>
          <p>{message}</p>
          {progress && (
            <p>
              {progress.phase}: {progress.processed}/{progress.total}
            </p>
          )}
        </header>

        {active === "Dashboard" && metrics && (
          <section className="cards">
            {Object.entries(metrics).map(([key, value]) => (
              <article key={key} className="card">
                <h3>{key}</h3>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
        )}

        {active === "Scan" && (
          <section>
            <p>Run a baseline scan flow with progress and indexed duplicate output.</p>
            <button onClick={() => void runDemoScan()}>Start Scan</button>
          </section>
        )}

        {active === "Duplicates" && (
          <section>
            <p>Unresolved groups: {unresolved.length}</p>
            {groups.map((group) => (
              <article className="card" key={group.id}>
                <h3>
                  {group.title} - {group.artist}
                </h3>
                <p>
                  {group.type} ({Math.round(group.confidence * 100)}%) - {group.status}
                </p>
                {group.candidates.map((candidate) => (
                  <div key={candidate.id} className="candidate">
                    <span>{candidate.path}</span>
                    <button onClick={() => void applyKeep(group.id, candidate.id)}>Keep This</button>
                  </div>
                ))}
              </article>
            ))}
          </section>
        )}

        {active === "Quarantine" && (
          <section>
            {quarantine.length === 0 ? (
              <p>No quarantined files.</p>
            ) : (
              quarantine.map((item) => (
                <article key={item.id} className="card">
                  <h3>{item.originalPath}</h3>
                  <p>
                    {item.reason} - {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <button onClick={() => void restoreItem(item.id)}>Restore</button>
                </article>
              ))
            )}
          </section>
        )}

        {active === "History" && <p>History view scaffolding is ready for event sourcing integration.</p>}
        {active === "Settings" && <p>Settings view scaffolding is ready for profile and preference forms.</p>}
      </main>
    </div>
  );
}
