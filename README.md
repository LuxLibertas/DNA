# DNA Encoder

Encode short text messages into DNA sequences and decode them back — deterministic bit
manipulation, fully client-side. A Rust cipher compiled to WebAssembly runs inside a static
Next.js app. There is **no server, API route, database, or network call at runtime**; the app works
offline once loaded. No LLM/AI is involved anywhere.

| Scheme | Basis | Bits/base | Max DNA length (50 chars) |
| --- | --- | --- | --- |
| **Alphabetical** | 2-bit mapping `00→A 01→C 10→G 11→T` (Erlich & Zielinski, *Science* 2017, DNA Fountain) | 2 | 200 nt |
| **Church** | `0→A/C`, `1→T/G`, never repeating the previous base (Church, Gao & Kosuri, *Science* 2012) | 1 | 400 nt |

**New here?** Read the [user manual](manual.md) — it explains both encodings with worked examples and
states exactly what is (and is not) faithful to the source papers.

> Educational & experimental use only. The tools are provided “as is”, without warranty. Outputs
> should be independently verified and should not be relied upon as a substitute for professional
> judgement. You use the tools at your own discretion and risk.

## Quick start

Prerequisites: Node ≥ 20.9 (developed on 24). Rust + `wasm-pack` are only needed if you change the
cipher (the built WASM is committed — see [Design decisions](#design-decisions)).

```bash
npm ci
npm run dev          # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Static export to `out/`, then injects the hashed CSP `<meta>` into each page |
| `npm run serve:out` | Serves `out/` on `127.0.0.1:4173` (tiny dependency-free static server) |
| `npm run wasm` | Rebuilds the Rust crate → `src/wasm/pkg/` (needs `wasm-pack`, `rustup target add wasm32-unknown-unknown`) |
| `npm run lint` / `npm run typecheck` | ESLint (incl. security rules) / `tsc --noEmit` |
| `npm test` | Vitest: unit + component + security-invariant tests (uses the **real** WASM module) |
| `npm run test:rust` | `cargo test` for the crate (unit + property tests) |
| `npm run test:e2e` | Production build, then Playwright against the static export (first time: `npx playwright install chromium`) |
| `npm run check` | lint + typecheck + Vitest + cargo test |

## How it works

### Rust crate — `dna-cipher/`

A single crate (no workspace; there is only one member). `Scheme::{Alphabetical, Church}` exposes
`encode(&str) -> Result<String, EncodeError>` and `decode(&str) -> Result<String, DecodeError>`;
each scheme lives in its own module.

* **Alphabetical**: stateless 2-bit lookup, 4 bases per character.
* **Church**: the message is one continuous MSB-first bit stream; each bit picks from `{A,C}` (0) or
  `{T,G}` (1), taking the *other* candidate if it equals the previous base. Because the candidate
  sets are disjoint, no two adjacent bases are ever equal. Decoding is a stateless per-base lookup
  (`A,C→0`, `G,T→1`), 8 bases per character.
* **Encode limits**: 1–50 printable ASCII characters (32–126).
* **Decode limits**: A/C/G/T only (case-insensitive), positive multiple of 4 (Alphabetical) or 8
  (Church), and at most the scheme's max length (200/400 nt).
* Errors are typed enums with stable `code()`s and human-readable messages; control characters are
  escaped in messages.

### WASM boundary

`wasm-bindgen` (`--target web`). `src/lib/cipher/types.ts` defines a thin `Cipher` interface;
`wasm-cipher.ts` adapts the module to it (thrown `CipherError` objects become
`{ ok: false, error: { code, message } }`; anything else — a trap/panic — is rethrown, not
masked). UI components receive a `Cipher`, and **all lengths shown in the UI come from the Rust
core** (`bases_per_char`, `max_dna_length`, `expected_dna_length`), never from a TS constant.

### Frontend — `src/`

Next.js App Router + TypeScript (strict, `noUncheckedIndexedAccess`), `output: 'export'`.
`Workbench` owns the interactive state; `ModeToggle`, `SchemeSelector`, `MessageInput`,
`ResultPanel`, `HistoryPanel`, `ThemeToggle` are presentational. Styling is one plain CSS file with
design tokens (light/dark) — no CSS framework, no external fonts.

Behaviour worth knowing:

* Validation runs live as you type (pure and cheap); the **Encode/Decode button** commits a
  conversion and writes history. Editing the input clears the result; changing the scheme re-runs
  the current conversion under the new scheme.
* Decode input is trimmed of surrounding whitespace only; whitespace *inside* a sequence is
  rejected like any other non-ACGT character.
* Enter submits the encode form; “Decode this sequence” moves an encoded result to the decoder.
* A short staggered fade-in plays when a sequence appears (disabled under
  `prefers-reduced-motion`; purely decorative).

### Persistence — `src/lib/storage/`

Everything lives in `localStorage` behind a small typed store: versioned envelope
`{ version, data }`, size-capped, `JSON.parse` in try/catch, per-entry shape validation, unknown
fields stripped, duplicates dropped, at most 100 history entries. Corrupt or foreign data is ignored
(fail closed), never thrown. Writes are read-modify-write, so two tabs don't clobber each other
(`storage` events keep tabs in sync). If storage is full, the oldest history is dropped to fit the
newest conversion; if it is blocked entirely the app keeps working in memory and shows a notice.
Keys: `dna-encoder:settings` (scheme, theme) and `dna-encoder:history`.

The theme is applied before first paint by `public/theme-init.js` (a same-origin script, so no
inline script is needed); a test keeps its key/version in sync with `settings.ts`.

### CSV export

Generated client-side (`Blob` + `URL.createObjectURL`), RFC 4180 (CRLF, quoted fields when they
contain `,` `"` or line breaks). Fields starting with `=` `+` `-` `@` (and tab / CR) are prefixed with
`'` so spreadsheets treat them as text — the file therefore contains `'=1+1` for the input `=1+1`.
Columns: `timestamp` (ISO 8601 UTC), `mode`, `scheme`, `input`, `output`. The history panel exports all
entries; the result panel exports the current result only.

## Testing

* **Rust** (`cargo test`): known vectors, both schemes' round trips, boundary lengths
  (1 / 50 chars OK; empty / 51 rejected), invalid encode input, invalid decode input (length rule per
  scheme, alphabet, non-printable decoded bytes), exhaustive Church no-adjacent-repeat over every
  1- and 2-character message, and `proptest` properties (round trip, determinism, homopolymer-free,
  lowercase decode, decode/encode never panic on arbitrary strings).
* **Vitest** (`npm test`): WASM boundary against the real module, CSV escaping, storage (corruption,
  quota, unavailable, cross-tab), history invariants, components (counter/limit, scheme selector,
  history list, full workbench flows), theme, and static security guards (no `eval`,
  `dangerouslySetInnerHTML`, network APIs, external URLs, server code; CSP script behaviour).
* **Playwright** (`npm run test:e2e`): against the production export — encode/decode round trips for
  each scheme, scheme switching, validation per scheme, history across reloads, CSV download,
  clipboard, theme, corrupted/hostile `localStorage`, offline use, zero external requests / console
  errors / CSP violations, axe accessibility scan (light + dark) and a 360 px layout check.

## Security

Requirements and how they are met:

| Requirement | Implementation / verification |
| --- | --- |
| No `eval`, `dangerouslySetInnerHTML`, dynamic script injection | ESLint (`no-eval`, `react/no-danger`, …) + `src/security.test.ts` scans shipped code |
| `localStorage` is untrusted | Size cap, try/catch, version + shape validation, fail closed (`store.ts`, `history.ts`); e2e test with corrupt and hostile data |
| CSV formula injection / quoting | `src/lib/csv.ts`, unit + e2e tests |
| No runtime network calls | No `fetch`/XHR/WebSocket in first-party code (lint rule + test); system font stack; Next telemetry disabled; e2e asserts every request is same-origin and the app works offline |
| Strict CSP for the static export | See below |
| Dependency audit | See [Audit results](#audit-results) |

Other hardening: no `next/font/google`, no analytics; all user text is rendered as React text nodes;
Rust crate uses `#![forbid(unsafe_code)]` (via lints) and denies `unwrap`/`expect`/`panic`/indexing;
oversized input is rejected in O(limit) before any allocation; decode refuses byte values outside
printable ASCII, so control characters can never reach the UI or a CSV.

### Content-Security-Policy

Vercel's static hosting sets no headers by default, and a `<meta>` CSP can't express everything, so it
is delivered two ways:

1. **`scripts/inject-csp.mjs`** (runs at the end of `npm run build`) SHA-256-hashes every inline script
   Next emits and writes this policy into each page's `<meta http-equiv="Content-Security-Policy">`:

   ```
   default-src 'none';
   script-src 'self' 'wasm-unsafe-eval' 'sha256-…' (one per inline script);
   style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self';
   base-uri 'none'; form-action 'none'; object-src 'none'
   ```

   `'wasm-unsafe-eval'` is what allows WebAssembly to compile; it does **not** permit JS `eval`.
   `connect-src 'self'` covers fetching the app's own `.wasm`. There is no `unsafe-inline`.

   The script patches **both** copies of each page that `next build` produces: the static export in
   `out/` and Next's prerendered HTML in `.next/server/app/`. The first Vercel deployment served pages without the policy `<meta>` even though `out/` had it
   (its HTML matched Next's prerendered copy), so both copies are now patched. It is idempotent, and it fails the build if any
   inline script in a page is not covered by that page's own policy.

2. **`vercel.json`** adds real response headers: `Content-Security-Policy: frame-ancestors 'none'`
   (unsupported in `<meta>`), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`,
   `Cross-Origin-Opener-Policy`, `Permissions-Policy`, HSTS, and immutable caching for hashed assets.

On another static host, either keep the meta tags from the build or send the policy above as a
header (compute the script hashes from your build, or reuse the ones in `out/index.html`).

### Audit results

Last run 2026-09-20:

* `npm audit` (all dependencies, incl. dev) — **0 vulnerabilities**.
* `cargo audit` (RustSec, 47 crates in `Cargo.lock`) — **no advisories**. The code that ships in the
  WASM depends only on `wasm-bindgen` and its macro crates; `proptest` (and its `rand`/`tempfile`
  tree) is a dev-dependency.
* `npm ls`: no invalid/missing peers. Two "extraneous" entries (`@emnapi/runtime`,
  `@img/sharp-wasm32`) are optional `sharp` binaries pulled in by Next; the app never uses image
  optimisation.
* Known-behind-latest on purpose: TypeScript 7 and ESLint 10 (see Design decisions).

Re-run with `npm audit` and `cd dna-cipher && cargo audit` before each release.

## Deploying to Vercel (static export)

The repo is ready as-is: `vercel.json` sets the build command (`npm run build`, which runs
`next build` and then injects the CSP). Import the GitHub repo in Vercel (Framework preset: Next.js)
and deploy; no environment variables, no Rust toolchain, and no server functions are needed.

**Output Directory must be `.next`, not `out`.** For a Next.js static export Vercel's builder reads
`routes-manifest.json` from the Output Directory (it is written to `.next/`) and then serves `out/`
by itself. If the project's dashboard settings carry `out` (the import screen can pre-fill it), the
build fails with *"The file …/out/routes-manifest.json couldn't be found"*. `vercel.json` therefore
pins `"outputDirectory": ".next"`, which overrides the dashboard. This was reproduced and verified
locally with `vercel build` against simulated dashboard settings (`out` → fails without the pin,
passes with it; default settings → passes). A test guards the value. From the CLI you would run
`vercel` (preview) or `vercel --prod` yourself. Any other static host works by serving `out/`
(serve `.wasm` as `application/wasm`).

The site expects to be served from the domain root (`/theme-init.js`, `/_next/…`).

## Design decisions

* **Single crate, built WASM committed.** `src/wasm/pkg/` is generated by `npm run wasm` but
  committed, so Vercel builds with only Node. The trade-off is a generated artifact in git — rebuild
  it whenever `dna-cipher/` changes (`npm run check` and e2e run against whatever is committed).
  `wasm-opt` is disabled (the module is ~50 KB unoptimised; it avoids an extra binary download).
* **Validation lives once, in Rust.** TypeScript only formats and displays what the core reports.
* **Decode enforces the 50-character cap and printable-ASCII output**, which the brief doesn't spell
  out: it bounds work on pasted input and keeps control characters out of the UI/CSV.
* **Plain CSS, hand-written type guards** instead of Tailwind / zod: two schemas and one stylesheet
  don't justify the dependencies.
* **CSP via post-build hashing** rather than `unsafe-inline`, since Next's static export inlines
  small bootstrap scripts.
* **TypeScript 6.0 and ESLint 9** are pinned deliberately: `typescript-eslint` doesn't yet support
  TS 7, and `eslint-plugin-react` (via `eslint-config-next`) doesn't yet support ESLint 10.

## Repository layout

```
dna-cipher/        Rust crate (src/, tests/) — cargo test
src/app/           Next.js App Router (layout, page, styles, icon)
src/components/    UI components + their tests
src/lib/cipher/    Cipher interface, WASM adapter, scheme copy
src/lib/storage/   Typed localStorage store, settings, history
src/lib/           CSV, download, hooks
src/wasm/pkg/      Generated by wasm-pack (committed)
public/            theme-init.js (pre-paint theme)
scripts/           build-wasm, inject-csp, serve-static
e2e/               Playwright tests
```
