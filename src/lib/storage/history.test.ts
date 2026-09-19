import { describe, expect, it } from "vitest";
import {
  addHistoryEntry,
  clearHistory,
  createHistoryStore,
  deleteHistoryEntry,
  HISTORY_KEY,
  MAX_HISTORY_ENTRIES,
  sanitizeHistory,
  type HistoryEntry,
} from "./history";

const valid = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  mode: "encode",
  scheme: "church",
  input: "hi",
  output: "ATACACAT",
  createdAt: 1_700_000_000_000,
  ...overrides,
});

describe("sanitizeHistory", () => {
  it("keeps valid entries and preserves order", () => {
    expect(sanitizeHistory([valid("a"), valid("b")]).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it.each([null, undefined, "x", 5, {}, { length: 1 }])("rejects non-array %j", (input) => {
    expect(sanitizeHistory(input)).toEqual([]);
  });

  it("drops individual bad entries but keeps the good ones", () => {
    const junk = [
      null,
      "str",
      valid("no-mode", { mode: "shout" }),
      valid("bad-scheme", { scheme: "rot13" }),
      valid("num-input", { input: 5 }),
      valid("", {}),
      valid("x".repeat(65)),
      valid("long", { output: "A".repeat(1_001) }),
      valid("nan", { createdAt: Number.NaN }),
      valid("float", { createdAt: 1.5 }),
      valid("neg", { createdAt: -1 }),
      valid("future", { createdAt: 9e15 }),
      valid("string-date", { createdAt: "2026-01-01" }),
      valid("good"),
    ];
    expect(sanitizeHistory(junk).map((e) => e.id)).toEqual(["good"]);
  });

  it("strips unknown properties from entries", () => {
    const [entry] = sanitizeHistory([valid("a", { evil: "<img onerror=x>", __proto__: { x: 1 } })]);
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      ["createdAt", "id", "input", "mode", "output", "scheme"].sort(),
    );
  });

  it("drops duplicate ids and caps the count", () => {
    expect(sanitizeHistory([valid("a"), valid("a")])).toHaveLength(1);
    const many = Array.from({ length: MAX_HISTORY_ENTRIES + 50 }, (_, i) => valid(`id-${i}`));
    expect(sanitizeHistory(many)).toHaveLength(MAX_HISTORY_ENTRIES);
  });
});

function memoryStorage(quotaAfter = Infinity, maxRawLength = Infinity): Storage {
  const map = new Map<string, string>();
  let writes = 0;
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => {
      writes += 1;
      if (writes > quotaAfter || value.length > maxRawLength) {
        throw new DOMException("full", "QuotaExceededError");
      }
      map.set(key, value);
    },
  };
}

const input = { mode: "encode", scheme: "alphabetical", input: "Hi", output: "CAGACGGC" } as const;

describe("history operations", () => {
  it("adds newest-first with generated id and timestamp", () => {
    const storage = memoryStorage();
    const store = createHistoryStore({ getStorage: () => storage });
    addHistoryEntry(store, { ...input, input: "one" }, 1000);
    addHistoryEntry(store, { ...input, input: "two" }, 2000);
    const [first, second] = store.getSnapshot();
    expect(first).toMatchObject({ input: "two", createdAt: 2000 });
    expect(second).toMatchObject({ input: "one", createdAt: 1000 });
    expect(first?.id).not.toBe(second?.id);
    expect(first?.id).toMatch(/^[0-9a-f-]{16,}$/);
  });

  it("deletes one entry by id and clears all", () => {
    const storage = memoryStorage();
    const store = createHistoryStore({ getStorage: () => storage });
    addHistoryEntry(store, input);
    addHistoryEntry(store, input);
    const [victim, survivor] = store.getSnapshot() as [HistoryEntry, HistoryEntry];
    deleteHistoryEntry(store, victim.id);
    expect(store.getSnapshot().map((e) => e.id)).toEqual([survivor.id]);
    clearHistory(store);
    expect(store.getSnapshot()).toEqual([]);
  });

  it("never stores more than MAX_HISTORY_ENTRIES", () => {
    const storage = memoryStorage();
    const store = createHistoryStore({ getStorage: () => storage });
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) addHistoryEntry(store, input, i);
    expect(store.getSnapshot()).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(store.getSnapshot()[0]?.createdAt).toBe(MAX_HISTORY_ENTRIES + 4);
  });

  it("trims the oldest entries when storage is full, keeping the new one", () => {
    // Room for roughly 10 entries.
    const storage = memoryStorage(Infinity, 2_000);
    const store = createHistoryStore({ getStorage: () => storage });
    for (let i = 0; i < 40; i += 1) {
      expect(addHistoryEntry(store, { ...input, input: `m${i}` }, i)).toBe("ok");
    }
    const entries = store.getSnapshot();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThan(40);
    expect(entries[0]?.input).toBe("m39");
  });

  it("reports quota when even a single entry cannot be stored", () => {
    const storage = memoryStorage(Infinity, 10);
    const store = createHistoryStore({ getStorage: () => storage });
    expect(addHistoryEntry(store, input)).toBe("quota");
    expect(store.getSnapshot()).toEqual([]);
  });

  it("recovers from corrupted stored history by starting empty", () => {
    const storage = memoryStorage();
    storage.setItem(HISTORY_KEY, "{corrupt");
    const store = createHistoryStore({ getStorage: () => storage });
    expect(store.getSnapshot()).toEqual([]);
    expect(addHistoryEntry(store, input)).toBe("ok");
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("filters junk out of otherwise valid stored history", () => {
    const storage = memoryStorage();
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify({ version: 1, data: [valid("ok"), { id: "bad" }, 7] }),
    );
    const store = createHistoryStore({ getStorage: () => storage });
    expect(store.getSnapshot().map((e) => e.id)).toEqual(["ok"]);
  });
});
