/** Delay before revoking the object URL so slower browsers can start the download. */
const REVOKE_DELAY_MS = 1_000;

/** Saves `content` as a file entirely client-side (Blob + object URL, no network). */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** `dna-history-2026-09-20T12-30-00.csv` — filesystem-safe, sortable. */
export function csvFilename(prefix: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replaceAll(":", "-");
  return `${prefix}-${stamp}.csv`;
}
