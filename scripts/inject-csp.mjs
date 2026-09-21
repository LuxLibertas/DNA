// Post-build step: adds a strict Content-Security-Policy <meta> to every built page.
//
// Next's static export inlines small bootstrap <script>s whose content changes per
// build, so instead of allowing 'unsafe-inline' we hash each inline script and allow
// exactly those. Directives a <meta> cannot carry (frame-ancestors) are set as real
// headers in vercel.json.
//
// Several copies of each page exist after `next build`, and which one a host serves varies:
//   out/                     the static export (what `next start`-less hosts and our tests use)
//   .next/server/app/        Next's prerendered HTML
//   .next/output/static/     written DURING `next build` by Vercel's Next.js adapter when the
//                            platform enables it (NEXT_ENABLE_ADAPTER=1); Vercel then moves it to
//                            .vercel/output/static. This is what production served, because the
//                            copy was made before this post-build script ran.
//   .vercel/output/static/   the moved copy, in case a host has already relocated it
// All present copies are patched; the script is idempotent.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");

/** Where built pages can live. Only `out/` is mandatory; the others exist depending on host/adapter. */
export const TARGETS = [
  { dir: outDir, label: "out/", required: true },
  { dir: join(root, ".next", "server", "app"), label: ".next/server/app/", required: false, warnIfMissing: true },
  // Vercel's Next.js adapter copies pages here during `next build` (it later becomes .vercel/output).
  { dir: join(root, ".next", "output", "static"), label: ".next/output/static/", required: false },
  { dir: join(root, ".vercel", "output", "static"), label: ".vercel/output/static/", required: false },
];

export function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith(".html")) yield path;
  }
}

/** Hashes of every executable inline <script> in `html`. */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(attrs)) continue; // external: covered by 'self'
    if (/\btype\s*=\s*["']?(application\/(ld\+)?json|importmap)/i.test(attrs)) continue; // data blocks
    if (body === "") continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes].sort();
}

export function buildPolicy(hashes) {
  return [
    "default-src 'none'",
    // 'wasm-unsafe-eval' lets the browser compile WebAssembly; it does NOT allow JS eval.
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'", // the app fetches its own .wasm file and nothing else
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}

// Placed right after the charset <meta> so charset still sits within the first 1024 bytes.
const CHARSET_META = /<meta\s+charset=(["'])utf-8\1\s*\/?>/i;

export function injectPolicy(html, policy) {
  if (/http-equiv=["']?content-security-policy/i.test(html)) {
    throw new Error("Page already contains a CSP <meta>; refusing to double-inject.");
  }
  const match = CHARSET_META.exec(html);
  if (!match) throw new Error("Could not find <meta charSet> to anchor the CSP <meta> after.");
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('"', "&quot;")}"/>`;
  const at = match.index + match[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}

const POLICY_META = /<meta http-equiv="Content-Security-Policy"[^>]*\/?>/gi;

/** Removes any CSP <meta> this script added earlier, so re-running recomputes instead of failing. */
export function stripPolicy(html) {
  return html.replace(POLICY_META, "");
}

/** The policy string carried by the page's CSP <meta>, or null. */
function embeddedPolicy(html) {
  const match = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i.exec(html);
  return match ? match[1].replaceAll("&quot;", '"') : null;
}

/**
 * Injects a per-page policy into every .html file under `dir` and verifies the result:
 * every inline script in the written page must be allowed by the page's own policy.
 * Returns the number of files patched.
 */
export function injectDirectory(dir) {
  let count = 0;
  for (const file of htmlFiles(dir)) {
    const clean = stripPolicy(readFileSync(file, "utf8"));
    const patched = injectPolicy(clean, buildPolicy(inlineScriptHashes(clean)));
    const policy = embeddedPolicy(patched);
    const missing = inlineScriptHashes(patched).filter((hash) => !policy?.includes(hash));
    if (missing.length > 0) throw new Error(`${file}: inline script not covered by CSP: ${missing}`);
    writeFileSync(file, patched);
    count += 1;
  }
  return count;
}

function main() {
  for (const { dir, label, required, warnIfMissing } of TARGETS) {
    if (!existsSync(dir)) {
      if (required) throw new Error(`${label} not found. Did \`next build\` run?`);
      // Not fatal (layouts vary by host and Next version), but a host serving that copy
      // would ship pages without the script policy, so make the gap visible.
      if (warnIfMissing) console.warn(`CSP: WARNING ${label} not found; that copy was NOT patched.`);
      continue;
    }
    const count = injectDirectory(dir);
    if (count === 0 && required) throw new Error(`No .html files found in ${label}. Did \`next build\` run?`);
    console.log(`CSP: injected into ${count} page(s) in ${label}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
