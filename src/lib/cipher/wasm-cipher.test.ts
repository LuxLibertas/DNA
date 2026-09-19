import { describe, expect, it } from "vitest";
import * as wasm from "@/wasm/pkg/dna_cipher";
import { loadTestCipher } from "./test-cipher";
import { createCipher, type WasmApi } from "./wasm-cipher";
import { SCHEMES } from "./types";

const cipher = loadTestCipher();

describe("WASM cipher boundary (real module)", () => {
  it("encodes the known vectors for both schemes", () => {
    expect(cipher.encode("alphabetical", "A")).toEqual({ ok: true, value: "CAAC" });
    expect(cipher.encode("church", "A")).toEqual({ ok: true, value: "ATACACAT" });
  });

  it("decodes back, case-insensitively", () => {
    expect(cipher.decode("alphabetical", "caac")).toEqual({ ok: true, value: "A" });
    expect(cipher.decode("church", "atacacat")).toEqual({ ok: true, value: "A" });
  });

  it.each(SCHEMES)("round-trips a 50-character message with %s", (scheme) => {
    const message = "The quick brown fox jumps over the lazy dog, 1234!";
    expect(message).toHaveLength(50);
    const encoded = cipher.encode(scheme, message);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value).toHaveLength(cipher.maxDnaLength(scheme));
    expect(cipher.decode(scheme, encoded.value)).toEqual({ ok: true, value: message });
  });

  it("reports scheme-specific lengths from the core, not constants", () => {
    expect(cipher.maxMessageChars).toBe(50);
    expect(cipher.basesPerChar("alphabetical")).toBe(4);
    expect(cipher.basesPerChar("church")).toBe(8);
    expect(cipher.maxDnaLength("alphabetical")).toBe(200);
    expect(cipher.maxDnaLength("church")).toBe(400);
    expect(cipher.expectedDnaLength("alphabetical", 7)).toBe(28);
    expect(cipher.expectedDnaLength("church", 7)).toBe(56);
  });

  it("maps core errors to typed results without throwing", () => {
    expect(cipher.encode("church", "")).toMatchObject({ ok: false, error: { code: "EMPTY" } });
    expect(cipher.encode("church", "x".repeat(51))).toMatchObject({
      ok: false,
      error: { code: "TOO_LONG", message: "Message is 51 characters; the maximum is 50." },
    });
    expect(cipher.encode("alphabetical", "héllo")).toMatchObject({
      ok: false,
      error: { code: "INVALID_CHARACTER" },
    });
    expect(cipher.decode("alphabetical", "ACGTA")).toMatchObject({
      ok: false,
      error: { code: "INVALID_LENGTH", message: "Sequence length 5 is not a multiple of 4." },
    });
    expect(cipher.decode("church", "ACGT")).toMatchObject({
      ok: false,
      error: { code: "INVALID_LENGTH", message: "Sequence length 4 is not a multiple of 8." },
    });
    expect(cipher.decode("church", "ACGTNCGT")).toMatchObject({
      ok: false,
      error: { code: "INVALID_CHARACTER" },
    });
    expect(cipher.decode("alphabetical", "AAAA")).toMatchObject({
      ok: false,
      error: { code: "NON_PRINTABLE_BYTE" },
    });
  });

  it("never returns a homopolymer for Church, across a wide sample", () => {
    for (let code = 32; code <= 126; code += 1) {
      const result = cipher.encode("church", String.fromCharCode(code).repeat(50));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).not.toMatch(/(.)\1/);
    }
  });
});

describe("createCipher error handling", () => {
  it("rethrows unexpected failures instead of masking them as validation errors", () => {
    const boom = new Error("wasm trap");
    const api = {
      ...wasm,
      encode: () => {
        throw boom;
      },
    } as unknown as WasmApi;
    expect(() => createCipher(api).encode("church", "x")).toThrow(boom);
  });

  it("rejects error codes it does not know about", () => {
    class FakeError {
      code = "SOMETHING_NEW";
      message = "?";
      free() {}
    }
    const api = {
      ...wasm,
      CipherError: FakeError,
      decode: () => {
        throw new FakeError();
      },
    } as unknown as WasmApi;
    expect(() => createCipher(api).decode("church", "ACGTACGT")).toThrow(/Unrecognised/);
  });
});
