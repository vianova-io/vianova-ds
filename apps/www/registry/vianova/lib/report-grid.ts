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

/** Reading order, for narrow screens where the grid collapses to one column. */
export const readingOrder = <T extends { layout: Rect }>(items: T[]) =>
  [...items].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
