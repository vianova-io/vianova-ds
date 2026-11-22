"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/registry/vianova/ui/button";
import { Label } from "@/registry/vianova/ui/label";
import { Separator } from "@/registry/vianova/ui/separator";
import { Switch } from "@/registry/vianova/ui/switch";
import {
  DateRangePicker,
  type DateRangePreset,
} from "@/registry/vianova/patterns/date-range-picker";
import {
  datesFromPeriod,
  periodFromDates,
  periodLength,
  previousPeriod,
  type Period,
} from "@/registry/vianova/lib/compare";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The period a layer is read over, and the period it is read against.
 *
 * A sibling of ColorizePanel and SizePanel, and built to the same shape: an
 * optional header so it can sit either on its own or inside a step whose
 * header already names the layer.
 *
 * It takes a `Period` -- two `YYYY-MM-DD` days -- rather than the calendar's
 * own `DateRange`, because a period is what the data is filtered by and what
 * `lib/compare.ts` reasons about. The conversion happens here, at the edge,
 * once.
 *
 * The comparison period is DERIVED by default and only stored once someone
 * overrides it. "The fortnight before this one" should follow the main range
 * when it moves; a stored copy would silently stop following it, which is the
 * kind of bug nobody notices until a number is wrong in a meeting.
 */
export function DateComparePanel({
  showHeader = true,
  onClose,
  period,
  onPeriodChange,
  comparing = false,
  onComparingChange,
  comparePeriod,
  onComparePeriodChange,
  blockedReason,
  compareEmpty = false,
  presets,
  noun = "rows",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  showHeader?: boolean;
  onClose?: () => void;
  period: Period;
  onPeriodChange?: (period: Period) => void;
  comparing?: boolean;
  onComparingChange?: (comparing: boolean) => void;
  /**
   * The period to compare against. Omit it and the panel shows -- and the
   * caller should use -- the period of the same length immediately before.
   */
  comparePeriod?: Period;
  onComparePeriodChange?: (period: Period | undefined) => void;
  /**
   * Why this layer has no period, from `compareBlockedReason`.
   *
   * Given one, the explanation REPLACES the whole panel body -- the range
   * picker included. A snapshot, a static zone set and a feed whose date
   * column nobody declared are not layers whose comparison is unavailable;
   * they are layers with no period at all, and offering a range picker that
   * cannot filter them would be a control that lies about what it does.
   */
  blockedReason?: string | null;
  /**
   * The comparison period holds no rows.
   *
   * Said out loud rather than left to be inferred from a map of uniform
   * falls. It is the ordinary state when a range reaches back past the start
   * of the data, and without a note every unit reads as having collapsed to
   * zero -- which is true of the arithmetic and false of the world.
   */
  compareEmpty?: boolean;
  presets?: DateRangePreset[];
  /** What the layer's rows are, for the summary line. */
  noun?: string;
}) {
  const derived = React.useMemo(() => previousPeriod(period), [period]);
  const against = comparePeriod ?? derived;
  const overridden = comparePeriod != null;

  const fromRange = (range: DateRange | undefined): Period | null =>
    range?.from && range.to ? periodFromDates(range.from, range.to) : null;

  /**
   * Both pickers are driven straight off the period, with no draft behind
   * them.
   *
   * A layer is always read over some period, so the picker has no empty state
   * to show. The calendar can hand back a range that is not one -- clicking
   * the single day of a one-day range clears the selection -- and a draft
   * holding that state made the trigger read "Pick a date range" while the
   * layer went on filtering by the day before. Swallowing those keeps the
   * label and the data saying the same thing.
   */
  const days = periodLength(period);
  const againstDays = periodLength(against);

  return (
    <div
      data-slot="date-compare-panel"
      className={cn(
        "bg-popover text-popover-foreground w-80 rounded-lg border shadow-md",
        className,
      )}
      {...props}
    >
      {showHeader ? (
        <>
          <header className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold">Date</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Close"
              className="ml-auto"
              onClick={onClose}
            >
              <X />
            </Button>
          </header>
          <Separator />
        </>
      ) : null}

      <div className="space-y-3 p-3">
        {blockedReason ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">No date range</p>
            <p className="text-muted-foreground text-xs leading-snug">
              {blockedReason}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="date-range">Date range</Label>
              <DateRangePicker
                id="date-range"
                className="w-full"
                value={datesFromPeriod(period)}
                onValueChange={(range) => {
                  const next = fromRange(range);
                  if (next) onPeriodChange?.(next);
                }}
                presets={presets}
                defaultMonth={datesFromPeriod(period).from}
              />
              <p className="text-muted-foreground text-xs">
                {days} day{days === 1 ? "" : "s"}.
              </p>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="date-compare" className="font-normal">
                  Compare with another period
                </Label>
                <Switch
                  id="date-compare"
                  checked={comparing}
                  onCheckedChange={(next) => onComparingChange?.(next)}
                />
              </div>

              {comparing ? (
                <div className="space-y-1.5">
                  <DateRangePicker
                    id="date-compare-range"
                    className="w-full"
                    value={datesFromPeriod(against)}
                    onValueChange={(range) => {
                      const next = fromRange(range);
                      if (next) onComparePeriodChange?.(next);
                    }}
                    presets={presets}
                    defaultMonth={datesFromPeriod(against).from}
                  />
                  <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                    <span>
                      {overridden
                        ? `${againstDays} day${againstDays === 1 ? "" : "s"}`
                        : "The period before, same length"}
                    </span>
                    {overridden ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-auto px-1 py-0 text-xs"
                        onClick={() => onComparePeriodChange?.(undefined)}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                  {compareEmpty ? (
                    <p className="text-muted-foreground text-xs leading-snug">
                      No {noun} in that period, so everything will read as a
                      fall. Pick a period the data covers.
                    </p>
                  ) : null}
                  {overridden && againstDays !== days ? (
                    // Not blocked, because comparing unequal periods is
                    // sometimes exactly right -- a fortnight against the same
                    // fortnight last year. But a count read across 15 days and
                    // one read across 7 are not comparable as counts, and
                    // nothing else on screen will say so.
                    <p className="text-muted-foreground text-xs leading-snug">
                      These periods are different lengths, so their totals are
                      not directly comparable.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
