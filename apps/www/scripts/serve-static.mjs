/**
 * A static file server for the exported site.
 *
 * `next start` cannot serve an `output: "export"` build -- it exits with an
 * error -- so the Playwright suites need something else to point at. This is
 * that something: ~90 lines and no new dependency, in a repo whose whole
 * deployment story is now "the output is just files".
 *
 * Two details are load-bearing rather than incidental:
 *
 *   1. `.mjs` MUST be served as text/javascript. Browsers refuse to execute a
 *      module worker delivered with the wrong type, and maplibre's failure mode
 *      for a worker that never starts is a map that renders NOTHING while
 *      reporting no error. A sloppy MIME table here would manufacture exactly
 *      the bug these tests exist to catch.
 *
 *   2. `--prefix` serves ONLY under that prefix and hard-404s everything else.
 *      That strictness is the whole point: it is what makes the pages-shape
 *      guard non-vacuous, by ensuring an unprefixed asset path cannot
 *      accidentally resolve.
 *
 * Node's http module gives HTTP/1.1 keep-alive for free, which matters because
 * the a11y sweep alone is 200+ page loads in parallel.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, extname, resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const ROOT = resolve(arg("dir", "out"));
const PORT = Number(arg("port", "3100"));
/** Normalised to "" or "/thing" -- never a trailing slash. */
const PREFIX = arg("prefix", "").replace(/\/+$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  // See the note above. This one is not interchangeable with the others.
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

const send = (res, code, body = "") => {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
  res.end(body || String(code));
};

/** The file a URL path resolves to, or null. Mirrors `trailingSlash: true`. */
async function resolveFile(pathname) {
  // Reject traversal before touching the filesystem.
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const target = join(ROOT, clean);
  if (!target.startsWith(ROOT)) return null;

  const candidates = target.endsWith("/")
    ? [join(target, "index.html")]
    : [target, join(target, "index.html")];

  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");

    let rest = pathname;
    if (PREFIX) {
      if (pathname === PREFIX) {
        res.writeHead(308, { location: `${PREFIX}/` });
        return res.end();
      }
      // Anything outside the prefix is genuinely absent here, exactly as it
      // would be on a project Pages site.
      if (!pathname.startsWith(`${PREFIX}/`)) return send(res, 404);
      rest = pathname.slice(PREFIX.length);
    }

    const file = await resolveFile(rest);
    if (!file) {
      const notFound = await resolveFile("/404.html");
      if (!notFound) return send(res, 404);
      res.writeHead(404, { "content-type": TYPES[".html"] });
      return createReadStream(notFound).pipe(res);
    }

    res.writeHead(200, {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, String(err));
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}${PREFIX}/`);
});
