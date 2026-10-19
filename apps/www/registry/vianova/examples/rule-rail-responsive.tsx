"use client";

import * as React from "react";

import { RuleRail, type RuleRailItem } from "@/registry/vianova/product/rule-rail";

const ITEMS: RuleRailItem[] = [
  { id: "parking-bays", type: "parking", label: "Parking bays" },
  { id: "no-parking", type: "no_parking", label: "No parking around schools" },
  { id: "parking-2", type: "parking", label: "Parking 2" },
];

/**
 * A strip of chips below lg, the usual column from lg up. Narrow the window to
 * see it switch; the ⋯ menus belong to the host below lg, so none show here.
 */
export default function RuleRailResponsive() {
  const [value, setValue] = React.useState("parking-bays");

  return (
    <div className="flex w-full max-w-md flex-col gap-3 lg:h-[420px] lg:flex-row lg:items-stretch">
      <RuleRail
        orientation="responsive"
        aria-label="Multi-parking rules"
        items={ITEMS}
        value={value}
        onValueChange={setValue}
        addableTypes={["parking", "no_parking"]}
        onAdd={() => {}}
      />
      <p className="text-sm text-muted-foreground lg:self-center">
        Selected: <code className="text-foreground">{value}</code>
      </p>
    </div>
  );
}
