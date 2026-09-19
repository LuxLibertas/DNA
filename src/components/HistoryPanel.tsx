import { useState } from "react";
import { SCHEME_INFO } from "@/lib/cipher/schemes";
import type { HistoryEntry } from "@/lib/storage/history";

interface HistoryPanelProps {
  entries: readonly HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

function formatTimestamp(epochMs: number): string {
  return formatter.format(new Date(epochMs));
}

export function HistoryPanel({ entries, onLoad, onDelete, onClear, onExport }: HistoryPanelProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const isEmpty = entries.length === 0;

  return (
    <section className="card history" aria-labelledby="history-title">
      <div className="card-head">
        <h2 id="history-title" className="card-title">
          History <span className="count">{entries.length}</span>
        </h2>
        <div className="actions">
          <button type="button" className="btn btn-small" onClick={onExport} disabled={isEmpty}>
            Export CSV
          </button>
          {confirmingClear ? (
            <>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
              >
                Yes, clear all
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setConfirmingClear(true)}
              disabled={isEmpty}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <p className="placeholder">No conversions yet. Saved in this browser only.</p>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => {
            const when = formatTimestamp(entry.createdAt);
            return (
              <li key={entry.id} className="history-item" data-testid="history-item">
                <div className="history-meta">
                  <span className="badge">{entry.mode === "encode" ? "Encode" : "Decode"}</span>
                  <span>{SCHEME_INFO[entry.scheme].label}</span>
                  <time dateTime={new Date(entry.createdAt).toISOString()}>{when}</time>
                </div>
                <div className="history-io">
                  <span className="history-text" title={entry.input}>
                    {entry.input}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="history-text mono" title={entry.output}>
                    {entry.output}
                  </span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onLoad(entry)}
                    aria-label={`Load ${entry.mode} entry from ${when}`}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger-ghost"
                    onClick={() => onDelete(entry.id)}
                    aria-label={`Delete ${entry.mode} entry from ${when}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
