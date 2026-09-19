import { isMode, isScheme, type Mode, type Scheme } from "@/lib/cipher/types";
import {
  createPersistedStore,
  type PersistedStore,
  type StoreOptions,
  type WriteStatus,
} from "./store";

export interface HistoryEntry {
  readonly id: string;
  readonly mode: Mode;
  readonly scheme: Scheme;
  /** What the user typed (message for encode, DNA for decode). */
  readonly input: string;
  /** What the cipher produced. */
  readonly output: string;
  /** Epoch milliseconds. */
  readonly createdAt: number;
}

export type NewHistoryEntry = Omit<HistoryEntry, "id" | "createdAt">;

export const HISTORY_KEY = "dna-encoder:history";
export const HISTORY_VERSION = 1;
export const MAX_HISTORY_ENTRIES = 100;

/** Longest text a valid entry can hold: 400 nt (Church, 50 chars); generous headroom. */
const MAX_STORED_TEXT_LENGTH = 1_000;
const MAX_ID_LENGTH = 64;
/** Largest epoch-ms value `Date` can represent. */
const MAX_DATE_MS = 8.64e15;

const EMPTY_HISTORY: readonly HistoryEntry[] = Object.freeze([]);

function sanitizeEntry(value: unknown): HistoryEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, mode, scheme, input, output, createdAt } = value as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > MAX_ID_LENGTH ||
    !isMode(mode) ||
    !isScheme(scheme) ||
    typeof input !== "string" ||
    typeof output !== "string" ||
    input.length > MAX_STORED_TEXT_LENGTH ||
    output.length > MAX_STORED_TEXT_LENGTH ||
    typeof createdAt !== "number" ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < 0 ||
    createdAt > MAX_DATE_MS
  ) {
    return null;
  }
  return { id, mode, scheme, input, output, createdAt };
}

/** Keeps valid entries only (dropping junk and duplicate ids) and caps the count. */
export function sanitizeHistory(data: unknown): readonly HistoryEntry[] {
  if (!Array.isArray(data)) return EMPTY_HISTORY;
  const seen = new Set<string>();
  const entries: HistoryEntry[] = [];
  for (const item of data as unknown[]) {
    const entry = sanitizeEntry(item);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
      if (entries.length === MAX_HISTORY_ENTRIES) break;
    }
  }
  return entries;
}

/** `crypto.randomUUID` needs a secure context; fall back for plain-http LAN dev. */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createHistoryStore(
  overrides: Pick<StoreOptions<readonly HistoryEntry[]>, "getStorage"> = {},
): PersistedStore<readonly HistoryEntry[]> {
  return createPersistedStore<readonly HistoryEntry[]>({
    key: HISTORY_KEY,
    version: HISTORY_VERSION,
    fallback: EMPTY_HISTORY,
    sanitize: sanitizeHistory,
    ...overrides,
  });
}

export const historyStore = createHistoryStore();

/**
 * Prepends an entry (newest first). If storage is full, drops the oldest entries
 * and retries, so a new conversion is preferred over old history.
 */
export function addHistoryEntry(
  store: PersistedStore<readonly HistoryEntry[]>,
  entry: NewHistoryEntry,
  now: number = Date.now(),
): WriteStatus {
  const full: HistoryEntry = { ...entry, id: newId(), createdAt: now };
  for (let keep = MAX_HISTORY_ENTRIES; keep >= 1; keep = Math.floor(keep / 2)) {
    const status = store.update((current) => [full, ...current].slice(0, keep));
    if (status !== "quota") return status;
  }
  return "quota";
}

export function deleteHistoryEntry(
  store: PersistedStore<readonly HistoryEntry[]>,
  id: string,
): WriteStatus {
  return store.update((current) => current.filter((entry) => entry.id !== id));
}

export function clearHistory(store: PersistedStore<readonly HistoryEntry[]>): WriteStatus {
  return store.update(() => EMPTY_HISTORY);
}
