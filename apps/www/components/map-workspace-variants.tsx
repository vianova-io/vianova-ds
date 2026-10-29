"use client";

import * as React from "react";

import { MapWorkspace } from "@/registry/vianova/blocks/map-workspace";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The map workspace with its size control switchable, on the docs page.
 *
 * The proposal lives here rather than only at a URL nobody is told about:
 * whoever is deciding between these two arrives at Workspaces > Map
 * workspace, and a comparison they cannot find decides nothing.
 *
 * The full-screen harness at /mockups/map-size/ still exists and is still
 * the right tool for the width question -- the panel is a docked column from
 * lg up and a bottom tray below it, and that resolves against the viewport,
 * which a page this wide cannot show. This is the quick look; that is the
 * measured one.
 *
 * TEMPORARY, with the `sizeControl` prop it drives. When one control is
 * chosen the other goes, and this file goes with it.
 */
const VARIANTS = [
  {
    id: "shipped",
    label: "Prod",
    note: "One row in the card. It multiplies whatever the layer already draws, so 1 is the map as it ships and the flows stay graduated by volume. Absent on a grid or a heatmap, which paint nothing it can set.",
  },
  {
    id: "panel",
    label: "UX ideation",
    note: "Size as its own step beside Colorize: Single and By value, a field to size by, a classification, and a preview of the scale drawn at the size it will draw.",
  },
] as const;

type Variant = (typeof VARIANTS)[number]["id"];

export function MapWorkspaceVariants() {
  const [variant, setVariant] = React.useState<Variant>("shipped");
  const active = VARIANTS.find((v) => v.id === variant)!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Size control
        </span>
        <div
          role="radiogroup"
          aria-label="Size control"
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
        <a
          href="mockups/map-size/"
          className="text-primary text-sm underline underline-offset-4"
        >
          Compare at four widths
        </a>
      </div>

      <p className="text-muted-foreground max-w-3xl text-sm">
        <span className="text-foreground font-medium">{active.label}:</span>{" "}
        {active.note}
      </p>

      {/* Remounted per variant: a reused tree keeps the previous control's
          slider position, its open panels and the map camera, which reads as
          the new control having inherited them. */}
      <MapWorkspace key={variant} sizeControl={variant} />
    </div>
  );
}
