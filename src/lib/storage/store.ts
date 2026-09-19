/**
 * A tiny typed wrapper over `localStorage`, shaped for `useSyncExternalStore`.
 *
 * Everything read from storage is untrusted: it is size-checked, parsed inside
 * try/catch, version-checked and passed through a caller-supplied `sanitize`
 * function. Any failure yields `fallback` (fail closed) and never throws.
 */

/** Result of a write: `ok`, `quota` (storage full) or `unavailable` (blocked/absent). */
export type WriteStatus = "ok" | "quota" | "unavailable";

export interface PersistedStore<T> {
  getSnapshot(): T;
  getServerSnapshot(): T;
  subscribe(listener: () => void): () => void;
  /** Read-modify-write against the latest stored value (safe across tabs). */
  update(mutate: (current: T) => T): WriteStatus;
}

export interface StoreOptions<T> {
  /** Storage key. */
  key: string;
  /** Schema version. A stored envelope with any other version is ignored. */
  version: number;
  /** Value used when nothing valid is stored. Treated as immutable. */
  fallback: T;
  /** Validates/normalises untrusted data; returns `fallback`-equivalent for junk. */
  sanitize: (data: unknown) => T;
  /** Storage accessor; defaults to `window.localStorage`. Injectable for tests. */
  getStorage?: () => Storage | null;
}

/** Refuse to JSON.parse anything larger than this (a corrupted/hostile blob). */
const MAX_RAW_LENGTH = 1_000_000;

export function defaultGetStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage; // can throw SecurityError when storage is blocked
  } catch {
    return null;
  }
}

export function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function createPersistedStore<T>(options: StoreOptions<T>): PersistedStore<T> {
  const { key, version, fallback, sanitize, getStorage = defaultGetStorage } = options;

  const listeners = new Set<() => void>();
  // Used only while real storage is unavailable, so the app still works in-session.
  let memory: T | undefined;
  // Snapshot cache: `useSyncExternalStore` needs a stable reference while nothing changed.
  let cache: { raw: string | null; value: T } | undefined;

  function parse(raw: string | null): T {
    if (raw === null || raw.length > MAX_RAW_LENGTH) return fallback;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (
        typeof envelope === "object" &&
        envelope !== null &&
        (envelope as { version?: unknown }).version === version
      ) {
        return sanitize((envelope as { data?: unknown }).data);
      }
    } catch {
      // Corrupted JSON: fall through and fail closed.
    }
    return fallback;
  }

  function read(): T {
    const storage = getStorage();
    if (!storage) return memory ?? fallback;
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return memory ?? fallback;
    }
    if (cache && cache.raw === raw) return cache.value;
    const value = parse(raw);
    cache = { raw, value };
    return value;
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function update(mutate: (current: T) => T): WriteStatus {
    const next = mutate(read());
    const storage = getStorage();
    if (storage) {
      const raw = JSON.stringify({ version, data: next });
      try {
        storage.setItem(key, raw);
        cache = { raw, value: next };
        memory = undefined;
        notify();
        return "ok";
      } catch (error) {
        // Nothing was written, so the visible state must not change either.
        return isQuotaError(error) ? "quota" : "unavailable";
      }
    }
    // No storage at all (blocked / SSR): keep working in memory for this session.
    memory = next;
    notify();
    return "unavailable";
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Cross-tab changes arrive as `storage` events (null key = storage cleared).
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  return {
    getSnapshot: read,
    getServerSnapshot: () => fallback,
    subscribe,
    update,
  };
}
