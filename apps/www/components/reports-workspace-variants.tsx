"use client";

import * as React from "react";

import {
  ReportsWorkspace,
  type FilterDisplay,
} from "@/registry/vianova/blocks/reports-workspace";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The reports workspace with the way its charts show their filters
 * switchable, on the docs page, as the map workspace's size control is.
 *
 * Not remounted per variant, unlike the map's: an open report and the filters
 * added to it carry over, so the two read side by side on the same charts.
 *
 * TEMPORARY, with the `filterDisplay` prop it drives. When one is chosen the
 * other goes, and this file goes with it.
 */
const VARIANTS: Array<{ id: FilterDisplay; label: string; note: string }> = [
  {
    id: "count",
    label: "Prod",
    note: "A filter icon and a count beside the dataset, on charts filtered beyond the report. The list opens on click, or in a bottom tray on a phone.",
  },
  {
    id: "labels",
    label: "UX ideation",
    note: "The filters only that chart is under, as labels under its header: “Type: Sidewalk parking +1”. One line; what does not fit folds into a “+2” that opens the full list. Open Parking compliance to see them.",
  },
];

export function ReportsWorkspaceVariants() {
  const [variant, setVariant] = React.useState<FilterDisplay>("count");
  const active = VARIANTS.find((v) => v.id === variant)!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Chart filters
        </span>
        <div
          role="radiogroup"
          aria-label="Chart filters"
          className="border-border bg-card flex items-center gap-1 rounded-lg border p-1"
        >
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={variant === v.id}
              onClick={() => setVariant(v.id)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                variant === v.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground max-w-3xl text-sm">
        <span className="text-foreground font-medium">{active.label}:</span>{" "}
        {active.note}
      </p>

      <ReportsWorkspace filterDisplay={variant} />
    </div>
  );
}
