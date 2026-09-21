// Guards the Vercel deployment config. Vercel's Next.js builder reads `routes-manifest.json`
// from the project's Output Directory, and that file lives in `.next/` (even for a static
// export, which then serves `out/` automatically). An Output Directory of `out` -- e.g. left
// over in the dashboard's Project Settings from the import screen -- fails with
// "The file .../out/routes-manifest.json couldn't be found".
// vercel.json overrides the dashboard, so we pin the value here instead of relying on it.
// Verified with a local `vercel build` against simulated dashboard settings (see README).
// See https://github.com/vercel/vercel/blob/main/errors/now-next-routes-manifest.md
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");
const vercel = JSON.parse(read("vercel.json")) as Record<string, unknown>;
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

describe("vercel.json", () => {
  it("pins the Output Directory to Next's default distDir (.next), never to the export folder", () => {
    expect(vercel.outputDirectory).toBe(".next");
  });

  it("leaves distDir at its default in next.config.ts (otherwise the pinned value above would be wrong)", () => {
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
