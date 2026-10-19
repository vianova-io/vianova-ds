import { createLucideIcon, type LucideIcon } from "lucide-react";

/**
 * Custom regulation type icons: production's twelve rule glyphs, redrawn on
 * Lucide's grid.
 *
 * Production ships them as filled outlines on a 28px canvas, baked into a
 * coloured shield (`vip.vianova.io/images/regulations/badge_*.svg`). Lucide has
 * no equivalent for most of them -- there is no "cap", "floor" or "max parked"
 * -- and the stock icons the workspace first borrowed (`Wrench`, `Timer`,
 * `Layers`) named the wrong thing. These keep production's meaning and follow
 * Lucide's rules instead: a 24x24 viewBox, a 2px round-capped stroke, no fill,
 * `currentColor`. So they sit beside any Lucide icon without looking imported.
 *
 * `createLucideIcon` makes each one a real Lucide component: `size`,
 * `strokeWidth`, `absoluteStrokeWidth` and `className` all behave as they do
 * on `lucide-react`'s own.
 *
 * Two departures from production, both because the original turns to mush
 * below 24px: max unavailable keeps the hexagon and the crossed-out eyes but
 * drops the zigzag mouth, and no deployment keeps two of the four scattering
 * arrows, the pair the slash does not cross.
 */

type Node = Parameters<typeof createLucideIcon>[1];

const p = (d: string, key: string): Node[number] => ["path", { d, key }];

const HEXAGON =
  "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z";

/** Raw geometry, for anything that needs the SVG rather than a component. */
export const REGULATION_TYPE_ICON_NODES = {
  cap: [p("M5 3h14", "a"), p("M12 21V9", "b"), p("m8 13 4-4 4 4", "c")],
  "cap-and-floor": [
    p("M5 3h14", "a"),
    p("M5 21h14", "b"),
    p("M12 7v10", "c"),
    p("m9 10 3-3 3 3", "d"),
    p("m9 14 3 3 3-3", "e"),
  ],
  fees: [
    p("M15 7a6 6 0 1 0 0 10", "a"),
    p("M3 10h8", "b"),
    p("M3 14h8", "c"),
    p("m18 9 3 3-3 3", "d"),
  ],
  floor: [p("M5 21h14", "a"), p("M12 17V4", "b"), p("m8 8 4-4 4 4", "c")],
  "low-speed": [p("m4 5 8 6 8-6", "a"), p("m4 12 8 6 8-6", "b")],
  "max-parked": [
    p("M4 16V2h4.5a4.5 4.5 0 0 1 0 9H4", "a"),
    ["circle", { cx: "17", cy: "17", r: "5", key: "b" }],
    p("M17 15v2l1 1", "c"),
  ],
  "max-unavailable": [
    p(HEXAGON, "a"),
    p("m8 9 2.5 2.5", "b"),
    p("m10.5 9-2.5 2.5", "c"),
    p("m13.5 9 2.5 2.5", "d"),
    p("m16 9-2.5 2.5", "e"),
    p("M9.5 16h5", "f"),
  ],
  "no-go": [p("M19 5 5 19", "a"), p("m5 5 14 14", "b")],
  "no-parking": [p("m2 2 20 20", "a"), p("M8 21v-8", "b"), p("M10 3h3a5 5 0 0 1 4 8", "c")],
  parking: [p("M7 21V3h5.5a5.5 5.5 0 0 1 0 11H7", "a")],
  "no-deployment": [
    p("M3 9V3h6", "a"),
    p("m3 3 6 6", "b"),
    p("M21 15v6h-6", "c"),
    p("m21 21-6-6", "d"),
    p("m2 22 20-20", "e"),
  ],
  "multi-parking": [
    p("M5 20V3h5.5a5.5 5.5 0 0 1 0 11H5", "a"),
    p("M18 15v6", "b"),
    p("m15.4 16.5 5.2 3", "c"),
    p("m15.4 19.5 5.2-3", "d"),
  ],
} satisfies Record<string, Node>;

export type RegulationTypeIconName = keyof typeof REGULATION_TYPE_ICON_NODES;

const icon = (name: RegulationTypeIconName) =>
  createLucideIcon(`regulation-${name}`, REGULATION_TYPE_ICON_NODES[name]);

export const RegulationCap: LucideIcon = icon("cap");
export const RegulationCapAndFloor: LucideIcon = icon("cap-and-floor");
export const RegulationFees: LucideIcon = icon("fees");
export const RegulationFloor: LucideIcon = icon("floor");
export const RegulationLowSpeed: LucideIcon = icon("low-speed");
export const RegulationMaxParked: LucideIcon = icon("max-parked");
export const RegulationMaxUnavailable: LucideIcon = icon("max-unavailable");
export const RegulationNoGo: LucideIcon = icon("no-go");
export const RegulationNoParking: LucideIcon = icon("no-parking");
export const RegulationParking: LucideIcon = icon("parking");
export const RegulationNoDeployment: LucideIcon = icon("no-deployment");
export const RegulationMultiParking: LucideIcon = icon("multi-parking");

/** Every icon by its kebab name, in the order production's picker lists them. */
export const REGULATION_TYPE_ICONS: Record<RegulationTypeIconName, LucideIcon> = {
  cap: RegulationCap,
  "cap-and-floor": RegulationCapAndFloor,
  fees: RegulationFees,
  floor: RegulationFloor,
  "low-speed": RegulationLowSpeed,
  "max-parked": RegulationMaxParked,
  "max-unavailable": RegulationMaxUnavailable,
  "no-go": RegulationNoGo,
  "no-parking": RegulationNoParking,
  parking: RegulationParking,
  "no-deployment": RegulationNoDeployment,
  "multi-parking": RegulationMultiParking,
};

/** A standalone SVG file's text, as Lucide publishes its own. */
export function regulationTypeIconSvg(name: RegulationTypeIconName): string {
  const body = REGULATION_TYPE_ICON_NODES[name]
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(" ");
      return `  <${String(tag)} ${a} />`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${body}\n</svg>\n`;
}
