// Static guards for the security requirements. They fail the build if someone
// (or a framework upgrade) reintroduces a forbidden pattern.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TARGETS,
  buildPolicy,
  injectDirectory,
  injectPolicy,
  inlineScriptHashes,
  injectAllTargets,
  stripPolicy,
  verifyDirectory,
} from "../scripts/inject-csp.mjs";
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

describe("CSP injection over a build directory (out/ and .next/server/app/)", () => {
  const page = (script: string) =>
    `<!DOCTYPE html><html><head><meta charSet="utf-8"/><title>t</title></head><body>` +
    `<script src="/a.js" async></script><script>${script}</script></body></html>`;

  const makeTree = () => {
    const dir = mkdtempSync(join(tmpdir(), "csp-"));
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "index.html"), page("self.a=1"));
    writeFileSync(join(dir, "nested", "deep.html"), page("self.b=2"));
    writeFileSync(join(dir, "ignore.txt"), "not html");
    return dir;
  };
  const metaCount = (html: string) => (html.match(/http-equiv="Content-Security-Policy"/g) ?? []).length;

  it("patches every html file recursively, each with a policy covering its own inline scripts", () => {
    const dir = makeTree();
    try {
      expect(injectDirectory(dir)).toBe(2);
      for (const [file, script] of [["index.html", "self.a=1"], ["nested/deep.html", "self.b=2"]] as const) {
        const html = readFileSync(join(dir, file), "utf8");
        expect(metaCount(html)).toBe(1);
        expect(html).toContain(`'sha256-${createHash("sha256").update(script).digest("base64")}'`);
      }
      expect(readFileSync(join(dir, "ignore.txt"), "utf8")).toBe("not html");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is idempotent: running twice yields identical files with a single meta", () => {
    const dir = makeTree();
    try {
      injectDirectory(dir);
      const once = readFileSync(join(dir, "index.html"), "utf8");
      injectDirectory(dir);
      const twice = readFileSync(join(dir, "index.html"), "utf8");
      expect(twice).toBe(once);
      expect(metaCount(twice)).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recomputes hashes if a page's inline script changed since an earlier run", () => {
    const dir = makeTree();
    try {
      injectDirectory(dir);
      const first = readFileSync(join(dir, "index.html"), "utf8");
      writeFileSync(join(dir, "index.html"), first.replace("self.a=1", "self.a=999"));
      injectDirectory(dir);
      const html = readFileSync(join(dir, "index.html"), "utf8");
      expect(html).toContain(`'sha256-${createHash("sha256").update("self.a=999").digest("base64")}'`);
      expect(html).not.toContain(`'sha256-${createHash("sha256").update("self.a=1").digest("base64")}'`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stripPolicy removes only the CSP meta", () => {
    const patched = injectPolicy(page("x"), "default-src 'none'");
    expect(metaCount(patched)).toBe(1);
    expect(stripPolicy(patched)).toBe(page("x"));
  });

  it("reports zero when a directory has no html (so main() can fail loudly)", () => {
    const dir = mkdtempSync(join(tmpdir(), "csp-empty-"));
    try {
      expect(injectDirectory(dir)).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CSP injection targets", () => {
  const targets = TARGETS.map((target) => relative(root, target.dir).replaceAll("\\", "/"));

  it("covers every place a host can serve built pages from", () => {
    // out/ = static export; .next/server/app = prerender; .next/output/static = what Vercel's
    // Next.js adapter writes DURING `next build` (production served this copy, unpatched, once).
    expect(targets).toEqual(
      expect.arrayContaining(["out", ".next/server/app", ".next/output/static", ".vercel/output/static"]),
    );
  });

  it("requires only the static export", () => {
    expect(TARGETS.filter((target) => target.required).map((target) => target.label)).toEqual(["out/"]);
  });

  it("treats the adapter's copies as Vercel's served output", () => {
    expect(TARGETS.filter((target) => target.vercelOutput).map((target) => target.label)).toEqual([
      ".next/output/static/",
      ".vercel/output/static/",
    ]);
  });
});

describe("CSP read-back verification", () => {
  const unpatched = `<!DOCTYPE html><html><head><meta charSet="utf-8"/></head><body><script>self.a=1</script></body></html>`;
  const withTree = (run: (dir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "csp-verify-"));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("passes pages whose policy covers their inline scripts, and ignores non-pages", () => {
    withTree((dir) => {
      writeFileSync(join(dir, "index.html"), unpatched);
      writeFileSync(join(dir, "index.rsc"), "1:not a page");
      writeFileSync(join(dir, "module.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
      injectDirectory(dir);
      expect(verifyDirectory(dir)).toEqual([]);
    });
  });

  it("reports a page with no CSP meta", () => {
    withTree((dir) => {
      writeFileSync(join(dir, "index.html"), unpatched);
      expect(verifyDirectory(dir)).toEqual([expect.stringMatching(/index\.html: no CSP meta/)]);
    });
  });

  it("reports an inline script the page's policy does not cover", () => {
    withTree((dir) => {
      writeFileSync(join(dir, "index.html"), unpatched);
      injectDirectory(dir);
      const patched = readFileSync(join(dir, "index.html"), "utf8");
      writeFileSync(join(dir, "index.html"), patched.replace("self.a=1", "self.a=2"));
      expect(verifyDirectory(dir)).toEqual([expect.stringMatching(/index\.html: inline script not covered/)]);
    });
  });

  it("finds a page without an .html extension, which the injector would have skipped", () => {
    withTree((dir) => {
      writeFileSync(join(dir, "index.html"), unpatched);
      writeFileSync(join(dir, "about"), unpatched);
      injectDirectory(dir);
      expect(verifyDirectory(dir)).toEqual([expect.stringMatching(/about: no CSP meta/)]);
    });
  });
});

describe("CSP build gate", () => {
  const page = `<!DOCTYPE html><html><head><meta charSet="utf-8"/></head><body><script>self.a=1</script></body></html>`;
  const quiet = { log: () => {}, warn: () => {} };

  /** Builds targets under a temp root; `pages` lists the directories that get an index.html. */
  const withTargets = (pages: string[], run: (targets: typeof TARGETS) => void) => {
    const base = mkdtempSync(join(tmpdir(), "csp-gate-"));
    try {
      for (const name of pages) {
        mkdirSync(join(base, name), { recursive: true });
        writeFileSync(join(base, name, "index.html"), page);
      }
      run([
        { dir: join(base, "out"), label: "out/", required: true },
        { dir: join(base, "adapter"), label: "adapter/", required: false, vercelOutput: true },
        { dir: join(base, "moved"), label: "moved/", required: false, vercelOutput: true },
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  };

  it("fails on Vercel when the adapter's output is missing", () => {
    withTargets(["out"], (targets) => {
      expect(() => injectAllTargets(targets, { VERCEL: "1" }, quiet)).toThrow(/Vercel.*adapter/s);
    });
  });

  it("fails on Vercel when the adapter's output exists but holds no pages", () => {
    withTargets(["out"], (targets) => {
      const adapter = targets.find((target) => target.label === "adapter/");
      mkdirSync(adapter?.dir ?? "", { recursive: true });
      expect(() => injectAllTargets(targets, { VERCEL: "1" }, quiet)).toThrow(/Vercel.*adapter/s);
    });
  });

  it.each([["adapter"], ["moved"]])("passes on Vercel when the pages are in %s/", (dir) => {
    withTargets(["out", dir], (targets) => {
      expect(() => injectAllTargets(targets, { VERCEL: "1" }, quiet)).not.toThrow();
    });
  });

  it("does not require the adapter's output off Vercel", () => {
    withTargets(["out"], (targets) => {
      expect(() => injectAllTargets(targets, {}, quiet)).not.toThrow();
    });
  });

  it("still fails anywhere when the static export is missing", () => {
    withTargets([], (targets) => {
      expect(() => injectAllTargets(targets, {}, quiet)).toThrow(/out\/ not found/);
    });
  });

  it("fails when a page the injector cannot see has no CSP", () => {
    withTargets(["out"], (targets) => {
      writeFileSync(join(targets[0]?.dir ?? "", "about"), page);
      expect(() => injectAllTargets(targets, {}, quiet)).toThrow(/about: no CSP meta/);
    });
  });
});
