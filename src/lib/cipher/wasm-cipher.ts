import init, * as wasm from "@/wasm/pkg/dna_cipher";
import {
  CIPHER_ERROR_CODES,
  SCHEMES,
  type Cipher,
  type CipherError,
  type CipherErrorCode,
  type CipherResult,
  type Scheme,
} from "./types";

/** The subset of the wasm-bindgen module this adapter needs (also eases testing). */
export type WasmApi = Pick<
  typeof wasm,
  | "CipherError"
  | "encode"
  | "decode"
  | "max_message_chars"
  | "bases_per_char"
  | "max_dna_length"
  | "expected_dna_length"
>;

function isErrorCode(code: string): code is CipherErrorCode {
  return (CIPHER_ERROR_CODES as readonly string[]).includes(code);
}

/** Converts a thrown wasm `CipherError` to a plain object; rethrows anything else. */
function toCipherError(api: WasmApi, thrown: unknown): CipherError {
  if (thrown instanceof api.CipherError) {
    const { code, message } = thrown;
    thrown.free();
    if (!isErrorCode(code)) throw new Error(`Unrecognised cipher error code: ${code}`);
    return { code, message };
  }
  // A panic / trap / unexpected failure is a bug, not a validation result: fail loudly.
  throw thrown;
}

function attempt(api: WasmApi, run: () => string): CipherResult {
  try {
    return { ok: true, value: run() };
  } catch (thrown) {
    return { ok: false, error: toCipherError(api, thrown) };
  }
}

/** Wraps an initialised wasm module in the `Cipher` interface. */
export function createCipher(api: WasmApi): Cipher {
  // Scheme metadata is constant; read it once from the core.
  const basesPerChar = Object.fromEntries(
    SCHEMES.map((scheme) => [scheme, api.bases_per_char(scheme)]),
  ) as Record<Scheme, number>;
  const maxDnaLength = Object.fromEntries(
    SCHEMES.map((scheme) => [scheme, api.max_dna_length(scheme)]),
  ) as Record<Scheme, number>;

  return {
    maxMessageChars: api.max_message_chars(),
    basesPerChar: (scheme) => basesPerChar[scheme],
    maxDnaLength: (scheme) => maxDnaLength[scheme],
    expectedDnaLength: (scheme, chars) => api.expected_dna_length(scheme, chars),
    encode: (scheme, message) => attempt(api, () => api.encode(scheme, message)),
    decode: (scheme, dna) => attempt(api, () => api.decode(scheme, dna)),
  };
}

let loading: Promise<Cipher> | undefined;

/**
 * Fetches and instantiates the WASM module (same-origin static asset) once.
 * A failed load is not cached, so a retry can succeed.
 */
export function loadWasmCipher(): Promise<Cipher> {
  loading ??= init()
    .then(() => createCipher(wasm))
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
