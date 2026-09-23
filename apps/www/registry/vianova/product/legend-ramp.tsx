import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Colour-ramp legend for a choropleth or flow layer.
 *
 * Reads --map-ramp-* rather than taking colours as props, so it follows the
 * active map scheme (Brand / Warm / Viridis / Blue) automatically. Those stops
 * are defined at multiples of ten only.
 */
export const RAMP_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export function LegendRamp({
  stops = RAMP_STOPS,
  showTicks = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  stops?: readonly number[];
  showTicks?: boolean;
}) {
  return (
    <div data-slot="legend-ramp" className={cn("space-y-1", className)} {...props}>
      <div className="flex overflow-hidden rounded-sm">
        {stops.map((s) => (
          <div
            key={s}
            className="h-2.5 flex-1"
            style={{ background: `var(--map-ramp-${s})` }}
          />
        ))}
      </div>
      {showTicks ? (
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          {stops.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
