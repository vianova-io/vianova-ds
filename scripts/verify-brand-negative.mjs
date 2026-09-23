/**
 * Asserts that each white logo is still the exact tonal negative of its black
 * counterpart.
 *
 *   pnpm brand:verify
 *
 * This is the check that would have caught the defect it was written for. The
 * white mark shipped for two rounds looking mid-grey on a dark ground while
 * every file-level property anyone thought to measure -- byte count, presence
 * of the blend, ink colour sampled where alpha was high -- looked correct. The
 * only reliable statement is about what the eye receives, so that is what this
 * measures: render white on black, render black on white, and require one to
 * be 255 minus the other.
 *
 * Note the trap in the earlier measurement. Sampling only near-opaque pixels
 * reported the white mark's ink as 255 because its INK is white; what makes it
 * look grey is its alpha. Compositing over the real ground first is the
 * difference between measuring the file and measuring the logo.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(ROOT, "apps", "www", "public", "brand");

const PAIRS = [
  ["vianova-logo-black", "vianova-logo-white"],
  ["vianova-symbol-black", "vianova-symbol-white"],
];

/** Antialiased curves land a few levels apart between two renders; real drift
 *  moves whole regions, so the gate is on AREA, with a loose per-pixel band. */
const TOLERANCE = 4;
const MAX_OFF_PCT = 0.05;

const require = createRequire(join(ROOT, "apps", "www", "package.json"));
const { chromium } = require("@playwright/test");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 });

const shot = async (name, background) => {
  const svg = readFileSync(join(BRAND, `${name}.svg`), "utf8");
  await page.setContent(
    `<style>html,body{margin:0;background:${background}}
     svg{display:block;width:600px;height:auto}</style>${svg}`,
  );
  return (await page.screenshot({ clip: { x: 0, y: 0, width: 600, height: 300 } })).toString("base64");
};

let failed = 0;
for (const [black, white] of PAIRS) {
  const r = await page.evaluate(
    async ([w, b, tol]) => {
      const load = async (s) => {
        const i = new Image();
        i.src = "data:image/png;base64," + s;
        await i.decode();
        const c = new OffscreenCanvas(i.width, i.height);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, i.width, i.height).data;
      };
      const [W, B] = [await load(w), await load(b)];
      let worst = 0, off = 0, n = 0;
      for (let i = 0; i < W.length; i += 4)
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(W[i + c] - (255 - B[i + c]));
          worst = Math.max(worst, d);
          if (d > tol) off++;
          n++;
        }
      return { worst, pct: (100 * off) / n };
    },
    [await shot(white, "#000000"), await shot(black, "#ffffff"), TOLERANCE],
  );

  const ok = r.pct <= MAX_OFF_PCT;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${white.padEnd(24)} worst Δ ${String(r.worst).padStart(3)}, ` +
      `${r.pct.toFixed(2)}% of subpixels off (limit ${MAX_OFF_PCT}%)`,
  );
}

await browser.close();

if (failed) {
  console.error(
    `\n${failed} white logo(s) no longer mirror their black counterpart.` +
      `\nRegenerate with: pnpm brand:negate <black>.svg <white>.svg\n`,
  );
  process.exit(1);
}
console.log("\nEvery white logo is the exact negative of its black counterpart.");
