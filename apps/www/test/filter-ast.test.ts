import { test } from "node:test";
import assert from "node:assert/strict";

import {
  appendTo,
  arity,
  countConditions,
  describeFilter,
  fromQuery,
  isFilterComplete,
  newCondition,
  newGroup,
  removeNode,
  serializeFilter,
  toQuery,
  updateNode,
  validateFilter,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
} from "../registry/vianova/lib/filter-ast.ts";

const fields: FilterField[] = [
  {
    name: "mode",
    label: "Mode",
    type: "enum",
    options: [
      { value: "car", label: "Car" },
      { value: "bike", label: "Bike" },
    ],
  },
  { name: "duration", label: "Duration", type: "number", unit: "min" },
  { name: "district", label: "District", type: "string" },
];

const complete = () =>
  newGroup("and", [
    { ...newCondition("mode", "in"), value: ["car", "bike"] },
    { ...newCondition("duration", "between"), value: [5, 45] },
  ]) as FilterGroup;

test("arity classifies every operator shape", () => {
  assert.equal(arity("is-null"), 0);
  assert.equal(arity("eq"), 1);
  assert.equal(arity("between"), 2);
  assert.equal(arity("in"), "n");
});

test("updateNode returns a new tree and leaves untouched branches identical", () => {
  const tree = complete();
  const target = tree.children[0]!;
  const other = tree.children[1]!;

  const next = updateNode(tree, target.id, (n) => ({ ...(n as FilterCondition), value: ["car"] }));

  assert.notEqual(next, tree, "root is rebuilt");
  // Identity matters: React skips re-rendering a branch it is given back
  // unchanged, so a full deep copy would defeat memoisation on every keystroke.
  assert.equal((next as FilterGroup).children[1], other, "sibling keeps its identity");
  assert.deepEqual((tree.children[0] as FilterCondition).value, ["car", "bike"], "input untouched");
});

test("removeNode drops a group once its last child goes", () => {
  const inner = newGroup("or", [newCondition("district", "eq")]);
  const tree = newGroup("and", [newCondition("mode", "eq"), inner]) as FilterGroup;

  const next = removeNode(tree, inner.children[0]!.id) as FilterGroup;

  assert.equal(next.children.length, 1, "the emptied group is gone too");
  assert.equal(countConditions(next), 1);
});

test("appendTo adds into the addressed group, not the root", () => {
  const inner = newGroup("or", [newCondition("district", "eq")]);
  const tree = newGroup("and", [inner]) as FilterGroup;

  const next = appendTo(tree, inner.id, newCondition("mode", "eq")) as FilterGroup;

  assert.equal(next.children.length, 1);
  assert.equal((next.children[0] as FilterGroup).children.length, 2);
});

test("validateFilter reports every way a condition can be unfinished", () => {
  const cases: [string, FilterGroup, string][] = [
    ["missing scalar", newGroup("and", [newCondition("district", "eq")]) as FilterGroup, "Needs a value."],
    [
      "empty list",
      newGroup("and", [{ ...newCondition("mode", "in"), value: [] }]) as FilterGroup,
      "Pick at least one value.",
    ],
    [
      "half a range",
      newGroup("and", [{ ...newCondition("duration", "between"), value: [5, ""] }]) as FilterGroup,
      "Needs both a lower and an upper bound.",
    ],
    [
      "reversed range",
      newGroup("and", [{ ...newCondition("duration", "between"), value: [45, 5] }]) as FilterGroup,
      "Lower bound is above the upper bound.",
    ],
    ["empty group", newGroup("and", []) as FilterGroup, "Group is empty."],
  ];

  for (const [name, tree, message] of cases) {
    const issues = validateFilter(tree, fields);
    assert.equal(issues.length, 1, `${name}: expected exactly one issue`);
    assert.equal(issues[0]!.message, message, name);
  }

  assert.ok(isFilterComplete(complete(), fields), "a finished filter reports no issues");
});

test("validateFilter rejects a field the schema does not have", () => {
  const tree = newGroup("and", [{ ...newCondition("ghost", "eq"), value: 1 }]) as FilterGroup;
  assert.match(validateFilter(tree, fields)[0]!.message, /Unknown field/);
});

test("validateFilter rejects an operator the field type does not support", () => {
  const tree = newGroup("and", [{ ...newCondition("duration", "contains"), value: "x" }]) as FilterGroup;
  assert.match(validateFilter(tree, fields)[0]!.message, /does not apply to Duration/);
});

test("describeFilter uses labels, units and brackets the nested group", () => {
  const tree = newGroup("and", [
    { ...newCondition("mode", "in"), value: ["car", "bike"] },
    newGroup("or", [
      { ...newCondition("duration", "gte"), value: 10 },
      { ...newCondition("district", "eq"), value: "Graville" },
    ]),
  ]) as FilterGroup;

  assert.equal(
    describeFilter(tree, fields),
    "Mode is any of Car, Bike and (Duration at least 10 min or District is Graville)",
  );
});

test("describeFilter omits the value for operators that take none", () => {
  const tree = newGroup("and", [newCondition("district", "is-null")]) as FilterGroup;
  assert.equal(describeFilter(tree, fields), "District is empty");
});

test("a filter survives a round trip through serialisation", () => {
  const tree = complete();
  const restored = fromQuery(JSON.parse(serializeFilter(tree)));

  assert.deepEqual(toQuery(restored), toQuery(tree), "structure and values are preserved");
  assert.equal(describeFilter(restored, fields), describeFilter(tree, fields));
});

test("toQuery drops ids so equivalent filters compare equal", () => {
  // Same query, built twice: ids differ, the serialised form must not.
  assert.equal(serializeFilter(complete()), serializeFilter(complete()));
  assert.equal(JSON.stringify(toQuery(complete())).includes('"id"'), false);
});
