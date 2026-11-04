/**
 * Turning points and lines into zones.
 *
 * A zone is always an area -- a closed ring of [longitude, latitude] pairs --
 * but the two things people most often have are a point (a junction, an
 * address) and a line (a street, a tram route). These grow one into the other,
 * and they live here because two unrelated surfaces need the same answer: the
 * paste box in the zone picker, and the line tool on the map. Two copies would
 * drift, and a street drawn by hand would stop matching the same street pasted
 * as GeoJSON.
 *
 * All of it is plane geometry in local metres around the shape's first vertex,
 * converted back to degrees at the end. Offsetting in degrees instead would
 * make a corridor narrower east-west than north-south, by a factor of
 * cos(latitude) -- a third narrower in Malmo than in Lisbon.
 */

/** Metres per degree of latitude. Longitude is this scaled by cos(latitude). */
export const METERS_PER_DEGREE = 111_320;

/**
 * Points in a full circle, and so also the points in the two round caps of a
 * corridor, which are half a circle each. Thirty-two is under a pixel of
 * error at the zoom a street is drawn at, and keeps a corridor of a few
 * hundred vertices rather than a few thousand.
 */
export const CIRCLE_STEPS = 32;

export type Position = [number, number];

/** A regular polygon around a point, close enough to a circle at map scale. */
export function circleAround(
  [lng, lat]: Position,
  radius: number,
): Position[] {
  const dLat = radius / METERS_PER_DEGREE;
  const dLng = radius / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const ring: Position[] = [];
  for (let i = 0; i < CIRCLE_STEPS; i++) {
    const a = (i / CIRCLE_STEPS) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]!);
  return ring;
}

/**
 * How far a mitred corner may reach past `radius`, as a multiple of it.
 *
 * A join is mitred so the corridor keeps its width around a bend, and the
 * sharper the bend the further the outside corner reaches: at 60 degrees it
 * is already twice the radius, and at a hairpin it would be unbounded. Four
 * is about a 151-degree turn, past which the corner is cut off rather than
 * allowed to shoot across the map.
 */
const MITRE_LIMIT = 4;

/**
 * A corridor of `radius` metres either side of a line, with round ends.
 *
 * Joins are mitred: each vertex is offset along the bisector of its two
 * segments and lengthened by 1/cos(half the turn), which is what keeps the
 * corridor the same width through a bend. Offsetting along the plain average
 * of the two normals instead -- the obvious thing, and what this did first --
 * pinches the corridor at every corner: a right angle comes out at 71% of the
 * width, so a street grid drawn with the line tool would narrow at each
 * junction and nothing on screen would say why.
 *
 * It is still not a general-purpose buffer: it does not resolve the
 * self-overlap a hairpin produces, and the mitre limit cuts the sharpest
 * corners rather than reaching for them.
 */
export function corridorAround(line: Position[], radius: number): Position[] {
  const [lng0, lat0] = line[0]!;
  const kx = METERS_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
  const ky = METERS_PER_DEGREE;
  const pts = line.map(
    ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky] as const,
  );
  const back = ([x, y]: readonly [number, number]): Position => [
    lng0 + x / kx,
    lat0 + y / ky,
  ];

  const normals = pts.slice(1).map(([x, y], i) => {
    const [px, py] = pts[i]!;
    const len = Math.hypot(x - px, y - py) || 1;
    return [-(y - py) / len, (x - px) / len] as const;
  });
  /** The unit bisector at vertex `i`: which way the corridor's side lies. */
  const vertexNormal = (i: number) => {
    const a = normals[Math.max(0, i - 1)]!;
    const b = normals[Math.min(normals.length - 1, i)]!;
    const nx = a[0] + b[0];
    const ny = a[1] + b[1];
    const len = Math.hypot(nx, ny) || 1;
    return [nx / len, ny / len] as const;
  };

  /**
   * The same bisector, lengthened so the offset vertex stays `radius` away
   * from both segments rather than from their average. At the two ends there
   * is only one segment, the bisector is that segment's normal, and the
   * factor is one.
   */
  const vertexOffset = (i: number) => {
    const [mx, my] = vertexNormal(i);
    const b = normals[Math.min(normals.length - 1, i)]!;
    const half = mx * b[0] + my * b[1];
    const scale = Math.min(MITRE_LIMIT, 1 / Math.max(half, 1e-6));
    return [mx * scale, my * scale] as const;
  };

  const left: Position[] = [];
  const right: Position[] = [];
  pts.forEach(([x, y], i) => {
    const [nx, ny] = vertexOffset(i);
    left.push(back([x + nx * radius, y + ny * radius]));
    right.push(back([x - nx * radius, y - ny * radius]));
  });

  const cap = (i: number, from: readonly [number, number]) => {
    const [cx, cy] = pts[i]!;
    const start = Math.atan2(from[1], from[0]);
    const out: Position[] = [];
    for (let s = 1; s < CIRCLE_STEPS / 2; s++) {
      const a = start - (s / (CIRCLE_STEPS / 2)) * Math.PI;
      out.push(back([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]));
    }
    return out;
  };

  const last = pts.length - 1;
  const [sx, sy] = vertexNormal(0);
  // Each cap sweeps clockwise from one side to the other, round the line's end.
  const ring = [
    ...left,
    ...cap(last, vertexNormal(last)),
    ...right.reverse(),
    ...cap(0, [-sx, -sy]),
  ];
  ring.push(ring[0]!);
  return ring;
}
