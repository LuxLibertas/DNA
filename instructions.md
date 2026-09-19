# DNA Encoder App 

## 1. Overview & Core Requirements

Build a fully client-side Next.js app that encodes short text messages into DNA sequences using a deterministic bit-to-nucleotide cipher, and decodes them back again.

**No server backend of any kind.** The entire app runs in the browser. It must work with `next dev` locally today, and later deploy as a static site to Vercel with zero server-side code — no API routes, no serverless functions, no database.

Core features:

1. **Encode** — type a message (max 50 characters) and get a DNA sequence.
2. **Decode** — paste a DNA sequence and get the original message back.
3. **Scheme selector** — choose between two preset encoding schemes (defined precisely below). The same scheme must be used for encode and decode of a given message.
4. **History** — every conversion (encode or decode) is saved to the browser's `localStorage` and shown in a history panel, with the ability to delete individual entries and clear all.
5. **CSV export** — export the history (or the current result) to a downloadable CSV file, generated entirely client-side.

All computation is deterministic. This is a pure bit-manipulation cipher — there is no LLM or AI involvement anywhere in the app or its logic.

---

## 2. Encoding & Decoding Algorithm

Only two schemes, and both are grounded in real DNA-storage literature rather than invented for this app:

| Scheme | Basis | Bits per base | Max DNA length (50-char message) |
| --- | --- | --- | --- |
| **Alphabetical** | The same 2-bit→base mapping used in DNA Fountain (Erlich & Zielinski, *Science*, 2017) | 2 | 200 nt |
| **Church** | Church, Gao & Kosuri, *Science*, 2012 | 1 | 400 nt |

**Important:** because the two schemes operate at different granularities, DNA sequence length depends on which is active. The UI must compute and display the expected/max length for the selected scheme — never a single hardcoded constant.

### 2.1 Alphabetical scheme (2 bits → 1 base, stateless)

Mapping: `00→A, 01→C, 10→G, 11→T`

**Encode:**
1. Validate input: 1–50 characters, printable ASCII only (code points 32–126). Reject anything outside that range with a clear inline error.
2. Each character → its ASCII code point as an 8-bit, zero-padded binary string.
3. Split into four consecutive 2-bit chunks, left to right.
4. Map each chunk to a base via the table above.
5. Concatenate all bases in order. Output length is always exactly 4 × (number of characters).

**Decode:**
1. Validate: sequence length is a positive multiple of **4**, and every character is A, C, G or T (case-insensitive; normalize to uppercase first).
2. Group into 4s. Map each base back to its 2-bit code via the inverse table, concatenate the four pairs into an 8-bit string, parse as an integer, convert to its ASCII character.
3. Concatenate characters to reconstruct the message.

This direction is a pure, stateless lookup table both ways — no history, no randomness, and every one of the four bit-pairs always maps to the same letter, so homopolymers are possible (any repeated 2-bit chunk produces a repeated base) — that's expected and not a bug.

### 2.2 Church scheme (1 bit → 1 base, stateful encode, stateless decode)

Candidates: `0 → A or C`, `1 → T or G` (Church et al. 2012).

**Encode — deterministic, no randomness:**

