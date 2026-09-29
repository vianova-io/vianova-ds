import { test } from "node:test";
import assert from "node:assert/strict";

import { newCondition, newGroup, type FilterField } from "../registry/vianova/lib/filter-ast.ts";
import { compileFilter } from "../registry/vianova/lib/filter-eval.ts";

const fields: FilterField[] = [
  { name: "volume", label: "Volume", type: "number", unit: "vehicles" },
  { name: "speed", label: "Speed limit", type: "number", unit: "km/h" },
  { name: "name", label: "Road name", type: "string" },
  { name: "junction", label: "At a junction", type: "boolean" },
  {
    name: "road",
    label: "Road type",
    type: "enum",
    options: [
      { value: "motorway", label: "Motorway" },
      { value: "primary", label: "Primary" },
      { value: "residential", label: "Residential" },
    ],
  },
];

const rows = [
  { name: "Hardbrücke", road: "primary", speed: 50, junction: false, volume: 7849 },
  { name: "Stelzentunnel", road: "motorway", speed: 100, junction: false, volume: 16946 },
  { name: "Ringstrasse", road: "residential", speed: 30, junction: true, volume: 5 },
  { name: "Hohlstrasse", road: "primary", speed: 50, junction: true, volume: 7609 },
  { name: "Nowhere", road: "residential", speed: 30, junction: false, volume: null },
];

const select = (tree: Parameters<typeof compileFilter>[0]) =>
  rows.filter(compileFilter(tree, fields)).map((r) => r.name);

const condition = (
  field: string,
  operator: Parameters<typeof newCondition>[1],
  value: unknown,
) => {
  const node = newCondition(field, operator);
  return { ...node, value: value as never };
};

test("an empty filter selects everything", () => {
  assert.equal(select(newGroup("and")).length, rows.length);
});

test("numbers compare numerically even when the value arrives as a string", () => {
  // The bug this guards: "5" > "30" lexically, so a typed threshold would put
  // a 5-vehicle residential street above a 30 km/h limit.
  const tree = newGroup("and", [condition("speed", "gt", "30")]);
  assert.deepEqual(select(tree), ["Hardbrücke", "Stelzentunnel", "Hohlstrasse"]);
});

test("between is inclusive at both ends", () => {
  const tree = newGroup("and", [condition("speed", "between", ["30", "50"])]);
  assert.deepEqual(select(tree), ["Hardbrücke", "Ringstrasse", "Hohlstrasse", "Nowhere"]);
});

test("in and not-in are complements over known values", () => {
  const inTree = newGroup("and", [condition("road", "in", ["motorway", "primary"])]);
  const outTree = newGroup("and", [condition("road", "not-in", ["motorway", "primary"])]);
  assert.deepEqual(select(inTree), ["Hardbrücke", "Stelzentunnel", "Hohlstrasse"]);
  assert.deepEqual(select(outTree), ["Ringstrasse", "Nowhere"]);
});

test("contains ignores case", () => {
  const tree = newGroup("and", [condition("name", "contains", "STRASSE")]);
  assert.deepEqual(select(tree), ["Ringstrasse", "Hohlstrasse"]);
});

test("booleans match without string coercion surprises", () => {
  const tree = newGroup("and", [condition("junction", "eq", "true")]);
  assert.deepEqual(select(tree), ["Ringstrasse", "Hohlstrasse"]);
});

test("is-null and is-not-null split the rows", () => {
  assert.deepEqual(select(newGroup("and", [condition("volume", "is-null", undefined)])), ["Nowhere"]);
  assert.equal(select(newGroup("and", [condition("volume", "is-not-null", undefined)])).length, 4);
});

test("and narrows, or widens", () => {
  const and = newGroup("and", [
    condition("road", "eq", "primary"),
    condition("junction", "eq", "true"),
  ]);
  const or = newGroup("or", [
    condition("road", "eq", "motorway"),
    condition("junction", "eq", "true"),
  ]);
  assert.deepEqual(select(and), ["Hohlstrasse"]);
  assert.deepEqual(select(or), ["Stelzentunnel", "Ringstrasse", "Hohlstrasse"]);
});

test("a half-built condition constrains nothing rather than blanking the view", () => {
  // Typing a threshold leaves the value briefly empty. Treating that as
  // "match nothing" empties the map mid-keystroke and reads as a bug.
  const tree = newGroup("and", [condition("volume", "gt", undefined)]);
  assert.equal(select(tree).length, rows.length);

  const emptyList = newGroup("and", [condition("road", "in", [])]);
  assert.equal(select(emptyList).length, rows.length);
});

test("an unknown field is ignored, not treated as matching nothing", () => {
  const tree = newGroup("and", [condition("does_not_exist", "eq", "x")]);
  assert.equal(select(tree).length, rows.length);
});

test("a null value never satisfies a comparison", () => {
  const tree = newGroup("and", [condition("volume", "gte", "0")]);
  assert.ok(!select(tree).includes("Nowhere"));
});
