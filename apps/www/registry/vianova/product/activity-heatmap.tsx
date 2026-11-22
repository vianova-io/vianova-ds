"use client";

import * as React from "react";

import {
  ChartTooltipAnchor,
  ChartTooltipSurface,
  ChartTooltipTitle,
  ChartTooltipValue,
} from "@/registry/vianova/product/chart-tooltip";
import { cn } from "@/registry/vianova/lib/utils";

export type ActivityHeatmapCell = {
  row: string;
  column?: string;
  rowIndex: number;
  columnIndex: number;
  /** The normalised 0-1 value the colour came from. */
  value: number;
  /** The matching entry from `counts`, when one was given. */
  count?: number;
};

/**
 * Day x hour activity grid, coloured from the map ramp.
 *
 * Takes normalised 0-1 values and quantises to the ramp's ten-step stops, so
 * the caller never has to know the token names — and the grid re-colours with
 * the active map scheme for free.
 *
 * ## The tooltip, and what it can honestly say
 *
 * `values` are normalised, which is right for colour and useless as a readout:
 * "0.72" is not a quantity anyone asked about. So the default tooltip says
 * "72% of peak", which is exactly what a normalised value means, rather than
 * dressing it up as a count it is not. Pass `counts` and it reports the real
 * number instead.
 *
 * One delegated listener on the grid, not a tooltip component per cell. A week
 * by hour is 168 cells; 168 triggers and 168 portals to show one box at a time
 * is a great deal of machinery for a panel that may be re-rendering as filters
 * change.
 *
 * `title` stays on every cell and now includes the value, which it did not
 * before -- it read "Tue 08:00" and left out the only thing a reader hovers to
 * find out. It is the fallback for anyone not using a mouse; the cells are
 * deliberately not focusable, because 168 tab stops between a reader and the
 * next control is worse than no keyboard tooltip at all. A table view is the
 * real answer there, and this component does not have one yet.
 */
export function ActivityHeatmap({
  rows,
  values,
  columns,
  counts,
  formatCount = (n) => n.toLocaleString("en-GB"),
  countUnit,
  ramp = "sequential",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** Row labels, e.g. weekdays. */
  rows: string[];
  /** values[row][col], each 0-1. */
  values: number[][];
  /** Optional column labels, e.g. hours. */
  columns?: string[];
  /** Optional raw figures behind `values`, same shape. */
  counts?: number[][];
  formatCount?: (count: number) => string;
  /** e.g. "trips". Only used when `counts` is given. */
  countUnit?: React.ReactNode;
  /**
   * What the colour means, which decides the ramp.
   *
   * `sequential` (the default) reads `values` as 0-1 magnitudes against the
   * active map scheme. Right whenever more colour means more of something.
   *
   * `diverging` reads them as -1 to 1 SIGNED values, where zero is no change.
   * Added for period-over-period comparison, which is the case a sequential
   * ramp gets actively wrong: scaled 0-1, every fall in the grid lands at the
   * pale end next to the genuinely small numbers, so a collapse and a quiet
   * hour look alike. Here the midpoint is the surface itself, so no change is
   * literally nothing, and the two directions are two hues.
   */
  ramp?: "sequential" | "diverging";
}) {
  const stopFor = (v: number) =>
    Math.min(100, Math.max(0, Math.round((v * 100) / 10) * 10));

  /**
   * The DS's own "Brown-Teal" diverging pair (`lib/color-ramp.ts`), flagged
   * colour-blind safe there. Red-Blue is the other one and the more common
   * convention, but red already means `critical` in the status palette, and
   * spending it on an arithmetic sign both misleads here and devalues it
   * there.
   *
   * The midpoint is `var(--card)` rather than the palette's own `#f5f5f5`, so
   * "no change" is the surface the grid sits on and the result is correct in
   * both themes without a second set of values.
   */
  const fillFor = (v: number) => {
    if (ramp !== "diverging") return `var(--map-ramp-${stopFor(v)})`;
    const mix = Math.min(100, Math.round(Math.abs(v) * 100));
    return `color-mix(in oklab, ${v >= 0 ? "#01665e" : "#8c510a"} ${mix}%, var(--card))`;
  };

  const gridRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<
    (ActivityHeatmapCell & { x: number; y: number }) | null
  >(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const describe = (r: number, c: number) => {
    const value = values[r]?.[c] ?? 0;
    const count = counts?.[r]?.[c];
    return {
      row: rows[r] ?? "",
      column: columns?.[c],
      rowIndex: r,
      columnIndex: c,
      value,
      count,
    };
  };

  const label = (cell: ActivityHeatmapCell) =>
    [cell.row, cell.column].filter(Boolean).join(" ");

  const readout = (cell: ActivityHeatmapCell) => {
    if (cell.count !== undefined) return formatCount(cell.count);
    const pct = Math.round(cell.value * 100);
    // A signed ramp needs a signed readout: "28%" on a cell that FELL is a
    // plain misreport, and the sign is the whole point of the view.
    return ramp === "diverging" && pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  const unitFor = (cell: ActivityHeatmapCell) =>
    cell.count !== undefined
      ? countUnit
      : ramp === "diverging"
        ? "of the largest change"
        : "of peak";

  return (
    <div
      data-slot="activity-heatmap"
      className={cn("relative space-y-1", className)}
      ref={gridRef}
      onPointerLeave={() => setHover(null)}
      onPointerMove={(event) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
        const host = gridRef.current;
        if (!cell || !host) return setHover(null);
        const [r, c] = cell.dataset.cell!.split(",").map(Number) as [number, number];
        const cellBox = cell.getBoundingClientRect();
        const hostBox = host.getBoundingClientRect();
        setHover({
          ...describe(r, c),
          // Anchored to the cell, not the pointer: the box then holds still
          // while the pointer moves within one cell, which is what makes it
          // readable in a grid this dense.
          x: cellBox.left - hostBox.left + cellBox.width / 2,
          y: cellBox.top - hostBox.top - 4,
        });
      }}
      {...props}
    >
      {rows.map((row, r) => (
        <div key={row} className="flex items-center gap-2">
          <span className="w-14 shrink-0 truncate text-[10px] text-muted-foreground">
            {row}
          </span>
          <div className="flex flex-1 gap-px">
            {(values[r] ?? []).map((v, c) => {
              const cell = describe(r, c);
              return (
                <div
                  key={c}
                  data-cell={`${r},${c}`}
                  title={`${label(cell)} — ${readout(cell)}${
                    unitFor(cell) ? ` ${unitFor(cell)}` : ""
                  }`}
                  className={cn(
                    "h-3.5 flex-1 rounded-[1px]",
                    hover?.rowIndex === r && hover?.columnIndex === c &&
                      "outline outline-1 outline-offset-1 outline-foreground/40",
                  )}
                  style={{ background: fillFor(v) }}
                />
              );
            })}
          </div>
        </div>
      ))}

      {hover ? (
        <ChartTooltipAnchor x={hover.x} y={hover.y} width={width}>
          <ChartTooltipSurface>
            <ChartTooltipTitle>{label(hover)}</ChartTooltipTitle>
            <ChartTooltipValue value={readout(hover)} unit={unitFor(hover)} />
          </ChartTooltipSurface>
        </ChartTooltipAnchor>
      ) : null}
    </div>
  );
}
