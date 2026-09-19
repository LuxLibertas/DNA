// Minimal static file server for ./out, used by `npm run serve:out` and Playwright.
// Dev tooling only (production is Vercel / any static host). Binds to loopback.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  // Mirrors vercel.json: frame-ancestors cannot be set from a <meta> CSP.
  "Content-Security-Policy": "frame-ancestors 'none'",
};

/** Maps a URL path to a file inside `root`, or null if it would escape it. */
function resolvePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = normalize(join(root, decoded));
  return target === root || target.startsWith(root + sep) ? target : null;
}

async function pick(target) {
  for (const candidate of [target, join(target, "index.html"), `${target}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(req.method === "HEAD" ? undefined : body);
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(405, "Method Not Allowed", { Allow: "GET, HEAD" });
  }
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const target = resolvePath(pathname);
  const file = target && (await pick(target));
  if (!file) return send(404, "Not Found", { "Content-Type": TYPES[".txt"] });
  try {
    const body = await readFile(file);
    send(200, body, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  } catch {
    send(500, "Internal Server Error", { "Content-Type": TYPES[".txt"] });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
