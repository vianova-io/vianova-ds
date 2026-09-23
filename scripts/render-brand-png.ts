/**
 * Renders PNG copies of the brand SVGs for download.
 *
 *   pnpm brand:png
 *
 * SVG is the right format for the web, but a logo is asked for far more often
 * by people putting it into Slides, a document or an email signature, where
 * SVG support ranges from patchy to absent. So both are offered.
 *
 * Rasterised with Playwright's Chromium rather than a native SVG library.
 * These marks are built from gradients in `mix-blend-mode: color` and
 * `soft-light`, and librsvg implements neither: it paints the overlays
 * literally, which turns the white lockup's mark into a magenta-and-green blob
 * and the original into something oversaturated. Attempting to strip the
 * offending layers first only moves the guesswork around — a browser already
 * knows exactly what these files mean, and Chromium is installed for the
 * visual tests regardless.
 *
 * Widths are fixed rather than scale factors, so the lockup and the symbol
 * come out at comparable useful sizes despite very different aspect ratios.
 * The output is committed: it changes only when the logo does.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(ROOT, "apps", "www", "public", "brand");

/** Immediately usable sizes: a slide, and a retina slide. */
const TARGETS: { file: string; widths: number[] }[] = [
  { file: "vianova-logo", widths: [1024, 2048] },
  { file: "vianova-logo-dark", widths: [1024, 2048] },
  { file: "vianova-logo-white", widths: [1024, 2048] },
  { file: "vianova-logo-black", widths: [1024, 2048] },
  { file: "vianova-symbol", widths: [512, 1024] },
  { file: "vianova-symbol-white", widths: [512, 1024] },
  { file: "vianova-symbol-black", widths: [512, 1024] },
];

function intrinsicSize(svg: string) {
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);
  if (viewBox?.length === 4) return { width: viewBox[2]!, height: viewBox[3]! };
  return {
    width: Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 0),
    height: Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 0),
  };
}

async function main() {
  // Resolved from apps/www, which is where @playwright/test is a dependency.
  // A bare import resolves relative to this file at the repo root instead, and
  // fails with MODULE_NOT_FOUND.
  const require = createRequire(join(ROOT, "apps", "www", "package.json"));
  const { chromium } = require("@playwright/test") as typeof import("@playwright/test");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { file, widths } of TARGETS) {
    const svg = readFileSync(join(BRAND, `${file}.svg`), "utf8");
    const natural = intrinsicSize(svg);

    for (const [index, width] of widths.entries()) {
      const height = Math.round((width * natural.height) / natural.width);
      const suffix = index === 0 ? "" : `@${index + 1}x`;

      await page.setViewportSize({ width, height });
      await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
      );
      // omitBackground is what keeps the alpha channel; without it every logo
      // ships on an opaque white rectangle, which is useless on a dark slide.
      const buffer = await page.screenshot({ omitBackground: true });

      writeFileSync(join(BRAND, `${file}${suffix}.png`), buffer);
      console.log(
        `  ${file}${suffix}.png  ${width}x${height}  ${(buffer.length / 1024).toFixed(0)} kB`,
      );
    }
  }

  await browser.close();
}

main();
