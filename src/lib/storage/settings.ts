import { isScheme, type Scheme } from "@/lib/cipher/types";
import { createPersistedStore, type PersistedStore, type StoreOptions } from "./store";

export type Theme = "light" | "dark";

export interface Settings {
  readonly scheme: Scheme;
  /** `null` = no explicit choice yet; follow the OS preference. */
  readonly theme: Theme | null;
}

/**
 * NOTE: `public/theme-init.js` reads this key/version before hydration to avoid a
 * flash of the wrong theme. A test keeps the two in sync.
 */
export const SETTINGS_KEY = "dna-encoder:settings";
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { scheme: "alphabetical", theme: null };

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Field-by-field: one bad field falls back to its default without discarding the rest. */
export function sanitizeSettings(data: unknown): Settings {
  if (typeof data !== "object" || data === null) return DEFAULT_SETTINGS;
  const { scheme, theme } = data as Record<string, unknown>;
  return {
    scheme: isScheme(scheme) ? scheme : DEFAULT_SETTINGS.scheme,
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme,
  };
}

export function createSettingsStore(
  overrides: Pick<StoreOptions<Settings>, "getStorage"> = {},
): PersistedStore<Settings> {
  return createPersistedStore<Settings>({
    key: SETTINGS_KEY,
    version: SETTINGS_VERSION,
    fallback: DEFAULT_SETTINGS,
    sanitize: sanitizeSettings,
    ...overrides,
  });
}

export const settingsStore = createSettingsStore();
