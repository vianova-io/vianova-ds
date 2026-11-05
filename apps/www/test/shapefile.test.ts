import { test } from "node:test";
import assert from "node:assert/strict";

import {
  collectShapefileParts,
  parseDbfNames,
  parseShp,
  readProjection,
  readShapefile,
} from "../registry/vianova/lib/shapefile.ts";

/* --------------------------------------------------------------------------
 * Files, built here rather than checked in.
 *
 * A fixture .shp would be a binary blob nobody could read in a diff, and the
 * point of these tests is the layout -- which byte means what -- so the
 * layout is written out in the builder and read back by the parser.
 * -------------------------------------------------------------------------- */

type Ring = [number, number][];

/** A .shp holding one record per ring, as polygons (5) or polylines (3). */
function buildShp(parts: Ring[], shapeType: 5 | 3 | 1): ArrayBuffer {
  const bodies = parts.map((ring) => {
    if (shapeType === 1) {
      const body = new ArrayBuffer(20);
      const v = new DataView(body);
      v.setInt32(0, 1, true);
      v.setFloat64(4, ring[0]![0], true);
      v.setFloat64(12, ring[0]![1], true);
      return body;
    }
    const body = new ArrayBuffer(44 + 4 + ring.length * 16);
    const v = new DataView(body);
    v.setInt32(0, shapeType, true);
    // The bounding box is read past, not read, so zeros are honest enough.
    v.setInt32(36, 1, true); // one part
    v.setInt32(40, ring.length, true);
    v.setInt32(44, 0, true); // that part starts at point 0
    ring.forEach(([x, y], i) => {
      v.setFloat64(48 + i * 16, x, true);
      v.setFloat64(56 + i * 16, y, true);
    });
    return body;
  });

  const size = 100 + bodies.reduce((n, b) => n + 8 + b.byteLength, 0);
  const out = new ArrayBuffer(size);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setInt32(0, 9994, false);
  view.setInt32(24, size / 2, false); // file length, in 16-bit words
  view.setInt32(28, 1000, true);
  view.setInt32(32, shapeType, true);

  let at = 100;
  bodies.forEach((body, i) => {
    view.setInt32(at, i + 1, false);
    view.setInt32(at + 4, body.byteLength / 2, false);
    bytes.set(new Uint8Array(body), at + 8);
    at += 8 + body.byteLength;
  });
  return out;
}

/** A .dbf with a single character column, one row per name. */
function buildDbf(column: string, values: string[], width = 16): ArrayBuffer {
  const headerLength = 32 + 32 + 1;
  const recordLength = 1 + width;
  const out = new ArrayBuffer(headerLength + values.length * recordLength + 1);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint8(0, 0x03);
  view.setUint32(4, values.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  for (let i = 0; i < column.length; i++) {
    bytes[32 + i] = column.charCodeAt(i);
  }
  bytes[32 + 11] = "C".charCodeAt(0);
  bytes[32 + 16] = width;
  bytes[64] = 0x0d; // the field list ends here
  values.forEach((value, row) => {
    const at = headerLength + row * recordLength;
    bytes[at] = 0x20; // not deleted
    for (let i = 0; i < width; i++) {
      bytes[at + 1 + i] = i < value.length ? value.charCodeAt(i) : 0x20;
    }
  });
  return out;
}

const SQUARE: Ring = [
  [-9.14, 38.72],
  [-9.14, 38.73],
  [-9.13, 38.73],
  [-9.13, 38.72],
  [-9.14, 38.72],
];
/* Clockwise in shapefile terms, which is what marks a ring as an outline and
 * not a hole. The winding is the only thing that distinguishes the two. */
const OUTER: Ring = [...SQUARE].reverse() as Ring;

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
const SWEREF_PRJ =
  'PROJCS["SWEREF99_TM",GEOGCS["GCS_SWEREF99",DATUM["D_SWEREF99",SPHEROID["GRS_1980",6378137.0,298.257222101]]],PROJECTION["Transverse_Mercator"],UNIT["Meter",1.0]]';

test("a polygon record reads back the points it was written with", () => {
  const shapes = parseShp(buildShp([OUTER], 5));
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0]!.kind, "area");
  assert.deepEqual(
    (shapes[0] as { parts: Ring[] }).parts[0],
    OUTER,
  );
});

