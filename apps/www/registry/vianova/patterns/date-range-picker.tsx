"use client";

import * as React from "react";
import { format, type Locale } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/registry/vianova/ui/button";
import { Calendar } from "@/registry/vianova/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/vianova/ui/popover";
import { cn } from "@/registry/vianova/lib/utils";

export type DateRangePreset = {
  label: string;
  /** Called when picked; return the range to apply. */
  range: () => DateRange;
};

/**
 * Two-month range calendar in a popover, with optional presets.
 *
 * The trigger label is built with date-fns `format`, not `toLocaleDateString`:
 * the latter resolves to the runtime's default locale, which differs between
 * the Node render and the browser and produces a hydration mismatch. Pass
 * `locale` to change the language rather than relying on the environment.
 */
export function DateRangePicker({
  value,
  defaultValue,
  onValueChange,
  presets,
  numberOfMonths = 2,
  defaultMonth,
  locale,
  placeholder = "Pick a date range",
  align = "start",
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "value" | "defaultValue" | "onChange"> & {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (range: DateRange | undefined) => void;
  presets?: DateRangePreset[];
  numberOfMonths?: number;
  defaultMonth?: Date;
  /**
   * A full date-fns locale. react-day-picker accepts a partial one, but the
   * trigger label formats with date-fns, which needs the whole object.
   */
  locale?: Locale;
  placeholder?: string;
  align?: "start" | "center" | "end";
}) {
  const [internal, setInternal] = React.useState<DateRange | undefined>(defaultValue);
  const range = value ?? internal;

  const apply = (next: DateRange | undefined) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const label = range?.from
    ? range.to
      ? `${format(range.from, "d MMM yyyy", { locale })} – ${format(range.to, "d MMM yyyy", { locale })}`
      : format(range.from, "d MMM yyyy", { locale })
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            data-slot="date-range-picker-trigger"
            data-empty={!range?.from}
            className={cn(
              "w-[18rem] justify-start text-left font-normal",
              !range?.from && "text-muted-foreground",
              className,
            )}
            {...props}
          >
            <CalendarIcon />
            <span className="truncate">{label}</span>
          </Button>
        }
      />
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          {presets?.length ? (
            <div className="flex gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => apply(preset.range())}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}
          <Calendar
            mode="range"
            autoFocus
            selected={range}
            onSelect={apply}
            numberOfMonths={numberOfMonths}
            defaultMonth={defaultMonth ?? range?.from}
            locale={locale}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
