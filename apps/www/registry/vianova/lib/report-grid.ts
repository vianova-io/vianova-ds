/**
 * Geometry for a report canvas: widgets sit on a grid of whole cells, never
 * overlapping, and every move or resize is checked against the others.
 *
 * Pure, so the rules -- what collides, how much room a cell has, where a new
 * widget goes -- can be tested without a browser.
 */

export const GRID_COLUMNS = 12;
/** A new report shows at least this many rows of empty cells. */
export const MIN_ROWS = 6;

/** Columns and rows are zero-based; w and h are counted in cells. */
export type Rect = { x: number; y: number; w: number; h: number };

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inBounds = (r: Rect, cols = GRID_COLUMNS) =>
  r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= cols;

/** Whether `r` can go on the grid without covering any of `others`. */
export const fits = (r: Rect, others: Rect[], cols = GRID_COLUMNS) =>
  inBounds(r, cols) && !others.some((o) => overlaps(r, o));

/** Whether the single cell at (x, y) is covered by anything. */
export const isFree = (x: number, y: number, others: Rect[]) =>
  !others.some((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);

/**
 * The largest rectangle anchored at (x, y), up to `want`, that covers nothing.
 *
 * Width is claimed first and height second, because a widget squeezed narrow
 * is less useful than one squeezed short. Null when the cell itself is taken.
 */
export function roomAt(
  x: number,
  y: number,
  want: { w: number; h: number },
  others: Rect[],
  cols = GRID_COLUMNS,
): Rect | null {
  if (!isFree(x, y, others) || x < 0 || x >= cols || y < 0) return null;
  let w = 1;
  while (w < want.w && x + w < cols && isFree(x + w, y, others)) w++;
  let h = 1;
  while (h < want.h && fits({ x, y: y + h, w, h: 1 }, others, cols)) h++;
  return { x, y, w, h };
}

/** The first free spot for a `w` by `h` widget, scanning rows top to bottom. */
export function firstFit(
  w: number,
  h: number,
  others: Rect[],
  cols = GRID_COLUMNS,
): Rect {
  const width = Math.min(w, cols);
  for (let y = 0; ; y++) {
    for (let x = 0; x + width <= cols; x++) {
      const r = { x, y, w: width, h };
      if (fits(r, others, cols)) return r;
    }
  }
}

/** Places sized items one after another, each in the first spot it fits. */
export function pack(
  sizes: Array<{ w: number; h: number }>,
  cols = GRID_COLUMNS,
): Rect[] {
  const placed: Rect[] = [];
  for (const s of sizes) placed.push(firstFit(s.w, s.h, placed, cols));
  return placed;
}

/**
 * How many rows the canvas draws: the minimum, or enough to show every widget
 * with `spare` empty rows below the lowest, so there is always room to add.
 */
export function rowCount(rects: Rect[], spare = 2, min = MIN_ROWS) {
  const bottom = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  return Math.max(min, bottom + spare);
}

/** `r` moved to (x, y), or null if it would leave the grid or cover another widget. */
export function moveTo(
  r: Rect,
  x: number,
  y: number,
  others: Rect[],
  cols = GRID_COLUMNS,
): Rect | null {
  const next = { ...r, x, y };
  return fits(next, others, cols) ? next : null;
}

/**
 * `r` resized to w by h, clamped to `min` and to the grid's right edge. Null
 * when the new size would cover another widget.
 */
export function resizeTo(
  r: Rect,
  w: number,
  h: number,
  others: Rect[],
  min = { w: 1, h: 1 },
  cols = GRID_COLUMNS,
): Rect | null {
  const next = {
    ...r,
    w: Math.max(min.w, Math.min(w, cols - r.x)),
    h: Math.max(min.h, h),
  };
  return fits(next, others, cols) ? next : null;
}

/**
 * Where everything goes when one widget is dragged or resized to `target`.
 *
 * Always worked out from `origin`, the layout before the gesture began, never
 * from the last frame's answer: a widget pushed aside by a passing drag goes
 * back once the drag moves on, rather than staying wherever it was shoved.
 *
 * - Swap: dropped onto exactly one widget, that widget takes the dragged one's
 *   old place, if it fits there.
 * - Otherwise everything in the way moves down, and whatever that lands on
 *   moves down in turn, so no widget can end up under another.
 *
 * Widgets keep their order and their gaps; nothing is pulled up.
 */
export function resolveMove<T extends Rect & { i: string }>(
  origin: readonly T[],
  id: string,
  target: Rect,
  { swap = true, cols = GRID_COLUMNS }: { swap?: boolean; cols?: number } = {},
): T[] {
  const from = origin.find((r) => r.i === id);
  if (!from) return origin.map((r) => ({ ...r }));
  const moved = {
    ...from,
    x: Math.max(0, Math.min(target.x, cols - target.w)),
    y: Math.max(0, target.y),
    w: Math.min(target.w, cols),
    h: target.h,
  };
  const others = origin.filter((r) => r.i !== id);

  if (swap) {
    const hit = others.filter((r) => overlaps(r, moved));
    const only = hit.length === 1 ? hit[0]! : null;
    if (only) {
      const back = {
        ...only,
        x: Math.max(0, Math.min(from.x, cols - only.w)),
        y: from.y,
      };
      const rest = others.filter((r) => r !== only);
      if (fits(back, [...rest, moved], cols))
        return origin.map((r) =>
          r.i === id ? moved : r.i === only.i ? back : { ...r },
        );
    }
  }

  // Top to bottom, so a widget pushed down is settled before anything below it.
  const queue = [...others].sort((a, b) => a.y - b.y || a.x - b.x);
  const settled: Rect[] = [moved];
  const placed = new Map<string, T>([[id, moved]]);
  for (const r of queue) {
    const next = { ...r };
    for (;;) {
      const below = settled.filter((s) => overlaps(s, next));
      if (!below.length) break;
      next.y = Math.max(...below.map((s) => s.y + s.h));
    }
    settled.push(next);
    placed.set(r.i, next);
  }
  return origin.map((r) => placed.get(r.i)!);
}

/** Reading order, for narrow screens where the grid collapses to one column. */
export const readingOrder = <T extends { layout: Rect }>(items: T[]) =>
  [...items].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
