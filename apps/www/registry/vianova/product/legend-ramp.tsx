import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Colour-ramp legend for a choropleth or flow layer.
 *
 * Reads --map-ramp-* rather than taking colours as props, so it follows the
 * active map scheme (Brand / Warm / Viridis / Blue) automatically. Those stops
 * are defined at multiples of ten only.
 *
 * For a layer coloured by a category rather than a magnitude, use
 * LegendCategorical — a ramp implies an order its values do not have.
 */
export const RAMP_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export function LegendRamp({
  stops = RAMP_STOPS,
  colors,
  ticks,
  showTicks = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  stops?: readonly number[];
  /**
   * Explicit colours, one per band, instead of the --map-ramp-* lookup.
   *
   * For a ramp the user has edited: once stops are theirs to drag, the scheme
   * no longer describes what the map is painted with, and a legend still
   * reading the tokens would disagree with the layer beside it. `colors`
   * governs the band count when given, so the caller decides the resolution.
   */
  colors?: readonly string[];
  /**
   * Labels under the ramp. Defaults to the stop positions, which describe the
   * ramp itself; pass the domain the ramp is bound to — "1", "1.1K" … "6.4K" —
   * to describe the data instead. Spaced evenly, so supply a count that
   * divides the width comfortably rather than one label per stop.
   */
  ticks?: readonly React.ReactNode[];
  showTicks?: boolean;
}) {
  const bands = colors?.length
    ? colors.map((color, i) => ({ key: i, background: color }))
    : stops.map((s) => ({ key: s, background: `var(--map-ramp-${s})` }));
  const labels = ticks ?? stops;

  return (
    <div
      data-slot="legend-ramp"
      className={cn("space-y-1", className)}
      {...props}
    >
      <div className="flex overflow-hidden rounded-sm">
        {bands.map((band) => (
          <div
            key={band.key}
            className="h-2.5 flex-1"
            style={{ background: band.background }}
          />
        ))}
      </div>
      {showTicks ? (
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          {labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
