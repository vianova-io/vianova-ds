"use client";

import * as React from "react";

import {
  ChartTooltipAnchor,
  ChartTooltipSurface,
  ChartTooltipTitle,
  ChartTooltipValue,
} from "@/registry/vianova/product/chart-tooltip";
import { Progress } from "@/registry/vianova/ui/progress";
import { cn } from "@/registry/vianova/lib/utils";

export type RankedBarItem = {
  label: string;
  /** 0-100. Drives the bar width. */
  percent: number;
  /** Raw count shown alongside the percentage. */
  count?: string | number;
  /**
   * A mark for the thing the row counts -- an operator's badge, a category's
   * colour -- shown before the label.
   *
   * Decorative: the label beside it says the same thing in words, so the
   * caller passes something already `aria-hidden`, as CategoryBadge is. It
   * never replaces the label, because a reader matching a chart to a map
   * legend needs the name as well as the mark.
   */
  icon?: React.ReactNode;
};

/**
 * Ranked horizontal bars — "top N segments", "busiest zones".
 *
 * Rank, label and value are laid out as fixed / fluid / fixed so long labels
 * truncate instead of pushing the value out of the panel.
 *
 * ## What the tooltip is for
 *
 * Not the numbers: the percentage and the count are already printed on the
 * row, and repeating them on hover would be decoration. It is for the LABEL,
 * which is the one thing this layout deliberately destroys -- the fluid middle
 * column truncates, and in a 340px panel "Boulevard Saint-Germain (eastbound,
 * 07:00-10:00)" becomes "Boulevard Sain...". The row knows its own full text
 * and the reader cannot get at it.
 *
 * So the tooltip shows the whole label, with the figures under it for context,
 * and only when the label is ACTUALLY clipped -- offering to reveal something
 * already fully visible trains people to ignore it.
 *
 * `title` carries the same text for anyone not using a mouse. The rows are not
 * focusable: each already contains a named progressbar that a screen reader
 * announces with its label and value, so the information is reachable without
 * adding a tab stop per row.
 */
export function RankedBars({
  items,
  showRank = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  items: RankedBarItem[];
  showRank?: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const hovered = hover === null ? null : items[hover.index];

  return (
    <div
      data-slot="ranked-bars"
      ref={hostRef}
      className={cn("relative space-y-2.5", className)}
      onPointerLeave={() => setHover(null)}
      onPointerMove={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-row]",
        );
        const host = hostRef.current;
        if (!row || !host) return setHover(null);
        const labelEl = row.querySelector<HTMLElement>("[data-row-label]");
        // Only when the text is actually cut off.
        if (!labelEl || labelEl.scrollWidth <= labelEl.clientWidth + 1) {
          return setHover(null);
        }
        const rowBox = row.getBoundingClientRect();
        const hostBox = host.getBoundingClientRect();
        setHover({
          index: Number(row.dataset.row),
          x: rowBox.left - hostBox.left + rowBox.width / 2,
          y: rowBox.top - hostBox.top - 4,
        });
      }}
      {...props}
    >
      {items.map((item, i) => (
        <div key={item.label} data-row={i} className="flex items-center gap-2">
          {showRank ? (
            <span className="w-3 shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {i + 1}
            </span>
          ) : null}
          {/* Centred on the row, not on the label line: the row is two lines
              tall and a badge pinned to the first one reads as floating above
              its own bar. */}
          {item.icon ? (
            <span className="flex shrink-0 items-center">{item.icon}</span>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <p data-row-label title={item.label} className="truncate text-xs">
              {item.label}
            </p>
            {/* Named explicitly: a progressbar with no accessible name is
                announced as just "progress bar" with a number. */}
            <Progress value={item.percent} aria-label={item.label} />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {item.percent}%{item.count !== undefined ? ` (${item.count})` : ""}
          </span>
        </div>
      ))}

      {hover && hovered ? (
        <ChartTooltipAnchor x={hover.x} y={hover.y} width={width}>
          <ChartTooltipSurface className="max-w-[16rem]">
            <ChartTooltipTitle className="whitespace-normal">
              {hovered.label}
            </ChartTooltipTitle>
            <ChartTooltipValue
              value={`${hovered.percent}%`}
              unit={
                hovered.count !== undefined ? `(${hovered.count})` : undefined
              }
            />
          </ChartTooltipSurface>
        </ChartTooltipAnchor>
      ) : null}
    </div>
  );
}
