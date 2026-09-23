/**
 * Copies MapLibre's worker into public/maplibre/.
 *
 * MapLibre v6 loads its worker from a sibling ESM file. Next's webpack dev
 * server fails to resolve that URL and serves an HTML 404 instead; the worker
 * cannot parse it, the style never finishes loading, and the map renders
 * nothing while reporting no error. Serving the worker ourselves and pointing
 * setWorkerUrl at it sidesteps bundler URL resolution entirely.
 *
 * maplibre-gl-shared.mjs must sit beside it — the worker imports it relatively.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = join(APP, "public", "maplibre");

mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log("maplibre worker -> public/maplibre/");
