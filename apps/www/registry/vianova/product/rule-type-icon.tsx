import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronsDown,
  Euro,
  FoldVertical,
  Layers,
  PackageX,
  SquareParking,
  SquareParkingOff,
  Timer,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

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
    icon: ArrowUpToLine,
  },
  cap_and_floor: {
    label: "Cap and floor",
    description: "Minimum and maximum fleet size, citywide or in an area.",
    color: FLEET,
    icon: FoldVertical,
  },
  fees_subsidies: {
    label: "Fees and subsidies",
    description: "Subsidise the fees of trips that start in an area.",
    color: FLEET,
    icon: Euro,
  },
  floor: {
    label: "Floor",
    description: "Minimum fleet size on the public right-of-way, citywide or in an area.",
    color: FLEET,
    icon: ArrowDownToLine,
  },
  low_speed: {
    label: "Low speed",
    description: "Riding is allowed, but the speed limit is lowered automatically.",
    color: SLOW,
    icon: ChevronsDown,
  },
  max_parked: {
    label: "Max parked",
    description: "How long, or how many, vehicles may stay parked or unavailable.",
    color: PARK,
    icon: Timer,
  },
  max_unavailable: {
    label: "Max unavailable",
    description: "Maximum share of a fleet that may be broken or in maintenance.",
    color: FLEET,
    icon: Wrench,
  },
  no_go: {
    label: "No go",
    description: "Riding is not allowed, around the clock or at set times.",
    color: NO_GO,
    icon: X,
  },
  no_parking: {
    label: "No parking",
    description: "Ending a trip here is not allowed, always or at set times.",
    color: NO_PARK,
    icon: SquareParkingOff,
  },
  parking: {
    label: "Parking",
    description: "Ending a trip here is allowed; the area is meant for parking.",
    color: PARK,
    icon: SquareParking,
  },
  operator_no_deployment: {
    label: "No deployment",
    description: "Operators may not deploy vehicles here.",
    color: FLEET,
    icon: PackageX,
  },
  multi_parking: {
    label: "Multi-parking",
    description: "A set of parking and no-parking areas managed together.",
    color: MULTI,
    icon: Layers,
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

const SIZES = {
  sm: { box: 16, glyph: 9, stroke: 3 },
  md: { box: 24, glyph: 13, stroke: 2.75 },
  lg: { box: 32, glyph: 17, stroke: 2.5 },
} as const;

/**
 * A rule type as a small shield: the type's map colour, with its glyph in white.
 *
 * A shield and not a disc so a rule never reads as a category badge, which is
 * a disc in the same palette; the two sit side by side in the map workspace.
 *
 * The glyph is always white because the fill never changes with the theme --
 * it is the map's colour, not the UI's. White clears 3:1 (WCAG 1.4.11, a
 * graphic) on every colour used here; the tightest is green at 3.01:1. The
 * stroke is thickened at the small sizes because a 1.5px line at 9px is
 * antialiased into the fill and loses that margin.
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
        {/* A banner with a pointed foot: square shoulders, so the glyph has
            room, and a point that makes the silhouette its own at 16px. */}
        <path
          d="M5 1.5h14a2.5 2.5 0 0 1 2.5 2.5v11.6a1.5 1.5 0 0 1-.66 1.24l-8 5.4a1.5 1.5 0 0 1-1.68 0l-8-5.4a1.5 1.5 0 0 1-.66-1.24V4a2.5 2.5 0 0 1 2.5-2.5Z"
          fill={color}
        />
      </svg>
      {/* Centred on the shield's shoulders rather than its full height: the
          point holds no area, so the box's true centre would sit the glyph
          visibly low. text-white rather than a token on purpose -- see above. */}
      <span className="absolute inset-x-0 top-[8%] flex h-[64%] items-center justify-center text-white">
        <Glyph aria-hidden style={{ width: s.glyph, height: s.glyph }} strokeWidth={s.stroke} />
      </span>
    </span>
  );
}
