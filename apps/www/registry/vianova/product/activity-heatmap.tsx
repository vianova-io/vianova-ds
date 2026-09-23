import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Day x hour activity grid, coloured from the map ramp.
 *
 * Takes normalised 0-1 values and quantises to the ramp's ten-step stops, so
 * the caller never has to know the token names — and the grid re-colours with
 * the active map scheme for free.
 */
export function ActivityHeatmap({
  rows,
  values,
  columns,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** Row labels, e.g. weekdays. */
  rows: string[];
  /** values[row][col], each 0-1. */
  values: number[][];
  /** Optional column labels, e.g. hours. */
  columns?: string[];
}) {
  const stopFor = (v: number) =>
    Math.min(100, Math.max(0, Math.round((v * 100) / 10) * 10));

  return (
    <div data-slot="activity-heatmap" className={cn("space-y-1", className)} {...props}>
      {rows.map((row, r) => (
        <div key={row} className="flex items-center gap-2">
          <span className="w-14 shrink-0 truncate text-[10px] text-muted-foreground">
            {row}
          </span>
          <div className="flex flex-1 gap-px">
            {(values[r] ?? []).map((v, c) => (
              <div
                key={c}
                title={`${row}${columns?.[c] ? ` ${columns[c]}` : ""}`}
                className="h-3.5 flex-1 rounded-[1px]"
                style={{ background: `var(--map-ramp-${stopFor(v)})` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
