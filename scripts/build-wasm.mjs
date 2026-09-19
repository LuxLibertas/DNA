// Builds the Rust crate to WebAssembly and drops the glue into src/wasm/pkg.
// Cross-platform wrapper so `npm run wasm` behaves the same on Windows/macOS/Linux.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "wasm", "pkg");

const result = spawnSync(
  "wasm-pack",
  [
    "build",
    "dna-cipher",
    "--release",
    "--target",
    "web",
    "--no-pack",
    "--out-dir",
    "../src/wasm/pkg",
    "--out-name",
    "dna_cipher",
  ],
  { cwd: root, stdio: "inherit" },
);

if (result.error) {
  console.error(`Could not run wasm-pack: ${result.error.message}`);
  console.error("Install it with: cargo install wasm-pack (and: rustup target add wasm32-unknown-unknown)");
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

// wasm-pack drops a `.gitignore` containing `*`, which would hide the artifacts we
// deliberately commit (so Vercel needs no Rust toolchain).
rmSync(join(outDir, ".gitignore"), { force: true });