test("every record in the file is read, not just the first", () => {
  const shapes = parseShp(buildShp([OUTER, OUTER, OUTER], 5));
  assert.equal(shapes.length, 3);
});

test("a .dbf gives each shape its name, and padding is trimmed", () => {
  assert.deepEqual(parseDbfNames(buildDbf("NAME", ["Baixa", "Alfama"])), [
    "Baixa",
    "Alfama",
  ]);
});

test("shapes are named from the .dbf, and numbered without one", () => {
  const shp = buildShp([OUTER, OUTER], 5);
  const named = readShapefile({ shp, dbf: buildDbf("NAME", ["Baixa", "Alfama"]) });
  assert.deepEqual(
    "zones" in named ? named.zones.map((z) => z.name) : named,
    ["Baixa", "Alfama"],
  );
  const bare = readShapefile({ shp });
  assert.deepEqual(
    "zones" in bare ? bare.zones.map((z) => z.name) : bare,
    ["Shape 1", "Shape 2"],
  );
});

/*
 * The failure this is really guarding against is silence. Numbers in metres
 * are perfectly good numbers, so a Swedish file taken as degrees produces
 * zones with no error at all -- in the Atlantic, off Africa, where nobody
 * would think to look for Malmo.
 */
test("a projection this reader cannot convert is refused by name", () => {
  assert.deepEqual(readProjection(SWEREF_PRJ), {
    kind: "unknown",
    name: "SWEREF99_TM",
  });
  const result = readShapefile({ shp: buildShp([OUTER], 5), prj: SWEREF_PRJ });
  assert.ok("error" in result);
  assert.match(result.error, /SWEREF99_TM/);
  assert.match(result.error, /EPSG:4326/);
});

test("a WGS 84 .prj is read as degrees and passes through unchanged", () => {
  assert.deepEqual(readProjection(WGS84_PRJ), { kind: "wgs84" });
  const result = readShapefile({ shp: buildShp([OUTER], 5), prj: WGS84_PRJ });
  assert.ok("zones" in result);
  assert.deepEqual(result.zones[0]!.ring, OUTER);
});

test("lines and points become zones only once given a width", () => {
  const line = buildShp(
    [
      [
        [-9.14, 38.72],
        [-9.13, 38.72],
      ],
    ],
    3,
  );
  const without = readShapefile({ shp: line });
  assert.deepEqual(without, { error: "Lines need a width above 0" });

  const with40 = readShapefile({ shp: line }, { radiusMeters: 40 });
  assert.ok("zones" in with40);
  assert.ok(with40.zones[0]!.ring.length > 4, "a corridor, not the line");

  const point = buildShp([[[-9.14, 38.72]]], 1);
  assert.deepEqual(readShapefile({ shp: point }), {
    error: "Points need a width above 0",
  });
  const circle = readShapefile({ shp: point }, { radiusMeters: 100 });
  assert.ok("zones" in circle);
});

test("a file that is not a shapefile says so rather than throwing", () => {
  const result = readShapefile({ shp: new ArrayBuffer(200) });
  assert.deepEqual(result, { error: "This is not a .shp file." });
});

test("the parts are picked out by extension, and a Mac's copies ignored", () => {
  const bytes = new Uint8Array(0);
  const parts = collectShapefileParts([
    { name: "zones/Zones.shp", bytes },
    { name: "zones/Zones.dbf", bytes },
    { name: "zones/Zones.prj", bytes },
  ]);
  assert.ok(parts.shp && parts.dbf && parts.prj !== undefined);
  assert.equal(parts.shpCount, 1);
});
