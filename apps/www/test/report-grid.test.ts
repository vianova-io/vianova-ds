import { test } from "node:test";
import assert from "node:assert/strict";

import {
  firstFit,
  fits,
  moveTo,
  overlaps,
  pack,
  readingOrder,
  resizeTo,
  compactUp,
  resolveMove,
  roomAt,
  rowCount,
} from "../registry/vianova/lib/report-grid.ts";

const chart = { x: 0, y: 0, w: 4, h: 2 };

test("rectangles that only touch do not overlap", () => {
  assert.equal(overlaps(chart, { x: 4, y: 0, w: 4, h: 2 }), false);
  assert.equal(overlaps(chart, { x: 0, y: 2, w: 12, h: 1 }), false);
  assert.equal(overlaps(chart, { x: 3, y: 1, w: 2, h: 2 }), true);
});

test("a widget cannot run past the twelfth column", () => {
  assert.equal(fits({ x: 9, y: 0, w: 4, h: 1 }, []), false);
  assert.equal(fits({ x: 8, y: 0, w: 4, h: 1 }, []), true);
});

test("room at a cell stops at the next widget and at the grid edge", () => {
  const others = [{ x: 6, y: 0, w: 2, h: 2 }];
  // Wants 4 across; only columns 4 and 5 are free before the widget at 6.
  assert.deepEqual(roomAt(4, 0, { w: 4, h: 2 }, others), {
    x: 4,
    y: 0,
    w: 2,
    h: 2,
  });
  assert.deepEqual(roomAt(10, 3, { w: 4, h: 2 }, others), {
    x: 10,
    y: 3,
    w: 2,
    h: 2,
  });
});

test("room at a cell claims width before height", () => {
  // Free row 0 across, but row 1 is blocked from column 2.
  const others = [{ x: 2, y: 1, w: 1, h: 1 }];
  assert.deepEqual(roomAt(0, 0, { w: 4, h: 2 }, others), {
    x: 0,
    y: 0,
    w: 4,
    h: 1,
  });
});

test("there is no room at a cell something already covers", () => {
  assert.equal(roomAt(1, 1, { w: 4, h: 2 }, [chart]), null);
});

test("first fit fills a row before starting the next", () => {
  assert.deepEqual(
    pack([
      { w: 12, h: 2 },
      { w: 4, h: 2 },
      { w: 4, h: 2 },
      { w: 4, h: 2 },
      { w: 12, h: 1 },
    ]),
    [
      { x: 0, y: 0, w: 12, h: 2 },
      { x: 0, y: 2, w: 4, h: 2 },
      { x: 4, y: 2, w: 4, h: 2 },
      { x: 8, y: 2, w: 4, h: 2 },
      { x: 0, y: 4, w: 12, h: 1 },
    ],
  );
  assert.deepEqual(firstFit(6, 1, [chart]), { x: 4, y: 0, w: 6, h: 1 });
});

test("the canvas keeps six rows, or two spare below the lowest widget", () => {
  assert.equal(rowCount([]), 6);
  assert.equal(rowCount([{ x: 0, y: 7, w: 4, h: 2 }]), 11);
});

test("a move onto another widget is refused", () => {
  const other = { x: 4, y: 0, w: 4, h: 2 };
  assert.equal(moveTo(chart, 2, 0, [other]), null);
  assert.deepEqual(moveTo(chart, 0, 2, [other]), { x: 0, y: 2, w: 4, h: 2 });
});

test("a resize is clamped to its minimum and the grid edge, and refused on a collision", () => {
  assert.deepEqual(
    resizeTo({ x: 10, y: 0, w: 2, h: 2 }, 6, 0, [], { w: 2, h: 2 }),
    { x: 10, y: 0, w: 2, h: 2 },
  );
  assert.equal(resizeTo(chart, 6, 2, [{ x: 5, y: 1, w: 1, h: 1 }]), null);
});

test("narrow screens read widgets top to bottom, then left to right", () => {
  const items = [
    { id: "c", layout: { x: 0, y: 2, w: 12, h: 1 } },
    { id: "b", layout: { x: 4, y: 0, w: 4, h: 2 } },
    { id: "a", layout: { x: 0, y: 0, w: 4, h: 2 } },
  ];
  assert.deepEqual(
    readingOrder(items).map((i) => i.id),
    ["a", "b", "c"],
  );
});

const at = (i: string, x: number, y: number, w: number, h: number) => ({
  i,
  x,
  y,
  w,
  h,
});
const noOverlaps = (
  rs: Array<{ x: number; y: number; w: number; h: number }>,
) => rs.every((a, i) => rs.every((b, j) => i === j || !overlaps(a, b)));

