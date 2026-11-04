import { test } from "node:test";
import assert from "node:assert/strict";

import {
  METERS_PER_DEGREE,
  circleAround,
  corridorAround,
  type Position,
} from "../registry/vianova/lib/zone-geometry.ts";

/** Metres between two nearby points, on the local flat approximation. */
function metresBetween(a: Position, b: Position) {
  const kx = METERS_PER_DEGREE * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * METERS_PER_DEGREE);
}

/** The shortest distance from `p` to the segment a-b, in metres. */
function metresToSegment(p: Position, a: Position, b: Position) {
  const kx = METERS_PER_DEGREE * Math.cos((a[1] * Math.PI) / 180);
  const to = ([lng, lat]: Position) =>
    [(lng - a[0]) * kx, (lat - a[1]) * METERS_PER_DEGREE] as const;
  const [px, py] = to(p);
  const [bx, by] = to(b);
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / len2));
  return Math.hypot(px - bx * t, py - by * t);
}

const LISBON: Position = [-9.14, 38.72];

test("a circle's every vertex sits the asked-for radius from the centre", () => {
  const ring = circleAround(LISBON, 250);
  for (const point of ring) {
    assert.ok(
      Math.abs(metresBetween(LISBON, point) - 250) < 1,
      `vertex at ${metresBetween(LISBON, point).toFixed(1)} m, expected 250`,
    );
  }
});

test("a ring comes back closed, so it is a polygon and not a path", () => {
  for (const ring of [
    circleAround(LISBON, 100),
    corridorAround(
      [LISBON, [-9.13, 38.73]],
      50,
    ),
  ]) {
    assert.deepEqual(ring[0], ring[ring.length - 1]);
  }
});

/*
 * The one thing about the line tool that is easy to get wrong by a factor of
 * two: the argument is the distance to EITHER side, so a corridor built with
 * 10 is 20 metres across. The banner's "20 m wide" promises the width, and
 * the control halves it on the way in -- if that halving ever goes missing,
 * every street in Malmo doubles, which no screenshot would make obvious.
 */
test("a corridor reaches its radius either side of the line, not across it", () => {
  const line: Position[] = [LISBON, [-9.13, 38.72]];
  const ring = corridorAround(line, 30);
  const distances = ring.map((p) => metresToSegment(p, line[0]!, line[1]!));
  const farthest = Math.max(...distances);
  assert.ok(
    Math.abs(farthest - 30) < 1,
    `farthest vertex is ${farthest.toFixed(1)} m from the line, expected 30`,
  );
  // And no vertex falls short: every one is on the boundary, not inside it.
  assert.ok(Math.min(...distances) > 29, "a vertex sits inside the corridor");
});

test("a corridor keeps its width around a corner", () => {
  const line: Position[] = [LISBON, [-9.13, 38.72], [-9.13, 38.73]];
  const ring = corridorAround(line, 40);
  // A mitred join reaches further than the radius at the corner itself, which
  // is correct; what must not happen is a vertex closer to the line than the
  // radius, which would be a pinch in the zone.
  const nearest = Math.min(
    ...ring.map((p) =>
      Math.min(
        metresToSegment(p, line[0]!, line[1]!),
        metresToSegment(p, line[1]!, line[2]!),
      ),
    ),
  );
  assert.ok(nearest > 39, `corridor pinches to ${nearest.toFixed(1)} m`);
});
