import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SAMPLE_FEEDS,
  columnLabel,
  defaultCategoryColumn,
  firstPosition,
  numbersIn,
  parseSample,
  pointsBy,
  ringOf,
  shapesBy,
} from "../registry/vianova/lib/sample-datasets.ts";

const POINTS = [
  "device_id,provider_name,battery_pct,location",
  'd1,Lime,80,"POINT (-9.14 38.72)"',
  'd2,Bolt,20,"POINT (-9.15 38.73)"',
  'd3,Lime,55,"POINT (-9.16 38.74)"',
].join("\n");

const AREAS = [
  "zone_id,zone_type,max_vehicles,geometry",
  'z1,bay,10,"POLYGON ((-9.1 38.7, -9.1 38.8, -9.2 38.8, -9.1 38.7))"',
  'z2,slow,5,"POLYGON ((-9.3 38.7, -9.3 38.8, -9.4 38.8, -9.3 38.7))"',
].join("\n");

test("every feed has a unique id and a distinct file", () => {
  const ids = SAMPLE_FEEDS.map((f) => f.id);
  const files = SAMPLE_FEEDS.map((f) => f.file);
  assert.equal(new Set(ids).size, ids.length, "ids must be unique: styles key on them");
  assert.equal(new Set(files).size, files.length);
  for (const feed of SAMPLE_FEEDS) assert.ok(feed.title.length > 0, feed.id);
});

test("a file of points reads as points, a file of polygons as areas", () => {
  assert.equal(parseSample(POINTS)?.geometry, "point");
  assert.equal(parseSample(AREAS)?.geometry, "area");
});

test("the geometry kind comes from the cells, not the column name", () => {
  // Both of these call the column `geometry`; only one holds polygons.
  const pointsInAGeometryColumn = [
    "id,kind,geometry",
    'a,one,"POINT (-9.1 38.7)"',
    'b,two,"POINT (-9.2 38.8)"',
  ].join("\n");
  assert.equal(parseSample(pointsInAGeometryColumn)?.geometry, "point");
});

test("a leading blank geometry does not decide the kind", () => {
  const withGap = [
    "id,kind,geometry",
    "a,one,",
    'b,two,"POLYGON ((-9.1 38.7, -9.1 38.8, -9.2 38.8, -9.1 38.7))"',
  ].join("\n");
  assert.equal(parseSample(withGap)?.geometry, "area");
});

test("points carry the category they are coloured by", () => {
  const sample = parseSample(POINTS)!;
  assert.deepEqual(
    pointsBy(sample, "provider_name").map((p) => p.category),
    ["Lime", "Bolt", "Lime"],
  );
  assert.deepEqual(pointsBy(sample, "provider_name")[0]!.position, [-9.14, 38.72]);
});

test("with no column every point is one unnamed category", () => {
  const sample = parseSample(POINTS)!;
  assert.deepEqual(
    pointsBy(sample, undefined).map((p) => p.category),
    ["", "", ""],
  );
});

test("a filter narrows what is drawn, by row rather than by point", () => {
  const sample = parseSample(POINTS)!;
  const lime = pointsBy(sample, "provider_name", (row) => row.provider_name === "Lime");
  assert.equal(lime.length, 2);

  const charged = pointsBy(sample, "provider_name", (row) => Number(row.battery_pct) > 50);
  assert.deepEqual(
    charged.map((p) => p.category),
    ["Lime", "Lime"],
  );
});

test("areas come out as closed rings", () => {
  const sample = parseSample(AREAS)!;
  const shapes = shapesBy(sample, "zone_type");
  assert.equal(shapes.length, 2);
  assert.equal(shapes[0]!.category, "bay");
  assert.deepEqual(shapes[0]!.ring[0], [-9.1, 38.7]);
  assert.ok(shapes[0]!.ring.length >= 4);
});

test("a ring of fewer than four vertices is not a polygon", () => {
  assert.equal(ringOf("POLYGON ((-9.1 38.7, -9.1 38.8))"), null);
  assert.ok(ringOf("POLYGON ((-9.1 38.7, -9.1 38.8, -9.2 38.8, -9.1 38.7))"));
});

test("firstPosition reads the first vertex of any geometry", () => {
  assert.deepEqual(firstPosition("POINT (-9.14 38.72)"), [-9.14, 38.72]);
  // A trip's route: the start is what gets drawn.
  assert.deepEqual(
    firstPosition("LINESTRING (-9.14 38.72, -9.15 38.73, -9.16 38.74)"),
    [-9.14, 38.72],
  );
  assert.equal(firstPosition("not a geometry"), null);
});

test("the default colour column is the first category that varies", () => {
  // `kind` is the first category column but holds one value, so it would paint
  // the whole layer one colour.
  const flat = [
    "id,kind,operator,location",
    'a,same,Lime,"POINT (-9.1 38.7)"',
    'b,same,Bolt,"POINT (-9.2 38.8)"',
  ].join("\n");
  assert.equal(defaultCategoryColumn(parseSample(flat)!), "operator");
});

test("numbersIn skips cells that are not numbers", () => {
  const messy = ["id,n", "a,10", "b,", "c,oops", "d,2.5"].join("\n");
  assert.deepEqual(numbersIn(parseSample(messy)!, "n"), [10, 2.5]);
});

test("columnLabel shortens a known column and passes anything else through", () => {
  assert.equal(columnLabel("provider_name"), "Operator");
  assert.equal(columnLabel("some_uploaded_column"), "some_uploaded_column");
});
