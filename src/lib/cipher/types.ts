/** Encoding schemes. Ids match the Rust `Scheme::id()` values and persisted data. */
export const SCHEMES = ["alphabetical", "church"] as const;
export type Scheme = (typeof SCHEMES)[number];

export const MODES = ["encode", "decode"] as const;
export type Mode = (typeof MODES)[number];

export function isScheme(value: unknown): value is Scheme {
  return typeof value === "string" && (SCHEMES as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Stable error codes emitted by the Rust core (see `dna-cipher/src/error.rs`). */
export const CIPHER_ERROR_CODES = [
  "EMPTY",
  "TOO_LONG",
  "INVALID_CHARACTER",
  "INVALID_LENGTH",
  "NON_PRINTABLE_BYTE",
  "UNKNOWN_SCHEME",
] as const;
export type CipherErrorCode = (typeof CIPHER_ERROR_CODES)[number];

export interface CipherError {
  readonly code: CipherErrorCode;
  /** Human-readable, safe to render (control characters are escaped by the core). */
  readonly message: string;
}

export type CipherResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: CipherError };

/**
 * The seam between the UI and the cipher implementation. Production uses the
 * Rust/WASM module; anything else (tests, a JS fallback) can implement this.
 * All numbers come from the core so the UI never hardcodes a length.
 */
export interface Cipher {
  /** Maximum message length in characters (50). */
  readonly maxMessageChars: number;
  /** DNA bases emitted per plaintext character for `scheme`. */
  basesPerChar(scheme: Scheme): number;
  /** DNA length of a maximum-length message for `scheme`. */
  maxDnaLength(scheme: Scheme): number;
  /** DNA length produced by a message of `chars` characters. */
  expectedDnaLength(scheme: Scheme, chars: number): number;
  encode(scheme: Scheme, message: string): CipherResult;
  decode(scheme: Scheme, dna: string): CipherResult;
}

/** Runs the conversion for `mode` — the one place the UI switches on it. */
export function convert(
  cipher: Cipher,
  mode: Mode,
  scheme: Scheme,
  input: string,
): CipherResult {
  return mode === "encode" ? cipher.encode(scheme, input) : cipher.decode(scheme, input);
}

/**
 * Prepares raw field text for `convert`. Decode input is trimmed (pasted DNA often
 * carries a trailing newline); encode input is left alone since spaces are valid.
 */
export function normalizeInput(mode: Mode, raw: string): string {
  return mode === "decode" ? raw.trim() : raw;
}

/** Length in Unicode code points — matches how the core counts characters. */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}
