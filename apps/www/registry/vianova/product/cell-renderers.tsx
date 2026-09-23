import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/registry/vianova/ui/badge";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Presentational cells for DataGrid.
 *
 * Deliberately plain components rather than TanStack cell functions, so they
 * can be used in a card or a definition list too, and so nothing here depends
 * on the table library.
 *
 * Everything numeric is `tabular-nums` and right-aligned. In a column of
 * figures, proportional digits make the ones column ragged and the eye can no
 * longer compare magnitudes down the column, which is the entire reason the
 * numbers are in a table.
 */

const LOCALE = "en-GB";

export function NumberCell({
  value,
  unit,
  maximumFractionDigits = 0,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  value: number | null | undefined;
  unit?: string;
  maximumFractionDigits?: number;
}) {
  if (value === null || value === undefined) return <EmptyCell />;
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {value.toLocaleString(LOCALE, { maximumFractionDigits })}
      {unit ? <span className="text-muted-foreground ml-1 text-xs">{unit}</span> : null}
    </span>
  );
}

/**
 * A period-over-period change.
 *
 * Colour follows `intent`, not the sign: in a mobility product congestion,
 * dwell time and emissions all get worse as they rise, so a green "+8%" would
 * be actively misleading.
 */
export function DeltaCell({
  value,
  intent = "auto",
  maximumFractionDigits = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  /** A ratio, e.g. 0.124 for +12.4%. */
  value: number | null | undefined;
  intent?: "auto" | "positive" | "negative" | "neutral";
  maximumFractionDigits?: number;
}) {
  if (value === null || value === undefined) return <EmptyCell />;

  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const resolved =
    intent !== "auto"
      ? intent
      : direction === "up"
        ? "positive"
        : direction === "down"
          ? "negative"
          : "neutral";

  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <span
      data-direction={direction}
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        resolved === "positive" && "text-success",
        resolved === "negative" && "text-destructive",
        resolved === "neutral" && "text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-3.5" />
      {/* The sign is carried by the arrow, so only the magnitude is printed. */}
      {Math.abs(value).toLocaleString(LOCALE, { style: "percent", maximumFractionDigits })}
    </span>
  );
}

/**
 * A value drawn as a proportion of the column's maximum.
 *
 * The number stays visible next to the bar. A bar alone encodes the value only
 * in length, which is unreadable to a screen reader and imprecise to everyone
 * else.
 */
export function BarCell({
  value,
  max,
  unit,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: number | null | undefined;
  max: number;
  unit?: string;
}) {
  if (value === null || value === undefined) return <EmptyCell />;
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div aria-hidden className="bg-muted h-1.5 w-full min-w-8 flex-1 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${ratio * 100}%` }} />
      </div>
      <NumberCell value={value} unit={unit} className="shrink-0 text-xs" />
    </div>
  );
}

export function BadgeCell({
  value,
  variant = "secondary",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "children"> & {
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return <EmptyCell />;
  return (
    <Badge variant={variant} className={cn("font-normal", className)} {...props}>
      {value}
    </Badge>
  );
}

export function DateCell({
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "children" | "dateTime"> & {
  value: Date | string | null | undefined;
}) {
  if (!value) return <EmptyCell />;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return <EmptyCell />;

  // Formatted explicitly rather than via toLocaleDateString: the runtime
  // default locale differs between the server and the browser, which React
  // reports as a hydration mismatch.
  const iso = date.toISOString();
  const [y, m, d] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10)];

  return (
    <time dateTime={iso} className={cn("tabular-nums", className)} {...props}>
      {`${d}/${m}/${y}`}
    </time>
  );
}

/** One consistent marker for "no value", so blank cells never read as a bug. */
export function EmptyCell({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("text-muted-foreground", className)} {...props}>
      <span aria-hidden>—</span>
      <span className="sr-only">No value</span>
    </span>
  );
}
