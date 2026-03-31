import { useCallback, useEffect, useState, type ReactElement } from "react";

type HistoryEvent = {
  id: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

type HistoryPage = {
  items: HistoryEvent[];
  total: number;
};

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const PAGE_SIZE = 30;

const EVENT_TYPE_LABELS: Record<string, string> = {
  scan_completed: "Scan Completed",
  scan_cancelled: "Scan Cancelled",
  decision_applied: "Decision Applied",
  duplicate_file_deleted: "File Deleted",
  duplicate_index_refreshed: "Index Refreshed",
  quarantine_move: "Quarantined",
  quarantine_restore: "Restored",
  quarantine_delete: "Permanently Deleted"
};

export function HistoryView({ onStatus }: { onStatus: (msg: string) => void }): ReactElement {
  const api = window.appApi;
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (pageOffset: number) => {
    if (!api?.getHistory) return;
    try {
      const res = (await api.getHistory(PAGE_SIZE, pageOffset)) as Envelope<HistoryPage>;
      if (res.ok) {
        setEvents(res.data.items);
        setTotal(res.data.total);
        setOffset(pageOffset);
      } else {
        onStatus(res.error.message);
      }
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err));
    }
  }, [api, onStatus]);

  useEffect(() => { void load(0); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <section className="history-view">
      {events.length === 0 ? (
        <p className="muted">No history events recorded yet.</p>
      ) : (
        <>
          <p className="muted">{total} event{total !== 1 ? "s" : ""} total</p>
          <ul className="history-list">
            {events.map((evt) => (
              <li key={evt.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-badge">{EVENT_TYPE_LABELS[evt.eventType] ?? evt.eventType}</span>
                  <time className="history-time" dateTime={evt.createdAt}>
                    {new Date(evt.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="history-message">{evt.message}</p>
                {evt.payload != null && (
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => setExpandedId(expandedId === evt.id ? null : evt.id)}
                  >
                    {expandedId === evt.id ? "Hide details" : "Show details"}
                  </button>
                )}
                {expandedId === evt.id && evt.payload != null && (
                  <pre className="history-payload">{JSON.stringify(evt.payload, null, 2)}</pre>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => void load(offset - PAGE_SIZE)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => void load(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
