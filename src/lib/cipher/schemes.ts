import type { Scheme } from "./types";

/** Presentation copy for each scheme. Numeric facts (bits/base, lengths) come from the core. */
export interface SchemeInfo {
  readonly label: string;
  readonly summary: string;
  readonly citation: string;
}

export const SCHEME_INFO: Record<Scheme, SchemeInfo> = {
  alphabetical: {
    label: "Alphabetical",
    summary: "2 bits → 1 base: 00→A, 01→C, 10→G, 11→T. Stateless lookup.",
    citation: "Erlich & Zielinski, Science 2017 (DNA Fountain)",
  },
  church: {
    label: "Church",
    summary: "1 bit → 1 base: 0→A/C, 1→T/G, never repeating the previous base.",
    citation: "Church, Gao & Kosuri, Science 2012",
  },
};
