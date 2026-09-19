# DNA Encoder — User Manual

**A browser tool that turns short text messages into DNA sequences (A, C, G, T) and back again.**

This manual explains what the tool does, exactly how each encoding works (with worked examples that were
produced by the real code), which parts come from the published research and which parts are
simplifications, and where the tool's limits are. Section 11 lists the sources and how each claim was
verified.

> **Educational & experimental use only.** The tools are provided “as is”, without warranty. Outputs
> should be independently verified and should not be relied upon as a substitute for professional
> judgement. You use the tools at your own discretion and risk.

---

## Contents

1. [The essence in one minute](#1-the-essence-in-one-minute)
2. [Background: DNA as a storage medium](#2-background-dna-as-a-storage-medium)
3. [Using the app](#3-using-the-app)
4. [How the encodings work](#4-how-the-encodings-work)
5. [Faithful to the papers, or simplified?](#5-faithful-to-the-papers-or-simplified)
6. [Rules and error messages](#6-rules-and-error-messages)
7. [History, CSV export and settings](#7-history-csv-export-and-settings)
8. [Privacy and security](#8-privacy-and-security)
9. [Limitations and common misunderstandings](#9-limitations-and-common-misunderstandings)
10. [Troubleshooting](#10-troubleshooting)
11. [Sources and verification log](#11-sources-and-verification-log)
12. [Glossary](#12-glossary)

---

## 1. The essence in one minute

Computers store text as numbers, and numbers as **bits** (0s and 1s). DNA is a chain of four
chemical letters — **A, C, G, T** (the *bases*, or *nucleotides*, “nt”). Any scheme that maps bits to bases
lets you write information in DNA. This app implements two such mappings from the research literature:

| | **Alphabetical** | **Church** |
|---|---|---|
| Idea | every **2 bits** → **1 base** | every **1 bit** → **1 base** |
| Mapping | `00→A  01→C  10→G  11→T` | `0→A or C`, `1→T or G` |
| Output size | **4 bases per character** | **8 bases per character** |
| Longest output (50 characters) | 200 nt | 400 nt |
| Same input always gives the same output? | yes | yes |
| Can the output contain runs like `CCCC`? | **yes** | **never** (no two neighbouring bases are equal) |
| Basis | the mapping used by *DNA Fountain* (Erlich & Zielinski, *Science* 2017) | *Church, Gao & Kosuri, Science 2012* |

Three things to remember:

1. **It is a pure, deterministic bit-to-letter cipher.** There is no randomness, no AI, and no server.
   Everything runs in your browser, and nothing you type leaves your device.
2. **It is an encoding, not encryption.** Anyone with the tool (or the tables in this manual) can decode
   the result. Do not use it to hide anything.
3. **It is a teaching model of DNA data storage, not a lab-ready design.** Real DNA-storage systems add
   error correction, addressing and sequence screening on top of a mapping like this one. This app
   deliberately does not (see [section 5](#5-faithful-to-the-papers-or-simplified)). Do not order
   synthesis of its output expecting it to be reliably synthesisable or readable.

---

## 2. Background: DNA as a storage medium

### 2.1 Vocabulary you need

* **Base / nucleotide (nt):** one of A, C, G, T. Sequence *length* is measured in nt.
* **Oligonucleotide (“oligo”):** a short synthetic DNA strand, typically tens to a couple of hundred nt.
* **Homopolymer (run):** the same base repeated, e.g. `AAAA`. Long runs are hard to synthesise and are
  error-prone to sequence.
* **GC content:** the fraction of bases that are G or C. Extreme values (very low or very high) also make
  DNA harder to synthesise and read.
* **Sequencing:** reading the bases of a DNA sample; **synthesis:** writing a chosen sequence as
  physical DNA.

### 2.2 Why people store data in DNA

The two papers this app is based on give concrete numbers (quoted from the papers; see
[section 11](#11-sources-and-verification-log)):

* At the theoretical maximum, DNA can encode **two bits per nucleotide**, which Church et al. put at
  **455 exabytes per gram** of single-stranded DNA.
* **Church, Gao & Kosuri (2012)** wrote an HTML book — 53,426 words, 11 JPEG images and one JavaScript
  program, a **5.27-megabit** bit stream — into **54,898 oligos of 159 nt**, and read it back with
  Illumina sequencing with **10 bit errors out of 5.27 million**. They reported a density of
  5.5 petabits/mm³ (at 100× synthetic coverage).
* **Erlich & Zielinski (2017, “DNA Fountain”)** stored a full computer operating system, a movie and other
  files — **2.14 × 10⁶ bytes** in total — in **72,000 oligos**, recovered them perfectly, and reported a
  density of **215 petabytes per gram** of DNA. They achieved **1.57 bits per nucleotide** in practice.

Writing and reading DNA is currently slow and costly relative to electronic storage, so the technology is
aimed at very long-lived archives, not everyday files.

### 2.3 Why the mapping alone is not enough

Physical DNA is unforgiving: synthesis and sequencing make mistakes, strands get lost, and some sequences
(long runs, extreme GC content) are error-prone. That is why both papers do more than map bits to bases —
Church et al. split the data into addressed blocks and read many copies; DNA Fountain adds a fountain code,
Reed–Solomon error correction and a screening step that discards unsuitable sequences. **This app
implements the bit-to-base step only.**

---

## 3. Using the app

### 3.1 The screen

* **Header:** app name and a **Dark mode** switch.
* **Convert card:** an **Encode / Decode** toggle, the **Encoding scheme** selector, the input field, and
  the action button.
* **Result card:** shows the outcome of the last conversion.
* **History card:** every conversion you have made, with **Export CSV**, **Clear all**, and per-entry
  **Load** and **Delete**.
* **Footer:** the disclaimer and the two source citations.

On narrow screens (phones) the cards stack vertically.

### 3.2 Encoding a message

1. Make sure **Encode** is selected.
2. Choose a scheme (**Alphabetical** or **Church**). Each card shows its own figures, e.g.
   “4 nt per character · max 200 nt”.
3. Type your message in **Message**. The counter shows `characters/50`; the hint under the field shows the
   output length this message will produce for the selected scheme.
4. Press **Encode** (or press **Enter** in the field).
5. The **DNA sequence** appears, colour-coded by base and grouped in blocks of ten for readability. The
   grouping is purely visual — copying gives the plain sequence with no spaces.

Result-card buttons: **Copy** (to the clipboard), **Export result (CSV)**, and **Decode this sequence**
(sends the sequence to the decoder so you can verify the round trip).

### 3.3 Decoding a sequence

1. Select **Decode**.
2. Select **the same scheme that was used to encode** — the scheme is not stored inside the sequence. The
   same DNA decodes to different text (or an error) under the other scheme: `CAGACGGC` is `Hi` under
   Alphabetical but `&` under Church.
3. Paste the sequence into **DNA sequence**. Upper or lower case are both accepted; whitespace around the
   sequence (such as a trailing newline from pasting) is ignored, but spaces *inside* it are an error.
4. Press **Decode**. The **Decoded message** appears. (Pressing Enter in this multi-line box inserts a new line, so use the button.)

### 3.4 What happens as you type

* Checking is **live**: an invalid input shows a red message straight away and disables the button.
* Only pressing the button records a conversion in history.
* **Editing the input clears the result**, so the result panel never shows an outdated answer.
* **Changing the scheme re-runs the current conversion** with the new scheme (and records it). If the input
  is not valid under the new scheme — for example a 4-base sequence under Church, which needs a multiple
  of 8 — the result is cleared and the error explains why.
* Encode and Decode each keep their own draft, so switching modes does not lose what you typed.

### 3.5 Keyboard and accessibility

Every control is reachable with **Tab**; the scheme selector and mode toggle are radio groups (arrow keys
move the selection); focus is always visibly outlined. Inputs have proper labels, errors are announced to
screen readers, and the sequence reveal animation is disabled when your system requests reduced motion.

---

## 4. How the encodings work

Both schemes share the same first steps, then differ in how bits become bases.

```
 text ──▶ characters ──▶ 8-bit ASCII codes ──▶ bit stream ──▶ bases (A/C/G/T)
 "Hi"      'H'  'i'       01001000 01101001      0100100001101001     scheme-specific
```

1. **Characters → codes.** Each character must be **printable ASCII** (code points 32–126: space through
   `~`). Its code is written as **8 bits, most significant bit first**. Example: `H` is 72, which is
   `01001000`; `i` is 105, which is `01101001`.
2. **Bits → bases** — Alphabetical takes the bits two at a time; Church takes them one at a time.
3. **Decoding** runs the process backwards: bases → bits → groups of 8 → ASCII characters.

### 4.1 Alphabetical (2 bits → 1 base)

Lookup table:

| Bits | Base |
|---|---|
| `00` | **A** |
| `01` | **C** |
| `10` | **G** |
| `11` | **T** |

Each 8-bit character is cut into four consecutive 2-bit chunks, left to right, and each chunk is looked
up. The output is always exactly **4 × (number of characters)** bases.

**Worked example — `Hi`:**

```
H = 72  = 01001000  →  01 | 00 | 10 | 00  →  C A G A
i = 105 = 01101001  →  01 | 10 | 10 | 01  →  C G G C
result:  CAGACGGC     (8 bases)
```

**More verified examples** (produced by the app's real code):

| Message | Bits | Alphabetical DNA |
|---|---|---|
| `A` | `01000001` | `CAAC` |
| ` ` (space) | `00100000` | `AGAA` |
| `~` | `01111110` | `CTTG` |
| `Hi` | `01001000 01101001` | `CAGACGGC` |
| `DNA` | `01000100 01001110 01000001` | `CACACATGCAAC` |

**Decoding** reverses the lookup: `CAGACGGC` → `01 00 10 00 01 10 10 01` → `01001000`, `01101001` → `H`, `i`.
Decoding is *stateless*: each base maps to its own two bits regardless of its neighbours.

**Property to know:** because the mapping has no memory, any repeated 2-bit chunk gives a repeated base.
Four `U`s (`01010101` each) encode to `CCCCCCCCCCCCCCCC` — sixteen `C`s in a row. This is expected
behaviour for this scheme, not a bug — but it is exactly the kind of sequence real DNA synthesis dislikes
(see [section 5](#5-faithful-to-the-papers-or-simplified)).

### 4.2 Church (1 bit → 1 base)

Each bit has two candidate bases:

| Bit | Candidates |
|---|---|
| `0` | **A** or **C** |
| `1` | **T** or **G** |

This is the choice-of-two idea from Church et al.: because either of two bases can carry the same bit,
the encoder has freedom to avoid problem sequences. The published paper leaves the choice to the encoder;
**this app resolves it with one fixed rule**, so the output is reproducible:

> Walk through the bit stream. For each bit, look at the two candidates. If the **previously emitted base**
> is the *first* candidate (A for a 0, T for a 1), use the **second** (C or G). Otherwise use the
> **first**.

Two details:

* The whole message is **one continuous bit stream** — the rule does not reset at character boundaries.
* The candidate sets `{A,C}` and `{T,G}` never overlap, so a repeat can only happen between two bits of
  the same value — and the rule breaks every such repeat. **No two adjacent bases are ever identical**
  (longest run = 1). This is guaranteed by construction, and verified by an exhaustive test over every one-
  and two-character message plus randomised tests.

**Worked example — `Hi`** (bits `01001000 01101001`, produced by the real code):

| # | Bit | Candidates | Previous base | Emitted |
|---|---|---|---|---|
| 1 | 0 | A, C | — | **A** |
| 2 | 1 | T, G | A | **T** |
| 3 | 0 | A, C | T | **A** |
| 4 | 0 | A, C | A | **C** |
| 5 | 1 | T, G | C | **T** |
| 6 | 0 | A, C | T | **A** |
| 7 | 0 | A, C | A | **C** |
| 8 | 0 | A, C | C | **A** |
| 9 | 0 | A, C | A | **C** |
| 10 | 1 | T, G | C | **T** |
| 11 | 1 | T, G | T | **G** |
| 12 | 0 | A, C | G | **A** |
| 13 | 1 | T, G | A | **T** |
| 14 | 0 | A, C | T | **A** |
| 15 | 0 | A, C | A | **C** |
| 16 | 1 | T, G | C | **T** |

Result: `ATACTACACTGATACT` (16 bases). Read rows 3–4: the two `0` bits in a row give `A` then `C` — the
second was forced to the other candidate to avoid `AA`.

**More verified examples:**

| Message | Church DNA |
|---|---|
| `A` | `ATACACAT` |
| `~` | `ATGTGTGA` |
| `AA` | `ATACACATATACACAT` |
| `Hi` | `ATACTACACTGATACT` |
| `DNA` | `ATACATACATACTGTACTACACAT` |
| `UUUU` | `ATATATATATATATATATATATATATATATAT` |

**Decoding** is stateless and does not care which synonym was chosen: `A` and `C` both mean 0; `G` and `T`
both mean 1. Group the bits into 8s, convert each group to a character.
`ATACACAT` → `0 1 0 0 0 0 0 1` → `A`. The sequence `CGCCCCCG` also decodes to `A` — same bits, different
synonyms — even though it contains runs the encoder itself would never produce.

### 4.3 Side-by-side

| | Alphabetical | Church |
|---|---|---|
| Bases per character | 4 | 8 |
| 1 character | 4 nt | 8 nt |
| 10 characters | 40 nt | 80 nt |
| 25 characters | 100 nt | 200 nt |
| 50 characters (max) | 200 nt | 400 nt |
| Valid decode lengths | multiples of 4 (4…200) | multiples of 8 (8…400) |
| Encoder needs memory of the previous base? | no | yes (one base) |
| Decoder needs memory? | no | no |
| Repeated bases in output | possible (up to 16 in a row for one 4-character message: `UUUU`) | never |
| GC content of output | unmanaged; often high for ordinary text | unmanaged; **always ≤ 50%**, typically ~30–35% |
| Determinism | fully deterministic | fully deterministic |

The GC facts deserve a note, because neither scheme controls GC content:

* **Church, here, can never exceed 50% GC.** A `C` is only chosen right after an `A`, and a `G` only
  right after a `T`, so every G/C is preceded by its own A/T. Measured over 20,000 pseudo-random printable
  messages (lengths 1–50), the mean was about **32%** and **99.9% of outputs fell outside 45–55%** GC.
  For English sentences it was about 35%.
* **Alphabetical, here, is unbalanced in both directions.** Over the same sample the mean GC was about
  **54%**, about **51%** of outputs fell outside 45–55%, and about **47%** contained a run longer than 3
  (the longest seen was 12). For the English sentence “The quick brown fox jumps over the lazy dog” the
  output is 59.9% GC.

(These percentages are illustrative measurements with the shipped code on uniformly random printable text;
different kinds of text give different numbers. The structural facts — Church never repeats a base and
never exceeds 50% GC; Alphabetical can repeat — are exact.)

---

## 5. Faithful to the papers, or simplified?

This is the most important section for anyone who wants to describe the tool accurately. “Verified”
means the statement was checked against the primary text or the authors' code (details in
[section 11](#11-sources-and-verification-log)).

### 5.1 Alphabetical vs. DNA Fountain

| Topic | What the source says | What this app does |
|---|---|---|
| Bit-to-base mapping | **Verified.** The DNA Fountain preprint says the algorithm “translates the binary droplet to a DNA sequence by converting {00,01,10,11} to {A,C,G,T}, respectively”, with the example droplet `110001` ↔ `TAC`. The authors' reference implementation (`utils.pyx`) uses the translation table `"0123"→"ACGT"` on 2-bit groups of 8-bit bytes. | Identical mapping, identical bit order (each byte as 8 bits, MSB first, then consecutive 2-bit groups). |
| Screening | **Verified.** After mapping, DNA Fountain **discards** sequences that fail biochemical screening: in the paper's experiment, homopolymer runs of **≤ 3 nt** and GC content of **45–55%**. The authors call this screening “not part of the original fountain code design”. | **None.** Output is never screened, so it can contain long runs and any GC content. |
| Fountain code | **Verified.** A Luby Transform generates many redundant “droplets” from the file; any sufficient subset can rebuild it. | **None.** One message → one deterministic sequence. |
| Error correction | **Verified.** Each 152-nt oligo carried a 4-byte seed, 32 bytes of payload and a 2-byte Reed–Solomon code; 72,000 oligos (7% redundancy) were generated, and upstream/downstream annealing sites for Illumina adapters brought them to 200 nt (48 nt beyond the 152-nt payload). | **None.** A single wrong letter changes the decoded text or breaks the length. |
| Scale | **Verified.** 2,146,816 bytes in 72,000 oligos of 152 nt = **1.57 bits/nt**. | ≤ 50 characters. |

In short: the app implements the *mapping step* of DNA Fountain and nothing else. The name
“Alphabetical” is this app's label — the paper does not use it.

### 5.2 Church vs. Church, Gao & Kosuri (2012)

| Topic | What the source says | What this app does |
|---|---|---|
| Bit-to-base mapping | **Verified** (primary text). “We encode one bit per base (A or C for zero, G or T for one), instead of two. This allows us to encode messages many ways in order to avoid sequences that are difficult to read or write such as extreme GC content, repeats, or secondary structure.” | Same two candidate sets per bit. |
| How the choice is made | The paper's main text states the *purpose* of the freedom (avoiding hard-to-write sequences). Secondary literature reports that the base was chosen **randomly**, subject to a cap of **3** on homopolymer run length. *I only saw this in search-result summaries of DNA-storage survey papers, and could not access the paper's Supplementary Online Material to confirm it myself — treat it as unconfirmed.* | A **fixed deterministic rule** that avoids *every* repeat (max run = 1). The differences — no randomness, stricter run limit, no GC/secondary-structure control — are design choices for reproducibility, **not** the published method. |
| Block structure | **Verified.** The bit stream was split into 96-bit data blocks, each with a 19-bit address and 22-nt flanking sequences at each end (96 + 19 + 22 + 22 = 159 nt), giving 54,898 oligos for 5.27 Mbit. | **None.** The message is a single stream with no blocks, addresses or primers. |
| Redundancy / error handling | **Verified.** Many physical copies of each oligo were made and sequenced (~3,000× coverage); a consensus was taken. The paper suggests future work could add “compression, redundant encodings, parity checks, and error correction”. | **None.** |
| Result | **Verified.** All data blocks recovered, 10 bit errors in 5.27 million, mostly in homopolymer runs at oligo ends with only single coverage. | Not applicable. |

Two implication notes:

* Church's paper *itself* reports errors concentrated in homopolymer runs — which is why avoiding them
  matters, and why this app's Church output has none.
* The app describes decoding as “stateless”, which is accurate for both papers' mappings: each base maps to
  its bit(s) independently.

### 5.3 One deliberate extension not in either paper

**Decoding rejects sequences that do not spell printable ASCII text.** Any valid-looking DNA can decode to
byte values outside 32–126 (e.g. `AAAA` → byte 0). The app reports an error instead of producing control
characters, which keeps the display and CSV files safe. Decoding also enforces the same 50-character cap
(200 nt for Alphabetical, 400 nt for Church).

---

## 6. Rules and error messages

### 6.1 Encoding rules

* 1–50 characters. Only printable ASCII (space to `~`). No tabs, newlines, accents, emoji or other Unicode.
* Characters are counted as Unicode code points (so an emoji counts as 1, and is rejected as
  non-ASCII).

### 6.2 Decoding rules

* Only the letters A, C, G, T (any case). Whitespace at the very start or end is trimmed; anywhere else it is
  an error.
* Length: a positive multiple of **4** (Alphabetical) or **8** (Church).
* Length ≤ **200** nt (Alphabetical) or **400** nt (Church).
* The decoded bytes must all be printable ASCII (32–126).
* The input boxes stop accepting text at 10× the limit (500 characters when encoding; 2,000 / 4,000 nt when
  decoding) as a guard against accidentally pasting something enormous. Anything over the real limit but
  under this cap gets the normal “too long” error.

The checks run in a fixed order, and the first failure is the one shown: **empty → too long → invalid
character → wrong length** (and, when decoding, finally *non-printable result*). So a 204-base sequence
reports “too long” even if it is also not a multiple of 4.

### 6.3 Messages you may see

Copied from the app's actual output:

| Situation | Message |
|---|---|
| Encode: empty | `Message is empty. Enter at least 1 character.` |
| Encode: too long | `Message is 51 characters; the maximum is 50.` |
| Encode: disallowed character | `Character 'é' at position 4 is not printable ASCII (space to ~).` |
| Decode: empty | `Sequence is empty. Paste a DNA sequence to decode.` |
| Decode: too long | `Sequence is 204 bases; the maximum is 200.` |
| Decode: wrong letter | `Character 'N' at position 4 is not one of A, C, G, T.` |
| Decode: Alphabetical length | `Sequence length 5 is not a multiple of 4.` |
| Decode: Church length | `Sequence length 4 is not a multiple of 8.` |
| Decode: result not printable | `Character 1 decodes to byte 0, which is not printable ASCII (32–126). Check that the sequence and the selected scheme match.` |
| Module failed to load | “The cipher module could not be loaded…” with a **Try again** button |
| Unexpected failure | “Something went wrong” with a **Try again** button; your saved history is unaffected |

“Position” is 1-based. Control characters are shown escaped (`'\n'`) rather than as raw text.

---

## 7. History, CSV export and settings

### 7.1 History

* Every button-press conversion (encode or decode) is saved, newest first, up to **100** entries (the oldest
  are dropped beyond that). Each entry shows mode, scheme, time, input and output (long text is truncated
  on screen; hover to see the full text).
* **Load** puts an entry back into the form and result area — including its mode and scheme.
* **Delete** removes one entry. **Clear all** asks for confirmation (**Yes, clear all** / **Cancel**).
* Decode entries store the *trimmed* sequence you converted, not stray surrounding whitespace.

### 7.2 CSV export

* **Export CSV** (History card) saves the entire history; **Export result (CSV)** (Result card) saves just
  the current result. The file is built in your browser; nothing is uploaded.
* File names look like `dna-history-2026-09-20T12-30-45.csv` and `dna-result-….csv` (UTC time).
* Columns: `timestamp` (ISO 8601, UTC), `mode`, `scheme`, `input`, `output`. Lines end in CRLF; fields
  containing commas, quotes or line breaks are double-quoted with inner quotes doubled.
* **Spreadsheet-safety:** a field that begins with `=`, `+`, `-` or `@` (or a tab or carriage return) is
  prefixed with an apostrophe `'`, so Excel, Sheets or LibreOffice treat it as text instead of running it
  as a formula. Consequence: a message `=1+1` appears in the file as `'=1+1`.

### 7.3 What is stored in your browser

Stored in `localStorage` under two keys:

| Key | Contents |
|---|---|
| `dna-encoder:settings` | selected scheme, and light/dark choice |
| `dna-encoder:history` | the history entries |

Data is versioned, size-limited and validated whenever it is read; corrupted or unexpected data is ignored
rather than causing errors. Two open tabs stay in sync. If browser storage is full, the oldest history is
discarded to make room for the newest conversion; if storage is blocked (some private-browsing modes) the
app still works for the session and shows a notice that history will not persist.

To erase everything: **Clear all** removes history; clearing the site's data in your browser removes the
settings too.

### 7.4 Theme

The **Dark mode** switch is remembered. With no saved choice, the app follows your operating system's
light/dark preference.

---

## 8. Privacy and security

* **Nothing leaves your device.** There is no server, API, database or analytics, and the page makes no
  network requests after loading; it also works offline once loaded. (The build tests check this.)
* **No external resources:** no web fonts, trackers or third-party scripts.
* The page ships a strict **Content-Security-Policy** (no inline-script allowance, no external hosts; the
  WebAssembly module is allowed via `wasm-unsafe-eval`, which does not permit JavaScript `eval`).
* Text you type is only ever displayed as plain text, never interpreted as HTML.
* Stored data and CSV output are treated defensively (see 7.2 and 7.3).
* **This is an encoding, not encryption**: anyone who sees the DNA sequence and knows the scheme can
  decode it.

Technical details, the exact policy and audit results are in [README.md](README.md).

---

## 9. Limitations and common misunderstandings

| Misunderstanding | Reality |
|---|---|
| “The DNA it produces is secure/private.” | No. It is a public, reversible encoding. |
| “I can send this sequence to a synthesis company and read it back.” | The sequences are **not screened or error-corrected**. Alphabetical output can contain long runs and skewed GC content; Church output has no runs but is AT-rich (≤ 50% GC), and neither has primers, addresses or redundancy. Real synthesis and sequencing add errors this tool does not defend against. |
| “This is DNA Fountain / Church's method.” | It uses their *mapping ideas* only. See [section 5](#5-faithful-to-the-papers-or-simplified). |
| “Decoding auto-detects the scheme.” | It cannot: the same letters mean different things under each scheme. You must pick the scheme. A wrong choice either gives an error or unrelated text. |
| “Longer messages are supported.” | The limit is 50 characters (200 / 400 nt), by design. |
| “Church and Alphabetical give the same length.” | Church output is twice as long (8 vs 4 nt per character). |
| “Lower-case in the sequence changes meaning.” | No. Decoding is case-insensitive. |
| “Non-English text works.” | Only printable ASCII: no accents, other alphabets, or emoji. |
| “The Church output is what the paper's authors would have produced.” | The paper allowed either synonym for each bit; this app picks one by a fixed rule. Many different sequences decode to the same text under Church; the app produces just one of them. |

Also note:

* Tested in Chromium with automated tests; the app uses standard web features (WebAssembly,
  `localStorage`, Clipboard API), but other browsers have not been part of the automated test runs. If
  **Copy** is blocked (some browsers require a secure connection or permission), the app says so and you
  can select and copy the text manually.
* The cipher rules themselves are covered by Rust unit and property tests, and the web app by unit and
  end-to-end tests — but this is a learning tool with no warranty, as the disclaimer states.

---

## 10. Troubleshooting

| Symptom | What to do |
|---|---|
| Button stays disabled | Read the red message under the field — it names the problem and position. |
| “Not a multiple of 4 / 8” | You picked the wrong scheme, or the sequence lost or gained a letter while copying. Church needs multiples of 8. |
| Decode says “not printable ASCII” | The sequence and scheme do not match, or the text was changed. Try the other scheme. |
| Decoded text looks wrong but no error | The other scheme decoded it to different (still printable) text. Check that you used the scheme that encoded it. |
| Pasted sequence has spaces or line breaks in the middle | Remove them first; only leading/trailing whitespace is ignored. |
| History empty after reopening | Browser storage may be blocked, in private mode, or cleared by browser settings. |
| “Cipher module could not be loaded” | Check that WebAssembly is enabled and the page finished loading, then press **Try again** or reload. |
| CSV shows `'=…` | That's the deliberate spreadsheet-safety apostrophe (7.2). |
| Copy does nothing | Select the sequence manually and copy it (some browsers restrict the clipboard). |

**Verify the app yourself** with these known-good pairs. Each line is *message → Alphabetical → Church*:

| Message | Alphabetical | Church |
|---|---|---|
| `A` | `CAAC` | `ATACACAT` |
| `Hi` | `CAGACGGC` | `ATACTACACTGATACT` |
| `~` | `CTTG` | `ATGTGTGA` |

---

## 11. Sources and verification log

### 11.1 The two papers

1. **Church, G. M., Gao, Y. & Kosuri, S.** Next-generation digital information storage in DNA.
   *Science* **337**(6102), 1628 (2012). PMID 22903519. DOI: <https://doi.org/10.1126/science.1226355>
2. **Erlich, Y. & Zielinski, D.** DNA Fountain enables a robust and efficient storage architecture.
   *Science* **355**(6328), 950–954 (2017). PMID 28254941. DOI: <https://doi.org/10.1126/science.aaj2038>

Bibliographic details and abstracts were confirmed with PubMed (records 22903519 and 28254941).

### 11.2 How each kind of claim was checked

| Claim | Checked against | Result |
|---|---|---|
| Church: 0→A/C, 1→T/G; 54,898 oligos × 159 nt; 96-bit blocks + 19-bit address + 2×22-nt flanks; 53,426 words / 11 JPEG / 1 JavaScript; 5.27 Mbit; ~3,000× coverage; 10 bit errors in 5.27 M; 5.5 Pbit/mm³; 455 EB/g theoretical | **Primary text** — the *Science* report (author-hosted PDF, `arep.med.harvard.edu`), read directly | Confirmed. Arithmetic cross-checks: 96+19+22+22 = 159; 54,898 × 96 = 5,270,208 ≈ 5.27 Mbit. |
| Church: base chosen at random, run-length cap of 3 | Search-result summaries of secondary DNA-storage survey papers (the surveys' full text was not read) | **Not confirmed from the primary source** (Supplementary Online Material not accessible). Reported here as “secondary literature reports…”. |
| DNA Fountain: `{00,01,10,11}→{A,C,G,T}`; `110001`→`TAC`; screening for homopolymer ≤3 and GC 45–55%; 4+32+2-byte droplets; 152-nt oligos, +adapters → 200 nt; 72,000 oligos (7% redundancy); 2,146,816 bytes; 1.57 bit/nt; 1.98 bit/nt coding potential; 2.14 × 10⁶ bytes; 2.18 × 10¹⁵ retrievals | **Primary text** — the authors' bioRxiv preprint (v4, Dec 2016), read directly | Confirmed as stated in the preprint. The published *Science* version was not accessible (403), so figures were also compared with its PubMed abstract (2.14 × 10⁶ bytes; 215 PB/g; 2.18 × 10¹⁵ retrievals). Small differences between preprint and final are possible; the preprint's own comparison table lists 214 PB/g where the abstracts say 215. |
| DNA Fountain mapping in code | Authors' reference implementation, `TeamErlich/dna-fountain` on GitHub (`utils.pyx`, `encode.py`) | `intab="0123"`, `outtab="ACGT"`; bytes formatted `{0:08b}` then read as 2-bit groups; droplets rejected if they contain a run longer than the maximum homopolymer or GC outside 0.5 ± tolerance. (The tool's default settings, 4 and ±0.2, differ from the values the paper reports using in its experiment, 3 and 45–55%.) |
| Church review numbers (659 kb book, 10 errors per 5.27 M) | A PubMed Central review (“DNA as a digital information storage device: hope or hype?”, PMC5935598) | Consistent with the primary text. |
| **This app's** behaviour: every example, table, statistic and error message in this manual | Generated by running the shipped WebAssembly module (and cross-checked by the project's automated tests) | The Church trace in §4.2 was also re-derived independently step by step and matched. The paper's `110001`→`TAC` example matches the app's mapping. |

### 11.3 What was *not* verified

* The Church supplementary methods (random choice, run cap of 3) — see above.
* The final published text of the DNA Fountain paper (the preprint was used; the abstract was checked via
  PubMed).
* The GC/run-length percentages in §4.3 are measurements on random text, not universal constants.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **ASCII** | A standard mapping of characters to numbers 0–127. Here, only 32–126 (printable) are allowed. |
| **Base / nucleotide (nt)** | One of A, C, G, T; the unit of DNA length. |
| **Bit** | 0 or 1. Eight bits make one byte, which holds one ASCII character. |
| **Deterministic** | The same input always gives the same output. |
| **Droplet** | In fountain codes, one generated packet of encoded data (here, one future oligo). |
| **Error correction** | Extra information that lets a decoder detect or fix mistakes (e.g. Reed–Solomon). The app has none. |
| **Fountain code** | A code that generates a limitless stream of redundant packets from a file so that enough of them, in any order, rebuild it. |
| **GC content** | Fraction of bases that are G or C. |
| **Homopolymer** | A run of one repeated base (`AAAA`). |
| **MSB first** | Writing the most significant (leftmost) bit first, as in ordinary binary numbers. |
| **Oligo** | A short synthetic DNA strand. |
| **Primer / adapter** | A fixed flanking sequence used to amplify or sequence an oligo. Not used by this app. |
| **Scheme** | One of the app's two bit-to-base mappings: Alphabetical or Church. |
| **Sequencing** | Reading the bases of a DNA sample. |
| **Synonym (Church)** | The two bases that can represent the same bit (A/C for 0, T/G for 1). |
