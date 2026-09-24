/**
 * Fails if the exported site contains a root-absolute reference to a `public/`
 * asset that was never given the site's basePath.
 *
 * This exists because `basePath` is not a general rewrite. Next applies it to
 * `next/link`, `next/image` and CSS-imported assets, and leaves every raw
 * string in a `src`/`href` exactly as written. On a project Pages site those
 * strings all 404 -- and the worst of them do so silently: a maplibre worker
 * that fails to load renders NOTHING and reports no error, and a `<a download>`
 * pointing at a 404 saves an empty file.
 *
 * Scans RENDERED HTML ATTRIBUTES only -- `src="..."` and `href="..."`. That
 * narrowness is deliberate and was arrived at the hard way: a first version
 * grepped raw file text and produced only false positives, because this docs
 * site renders registry source as syntax-highlighted HTML, so every code
 * listing and every doc comment that mentions "/maplibre/..." looked like a
 * defect. Worse, it flagged the compiled `("/vianova-ds"||"")+"/maplibre/..."`
 * -- code that is correct precisely because it concatenates the prefix.
 *
 * An attribute value is the one place a static scan can actually judge: it is
 * a literal URL the browser will request, not prose about one. Paths built in
 * JavaScript are out of reach here by construction, which is why
 * e2e/pages-shape.spec.ts watches real network traffic as well. The two
 * guards cover different halves and neither replaces the other.
 *
 * Browserless, so it costs about a second and can run on every build. With
 * NEXT_PUBLIC_BASE_PATH unset it is a no-op by construction -- a correct
 * root-served build has exactly these unprefixed paths.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WWW = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(WWW, "out");
const PREFIX = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Every src/href attribute whose value is a root-absolute path. */
const ATTR = /\b(?:src|href)="(\/[^"]*)"/g;

/**
 * Top-level entries of `public/`. A correctly prefixed value reads
 * "/vianova-ds/maplibre/..." and will not match.
 */
const BARE = /^\/(maplibre\/|brand\/|avatar\.png)/;

const SCAN = new Set([".html"]);

// Never let this pass by finding nothing to look at.
if (!existsSync(OUT)) {
  console.error(`check-export-paths: ${OUT} does not exist -- run the build first.`);
  process.exit(1);
}

if (!PREFIX) {
  console.log("check-export-paths: NEXT_PUBLIC_BASE_PATH unset, nothing to check.");
  process.exit(0);
}

/** The registry is consumer-facing source; its paths are theirs, not ours. */
const skip = (p) => relative(OUT, p).startsWith("r/");

const findings = [];
let scanned = 0;

const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip(p)) walk(p);
      continue;
    }
    if (!SCAN.has(extname(e.name)) || skip(p)) continue;
    scanned++;
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(ATTR)) {
      if (BARE.test(m[1])) findings.push({ file: relative(OUT, p), match: m[1] });
    }
  }
};

walk(OUT);

if (findings.length) {
  console.error(
    `\ncheck-export-paths: ${findings.length} unprefixed asset path(s) in the export.` +
      `\nbasePath is "${PREFIX}", so each of these 404s on the deployed site:\n`,
  );
  // Grouped by the offending PATH, not by file. One missing asset() call shows
  // up in every rendered route -- 200+ identical lines buries the one fact you
  // need, which is which path is wrong.
  const byPath = new Map();
  for (const f of findings) {
    if (!byPath.has(f.match)) byPath.set(f.match, []);
    byPath.get(f.match).push(f.file);
  }
  for (const [path, files] of [...byPath].sort()) {
    const where = files.length > 3 ? `${files.slice(0, 3).join(", ")} (+${files.length - 3} more)` : files.join(", ");
    console.error(`  ${path}   in ${files.length} file(s)\n    ${where}`);
  }
  console.error(
    "\nFix: wrap docs paths in asset() from @/lib/asset, or prefix a registry" +
      "\npath with process.env.NEXT_PUBLIC_BASE_PATH at the call site.\n",
  );
  process.exit(1);
}

console.log(
  `check-export-paths: ${scanned} HTML files scanned, every src/href carries "${PREFIX}".`,
);
