/**
 * Converts the Vehicle Flows export into the GeoJSON the map workspace loads.
 *
 * One-off, NOT part of `pnpm build`: the source CSV is an export that does not
 * live in this repo, so a build step that needed it would fail in CI. Run it by
 * hand when the extract is refreshed, and commit the result.
 *
 *   node scripts/build-vehicle-flows.mjs "~/Downloads/Vehicle Flows.csv"
 *
 * Two things about the source are worth knowing before you change anything:
 *
 * 1. `geometry` is PostGIS EWKB hex, not WKT and not GeoJSON -- a little-endian
 *    LineString carrying an SRID (4326). It is decoded here rather than pulled
 *    in with a dependency, because the whole format is a byte order flag, a
 *    type, an SRID, a point count and then pairs of doubles.
 *
 * 2. Most rows have NO measurement. In the September 2026 extract 12,642 of
 *    19,847 segments carry `null` volume, and only 7,205 are measured. Those
 *    rows are dropped: a flow layer whose colour encodes volume cannot say
 *    anything about a segment that has none, and drawing them in a "no data"
 *    grey would put 12,642 lines of noise under the 7,205 that mean something.
 *    The count that survives is printed so the drop stays visible.
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * `.json`, not `.geojson`. Static hosts map .json to application/json; our own
 * serve-static fell through to application/octet-stream for .geojson, and
 * compression is commonly keyed on content type -- so an unrecognised
 * extension risks shipping the full 2MB instead of the ~0.3MB it gzips to.
 */
const OUT = join(HERE, "..", "public", "data", "vehicle-flows.json");

/**
 * Coordinate precision. 5 decimal places is ~1.1m at this latitude, which is
 * finer than the road centrelines themselves, and costs a quarter of the bytes
 * that full double precision does.
 */
const DECIMALS = 5;

/** Semicolon-separated, with quoted fields that themselves contain semicolons. */
function splitRow(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ";" && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** EWKB hex -> array of [lon, lat]. */
function decodeLineString(hex) {
  const buf = Buffer.from(hex, "hex");
  let at = 0;
  const little = buf.readUInt8(at) === 1;
  at += 1;
  const type = little ? buf.readUInt32LE(at) : buf.readUInt32BE(at);
  at += 4;
  if ((type & 0xff) !== 2) throw new Error(`expected LineString, got type ${type & 0xff}`);
  // The high bit of the type word flags a trailing SRID word.
  if (type & 0x20000000) at += 4;
  const count = little ? buf.readUInt32LE(at) : buf.readUInt32BE(at);
  at += 4;

  const round = (v) => Number(v.toFixed(DECIMALS));
  const coordinates = [];
  for (let i = 0; i < count; i++) {
    const x = little ? buf.readDoubleLE(at) : buf.readDoubleBE(at);
    at += 8;
    const y = little ? buf.readDoubleLE(at) : buf.readDoubleBE(at);
    at += 8;
    coordinates.push([round(x), round(y)]);
  }
  return coordinates;
}

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-vehicle-flows.mjs "<path to Vehicle Flows.csv>"');
  process.exit(1);
}

const lines = readFileSync(source, "utf8").split("\n").filter((l) => l.trim());
const header = splitRow(lines[0]);
const EXPECTED = [
  "geometry",
  "road_name",
  "road_type",
  "speed_limit",
  "is_intersection",
  "sum_vehicle_volume",
  "average_sum_vehicle_volume",
];
// Fail loudly on a reshaped export rather than silently writing a file whose
// columns have quietly shifted by one.
if (header.join(",") !== EXPECTED.join(",")) {
  console.error("Unexpected columns.\n  expected: %s\n  found:    %s", EXPECTED.join(";"), header.join(";"));
  process.exit(1);
}

const features = [];
let unmeasured = 0;
for (let i = 1; i < lines.length; i++) {
  const cells = splitRow(lines[i]);
  const volume = Number(cells[5]);
  if (!Number.isFinite(volume)) {
    unmeasured++;
    continue;
  }
  features.push({
    type: "Feature",
    properties: {
      name: cells[1],
      road: cells[2],
      speed: Number(cells[3]),
      junction: cells[4] === "true",
      volume,
      avg: Number(Number(cells[6]).toFixed(1)),
    },
    geometry: { type: "LineString", coordinates: decodeLineString(cells[0]) },
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }));

const mb = (statSync(OUT).size / 1e6).toFixed(2);
console.log(
  `vehicle-flows: ${features.length} measured segments (${unmeasured} unmeasured dropped), ${mb}MB`,
);
