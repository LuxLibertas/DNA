import { describe, expect, it, vi } from "vitest";
import { createPersistedStore } from "./store";

interface Box {
  n: number;
}
const FALLBACK: Box = { n: 0 };

const sanitize = (data: unknown): Box =>
  typeof data === "object" &&
  data !== null &&
  typeof (data as { n?: unknown }).n === "number"
    ? { n: (data as { n: number }).n }
    : FALLBACK;

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

const make = (storage: Storage | null) =>
  createPersistedStore<Box>({
    key: "k",
    version: 1,
    fallback: FALLBACK,
    sanitize,
    getStorage: () => storage,
  });

describe("createPersistedStore: reading untrusted data", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(make(memoryStorage()).getSnapshot()).toBe(FALLBACK);
  });

  it("reads a valid, versioned envelope", () => {
    const store = make(memoryStorage({ k: JSON.stringify({ version: 1, data: { n: 7 } }) }));
    expect(store.getSnapshot()).toEqual({ n: 7 });
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a JSON primitive", "42"],
    ["null", "null"],
    ["an array", "[]"],
    ["a wrong version", JSON.stringify({ version: 2, data: { n: 1 } })],
    ["a missing version", JSON.stringify({ data: { n: 1 } })],
    ["a wrong data shape", JSON.stringify({ version: 1, data: "nope" })],
    ["a prototype-pollution attempt", '{"version":1,"data":{"__proto__":{"n":1}}}'],
    ["an oversized blob", `{"version":1,"data":{"n":1},"pad":"${"x".repeat(1_000_001)}"}`],
  ])("fails closed on %s", (_label, raw) => {
    const store = make(memoryStorage({ k: raw }));
    expect(() => store.getSnapshot()).not.toThrow();
    expect(store.getSnapshot()).toEqual(FALLBACK);
  });

  it("returns a referentially stable snapshot while storage is unchanged", () => {
    const store = make(memoryStorage({ k: JSON.stringify({ version: 1, data: { n: 3 } }) }));
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("does not throw when getItem itself throws", () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    expect(make(storage).getSnapshot()).toBe(FALLBACK);
  });
});

describe("createPersistedStore: writing", () => {
  it("persists, notifies subscribers and updates the snapshot", () => {
    const storage = memoryStorage();
    const store = make(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.update((c) => ({ n: c.n + 1 }))).toBe("ok");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ n: 1 });
    expect(JSON.parse(storage.getItem("k") ?? "")).toEqual({ version: 1, data: { n: 1 } });
  });

  it("is read-modify-write: sees changes made by another tab", () => {
    const storage = memoryStorage();
    const store = make(storage);
    store.update(() => ({ n: 1 }));
    storage.setItem("k", JSON.stringify({ version: 1, data: { n: 10 } })); // "other tab"
    store.update((c) => ({ n: c.n + 1 }));
    expect(store.getSnapshot()).toEqual({ n: 11 });
  });

  it("reports quota errors and leaves state unchanged", () => {
    const storage = memoryStorage();
    const store = make(storage);
    store.update(() => ({ n: 1 }));
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(store.update(() => ({ n: 2 }))).toBe("quota");
    expect(store.getSnapshot()).toEqual({ n: 1 });
  });

  it("reports other write failures as unavailable without changing state", () => {
    const storage = memoryStorage();
    const store = make(storage);
    storage.setItem = () => {
      throw new DOMException("nope", "SecurityError");
    };
    expect(store.update(() => ({ n: 5 }))).toBe("unavailable");
    expect(store.getSnapshot()).toBe(FALLBACK);
  });

  it("falls back to in-memory state when storage is entirely unavailable", () => {
    const store = make(null);
    expect(store.update(() => ({ n: 4 }))).toBe("unavailable");
    expect(store.getSnapshot()).toEqual({ n: 4 });
  });
});

describe("createPersistedStore: subscriptions", () => {
  it("re-notifies on cross-tab `storage` events for its key only", () => {
    const store = make(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: "k" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null })); // storage.clear()
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new StorageEvent("storage", { key: "k" }));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
