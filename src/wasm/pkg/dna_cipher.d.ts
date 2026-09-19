/* tslint:disable */
/* eslint-disable */

export class CipherError {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly code: string;
    readonly message: string;
}

export function bases_per_char(scheme: string): number;

export function decode(scheme: string, dna: string): string;

export function encode(scheme: string, message: string): string;

export function expected_dna_length(scheme: string, chars: number): number;

export function max_dna_length(scheme: string): number;

export function max_message_chars(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_ciphererror_free: (a: number, b: number) => void;
    readonly bases_per_char: (a: number, b: number) => [number, number, number];
    readonly ciphererror_code: (a: number) => [number, number];
    readonly ciphererror_message: (a: number) => [number, number];
    readonly decode: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly encode: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly expected_dna_length: (a: number, b: number, c: number) => [number, number, number];
    readonly max_dna_length: (a: number, b: number) => [number, number, number];
    readonly max_message_chars: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
