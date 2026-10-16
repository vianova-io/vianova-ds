"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";
import { Label } from "@/registry/vianova/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/registry/vianova/ui/toggle-group";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Schedule = {
  /** yyyy-mm-dd. */
  start?: string;
  /** yyyy-mm-dd. Open-ended when omitted. */
  end?: string;
  allDay: boolean;
  /** HH:mm. Ignored when allDay. */
  from?: string;
  /** HH:mm. Earlier than `from` means the window runs past midnight. */
  to?: string;
  /** Empty, or all seven, means every day. */
  days: Weekday[];
};

export const EVERY_DAY: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_INDEX = Object.fromEntries(EVERY_DAY.map((d, i) => [d, i])) as Record<Weekday, number>;

/**
 * Dates are parsed and formatted in UTC. A yyyy-mm-dd string is a calendar
 * day, not an instant; reading it in local time moves it a day earlier for
 * anyone west of Greenwich.
 */
function parseDay(value: string | undefined) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 1 Jan 2024 was a Monday, so day i of the week is 1 + i January. */
function weekdayName(day: Weekday, locale: string, width: "narrow" | "short" | "long") {
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + DAY_INDEX[day])),
  );
}

function summarizeDates(s: Schedule, locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = parseDay(s.start);
  const end = parseDay(s.end);
  // formatRange collapses what the two dates share, so "4–31 May 2026" and
  // "4 May – 3 June 2026" come out right in every locale without our help.
  if (start && end) return start.getTime() === end.getTime() ? fmt.format(start) : fmt.formatRange(start, end);
  if (start) return `From ${fmt.format(start)}`;
  if (end) return `Until ${fmt.format(end)}`;
  return null;
}

/**
 * Runs of three or more consecutive days collapse to a range ("Mon–Fri");
 * pairs stay listed ("Sat, Sun"), since "Sat–Sun" reads as a span that might
 * include something in between. Sunday does not wrap to Monday: a week here
 * starts on Monday, as it does on the toggles.
 */
function summarizeDays(days: Weekday[], locale: string) {
  const set = new Set(days);
  if (set.size === 0 || set.size === 7) return "every day";
  const sorted = EVERY_DAY.filter((d) => set.has(d));
  const runs: Weekday[][] = [];
  for (const day of sorted) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    if (run && prev !== undefined && DAY_INDEX[day] === DAY_INDEX[prev] + 1) run.push(day);
    else runs.push([day]);
  }
  const name = (d: Weekday) => weekdayName(d, locale, "short");
  return runs
    .map((run) =>
      run.length >= 3
        ? `${name(run[0]!)}–${name(run[run.length - 1]!)}`
        : run.map(name).join(", "),
    )
    .join(", ");
}

function summarizeTimes(s: Schedule) {
  if (s.allDay) return "all day";
  if (s.from && s.to) return `${s.from}–${s.to}`;
  if (s.from) return `from ${s.from}`;
  if (s.to) return `until ${s.to}`;
  return "times not set";
}

/**
 * One line that says when a schedule applies, e.g.
 * "From 4 May 2026 · Mon–Fri · 07:00–19:00" or "4–31 May 2026 · Sat, Sun · all day".
 *
 * `locale` changes date and weekday names only; the connecting words are
 * English. It defaults to "en-GB" rather than the runtime's locale, which
 * differs between the server render and the browser and would produce a
 * hydration mismatch.
 *
 * `datesOnly` drops the days and times, for a schedule edited with
 * `showTimes={false}`, where neither is shown and so neither should be claimed.
 */
