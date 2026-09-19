// Test helper: loads the real WASM module synchronously from disk (Node only).
// Imported by unit/component tests, never by app code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as wasm from "@/wasm/pkg/dna_cipher";
import { createCipher } from "./wasm-cipher";
import type { Cipher } from "./types";

let cached: Cipher | undefined;

export function loadTestCipher(): Cipher {
  if (!cached) {
    const bytes = readFileSync(join(process.cwd(), "src", "wasm", "pkg", "dna_cipher_bg.wasm"));
    wasm.initSync({ module: bytes });
    cached = createCipher(wasm);
  }
  return cached;
}
