import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORICAL_PALETTES,
  SEQUENTIAL_PALETTES,
  quantileEdges,
  rampFromStops,
  stopsFromRamp,
} from "../registry/vianova/lib/color-ramp.ts";

const BLACK_TO_WHITE = [
  { position: 0, color: "#000000" },
  { position: 100, color: "#ffffff" },
];

test("a two-stop ramp interpolates evenly between them", () => {
  assert.deepEqual(rampFromStops(BLACK_TO_WHITE, 3), ["#000000", "#808080", "#ffffff"]);
});

test("the ends are exact, never a rounded approximation of themselves", () => {
  const ramp = rampFromStops(BLACK_TO_WHITE, 11);
  assert.equal(ramp[0], "#000000");
  assert.equal(ramp[10], "#ffffff");
  assert.equal(ramp.length, 11);
});

test("positions outside the stops clamp rather than extrapolate", () => {
  // Nothing below 50% was chosen, so everything below it is the first colour --
  // not a darker one invented by running the gradient backwards.
  const ramp = rampFromStops(
    [
      { position: 50, color: "#000000" },
      { position: 100, color: "#ffffff" },
    ],
    5,
  );
  assert.deepEqual(ramp.slice(0, 3), ["#000000", "#000000", "#000000"]);
  assert.equal(ramp[4], "#ffffff");
});

test("stops are read in position order however they arrive", () => {
  const shuffled = [
    { position: 100, color: "#ffffff" },
    { position: 0, color: "#000000" },
  ];
  assert.deepEqual(rampFromStops(shuffled, 3), rampFromStops(BLACK_TO_WHITE, 3));
});

test("an unreadable colour is skipped, not painted as black", () => {
  const ramp = rampFromStops(
    [
      { position: 0, color: "not a colour" },
      { position: 0, color: "#ff0000" },
      { position: 100, color: "#ff0000" },
    ],
    3,
  );
  assert.deepEqual(ramp, ["#ff0000", "#ff0000", "#ff0000"]);
});

test("no usable stops gives no ramp rather than a default nobody chose", () => {
  assert.deepEqual(rampFromStops([], 5), []);
  assert.deepEqual(rampFromStops([{ position: 0, color: "nope" }], 5), []);
});

test("a ramp round-trips through its five anchors", () => {
  const ramp = rampFromStops(BLACK_TO_WHITE, 11);
  const stops = stopsFromRamp(ramp);
  assert.deepEqual(
    stops.map((s) => s.position),
    [0, 25, 50, 75, 100],
  );
  assert.equal(stops[0]!.color, "#000000");
  assert.equal(stops[4]!.color, "#ffffff");
  // Re-expanding the anchors reproduces the ends it came from.
  const again = rampFromStops(stops, 11);
  assert.equal(again[0], "#000000");
  assert.equal(again[10], "#ffffff");
});

test("quantile edges strictly ascend, which MapLibre's step requires", () => {
  const edges = quantileEdges([1, 1, 1, 2, 3, 100], 5);
  assert.ok(edges.length >= 2);
  for (let i = 1; i < edges.length; i++) assert.ok(edges[i]! > edges[i - 1]!);
});

test("a column of one repeated value yields no usable edges", () => {
  // Every quantile is the same number, so there is no band boundary to draw.
  assert.deepEqual(quantileEdges([7, 7, 7, 7], 5), [7]);
});

test("quantiles follow the data, not the range", () => {
  // Long-tailed: equal intervals would put all but the outlier in one band.
  const edges = quantileEdges([1, 2, 3, 4, 5, 1000], 3);
  assert.ok(edges[edges.length - 1]! === 1000);
  assert.ok(edges[0]! === 1);
});

test("every palette is non-empty and families are consistent", () => {
  for (const p of [...CATEGORICAL_PALETTES, ...SEQUENTIAL_PALETTES]) {
    assert.ok(p.colors.length >= 5, p.name);
    for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/i, `${p.name}: ${c}`);
  }
  assert.ok(CATEGORICAL_PALETTES.every((p) => p.family === "Categorical"));
  // The sequential set carries diverging ramps too; both have order, which is
  // what makes them usable for a measure.
  assert.ok(SEQUENTIAL_PALETTES.every((p) => p.family !== "Categorical"));
});

test("names are unique within each set, since they are the selection value", () => {
  for (const set of [CATEGORICAL_PALETTES, SEQUENTIAL_PALETTES]) {
    const names = set.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
  }
});
