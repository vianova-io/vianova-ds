import { createLucideIcon } from "lucide-react";

/**
 * The draw-a-zone glyph: a closed polygon with its vertices exposed as
 * handles, redrawn on Lucide's grid.
 *
 * Production puts this on the map's drawing tool, where it replaces
 * `PenLine`. A pen names the gesture and draws anything; this names what the
 * tool produces -- a closed zone whose corners can be moved. The handles are
 * the whole point: they are what makes the shape read as editable rather than
 * as a stamp. (The mode menu keeps its shape glyphs, Spline / Circle /
 * Hexagon, because each item there names a shape rather than the tool.)
 *
 * Lucide's rules, not production's artwork: 24x24, a 2px round-capped stroke,
 * no fill, `currentColor`, and all art inside 2..22. Two details are Lucide's
 * own conventions rather than mine --
 *
 * 1. The edges STOP at the handles instead of running under them, as `Spline`
 *    does (circles at 19,5 and 5,19; the path runs 17,5 to 5,17). With no fill
 *    behind the handles, an edge drawn through one would show inside it. Each
 *    edge is therefore a separate segment, trimmed to where it meets the
 *    square -- `H / max(|ux|, |uy|)` along the edge's own direction, which is
 *    why none of the four trims is the same length.
 * 2. The handles are squares, as production draws them, because Lucide already
 *    spends the r=2 circle on a bezier control point. A square says "corner you
 *    can drag", a circle says "curve you can bend", and this tool only has
 *    corners.
 *
 * They are 3.6 rather than 4 after looking at the thing: at 4 the 2px stroke
 * leaves a 2px hole, which fills in at the 16px the map's 32px button renders
 * it at. 3.6 with rx 0.5 keeps the hole open and still reads square.
 */

type Node = Parameters<typeof createLucideIcon>[1];

const p = (d: string, key: string): Node[number] => ["path", { d, key }];

/** Raw geometry, for anything that needs the SVG rather than a component. */
export const DRAW_ZONE_ICON_NODES: Node = [
  ["rect", { x: "2", y: "6.8", width: "3.6", height: "3.6", rx: "0.5", key: "a" }],
  ["rect", { x: "12.4", y: "2", width: "3.6", height: "3.6", rx: "0.5", key: "b" }],
  ["rect", { x: "18.4", y: "12.4", width: "3.6", height: "3.6", rx: "0.5", key: "c" }],
  ["rect", { x: "7", y: "18.4", width: "3.6", height: "3.6", rx: "0.5", key: "d" }],
  p("M5.6 7.77 12.4 4.63", "ab"),
  p("M15.24 5.6 19.16 12.4", "bc"),
  p("M18.4 15.15 10.6 19.25", "cd"),
  p("M8.02 18.4 4.58 10.4", "da"),
];

/**
 * A real Lucide component: `size`, `strokeWidth`, `absoluteStrokeWidth` and
 * `className` all behave as they do on `lucide-react`'s own, so it sits beside
 * them without looking imported.
 */
export const DrawZoneIcon = createLucideIcon("DrawZone", DRAW_ZONE_ICON_NODES);
