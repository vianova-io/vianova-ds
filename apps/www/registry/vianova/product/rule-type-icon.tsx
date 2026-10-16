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

import { CATEGORY_PALETTE } from "@/registry/vianova/lib/category-style";
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
 * Rule colours are map layer colours, so they come from the categorical
 * palette rather than from the theme: the zone a rule draws on the map and the
 * icon that names it in a list have to be the same colour, and the map cannot
 * read a CSS variable.
 *
 * Grouped by what a rule does to a vehicle, not one colour per type. Twelve
 * types would exhaust an eight-stop palette and the pairs it reused would be
 * arbitrary; grouping makes the reuse mean something. Every rule about how
 * many vehicles there are, or what they cost, is the same purple, because on
 * the map they are all "an area with a fleet condition", and the glyph is what
 * tells them apart.
 *
 * The teal first stop is skipped on purpose: it is the product primary, and a
 * rule drawn in it would read as selected or as UI chrome.
 */
const FLEET = CATEGORY_PALETTE[4]; // purple
const PARK = CATEGORY_PALETTE[5]; // green
const NO_PARK = CATEGORY_PALETTE[2]; // amber
const NO_GO = CATEGORY_PALETTE[6]; // red
const SLOW = CATEGORY_PALETTE[7]; // cyan
const MULTI = CATEGORY_PALETTE[1]; // blue

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

/**
 * A rule type as a small shield: the type's map colour, with its glyph in white.
 *
 * A shield and not a disc so a rule never reads as a category badge, which is
 * a disc in the same palette; the two sit side by side in the map workspace.
 *
 * The glyph is always white because the fill never changes with the theme --
 * it is the map's colour, not the UI's. White clears 3:1 (WCAG 1.4.11, a
 * graphic) on every colour used here; the tightest is green at 3.01:1. That
 * margin is why the stroke never renders under ~1.15px (see SIZES): a thinner
 * line is antialiased into the fill and loses it.
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
      {/* text-white rather than a token on purpose -- see above. */}
      <Glyph
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 text-white"
        style={{ top: s.top, width: s.glyph, height: s.glyph }}
        strokeWidth={s.stroke}
      />
    </span>
  );
}
