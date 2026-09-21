export function inlineScriptHashes(html: string): string[];
export function buildPolicy(hashes: string[]): string;
export function injectPolicy(html: string, policy: string): string;
export function stripPolicy(html: string): string;
export function injectDirectory(dir: string): number;
export function htmlFiles(dir: string): Generator<string>;