export function summarizeSchedule(
  s: Schedule,
  locale = "en-GB",
  options?: { datesOnly?: boolean },
): string {
  const parts = [summarizeDates(s, locale)];
  if (!options?.datesOnly) parts.push(summarizeDays(s.days, locale), summarizeTimes(s));
  const line = parts.filter(Boolean).join(" · ");
  if (!line) return "Always";
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * When a rule applies: a date span, a time of day, and days of the week.
 *
 * Two plain date inputs rather than the range picker. A rule usually starts
 * on a known day and runs until someone stops it, and a range calendar treats
 * a missing end as an unfinished selection rather than a valid answer. The
 * native input also gives a keyboard and screen reader path for free.
 *
 * "Every day" unticked starts with all seven days pressed, so ticking and
 * unticking never changes what the schedule means by itself; the last
 * pressed day cannot be released, because no days would read as every day
 * and silently flip the meaning.
 */
export function ScheduleEditor({
  value,
  onChange,
  showTimes = true,
  disabled,
  locale = "en-GB",
  className,
}: {
  value: Schedule;
  onChange: (next: Schedule) => void;
  /** false shows the dates only, as for a global setting. Defaults to true. */
  showTimes?: boolean;
  disabled?: boolean;
  /** Locale for weekday names on the toggles and in the summary, and for its dates. Defaults to "en-GB". */
  locale?: string;
  className?: string;
}) {
  const id = React.useId();
  const set = (patch: Partial<Schedule>) => onChange({ ...value, ...patch });

  // Whether the day toggles are showing. Held locally: all seven pressed and
  // "every day" mean the same, so the value alone cannot say which the
  // person is looking at.
  const [pickDays, setPickDays] = React.useState(
    value.days.length > 0 && value.days.length < 7,
  );

  const endBeforeStart = Boolean(value.start && value.end && value.end < value.start);
  const sameTimes = !value.allDay && Boolean(value.from && value.to && value.from === value.to);
  const summary = summarizeSchedule(value, locale, { datesOnly: !showTimes });

  return (
    <div data-slot="schedule-editor" className={cn("flex flex-col gap-6", className)}>
      <FieldSet disabled={disabled}>
        <FieldLegend variant="label">Dates</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>Starts</FieldLabel>
            <Input
              id={`${id}-start`}
              type="date"
              value={value.start ?? ""}
              onChange={(e) => set({ start: e.target.value || undefined })}
            />
          </Field>
          <Field data-invalid={endBeforeStart || undefined}>
            <FieldLabel htmlFor={`${id}-end`}>Ends (optional)</FieldLabel>
            <Input
              id={`${id}-end`}
              type="date"
              min={value.start}
              value={value.end ?? ""}
              aria-invalid={endBeforeStart || undefined}
              aria-describedby={endBeforeStart ? `${id}-end-error` : undefined}
              onChange={(e) => set({ end: e.target.value || undefined })}
            />
            {endBeforeStart ? (
              <FieldError id={`${id}-end-error`}>
                The end date must be on or after the start date.
              </FieldError>
            ) : null}
          </Field>
        </div>
      </FieldSet>

      {showTimes ? (
        <>
          <FieldSet disabled={disabled}>
            <FieldLegend variant="label">Time of day</FieldLegend>
            <FieldGroup className="gap-4">
              <Label className="w-fit font-normal">
                <Checkbox
                  checked={value.allDay}
                  disabled={disabled}
                  onCheckedChange={(checked) => set({ allDay: checked })}
                />
                All day
              </Label>
              {!value.allDay ? (
                <div className="flex flex-col gap-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={sameTimes || undefined}>
                      <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
                      <Input
                        id={`${id}-from`}
                        type="time"
                        value={value.from ?? ""}
                        aria-invalid={sameTimes || undefined}
                        aria-describedby={`${id}-times-hint`}
                        onChange={(e) => set({ from: e.target.value || undefined })}
                      />
                    </Field>
                    <Field data-invalid={sameTimes || undefined}>
                      <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
                      <Input
                        id={`${id}-to`}
                        type="time"
                        value={value.to ?? ""}
                        aria-invalid={sameTimes || undefined}
                        aria-describedby={`${id}-times-hint`}
                        onChange={(e) => set({ to: e.target.value || undefined })}
                      />
                    </Field>
                  </div>
                  {sameTimes ? (
                    <FieldError id={`${id}-times-hint`}>From and to can’t be the same time.</FieldError>
                  ) : (
                    <FieldDescription id={`${id}-times-hint`}>
                      A window can run overnight, for example 22:00 to 06:00.
                    </FieldDescription>
                  )}
                </div>
              ) : null}
            </FieldGroup>
          </FieldSet>

          <FieldSet disabled={disabled}>
            <FieldLegend variant="label">Days</FieldLegend>
            <FieldGroup className="gap-4">
              <Label className="w-fit font-normal">
                <Checkbox
                  checked={!pickDays}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    setPickDays(!checked);
                    // Every day either way; only the representation changes.
                    set({ days: checked ? [] : [...EVERY_DAY] });
                  }}
                />
                Every day
              </Label>
              {pickDays ? (
                <ToggleGroup
                  multiple
                  variant="outline"
                  spacing={1}
                  aria-label="Days of the week"
                  disabled={disabled}
                  value={value.days.length ? value.days : EVERY_DAY}
                  onValueChange={(next) => {
                    if (next.length === 0) return;
                    const days = EVERY_DAY.filter((d) => (next as string[]).includes(d));
                    set({ days });
                  }}
                >
                  {EVERY_DAY.map((day) => (
                    <ToggleGroupItem
                      key={day}
                      value={day}
                      aria-label={weekdayName(day, locale, "long")}
                      className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 w-9 px-0"
                    >
                      <span aria-hidden>{weekdayName(day, locale, "narrow")}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : null}
            </FieldGroup>
          </FieldSet>
        </>
      ) : null}

      <p
        data-slot="schedule-editor-summary"
        aria-live="polite"
        className="text-muted-foreground border-t pt-3 text-sm"
      >
        {summary}
      </p>
    </div>
  );
}
