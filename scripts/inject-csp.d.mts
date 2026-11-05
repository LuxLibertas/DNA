export type Target = {
  dir: string;
  label: string;
  required: boolean;
  warnIfMissing?: boolean;
  /** A copy Vercel serves; on Vercel at least one of these must hold pages. */
  vercelOutput?: boolean;
};

export function inlineScriptHashes(html: string): string[];
export function buildPolicy(hashes: string[]): string;
export function injectPolicy(html: string, policy: string): string;
export function stripPolicy(html: string): string;
export function injectDirectory(dir: string): number;
export function verifyDirectory(dir: string): string[];
export function injectAllTargets(
  targets: ReadonlyArray<Target>,
  env: Record<string, string | undefined>,
  logger?: Pick<Console, "log" | "warn">,
): void;
export function htmlFiles(dir: string): Generator<string>;
export const TARGETS: ReadonlyArray<Target>;
