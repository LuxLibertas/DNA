import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PersistedStore } from "@/lib/storage/store";
import { settingsStore, type Theme } from "@/lib/storage/settings";

/** Subscribes a component to a persisted store (SSR-safe via the server snapshot). */
export function usePersistedStore<T>(store: PersistedStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** `matchMedia` is missing in some non-browser environments (e.g. jsdom); treat as "light". */
const systemThemeQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;

function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = systemThemeQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

const getSystemPrefersDark = () => systemThemeQuery()?.matches ?? false;

/**
 * Effective theme = the persisted choice, else the OS preference. Applies it to
 * <html data-theme>. (`public/theme-init.js` sets the same attribute pre-hydration.)
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const settings = usePersistedStore(settingsStore);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemPrefersDark, () => false);
  const theme: Theme = settings.theme ?? (systemDark ? "dark" : "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    settingsStore.update((current) => ({
      ...current,
      theme: theme === "dark" ? "light" : "dark",
    }));
  }, [theme]);

  return { theme, toggle };
}

export type CopyState = "idle" | "copied" | "failed";

const COPY_FEEDBACK_MS = 2_000;

/** Copies text to the clipboard and exposes transient feedback. */
export function useCopyToClipboard(): { state: CopyState; copy: (text: string) => Promise<void> } {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    let next: CopyState = "copied";
    try {
      // Undefined outside secure contexts; treat as a failure, not a crash.
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
    } catch {
      next = "failed";
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
  }, []);

  return { state, copy };
}
