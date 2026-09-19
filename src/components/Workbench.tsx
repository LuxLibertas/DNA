"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import { usePersistedStore } from "@/lib/hooks";
import { csvFilename, downloadTextFile } from "@/lib/download";
import { historyToCsv } from "@/lib/csv";
import {
  convert,
  normalizeInput,
  type Cipher,
  type Mode,
  type Scheme,
} from "@/lib/cipher/types";
import {
  addHistoryEntry,
  clearHistory,
  deleteHistoryEntry,
  historyStore,
  newId,
  type HistoryEntry,
} from "@/lib/storage/history";
import type { WriteStatus } from "@/lib/storage/store";
import { settingsStore } from "@/lib/storage/settings";
import { HistoryPanel } from "./HistoryPanel";
import { MessageInput } from "./MessageInput";
import { ModeToggle } from "./ModeToggle";
import { ResultPanel, type ConversionResult } from "./ResultPanel";
import { SchemeSelector } from "./SchemeSelector";

interface WorkbenchProps {
  cipher: Cipher;
}

const STORAGE_NOTICES: Record<Exclude<WriteStatus, "ok">, string> = {
  quota: "Browser storage is full, so this conversion was not saved to history.",
  unavailable: "Browser storage is unavailable, so history will not persist after you leave.",
};

/**
 * Owns all interactive state. Rule of thumb: the result panel always reflects the
 * current input + scheme, so editing the input clears it and changing the scheme
 * re-runs it.
 */
export function Workbench({ cipher }: WorkbenchProps) {
  const settings = usePersistedStore(settingsStore);
  const history = usePersistedStore(historyStore);
  const { scheme } = settings;

  const [mode, setMode] = useState<Mode>("encode");
  const [drafts, setDrafts] = useState<Record<Mode, string>>({ encode: "", decode: "" });
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rawInput = drafts[mode];
  const input = normalizeInput(mode, rawInput);

  // Pure and cheap, so validate live on every keystroke; only the button commits.
  const preview = useMemo(
    () => (input === "" ? null : convert(cipher, mode, scheme, input)),
    [cipher, mode, scheme, input],
  );
  const error = preview && !preview.ok ? preview.error.message : null;

  function commit(next: Omit<ConversionResult, "createdAt">) {
    const createdAt = Date.now();
    setResult({ ...next, createdAt });
    const status = addHistoryEntry(historyStore, next, createdAt);
    setNotice(status === "ok" ? null : STORAGE_NOTICES[status]);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (preview?.ok) commit({ mode, scheme, input, output: preview.value });
  }

  function handleInputChange(value: string) {
    setDrafts((current) => ({ ...current, [mode]: value }));
    setResult(null);
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    setResult(null);
  }

  function handleSchemeChange(next: Scheme) {
    settingsStore.update((current) => ({ ...current, scheme: next }));
    if (!result) return;
    const rerun = convert(cipher, mode, next, input);
    if (rerun.ok) commit({ mode, scheme: next, input, output: rerun.value });
    else setResult(null); // the inline error explains why it no longer applies
  }

  function handleLoad(entry: HistoryEntry) {
    settingsStore.update((current) => ({ ...current, scheme: entry.scheme }));
    setMode(entry.mode);
    setDrafts((current) => ({ ...current, [entry.mode]: entry.input }));
    const { mode, scheme, input, output, createdAt } = entry;
    setResult({ mode, scheme, input, output, createdAt });
  }

  function handleDecodeThis() {
    if (!result) return;
    setMode("decode");
    setDrafts((current) => ({ ...current, decode: result.output }));
    setResult(null);
  }

  function exportHistory() {
    downloadTextFile(csvFilename("dna-history"), historyToCsv(history));
  }

  function exportResult() {
    if (!result) return;
    downloadTextFile(csvFilename("dna-result"), historyToCsv([{ id: newId(), ...result }]));
  }

  return (
    <div className="layout">
      <div className="stack">
        <form className="card" onSubmit={handleSubmit} noValidate>
          <div className="card-head">
            <h2 className="card-title">Convert</h2>
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>

          <SchemeSelector cipher={cipher} scheme={scheme} onChange={handleSchemeChange} />

          <MessageInput
            cipher={cipher}
            mode={mode}
            scheme={scheme}
            value={rawInput}
            error={error}
            onChange={handleInputChange}
          />

          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={!preview?.ok}>
              {mode === "encode" ? "Encode" : "Decode"}
            </button>
          </div>
        </form>

        <ResultPanel
          cipher={cipher}
          result={result}
          onExport={exportResult}
          onDecodeThis={handleDecodeThis}
        />
      </div>

      <div className="stack">
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <HistoryPanel
          entries={history}
          onLoad={handleLoad}
          onDelete={(id) => deleteHistoryEntry(historyStore, id)}
          onClear={() => clearHistory(historyStore)}
          onExport={exportHistory}
        />
      </div>
    </div>
  );
}
