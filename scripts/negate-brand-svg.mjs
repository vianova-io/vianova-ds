/**
 * Derives the white logo from the black one as its exact tonal negative.
 *
 *   pnpm brand:negate <black-in.svg> <white-out.svg>
 *
 * Why generate it rather than ship Figma's own white export:
 *
 * The mark is three overlapping shapes under `mix-blend-mode: color`, which
 * takes hue and saturation from the source and LUMINOSITY FROM THE BACKDROP.
 * In the black variant the shape underneath is a black gradient, so the mark
 * stays black. In Figma's white variant that same underlying shape is the
 * pink-to-green brand gradient, which desaturates to mid-grey and drags the
 * whole mark to mid-grey with it. Measured, the white symbol read 131/255 on a
 * dark ground where a true mirror of the black reads 228.
 *
 * Editing those layers by hand does not work either, and two attempts proved
 * it: recolouring any one shape changes what the other two blend against, so
 * fixing the foreground grey leaves the underlying gradient still setting the
 * tone. Negating the finished result cannot desynchronise from the black
 * artwork, because it IS the black artwork.
 *
 * feComponentTransfer maps each colour channel through 1 -> 0 and leaves alpha
 * alone, so black ink at 70% becomes white ink at 70% and every overlap keeps
 * its relative tone. The filter also isolates, which stops the blends inside
 * from reaching out to the page behind and taking their luminosity from it.
 *
 * The invariant this maintains, asserted by scripts/verify-brand-negative.mjs:
 * the white file on black is the photographic negative of the black file on
 * white. If someone re-exports the black mark, the white one follows for free.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const NEGATE =
  `<filter id="vn-negate" x="0" y="0" width="100%" height="100%"` +
  ` filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">` +
  `<feComponentTransfer>` +
  `<feFuncR type="table" tableValues="1 0"/>` +
  `<feFuncG type="table" tableValues="1 0"/>` +
  `<feFuncB type="table" tableValues="1 0"/>` +
  `</feComponentTransfer></filter>`;

export function negateBrandSvg(svg) {
  const open = svg.match(/^\s*<svg[^>]*>/)?.[0];
  if (!open) throw new Error("not an SVG: no root <svg> element");
  const close = svg.lastIndexOf("</svg>");
  const body = svg.slice(svg.indexOf(open) + open.length, close);
  return `${open}<defs>${NEGATE}</defs><g filter="url(#vn-negate)">${body}</g></svg>`;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: pnpm brand:negate <black-in.svg> <white-out.svg>");
  process.exit(1);
}

// Resolved against where the command was run, not where pnpm put the process.
const from = process.env.INIT_CWD ?? process.cwd();
const at = (p) => (isAbsolute(p) ? p : resolve(from, p));

const out = negateBrandSvg(readFileSync(at(input), "utf8"));
writeFileSync(at(output), out);
console.log(`${output}: ${out.length} bytes, negated from ${input}`);
