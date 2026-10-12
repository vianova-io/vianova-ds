"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * The surface every chart tooltip in the system is drawn on.
 *
 * One component rather than three near-identical boxes, because the charts
 * here are not all drawn by the same thing -- the Sankey is Recharts, the
 * heatmap and the ranked bars are DOM -- and the tooltip is the one piece a
 * reader compares directly across them. The renderer can differ; the surface
 * should not.
 */
function ChartTooltipSurface({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chart-tooltip"
      className={cn(
        "pointer-events-none grid min-w-[8rem] gap-1 rounded-lg border border-border",
        "bg-popover px-2.5 py-1.5 text-xs shadow-md",
        className,
      )}
      {...props}
    />
  );
}

/** The label line: what the reader is pointing at. */
function ChartTooltipTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-medium text-popover-foreground", className)}
      {...props}
    />
  );
}

/** The value line, with the number carrying the emphasis rather than the unit. */
function ChartTooltipValue({
  value,
  unit,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: React.ReactNode;
  unit?: React.ReactNode;
}) {
  return (
    <div className={cn("text-muted-foreground", className)} {...props}>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
      {unit ? ` ${unit}` : null}
    </div>
  );
}

/**
 * A tooltip positioned against a point inside its own chart.
 *
 * `x`/`y` are relative to the nearest positioned ancestor, so the chart owns a
 * `relative` wrapper and passes the anchor point in its own coordinates. That
 * keeps the whole thing inside the chart's box: no portal, no document-level
 * listener, and nothing to tear down when the panel it lives in unmounts.
 *
 * It is deliberately NOT one Tooltip component per mark. The activity heatmap
 * is 168 cells; 168 triggers, 168 portals and 168 positioners to show one box
 * at a time is a lot of machinery to pay for on every render of a panel.
 *
 * `clamp` keeps it from hanging off the left or right edge, which matters most
 * at the ends of a row -- the first and last cells are exactly where a reader
 * checks the boundary of a pattern.
 */
function ChartTooltipAnchor({
  x,
  y,
  width,
  children,
}: {
  /** Anchor point, in the positioned ancestor's coordinates. */
  x: number;
  y: number;
  /** Width of that ancestor, used to keep the box inside it. */
  width: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [offset, setOffset] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !width) return setOffset(0);
    const half = el.offsetWidth / 2;
    const left = x - half;
    const right = x + half;
    if (left < 0) setOffset(-left);
    else if (right > width) setOffset(width - right);
    else setOffset(0);
  }, [x, y, width, children]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute z-20"
      style={{
        left: x + offset,
        top: y,
        // Sits above the point and centred on it; the anchor is the mark, so
        // the box must not cover the thing being described.
        transform: "translate(-50%, -100%)",
      }}
    >
      {children}
    </div>
  );
}

export {
  ChartTooltipAnchor,
  ChartTooltipSurface,
  ChartTooltipTitle,
  ChartTooltipValue,
};
