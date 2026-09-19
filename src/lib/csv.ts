import type { HistoryEntry } from "@/lib/storage/history";

/**
 * Leading characters a spreadsheet may interpret as a formula. OWASP's list:
 * `= + - @` plus tab and carriage return.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * Escapes one CSV field: neutralises formula injection by prefixing an apostrophe
 * (spreadsheets then treat the cell as text), then quotes per RFC 4180 when the
 * value contains a comma, quote or line break.
 */
export function escapeCsvField(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return NEEDS_QUOTING.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const CSV_HEADER = ["timestamp", "mode", "scheme", "input", "output"] as const;

/** RFC 4180 line ending. */
const EOL = "\r\n";

export function historyToCsv(entries: readonly HistoryEntry[]): string {
  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toISOString(),
    entry.mode,
    entry.scheme,
    entry.input,
    entry.output,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(escapeCsvField).join(",")).join(EOL) + EOL;
}
