// Guards the Vercel deployment config. A Next.js static export must NOT set an Output
// Directory: Vercel's Next.js builder reads `routes-manifest.json` from it, and that file
// lives in `.next/`, so `outputDirectory: "out"` fails with
// "The file .../out/routes-manifest.json couldn't be found".
// See https://github.com/vercel/vercel/blob/main/errors/now-next-routes-manifest.md
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
const vercel = JSON.parse(read("vercel.json")) as Record<string, unknown>;
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

describe("vercel.json", () => {
  it("does not override the Output Directory", () => {
    expect(vercel).not.toHaveProperty("outputDirectory");
  });

  it("does not override distDir in next.config.ts (which is what would justify an outputDirectory)", () => {
    expect(read("next.config.ts")).not.toMatch(/distDir/);
  });

  it("builds via the package script so the CSP step always runs", () => {
    expect(vercel.buildCommand).toBe("npm run build");
    expect(pkg.scripts.build).toMatch(/^next build && node scripts\/inject-csp\.mjs$/);
  });

  it("keeps a static export (no server runtime needed on Vercel)", () => {
    expect(read("next.config.ts")).toMatch(/output:\s*["']export["']/);
  });
});
