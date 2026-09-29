import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

export type LegendCategory = {
  label: string;
  /** Any CSS colour. Usually the colour the layer paints this category on the map. */
  color: string;
};

/**
 * Legend for a layer coloured by a category rather than by magnitude.
 *
 * Takes its colours as props, unlike LegendRamp which reads --map-ramp-*. A
 * ramp describes a scale the theme owns, so it can follow the active map
 * scheme; a category list describes values in someone's data — accident
 * severity, vehicle class, operator — which the theme cannot know about and
 * the user reassigns in the colorize panel. Hard-coding tokens here would mean
 * the legend and the map disagreed the moment either changed.
 *
 * Every swatch is paired with its label, so identity never rests on colour
 * alone and the list stays readable in monochrome or forced-colours mode.
 */
export function LegendCategorical({
  items,
  columns = 2,
  className,
  ...props
}: React.ComponentProps<"ul"> & {
  items: LegendCategory[];
  /** Categories are short; two columns keep a four-value legend to two lines. */
  columns?: 1 | 2;
}) {
  return (
    <ul
      data-slot="legend-categorical"
      className={cn(
        "grid gap-x-3 gap-y-1",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        // Category names come from someone's data and are routinely longer
        // than the panel. The title keeps the whole value reachable; the text
        // node is complete either way, so assistive tech reads it in full.
        <li
          key={item.label}
          title={item.label}
          className="flex min-w-0 items-center gap-1.5"
        >
          <span
            aria-hidden
            // shrink-0 so a long label never squeezes the swatch into an
            // ellipse, which reads as a different symbol rather than a
            // narrower one.
            className="size-2 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          <span className="truncate text-[11px] text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
