"use client";

import * as React from "react";
import { Check } from "lucide-react";

import {
  BASEMAPS,
  BASEMAP_BY_ID,
  type BasemapId,
} from "@/registry/vianova/lib/basemaps";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Picks the basemap a map is drawn on.
 *
 * ## The previews are drawn, not photographed
 *
 * The obvious build is five little live maps. It is also the wrong one: five
 * WebGL contexts and five tile streams, torn down and rebuilt every time a
 * popover opens, for a control that is shut almost always. Worse for this repo,
 * it would be non-deterministic, and the examples could then never be
 * pixel-pinned -- `map-canvas-default` is already excluded from the visual
 * suite for exactly that reason.
 *
 * So each option draws a 2-line SVG impression of what it is: a street grid, the
 * same grid gone quiet, a photographic wash, contour bands, nothing at all.
 * They cost no network, theme themselves from tokens, and are honest about
 * being a legend rather than a picture of your city.
 *
 * ## Why a radiogroup
 *
 * Five options, exactly one chosen. `role="radio"` inside `role="radiogroup"`
 * gives arrow-key traversal and announces "3 of 5" without any of it being
 * written here. The selected option carries `aria-checked` AND a ring AND a
 * check glyph -- three signals, because colour alone is not one.
 */
export function BasemapSwitcher({
  value,
  onValueChange,
  side = "top",
  align = "end",
  defaultOpen,
  trigger,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "children"> & {
  value: BasemapId;
  onValueChange: (id: BasemapId) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
  /**
   * Replaces the default 56px tile, e.g. with a toolbar-sized icon button.
   * A single element, because Base UI merges its popover props onto it.
   */
  trigger?: React.ReactElement;
}) {
  const current = BASEMAP_BY_ID[value] ?? BASEMAP_BY_ID.muted;
  const labelId = React.useId();
  // Controlled so choosing dismisses. A picker that stays open after you have
  // picked leaves the thing you were comparing hidden behind itself.
  const [open, setOpen] = React.useState(defaultOpen ?? false);

  return (
    <div data-slot="basemap-switcher" className={cn("flex", className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            trigger ?? (
              <button
                type="button"
                // Matches the zoom stack's tile: same size, same surface, same
                // focus treatment, so the two read as one control cluster.
                className="flex size-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card/95 text-[10px] text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            )
          }
          // The bare button this replaces had no accessible name beyond its
          // label text, which said "Satellite" over a map that was not.
          aria-label={`Basemap: ${current.label}`}
        >
          {trigger ? null : (
            <>
              <BasemapPreview id={current.id} className="h-6 w-9 rounded-[3px]" />
              {current.label}
            </>
          )}
        </PopoverTrigger>

        {/* No overflow-hidden anywhere below: a focus ring reaches 3px past its
            box, and clipping it is the bug map-controls.tsx carries a comment
            about. The previews round themselves instead. */}
        <PopoverContent side={side} align={align} className="w-[260px] p-2">
          <PopoverTitle id={labelId} className="px-1 pb-2 text-xs text-muted-foreground">
            Basemap
          </PopoverTitle>
          <div
            data-slot="basemap-options"
            role="radiogroup"
            aria-labelledby={labelId}
            className="grid gap-1"
          >
            {BASEMAPS.map((basemap) => {
              const selected = basemap.id === value;
              return (
                <button
                  key={basemap.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    onValueChange(basemap.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-left transition-colors",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected ? "bg-accent" : "hover:bg-muted",
                  )}
                >
                  <BasemapPreview
                    id={basemap.id}
                    className={cn(
                      "h-9 w-12 shrink-0 rounded-[3px] ring-1 ring-border",
                      selected && "ring-2 ring-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {basemap.label}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {basemap.hint}
                    </span>
                  </span>
                  <Check
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 text-primary",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * A drawn impression of a basemap.
 *
 * Deliberately schematic. A 48x36 photograph of anywhere is unreadable, and a
 * photograph of the WRONG place is worse than a diagram -- it implies the map
 * will look like that, in a product whose maps are of the reader's own city.
 * Token colours throughout, so each one themes itself.
 */
function BasemapPreview({ id, className }: { id: BasemapId; className?: string }) {
  const common = { viewBox: "0 0 48 36", "aria-hidden": true as const, className };

  if (id === "blank") {
    return (
      <svg {...common}>
        <rect width="48" height="36" className="fill-surface-sunken" />
      </svg>
    );
  }

  if (id === "satellite") {
    return (
      <svg {...common}>
        <rect width="48" height="36" fill="#1f3326" />
        <path d="M0 22 L14 15 L26 20 L38 11 L48 16 V36 H0Z" fill="#2f4a33" />
        <path d="M0 30 L16 26 L30 31 L48 27 V36 H0Z" fill="#24402c" />
        <circle cx="34" cy="8" r="6" fill="#3c5a3f" />
        {/* The giveaway that it is a hybrid: roads and a label over the photo. */}
        <path d="M2 26 L22 18 L46 22" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
        <rect x="18" y="8" width="11" height="2" rx="1" fill="#ffffff" fillOpacity="0.75" />
      </svg>
    );
  }

  if (id === "terrain") {
    return (
      <svg {...common}>
        <rect width="48" height="36" className="fill-surface-sunken" />
        {[0.35, 0.28, 0.2, 0.12].map((opacity, i) => (
          <path
            key={i}
            d={`M-2 ${30 - i * 5} Q 12 ${22 - i * 5} 24 ${27 - i * 5} T 50 ${23 - i * 5}`}
            className="stroke-foreground"
            strokeOpacity={opacity}
            strokeWidth="1.1"
            fill="none"
          />
        ))}
        <path d="M4 34 L20 20 L30 26 L44 14" className="stroke-muted-foreground" strokeWidth="1" fill="none" />
      </svg>
    );
  }

  // Plan and Muted share a street grid; Muted simply says it more quietly,
  // which is the whole difference between them.
  const quiet = id === "muted";
  return (
    <svg {...common}>
      <rect width="48" height="36" className="fill-surface-sunken" />
      {!quiet ? <path d="M0 24 L18 24 L18 36 L0 36Z" className="fill-primary" fillOpacity="0.12" /> : null}
      <path
        d="M30 0 L30 36 M0 14 L48 14"
        className="stroke-foreground"
        strokeOpacity={quiet ? 0.18 : 0.34}
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M12 0 L12 36 M0 27 L48 27 M40 0 L40 36"
        className="stroke-foreground"
        strokeOpacity={quiet ? 0.1 : 0.2}
        strokeWidth="1"
        fill="none"
      />
      {!quiet ? (
        <path d="M0 6 Q 16 10 48 4" className="stroke-primary" strokeOpacity="0.5" strokeWidth="1.4" fill="none" />
      ) : null}
    </svg>
  );
}
