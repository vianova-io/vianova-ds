import * as React from "react";

import { CategoryBadge } from "@/registry/vianova/product/category-badge";
import { cn } from "@/registry/vianova/lib/utils";

export type LegendCategory = {
  label: string;
  /** Any CSS colour. Usually the colour the layer paints this category on the map. */
  color: string;
  /**
   * What this category is drawn as when the map shows logos instead of dots.
   * A category without one stays a dot, as it does on the map.
   */
  logo?: {
    src: string;
    /** The logo has its own background and fills the badge. See CategoryBadge. */
    solid?: boolean;
    /** What the logo sits on, when that is not `color`. */
    background?: string;
  };
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
 * A layer can draw a category as a dot far out and as its logo close in. The
 * legend follows it with `showLogos`: the host knows the zoom and the legend
 * does not, so it is told rather than asked. Turning it on swaps each logo-bearing
 * category's dot for the same badge the map draws, so what is on the map can be
 * matched to what the legend says.
 *
 * Every swatch is paired with its label, so identity never rests on colour
 * alone and the list stays readable in monochrome or forced-colours mode.
 */
export function LegendCategorical({
  items,
  columns = 2,
  showLogos = false,
  className,
  ...props
}: React.ComponentProps<"ul"> & {
  items: LegendCategory[];
  /** Categories are short; two columns keep a four-value legend to two lines. */
  columns?: 1 | 2;
  /** Draw each category that has a logo as its badge rather than a dot. */
  showLogos?: boolean;
}) {
  // A legend where no category has a logo is exactly the plain one it always
  // was. Only when one does is each swatch given a fixed box, wide enough for a
  // badge, so the label does not slide sideways when the swatch changes shape.
  const hasLogos = items.some((item) => item.logo);

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
      {items.map((item) => {
        const badge = showLogos && item.logo;
        const dot = (
          <span
            aria-hidden
            // shrink-0 so a long label never squeezes the swatch into an
            // ellipse, which reads as a different symbol rather than a
            // narrower one.
            className="size-2 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
        );

        return (
          // Category names come from someone's data and are routinely longer
          // than the panel. The title keeps the whole value reachable; the text
          // node is complete either way, so assistive tech reads it in full.
          <li
            key={item.label}
            title={item.label}
            className="flex min-w-0 items-center gap-1.5"
          >
            {hasLogos ? (
              <span className="flex size-5 shrink-0 items-center justify-center">
                {badge ? (
                  <CategoryBadge
                    size={20}
                    color={item.logo!.background ?? item.color}
                    logo={item.logo!.src}
                    logoKind={item.logo!.solid ? "solid" : "transparent"}
                  />
                ) : (
                  dot
                )}
              </span>
            ) : (
              dot
            )}
            <span className="truncate text-[11px] text-muted-foreground">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
