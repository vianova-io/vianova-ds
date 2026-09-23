/**
 * Strips the Figma board background out of an exported SVG.
 *
 *   pnpm brand:clean <in.svg> <out.svg>
 *
 * (tsx is a dependency of apps/www, not of the workspace root, hence the
 * script wrapper rather than a bare `pnpm tsx` here.)
 *
 * Figma's asset export captures a component *in situ*, so a logo exported from
 * a board on a dark section arrives with that section's fill and two
 * page-sized rectangles baked in — the mark on a grey slab rather than on
 * nothing. This removes them without guessing at shapes:
 *
 *   1. a rect that exactly covers the canvas, which is the board's own fill
 *   2. any path whose geometry starts well outside the viewBox
 *
 * Both tests are structural, so re-exporting an updated logo is one command
 * rather than a hand edit somebody has to remember the details of.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const MARGIN = 50;

export function cleanFigmaSvg(svg: string): string {
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1]);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("Could not read width/height from the SVG root element.");
  }

  let out = svg.replace(
    new RegExp(`<rect width="${width}" height="${height}" fill="#[0-9a-fA-F]{6}"\\s*/>`),
    "",
  );

  out = out.replace(/<path\b[^>]*\/>/g, (element) => {
    const start = /\bd="M(-?[\d.]+)[ ,](-?[\d.]+)/.exec(element);
    if (!start) return element;
    const [x, y] = [Number(start[1]), Number(start[2])];
    const offCanvas =
      x < -MARGIN || y < -MARGIN || x > width + MARGIN || y > height + MARGIN;
    return offCanvas ? "" : element;
  });

  return out.replace(/\n\s*\n+/g, "\n");
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: tsx scripts/clean-figma-svg.ts <in.svg> <out.svg>");
  process.exit(1);
}

/**
 * Paths are resolved against the directory the command was *run* from.
 *
 * The pnpm wrapper executes this inside apps/www so it can find tsx, which
 * would otherwise silently reinterpret a repo-relative path like
 * `apps/www/public/brand/x.svg` as `apps/www/apps/www/...`. INIT_CWD is where
 * the user actually stood.
 */
const from = process.env.INIT_CWD ?? process.cwd();
const at = (p: string) => (isAbsolute(p) ? p : resolve(from, p));

const cleaned = cleanFigmaSvg(readFileSync(at(input), "utf8"));
writeFileSync(at(output), cleaned);
console.log(`${output}: ${cleaned.length} bytes`);
