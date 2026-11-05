// Stills of the mobile-navigation mockups. TEMPORARY, like the route it shoots.
//
// Not a Playwright SPEC. `e2e/` is now run whole by CI -- that is the entire
// point of the commit that gated it -- so a screenshot script dropped in there
// would become a CI job that writes PNGs nobody reads. This drives chromium
// directly instead and is run by hand.
//
//   node scripts/mockup-shots.mjs --out /path/to/dir [--port 3190]
//
// Expects the static export to be served already, or serves out/ itself.

import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const PORT = Number(arg("port", 3190));
const OUT = arg("out", path.resolve("mockup-shots"));
const BASE = `http://127.0.0.1:${PORT}`;
const PHONE = { width: 390, height: 844 };

// Kept in step with frames.ts by reading the export's own directory listing:
// a frame added there appears here without this file being touched.
async function frameIds() {
  const dir = path.resolve("out/mockups/mobile-nav");
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== "live")
    .map((e) => e.name)
    .sort();
}

async function serve() {
  const child = spawn(
    "node",
    ["scripts/serve-static.mjs", "--dir", "out", "--port", String(PORT)],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error(`no server on ${BASE}`);
}

const ids = await frameIds();
const server = await serve();
const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

try {
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 2,
      colorScheme: theme,
    });
    // next-themes is class-based with defaultTheme "dark", so the class comes
    // from storage rather than from the media query -- emulateMedia alone
    // would shoot two identical dark frames. BasemapPreview picks its image
    // with `dark:`, so the two themes are genuinely different pictures.
    await context.addInitScript(
      `localStorage.setItem("theme", ${JSON.stringify(theme)})`,
    );
    const page = await context.newPage();

    for (const id of ids) {
      await page.goto(`${BASE}/mockups/mobile-nav/${id}/`, {
        waitUntil: "networkidle",
      });
      // MapLibre keeps fetching tiles after networkidle settles once, and a
      // half-painted basemap is the one thing these stills must not show.
      await page.waitForTimeout(id.endsWith("basemap") || /map/.test(id) ? 2500 : 600);
      const file = path.join(OUT, `${id}.${theme}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
