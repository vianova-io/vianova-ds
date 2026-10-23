import * as React from "react";
import type { LucideIcon } from "lucide-react";

import {
  RegulationCap,
  RegulationCapAndFloor,
  RegulationFees,
  RegulationFloor,
  RegulationLowSpeed,
  RegulationMaxParked,
  RegulationMaxUnavailable,
  RegulationMultiParking,
  RegulationNoDeployment,
  RegulationNoGo,
  RegulationNoParking,
  RegulationParking,
} from "@/registry/vianova/product/regulation-type-icons";

import {
  contrastBetween,
  luminance,
  parseHex,
} from "@/registry/vianova/lib/category-style";
import { cn } from "@/registry/vianova/lib/utils";

export type RuleType =
  | "cap"
  | "cap_and_floor"
  | "fees_subsidies"
  | "floor"
  | "low_speed"
  | "max_parked"
  | "max_unavailable"
  | "no_go"
  | "no_parking"
  | "parking"
  | "operator_no_deployment"
  | "multi_parking";

/*
 * Rule colours are PRODUCTION's regulation palette, given as literal hexes.
 *
 * They used to be stops from CATEGORY_PALETTE, which made the design system
 * disagree with the product it documents: side by side the generated set read
 * duller, and multi-parking came out blue where production draws it green.
 * These are the values production actually paints, so a rule list here and a
 * rule list there are the same picture.
 *
 * Literal hexes rather than tokens because these are MAP LAYER colours: the
 * zone a rule draws and the icon that names it in a list have to match, and
 * MapLibre cannot read a CSS variable. They do not change with the theme.
 *
 * Grouped by what a rule does to a vehicle, not one colour per type. Every
 * rule about how many vehicles there are, or what they cost, is the same
 * purple, because on the map they are all "an area with a fleet condition",
 * and the glyph is what tells them apart.
 */
const FLEET = "#9254DE"; // purple -- cap, floor, fees, max unavailable, no deployment
const PARK = "#73D13D"; // green -- parking, max parked
const NO_PARK = "#FAAD14"; // amber
const NO_GO = "#F5222D"; // red
const SLOW = "#13A8A8"; // teal
/*
 * Multi-parking is the same green as parking, which is what production shows
 * and what it is: a set of parking and no-parking areas managed together.
 *
 * The brief said "keep Multi-parking green" without giving a sixth hex, so it
 * takes parking's. If production turns out to use a distinct green, this is
 * the one line to change.
 */
const MULTI = PARK;

export const RULE_TYPES: Record<
  RuleType,
  { label: string; description: string; color: string; icon: LucideIcon }
> = {
  cap: {
    label: "Cap",
    description: "Maximum fleet size on the public right-of-way, citywide or in an area.",
    color: FLEET,
    icon: RegulationCap,
  },
  cap_and_floor: {
    label: "Cap and floor",
    description: "Minimum and maximum fleet size, citywide or in an area.",
    color: FLEET,
    icon: RegulationCapAndFloor,
  },
  fees_subsidies: {
    label: "Fees and subsidies",
    description: "Subsidise the fees of trips that start in an area.",
    color: FLEET,
    icon: RegulationFees,
  },
  floor: {
    label: "Floor",
    description: "Minimum fleet size on the public right-of-way, citywide or in an area.",
    color: FLEET,
    icon: RegulationFloor,
  },
  low_speed: {
    label: "Low speed",
    description: "Riding is allowed, but the speed limit is lowered automatically.",
    color: SLOW,
    icon: RegulationLowSpeed,
  },
  max_parked: {
    label: "Max parked",
    description: "How long, or how many, vehicles may stay parked or unavailable.",
    color: PARK,
    icon: RegulationMaxParked,
  },
  max_unavailable: {
    label: "Max unavailable",
    description: "Maximum share of a fleet that may be broken or in maintenance.",
    color: FLEET,
    icon: RegulationMaxUnavailable,
  },
  no_go: {
    label: "No go",
    description: "Riding is not allowed, around the clock or at set times.",
    color: NO_GO,
    icon: RegulationNoGo,
  },
  no_parking: {
    label: "No parking",
    description: "Ending a trip here is not allowed, always or at set times.",
    color: NO_PARK,
    icon: RegulationNoParking,
  },
  parking: {
    label: "Parking",
    description: "Ending a trip here is allowed; the area is meant for parking.",
    color: PARK,
    icon: RegulationParking,
  },
  operator_no_deployment: {
    label: "No deployment",
    description: "Operators may not deploy vehicles here.",
    color: FLEET,
    icon: RegulationNoDeployment,
  },
  multi_parking: {
    label: "Multi-parking",
    description: "A set of parking and no-parking areas managed together.",
    color: MULTI,
    icon: RegulationMultiParking,
  },
};

/** The order a picker lists the types in. */
export const RULE_TYPE_ORDER: RuleType[] = [
  "cap",
  "cap_and_floor",
  "fees_subsidies",
  "floor",
  "low_speed",
  "max_parked",
  "max_unavailable",
  "no_go",
  "no_parking",
  "parking",
  "operator_no_deployment",
  "multi_parking",
];

