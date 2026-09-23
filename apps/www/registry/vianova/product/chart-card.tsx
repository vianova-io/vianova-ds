import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Container for a single chart or metric inside a panel.
 *
 * Sits on `background/40` rather than `card`, because it is nested inside an
 * already-translucent floating panel — a solid surface there reads as a second
 * card stacked on the first.
 */
function ChartCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chart-card"
      className={cn(
        "space-y-2 rounded-lg border border-border bg-background/40 p-3",
        className,
      )}
      {...props}
    />
  );
}

function ChartCardHeader({
  title,
  icon,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  icon?: React.ReactNode;
  /** Defaults to an overflow button; pass null to render no action. */
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="chart-card-header"
      className={cn("flex items-start justify-between gap-2", className)}
      {...props}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {title}
      </span>
      {action === undefined ? (
        <Button variant="ghost" size="icon-xs" aria-label="Chart options">
          <MoreHorizontal />
        </Button>
      ) : (
        action
      )}
    </div>
  );
}

/** A single headline number, e.g. "32 908 Vehicles". */
function ChartCardMetric({
  value,
  unit,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: React.ReactNode; unit?: React.ReactNode }) {
  return (
    <div data-slot="chart-card-metric" className={className} {...props}>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {unit ? <p className="text-xs text-muted-foreground">{unit}</p> : null}
    </div>
  );
}

export { ChartCard, ChartCardHeader, ChartCardMetric };
