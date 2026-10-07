import { test } from "node:test";
import assert from "node:assert/strict";

import { inferColumns, parseCsv } from "../registry/vianova/lib/csv.ts";

test("detects a semicolon delimiter, as French and Belgian exports use", () => {
  const { delimiter, header, rows } = parseCsv("a;b;c\n1;2;3\n");
  assert.equal(delimiter, ";");
  assert.deepEqual(header, ["a", "b", "c"]);
  assert.deepEqual(rows, [["1", "2", "3"]]);
});

test("the Fleet export: one geometry, a quoted name, a count", () => {
  const hex = "0106000020E6100000010000000103000000010000002800";
  const parsed = parseCsv(`geometry;name;fleet_size\n${hex};"Brussels";15868\n`);
  assert.deepEqual(parsed.rows, [[hex, "Brussels", "15868"]]);
  const cols = inferColumns(parsed);
  assert.deepEqual(
    cols.map((c) => [c.name, c.type]),
    [
      ["geometry", "geometry"],
      ["name", "category"],
      ["fleet_size", "number"],
    ],
  );
  assert.deepEqual(cols[1]!.values, ["Brussels"]);
});

test("quoted fields keep delimiters, newlines and doubled quotes", () => {
  const { rows } = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",z\r\n');
  assert.deepEqual(rows, [
    ["x, y", "line1\nline2"],
    ['say "hi"', "z"],
  ]);
});

test("strips a BOM and tolerates a missing final newline", () => {
  const { header, rows } = parseCsv("﻿a,b\n1,2");
  assert.deepEqual(header, ["a", "b"]);
  assert.deepEqual(rows, [["1", "2"]]);
});

test("ignores blank lines", () => {
  assert.equal(parseCsv("a,b\n\n1,2\n\n").rows.length, 1);
});

test("an empty file has no header and no rows", () => {
  assert.deepEqual(parseCsv(""), { delimiter: ",", header: [], rows: [] });
});

test("types: ids, numbers, timestamps and geometry", () => {
  const cols = inferColumns(
    parseCsv(
      [
        "trip_id,speed,seen,shape",
        "a1,12.5,2025-04-01 08:30,POINT (1 2)",
        "b2,13,2025-04-02T09:00:00Z,POINT (3 4)",
      ].join("\n"),
    ),
  );
  assert.deepEqual(
    cols.map((c) => c.type),
    ["id", "number", "timestamp", "geometry"],
  );
});

test("a column of many distinct strings is text, not a category", () => {
  const body = Array.from({ length: 30 }, (_, i) => `name${i}`).join("\n");
  assert.equal(inferColumns(parseCsv(`label\n${body}`))[0]!.type, "text");
});

test("category values come most frequent first", () => {
  const cols = inferColumns(parseCsv("kind\ncar\nvan\nvan\nvan\ncar\ntruck"));
  assert.deepEqual(cols[0]!.values, ["van", "car", "truck"]);
});

test("mixed numbers and words fall back to a category or text, never number", () => {
  assert.notEqual(inferColumns(parseCsv("v\n1\nn/a\n3"))[0]!.type, "number");
});

test("an all-empty column is text", () => {
  assert.equal(inferColumns(parseCsv("a,b\n1,\n2,"))[1]!.type, "text");
});