test("dropped onto a chart of its size, the two swap", () => {
  const origin = [
    at("a", 0, 2, 4, 2),
    at("b", 4, 2, 4, 2),
    at("c", 0, 4, 12, 2),
  ];
  const out = resolveMove(origin, "a", { x: 4, y: 2, w: 4, h: 2 });
  assert.deepEqual(
    out.find((r) => r.i === "a"),
    at("a", 4, 2, 4, 2),
  );
  assert.deepEqual(
    out.find((r) => r.i === "b"),
    at("b", 0, 2, 4, 2),
  );
  assert.deepEqual(
    out.find((r) => r.i === "c"),
    at("c", 0, 4, 12, 2),
  );
});

test("what a pushed chart lands on is pushed too, so nothing hides under another", () => {
  // The bug: b was pushed onto c, and stayed hidden beneath it.
  const origin = [
    at("a", 0, 0, 12, 2),
    at("b", 0, 2, 12, 2),
    at("c", 0, 4, 12, 2),
  ];
  const out = resolveMove(
    origin,
    "a",
    { x: 0, y: 1, w: 12, h: 2 },
    { swap: false },
  );
  assert.ok(noOverlaps(out));
  assert.deepEqual(
    out.map((r) => r.y),
    [1, 3, 5],
  );
});

test("a chart pushed by a passing drag goes back when the drag moves on", () => {
  const origin = [
    at("a", 0, 0, 4, 2),
    at("b", 4, 0, 8, 2),
    at("c", 0, 2, 12, 2),
  ];
  resolveMove(origin, "a", { x: 6, y: 0, w: 4, h: 2 });
  const back = resolveMove(origin, "a", { x: 0, y: 0, w: 4, h: 2 });
  assert.deepEqual(back, origin);
});

test("a swap that would not fit falls back to pushing down", () => {
  // b is wider than a's old place next to d.
  const origin = [
    at("a", 0, 0, 4, 2),
    at("d", 4, 0, 8, 2),
    at("b", 0, 2, 12, 2),
  ];
  const out = resolveMove(origin, "a", { x: 0, y: 2, w: 4, h: 2 });
  assert.ok(noOverlaps(out));
  assert.equal(out.find((r) => r.i === "b")!.y, 4);
});

test("growing a chart pushes what is below it down", () => {
  const origin = [
    at("a", 0, 0, 4, 2),
    at("b", 0, 2, 4, 2),
    at("c", 0, 4, 12, 1),
  ];
  const out = resolveMove(
    origin,
    "a",
    { x: 0, y: 0, w: 4, h: 3 },
    { swap: false },
  );
  assert.ok(noOverlaps(out));
  assert.deepEqual(
    out.map((r) => r.y),
    [0, 3, 5],
  );
});

test("charts rise into the space a dragged chart leaves", () => {
  // a is held two rows down; b, beside it, and c, below, fill in above.
  const origin = [
    at("a", 0, 0, 12, 2),
    at("b", 0, 2, 4, 2),
    at("c", 0, 4, 12, 2),
  ];
  const out = resolveMove(
    origin,
    "a",
    { x: 0, y: 6, w: 12, h: 2 },
    { compact: true },
  );
  assert.deepEqual(
    out.map((r) => [r.i, r.y]),
    [
      ["a", 6],
      ["b", 0],
      ["c", 2],
    ],
  );
});

test("the held chart stays put while the rest compact around it", () => {
  const origin = [
    at("a", 0, 0, 4, 2),
    at("b", 4, 0, 4, 2),
    at("c", 0, 2, 12, 2),
  ];
  const out = resolveMove(
    origin,
    "a",
    { x: 8, y: 3, w: 4, h: 2 },
    { compact: true },
  );
  assert.deepEqual(
    out.find((r) => r.i === "a"),
    at("a", 8, 3, 4, 2),
  );
  assert.ok(noOverlaps(out));
  // b rises to the top; c is full width and cannot rise past the held chart.
  assert.equal(out.find((r) => r.i === "b")!.y, 0);
  assert.equal(out.find((r) => r.i === "c")!.y, 5);
});

test("compacting closes gaps and keeps order", () => {
  const out = compactUp([
    at("a", 0, 3, 4, 2),
    at("b", 0, 7, 4, 1),
    at("c", 4, 9, 8, 2),
  ]);
  assert.deepEqual(
    out.map((r) => r.y),
    [0, 2, 0],
  );
});