Process the character stream as one continuous bit stream (not reset per character — this matches how Church's team actually did it). For each bit:

```
last_base = None
for bit in bitstream:
    candidates = ['A', 'C'] if bit == 0 else ['T', 'G']
    if last_base in candidates:
        chosen = the other candidate     # never repeat the previous base
    else:
        chosen = candidates[0]            # deterministic default: A for 0, T for 1
    emit(chosen)
    last_base = chosen
```

Church's own paper used true randomness with rejection sampling, capping homopolymer runs at length 3. This rule is stricter and simpler: it breaks every potential repeat immediately, so runs never exceed length 1. It needs no RNG dependency, is fully reproducible (same input → same output, every time), and only needs O(1) state — the single most-recently emitted base.

This works as a *complete* guarantee, not a heuristic, because the two candidate sets (`{A,C}` and `{T,G}`) never overlap — a homopolymer can only ever form within a run of the same underlying bit value, and the rule above eliminates every one of those.

**Decode — stateless:**
1. Validate: sequence length is a positive multiple of **8** (not 4 — one base per bit, 8 bits per byte), and every character is A, C, G or T (case-insensitive; normalize to uppercase first).
2. Map each base to its bit independently: `A→0, C→0, G→1, T→1`. Which synonym was chosen at encode time is irrelevant here — decode is a plain per-base lookup, with no state.
3. Group bits into 8s, parse each group as an integer, convert to its ASCII character, concatenate.

**Testing note:** round-trip tests (`decode(encode(x)) == x`) must cover this scheme too. "Deterministic" here means the same input always produces the same DNA output — not that a human can eyeball the mapping without running the algorithm.

---

## 3. Technical Architecture

- **Rust crate** for the cipher logic. Model the two schemes behind a shared interface — e.g. an enum `Scheme::Alphabetical | Scheme::Church` — each implementing its own `encode(&str) -> Result<String, EncodeError>` and `decode(&str) -> Result<String, DecodeError>`. The Alphabetical path is a stateless lookup; the Church path is a small fold over bits carrying the last-emitted base forward. Pure functions, proper error types, `cargo test`-able on its own.
- Compiled to **WebAssembly** with `wasm-pack`/`wasm-bindgen` and loaded directly in the browser by a client component. No Next.js API route in the loop — the WASM module runs entirely client-side, since there's no server to host it on.
- **Next.js (App Router, TypeScript)**, built as a fully static export (`output: 'export'`) so the final build is a folder of static files, deployable to Vercel — or any static host — with no server runtime required.
- All persisted state (selected scheme, conversion history, theme) lives in the browser's `localStorage` behind a small typed storage module: versioned schema, safe JSON parsing wrapped in try/catch, graceful handling of quota-exceeded or corrupted data.
- **CSV export** generated client-side via `Blob` + `URL.createObjectURL` — no network round-trip.
- You (Claude Code) have latitude on: monorepo layout (Cargo workspace vs. single crate), the exact WASM↔TypeScript binding glue, component structure, and styling approach. Make a reasoned choice and note it briefly in the README.

---

## 4. Build Workflow

This follows Anthropic's own published workflow for Claude Code — explore, then plan, then implement, then verify, then commit (see "Best practices for Claude Code," anthropic.com/engineering/claude-code-best-practices).

1. **Explore** (plan mode, read-only). No code changes yet — get oriented on what you're about to scaffold.
2. **Plan.** Write a concrete implementation plan covering repo/file structure, the `Scheme` abstraction in Rust, the WASM↔TypeScript boundary, component breakdown, localStorage design, and test strategy. Surface the plan before writing code.
3. **Implement.** Build the Rust core, wire up WASM, then build the frontend. Write tests alongside each piece as you go rather than all at the end.
4. **Verify — give yourself a check you can run, not just "looks done."** Run `cargo test`, the frontend test suite, and the production build after each meaningful change, and iterate until they pass. Show the command and its actual output as evidence rather than asserting something works.
5. **Adversarial review.** Once implementation looks complete, review the diff in a fresh context (Claude Code's `/code-review` skill, or explicitly review it as if you hadn't written it) against the Definition of Done below. Flag only gaps that affect correctness or a stated requirement — not style preferences; chasing every possible nitpick leads to over-engineering.
6. **Security pass** (Section 6) — an explicit step, not folded silently into review.
7. **UI polish pass** for the modern-dashboard feel, once everything above works.
8. **Commit** with a descriptive message once checks pass and review gaps are resolved.
9. **README**: setup, local dev, running tests, building the WASM module, and deploying the static export to Vercel.

---

## 5. Testing Requirements

- **Rust**: `cargo test` unit tests covering — round-trip correctness for *both* schemes (encode then decode returns the original string); boundary lengths (1 character, 50 characters, empty string, 51 characters rejected); invalid encode input (non-printable or out-of-ASCII-range characters); invalid decode input (Alphabetical: length not a multiple of 4; Church: length not a multiple of 8; either scheme: characters outside A/C/G/T). For the Church scheme specifically, also assert the homopolymer guarantee: no two adjacent output bases are ever identical, for any valid input. Prefer property-based testing (e.g. the `proptest` crate) generating random valid strings up to 50 characters.
- **Frontend unit tests**: component-level tests (e.g. Vitest + React Testing Library) for the character counter/limit, the scheme selector, and history list rendering.
- **End-to-end test** (e.g. Playwright) covering at least: encode a message with each scheme → see the DNA sequence → decode it back → matches the original; switching schemes changes both the output and the expected length; history persists across a page reload; CSV export triggers a file download; input validation blocks >50 characters and invalid decode input with a visible error, using the correct length rule for the active scheme.
- All tests must pass before the build is considered done — show the actual `cargo test` and frontend test output as evidence, not just a claim that tests pass.

---

## 6. Security Requirements

- No `eval`, no `dangerouslySetInnerHTML`, no dynamic script injection anywhere.
- Treat all `localStorage` reads as untrusted: wrap JSON parsing in try/catch, validate shape before use, and fail closed (ignore or reset corrupted entries) rather than throwing.
- CSV export must escape values starting with `=`, `+`, `-`, or `@` (CSV/formula-injection prevention), and correctly quote fields containing commas, quotes, or newlines.
- No external network calls at runtime — the app should work fully offline once loaded. Verify no analytics, external fonts, or tracking scripts sneak in via framework defaults.
- Document the Content-Security-Policy the static export needs (WASM requires an appropriate `script-src` allowance, e.g. `'wasm-unsafe-eval'`) in the README, even though Vercel's static hosting sets no headers by default.
- Run `npm audit` and `cargo audit` (or equivalents) before calling the build done, and note any findings.

---

## 7. UI / Dashboard Requirements

- Clean, modern, uncluttered dashboard feel — generous whitespace, clear typographic hierarchy, monospace font for the DNA sequence output specifically (readability matters there).
- Light/dark mode toggle, persisted in `localStorage` alongside the other settings.
- Core layout: message/sequence input with a live character counter (x/50), scheme selector, a prominent result area with a copy-to-clipboard button and the scheme-appropriate expected/max length shown, an encode/decode mode toggle, a history panel, and a CSV export action.
- Responsive down to mobile width.
- Accessible: labelled form controls, visible focus states, keyboard-operable throughout.
- Optional nice-to-have, time permitting: a small visual flourish when a sequence is generated (e.g. nucleotides appearing one at a time) — purely decorative, never blocking or required for core functionality.

---

## 8. Definition of Done

- [ ] Encode and decode both work correctly for both schemes, verified by passing tests — not just manual spot-checks.
- [ ] 50-character limit enforced on encode input; decode input validated with the correct length rule per scheme (multiple of 4 for Alphabetical, multiple of 8 for Church) and alphabet.
- [ ] Church-scheme output is verified homopolymer-free by a dedicated test, not just eyeballed.
- [ ] History persists in `localStorage` across page reloads; can be cleared.
- [ ] CSV export downloads a correctly formatted, injection-safe file.
- [ ] `cargo test` and the frontend/e2e tests all pass, with output shown as evidence.
- [ ] A fresh-context (adversarial) review against this checklist has been done and its gaps resolved.
- [ ] No server-side code anywhere; the static export builds successfully and the app works fully offline.
- [ ] Security pass completed and documented.
- [ ] README covers setup, testing, and Vercel deployment.

**Left to your discretion** — make a reasoned call and note it briefly in the README rather than asking: Rust workspace layout, exact component/state structure, styling approach, specific visual design language beyond "modern/clean," and any additional small UX niceties that don't conflict with the requirements above.

## 9. Add the disclaimer footnote
Educational & experimental use only. The tools are provided “as is”, without warranty. Outputs should be independently verified and should not be relied upon as a substitute for professional judgement. You use the tools at your own discretion and risk.

---

## Sources

- Erlich, Y. & Zielinski, D. "DNA Fountain enables a robust and efficient storage architecture." *Science* 355, 950–954 (2017).
- Church, G. M., Gao, Y. & Kosuri, S. "Next-Generation Digital Information Storage in DNA." *Science* 337, 1628 (2012).
- Anthropic, "Best practices for Claude Code" — https://www.anthropic.com/engineering/claude-code-best-practices