/** A rule type's colour as a literal hex, for a map layer to paint with. */
export function ruleTypeColor(type: RuleType): string {
  return RULE_TYPES[type].color;
}

/*
 * The glyph fills about two thirds of the badge, as production's does: at
 * half, which is where this started, a 16px badge was mostly colour with a
 * speck in it. `stroke` is in viewBox units and shrinks with the glyph, so it
 * is tuned per size to land on roughly the same rendered line -- 1.15, 1.5 and
 * 1.75px -- rather than thinning to a hairline at 16px.
 *
 * `top` centres the glyph on the shoulders (40% of the box), not the box: the
 * point holds no area, so the box's true centre would sit the glyph low.
 */
const SIZES = {
  sm: { box: 16, glyph: 11, stroke: 2.5, top: 0.9 },
  md: { box: 24, glyph: 16, stroke: 2.25, top: 1.6 },
  lg: { box: 32, glyph: 21, stroke: 2, top: 2.3 },
} as const;

/** The dark ink, when white would not read. Matches category-style's own. */
const INK_DARK = "#111827";
const INK_LIGHT = "#ffffff";
/** WCAG 1.4.11, a graphic. The same bar as category-style's MIN_LOGO_CONTRAST. */
const MIN_GLYPH_CONTRAST = 3;

/**
 * The glyph's ink for a given fill, measured rather than assumed.
 *
 * This used to be `text-white`, unconditionally, and that was defensible while
 * the fills came from CATEGORY_PALETTE: white cleared 3:1 on all six, the
 * tightest being green at 3.01:1. Production's palette is lighter and white
 * does not survive it -- measured against these exact values:
 *
 *   purple  #9254DE   white 4.62:1   PASS
 *   red     #F5222D   white 4.08:1   PASS
 *   teal    #13A8A8   white 2.92:1   fails
 *   green   #73D13D   white 1.92:1   fails
 *   amber   #FAAD14   white 1.90:1   fails
 *
 * Four of six below the bar, and the green one at 1.92:1 is a glyph you
 * genuinely cannot make out at 16px. So the ink is chosen per fill, the way
 * adviseLogo already picks between the same two inks for a logo on a badge.
 * With #111827 on the three that fail, the worst badge in the set is 4.08:1.
 *
 * Keeping the fills exactly as production has them is the point of the change;
 * the ink is what gives way.
 */
function glyphInk(color: string): string {
  const rgb = parseHex(color);
  // A fill we cannot read is left to white, which is what it was before.
  if (!rgb) return INK_LIGHT;
  const behind = luminance(rgb);
  const onLight = contrastBetween(luminance(parseHex(INK_LIGHT)!), behind);
  return onLight >= MIN_GLYPH_CONTRAST ? INK_LIGHT : INK_DARK;
}

/**
 * A rule type as a small shield: the type's map colour, with its glyph in the
 * ink that reads on it.
 *
 * A shield and not a disc so a rule never reads as a category badge, which is
 * a disc in the same palette; the two sit side by side in the map workspace.
 *
 * The fill never changes with the theme -- it is the map's colour, not the
 * UI's -- so the ink does not either; it is fixed per fill by `glyphInk`.
 * The stroke never renders under ~1.15px (see SIZES) because a thinner line
 * is antialiased into the fill and loses it.
 *
 * The glyphs are the DS's own custom regulation type icons
 * (`regulation-type-icons`), shown on the Foundations page.
 *
 * Decorative unless given a `label`. Most uses sit next to the type's name,
 * and repeating it would only make a screen reader say it twice.
 */
export function RuleTypeIcon({
  type,
  size = "md",
  label,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  type: RuleType;
  /** 16, 24 or 32px. */
  size?: "sm" | "md" | "lg";
  /** Names the icon for assistive tech. Without one it is hidden from it. */
  label?: string;
}) {
  const { color, icon: Glyph } = RULE_TYPES[type];
  const s = SIZES[size];

  return (
    <span
      data-slot="rule-type-icon"
      data-type={type}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: s.box, height: s.box, ...style }}
      {...props}
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-full" aria-hidden>
        {/* A banner with a pointed foot, as production's badge is: square
            shoulders give the glyph room, and the point makes the silhouette
            its own at 16px. Full width of the box, so the badge does not read
            smaller than a 24px icon beside it. */}
        <path
          d="M4.5 1h15A2.5 2.5 0 0 1 22 3.5v12.2a1.5 1.5 0 0 1-.68 1.26l-8.5 5.6a1.5 1.5 0 0 1-1.64 0l-8.5-5.6A1.5 1.5 0 0 1 2 15.7V3.5A2.5 2.5 0 0 1 4.5 1Z"
          fill={color}
        />
      </svg>
      {/* A literal ink rather than a token on purpose -- see glyphInk. */}
      <Glyph
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: s.top,
          width: s.glyph,
          height: s.glyph,
          color: glyphInk(color),
        }}
        strokeWidth={s.stroke}
      />
    </span>
  );
}
