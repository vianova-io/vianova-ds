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
