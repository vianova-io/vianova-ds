import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

export type StatTileTrend = "up" | "down" | "flat";

/**
 * A single headline number with an optional period-over-period delta.
 *
 * Direction and sentiment are separate inputs. In a mobility product a rise is
 * not automatically good -- congestion, dwell time and emissions all go the
 * wrong way when they go up -- so `intent` decides the colour and `trend` only
 * decides the arrow. Tying colour to the sign is the usual bug here.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  trend,
  intent = "auto",
  hint,
  icon,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Rendered verbatim, e.g. "+12.4%" or "-1.2k". */
  delta?: React.ReactNode;
  trend?: StatTileTrend;
  /** `auto` reads up as positive; set explicitly when up is bad. */
  intent?: "auto" | "positive" | "negative" | "neutral";
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const resolved =
    intent !== "auto"
      ? intent
      : trend === "up"
        ? "positive"
        : trend === "down"
          ? "negative"
          : "neutral";

  const Arrow = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;

  return (
    <div
      data-slot="stat-tile"
      className={cn("bg-card rounded-lg border p-4", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-sm font-medium">{label}</span>
        {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
      </div>

      {delta || hint ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta ? (
            <span
              data-trend={trend ?? "flat"}
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                resolved === "positive" && "text-success",
                resolved === "negative" && "text-destructive",
                resolved === "neutral" && "text-muted-foreground",
              )}
            >
              {trend ? <Arrow aria-hidden className="size-3.5" /> : null}
              {delta}
            </span>
          ) : null}
          {hint ? <span className="text-muted-foreground truncate">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
