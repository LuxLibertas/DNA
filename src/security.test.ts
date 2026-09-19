// Static guards for the security requirements. They fail the build if someone
// (or a framework upgrade) reintroduces a forbidden pattern.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPolicy, injectPolicy, inlineScriptHashes } from "../scripts/inject-csp.mjs";
import { HISTORY_KEY } from "@/lib/storage/history";
import { SETTINGS_KEY, SETTINGS_VERSION } from "@/lib/storage/settings";

const root = process.cwd();

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** First-party runtime source: everything shipped to the browser, minus tests and generated glue. */
const runtimeFiles = [...walk(join(root, "src")), ...walk(join(root, "public"))]
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .filter((file) => !file.includes(`${join("src", "wasm", "pkg")}`))
  .filter((file) => !file.endsWith("test-cipher.ts")) // Node-only test helper
  .filter((file) => /\.(tsx?|jsx?|css|svg|html)$/.test(file));

const read = (file: string) => readFileSync(file, "utf8");

describe("forbidden patterns in shipped first-party code", () => {
  it("has files to scan (guards against a silently empty glob)", () => {
    expect(runtimeFiles.length).toBeGreaterThan(15);
  });

  const forbidden: Array<[string, RegExp]> = [
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["eval()", /\beval\s*\(/],
    ["new Function()", /new\s+Function\s*\(/],
    ["string timers", /set(Timeout|Interval)\s*\(\s*["'`]/],
    ["innerHTML / outerHTML", /\b(inner|outer)HTML\b/],
    ["insertAdjacentHTML", /insertAdjacentHTML/],
    ["document.write", /document\.write/],
    ["dynamic script injection", /createElement\(\s*["']script["']\s*\)/],
    ["fetch()", /\bfetch\s*\(/],
    ["XMLHttpRequest", /XMLHttpRequest/],
    ["WebSocket / EventSource", /\b(WebSocket|EventSource)\b/],
    ["sendBeacon", /sendBeacon/],
    ["importScripts / workers", /importScripts|new\s+(Shared)?Worker\s*\(/],
    ["server actions", /["']use server["']/],
  ];

  it.each(forbidden)("contains no %s", (_name, pattern) => {
    const offenders = runtimeFiles.filter((file) => pattern.test(read(file)));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("references no external hosts (only XML namespace URIs are allowed)", () => {
    const offenders: string[] = [];
    for (const file of runtimeFiles) {
      for (const [url] of read(file).matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
        if (!url.startsWith("http://www.w3.org/")) offenders.push(`${relative(root, file)}: ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not use the `next/font` loaders that reach out to Google Fonts", () => {
    const offenders = runtimeFiles.filter((file) => /next\/font\/google/.test(read(file)));
    expect(offenders).toEqual([]);
  });
});

describe("no server-side code", () => {
  it("has no API routes, route handlers, middleware or proxy", () => {
    const names = [...walk(join(root, "src"))].map((f) => relative(root, f).replaceAll("\\", "/"));
    expect(names.filter((n) => /(^|\/)(route|middleware|proxy)\.(t|j)sx?$/.test(n))).toEqual([]);
    expect(names.filter((n) => n.startsWith("src/app/api/") || n.startsWith("src/pages/"))).toEqual([]);
  });

  it("is configured as a static export", () => {
    expect(read(join(root, "next.config.ts"))).toMatch(/output:\s*["']export["']/);
  });
});

describe("theme-init.js stays in sync with the settings module", () => {
  const script = read(join(root, "public", "theme-init.js"));

  it("reads the same storage key and schema version", () => {
    expect(script).toContain(`"${SETTINGS_KEY}"`);
    expect(script).toContain(`envelope.version === ${SETTINGS_VERSION}`);
  });

  it("does not collide with the history key", () => {
    expect(SETTINGS_KEY).not.toBe(HISTORY_KEY);
  });
});

describe("CSP post-build script", () => {
  const b64 = (text: string) => createHash("sha256").update(text, "utf8").digest("base64");

  it("hashes only inline, executable scripts", () => {
    const html = [
      `<script src="/a.js" async></script>`,
      `<script>self.x=1</script>`,
      `<script type="application/json">{"a":1}</script>`,
      `<script id="empty"></script>`,
    ].join("");
    expect(inlineScriptHashes(html)).toEqual([`'sha256-${b64("self.x=1")}'`]);
  });

  it("builds a policy without unsafe-inline / unsafe-eval and with default-src 'none'", () => {
    const policy = buildPolicy([`'sha256-abc'`]);
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' 'sha256-abc'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toMatch(/unsafe-inline|'unsafe-eval'/);
    expect(policy).not.toMatch(/https?:|\*/);
  });

  it("injects the meta right after the charset meta, and refuses to double-inject", () => {
    const html = `<html><head><meta charSet="utf-8"/><title>x</title></head></html>`;
    const out = injectPolicy(html, "default-src 'none'");
    expect(out).toMatch(
      /<meta charSet="utf-8"\/><meta http-equiv="Content-Security-Policy" content="default-src 'none'"\/><title>/,
    );
    expect(() => injectPolicy(out, "x")).toThrow(/already contains/);
    expect(() => injectPolicy("<html><head></head></html>", "x")).toThrow(/charSet/);
  });
});
