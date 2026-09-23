import * as React from "react";

import { Progress } from "@/registry/vianova/ui/progress";
import { cn } from "@/registry/vianova/lib/utils";

export type RankedBarItem = {
  label: string;
  /** 0-100. Drives the bar width. */
  percent: number;
  /** Raw count shown alongside the percentage. */
  count?: string | number;
};

/**
 * Ranked horizontal bars — "top N segments", "busiest zones".
 *
 * Rank, label and value are laid out as fixed / fluid / fixed so long labels
 * truncate instead of pushing the value out of the panel.
 */
export function RankedBars({
  items,
  showRank = true,
  className,
  ...props
}: React.ComponentProps<"div"> & { items: RankedBarItem[]; showRank?: boolean }) {
  return (
    <div data-slot="ranked-bars" className={cn("space-y-2.5", className)} {...props}>
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          {showRank ? (
            <span className="w-3 shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {i + 1}
            </span>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs">{item.label}</p>
            {/* Named explicitly: a progressbar with no accessible name is
                announced as just "progress bar" with a number. */}
            <Progress value={item.percent} aria-label={item.label} />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {item.percent}%{item.count !== undefined ? ` (${item.count})` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
