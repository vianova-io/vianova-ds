/**
 * Comparing one period against another.
 *
 * Extracted so the map and the dashboard can agree. The compare pass was built
 * inside `blocks/dashboard-workspace.tsx`, which is why the map workspace --
 * sharing almost nothing with it beyond `category-style` and `utils` -- could
 * not have it. Everything here is deliberately free of React, of MapLibre and
 * of any dataset's shape: it takes rows and two accessors.
 *
 * The rules it encodes are the ones settled for the dashboard's charts:
 *
 *   - Colour means IDENTITY  -> previous is the same hue, faded and dashed.
 *     Not here: that is a chart decision, and it does not survive on a map.
 *   - Colour means MAGNITUDE -> ONE scale across both periods, legend once.
 *   - Colour means SIGN      -> a diverging ramp, and only then two hues.
 *
 * This file is the third case, which is the one a map needs: on a map the two
 * periods occupy the same geometry to the pixel, so they cannot both be drawn,
 * and the comparison has to become a quantity of its own.
 */

import { format } from "date-fns";

/** An inclusive range of whole days, each `YYYY-MM-DD`. */
export type Period = { start: string; end: string };

/** Milliseconds in a day, for the only arithmetic that needs them. */
const DAY = 86_400_000;

/**
 * A `YYYY-MM-DD` as a UTC timestamp.
 *
 * UTC rather than local on purpose: `new Date("2026-09-16")` is already UTC
 * midnight, but `new Date(2026, 8, 16)` is local, and the two disagree by a day
 * for anyone west of Greenwich. Period arithmetic that is off by a day puts an
 * event in the wrong fortnight, which is exactly the error a comparison cannot
 * survive.
 */
function utcOf(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** A UTC timestamp back to `YYYY-MM-DD`. */
function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** How many days the period covers, counting both ends. */
export function periodLength(period: Period): number {
  return Math.round((utcOf(period.end) - utcOf(period.start)) / DAY) + 1;
}

/**
 * The period of the same length immediately before this one.
 *
 * The default a reader expects of "compare with previous", and the same
 * derivation the dashboard uses, so a fortnight compares against the fortnight
 * before rather than against the same fortnight last year. Year-on-year is a
 * legitimate second option but it is a choice, not a default -- seasonality is
 * a question the reader has to raise.
 */
export function previousPeriod(period: Period): Period {
  const length = periodLength(period);
  const end = utcOf(period.start) - DAY;
  return { start: dayOf(end - (length - 1) * DAY), end: dayOf(end) };
}

/**
 * Whether a timestamp falls inside the period.
 *
 * Compares the date part as a STRING rather than parsing it. Both sides are
 * zero-padded ISO, so lexical order is chronological order, and it sidesteps
 * the whole timezone question for a row whose timestamp carries an offset: the
 * day a row belongs to is the day its own timestamp names.
 */
export function withinPeriod(timestamp: string, period: Period): boolean {
  const day = timestamp.slice(0, 10);
  return day >= period.start && day <= period.end;
}

/**
 * A `Date` as the day the person looking at it would call it.
 *
 * Local components, not `toISOString`: a calendar hands back midnight LOCAL,
 * and for anyone east of Greenwich that is the previous day in UTC. Picking
 * "16 September" and filtering from the 15th is the bug this avoids.
 */
export function dayFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A calendar's two dates as a period. */
export function periodFromDates(from: Date, to: Date): Period {
  const a = dayFromDate(from);
  const b = dayFromDate(to);
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/** A period as two local dates, for a calendar to show. */
export function datesFromPeriod(period: Period): { from: Date; to: Date } {
  const at = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return { from: at(period.start), to: at(period.end) };
}

/**
 * A period as a person reads it: "16–30 Sep", "28 Aug–3 Sep", "16 Sep".
 *
 * date-fns, and not `toLocaleDateString`, which is the one import this file
 * takes. `toLocaleDateString("en", { day, month })` is en-US and puts the
 * month first, which gave "1–Sep 30"; `DateRangePicker` formats
 * "d MMM yyyy", so a line reporting what that control set has to read the same
 * way round as the control itself.
 */
export function formatPeriod(period: Period): string {
  const { from, to } = datesFromPeriod(period);
  // A single day is a date, not a range: "16 Sep", never "16–16 Sep".
  if (period.start === period.end) return format(from, "d MMM");
  // Across a year boundary "28 Dec–3 Jan" hides which December, so both
  // ends carry a year the moment the years disagree.
  if (from.getFullYear() !== to.getFullYear())
    return `${format(from, "d MMM yyyy")}–${format(to, "d MMM yyyy")}`;
  // Otherwise the month goes once, where English puts it: after the day it
  // qualifies, unless the period crosses one.
  if (from.getMonth() === to.getMonth())
    return `${format(from, "d")}–${format(to, "d MMM")}`;
  return `${format(from, "d MMM")}–${format(to, "d MMM")}`;
}

/* -------------------------------------------------------------------------
 * The temporal filter
 *
 * A period is not the whole of how a layer is read over time. VIP's own
 * "Select a period" popover filters on three facets at once, and its shortcut
 * menu is a flat list over all three: Last week / Last month / Last 3 months
 * set the period, Work days / Weekend set the weekdays, Morning / Afternoon /
 * Night set the hours. Modelling only the period would make two thirds of
 * that menu unbuildable.
 * ---------------------------------------------------------------------- */

/** Monday = 1 ... Sunday = 7, as ISO-8601 numbers them. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Whole hours on a 24-hour clock, `start` inclusive and `end` exclusive.
 *
 * `start > end` is a range that WRAPS midnight, which is the only honest way
 * to say "night". A caller that forgets the wrap gets an empty result rather
 * than a wrong one, so `withinHours` handles it here, once.
 */
export type HourRange = { start: number; end: number };

/** How a layer is read over time: a period, and optionally a slice of it. */
export type TemporalFilter = {
  period: Period;
  /** Omitted or empty means every day of the week. */
  days?: readonly Weekday[];
  /** Omitted means the whole day. */
  hours?: HourRange;
};

/** ISO weekday for a date: `Date.getDay()` is Sunday-0, which ISO is not. */
export function weekdayOf(date: Date): Weekday {
  const js = date.getDay();
  return (js === 0 ? 7 : js) as Weekday;
}

export function withinHours(hour: number, range: HourRange): boolean {
  return range.start <= range.end
    ? hour >= range.start && hour < range.end
    : // wraps midnight: 18:00-06:00 is late evening OR early morning
      hour >= range.start || hour < range.end;
}

/**
 * Does a timestamp fall inside the filter?
 *
 * Reads the day from the first ten characters, as `withinPeriod` does, and
 * the hour from characters 11-12 -- both local-as-written, never parsed into
 * a `Date`, so a feed's own clock is not re-interpreted in the viewer's.
 */
export function withinTemporal(
  timestamp: string,
  filter: TemporalFilter,
): boolean {
  if (!withinPeriod(timestamp, filter.period)) return false;
  if (filter.days?.length) {
    const { from } = datesFromPeriod({
      start: timestamp.slice(0, 10),
      end: timestamp.slice(0, 10),
    });
    if (!filter.days.includes(weekdayOf(from))) return false;
  }
  if (filter.hours) {
    const hour = Number(timestamp.slice(11, 13));
    // A date with no time in it is a whole day, so an hour filter cannot
    // include it; saying otherwise would quietly widen the filter.
    if (!Number.isFinite(hour)) return false;
    if (!withinHours(hour, filter.hours)) return false;
  }
  return true;
}

/** "06:00", from a whole hour. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The one-line summary a field shows, after VIP's own:
 * "20 Jan 2024 – 26 Jan 2024, 06:00 – 12:00".
 *
 * VIP writes the dates `1/20/2024 - 1/26/2024`. This writes them day-first,
 * because every other date in this DS is day-first -- `DateRangePicker`
 * formats "d MMM yyyy" -- and one control disagreeing with the rest is worse
 * than one control disagreeing with VIP.
 */
export function formatTemporal(filter: TemporalFilter): string {
  const { from, to } = datesFromPeriod(filter.period);
  const dates = `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
  const parts = [dates];
  if (filter.days?.length && filter.days.length < 7) {
    parts.push(filter.days.map((d) => WEEKDAY_LABELS[d]).join(", "));
  }
  if (filter.hours) {
    parts.push(
      `${formatHour(filter.hours.start)} – ${formatHour(filter.hours.end)}`,
    );
  }
  return parts.join(", ");
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

/** Monday-first, which is how VIP's own day chips are ordered. */
export const WEEKDAY_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/* -------------------------------------------------------------------------
 * Shortcuts
 * ---------------------------------------------------------------------- */

/** Which facet of the filter a shortcut sets. */
export type ShortcutFacet = "period" | "days" | "hours";

export type DateShortcut = {
  id: string;
  label: string;
  facet: ShortcutFacet;
  apply: (filter: TemporalFilter, today: Date) => TemporalFilter;
};

const back = (today: Date, days: number): Period => {
  const end = new Date(today);
  end.setDate(end.getDate() - 1); // through yesterday: today is still partial
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { start: dayFromDate(start), end: dayFromDate(end) };
};

/**
 * VIP's eight, in VIP's order.
 *
 * The three hour ranges: Morning is 06:00-12:00, read off the running app.
 * Afternoon and Night are not -- they are the obvious continuation, and they
 * are here as named constants precisely so that a one-line edit corrects them
 * if VIP draws those boundaries elsewhere.
 *
 * The three periods likewise: VIP's "Last week" was not measured against a
 * known clock, so these count back whole days through yesterday, which is the
 * reading that never includes a part-finished today.
 */
export const DATE_SHORTCUTS: readonly DateShortcut[] = [
  {
    id: "last-week",
    label: "Last week",
    facet: "period",
    apply: (f, today) => ({ ...f, period: back(today, 7) }),
  },
  {
    id: "last-month",
    label: "Last month",
    facet: "period",
    apply: (f, today) => ({ ...f, period: back(today, 30) }),
  },
  {
    id: "last-3-months",
    label: "Last 3 months",
    facet: "period",
    apply: (f, today) => ({ ...f, period: back(today, 90) }),
  },
  {
    id: "work-days",
    label: "Work days",
    facet: "days",
    apply: (f) => ({ ...f, days: [1, 2, 3, 4, 5] }),
  },
  {
    id: "weekend",
    label: "Weekend",
    facet: "days",
    apply: (f) => ({ ...f, days: [6, 7] }),
  },
  {
    id: "morning",
    label: "Morning",
    facet: "hours",
    apply: (f) => ({ ...f, hours: { start: 6, end: 12 } }),
  },
  {
    id: "afternoon",
    label: "Afternoon",
    facet: "hours",
    apply: (f) => ({ ...f, hours: { start: 12, end: 18 } }),
  },
  {
    id: "night",
    label: "Night",
    facet: "hours",
    apply: (f) => ({ ...f, hours: { start: 18, end: 6 } }),
  },
];

/** One unit -- a zone, a cell, a road segment -- counted in both periods. */
export type Comparison = {
  key: string;
  now: number;
  previous: number;
  /** Signed absolute change. */
  delta: number;
  /**
   * Signed change as a percentage of the earlier period, or null where the
   * earlier period is too small for a percentage to mean anything.
   */
  percent: number | null;
};

/**
 * How many events a unit needs in the EARLIER period before a percentage is
 * reported for it.
 *
 * The single most common way a change map lies: a zone going from 1 event to 4
 * is +300%, which will be the loudest thing on the map and is noise. Below the
 * floor the percentage is withheld rather than guessed, and the caller draws
 * the unit at the neutral midpoint.
 *
 * Twenty is a starting value, not a measured one -- it wants tuning against a
 * period whose answer is already known.
 */
export const PERCENT_FLOOR = 20;

/**
 * Change as a percentage of the earlier period, or null below the floor.
 *
 * Null also when the earlier period is zero: "appeared from nothing" is a real
 * and interesting event, but it is not a percentage, and reporting it as one
 * (or as Infinity, or as +100%) misstates it. The caller shows those units by
 * their absolute change instead.
 */
export function percentChange(
  now: number,
  previous: number,
  floor: number = PERCENT_FLOOR,
): number | null {
  if (previous < floor || previous <= 0) return null;
  return ((now - previous) / previous) * 100;
}

/**
 * Count rows per unit in both periods, and difference them.
 *
 * `keys` matters more than it looks. Passing the full vocabulary -- every zone
 * on the map, not just the ones with events -- is what lets a unit that went to
 * zero appear as a fall rather than vanish from the result. A change map that
 * silently drops its emptied units reports the opposite of what happened there.
 */
export function compareCounts<Row>({
  rows,
  keyOf,
  timeOf,
  period,
  previous = previousPeriod(period),
  keys,
  floor = PERCENT_FLOOR,
}: {
  rows: readonly Row[];
  /** The unit a row belongs to, or null to drop the row. */
  keyOf: (row: Row) => string | null;
  /** The row's timestamp. */
  timeOf: (row: Row) => string;
  period: Period;
  previous?: Period;
  /** Every unit that should appear, including those with no rows at all. */
  keys?: readonly string[];
  floor?: number;
}): Comparison[] {
  const now = new Map<string, number>();
  const before = new Map<string, number>();

  for (const row of rows) {
    const key = keyOf(row);
    if (key == null) continue;
    const time = timeOf(row);
    const bucket = withinPeriod(time, period)
      ? now
      : withinPeriod(time, previous)
        ? before
        : null;
    if (bucket) bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  const all = keys ?? [...new Set([...now.keys(), ...before.keys()])];
  return all.map((key) => {
    const a = now.get(key) ?? 0;
    const b = before.get(key) ?? 0;
    return {
      key,
      now: a,
      previous: b,
      delta: a - b,
      percent: percentChange(a, b, floor),
    };
  });
}

/** Which number a change map is painted by. */
export type CompareMetric = "absolute" | "percent";

/** The value a unit is drawn by, or null where it should stay neutral. */
export function metricValue(
  row: Comparison,
  metric: CompareMetric,
): number | null {
  return metric === "absolute" ? row.delta : row.percent;
}

/**
 * The larger of the two extremes, so the scale is symmetric about zero.
 *
 * Without this the midpoint drifts off zero, "no change" picks up a colour from
 * one side of the ramp, and the whole map reads as a uniform rise or fall. The
 * limit is the one number that makes a diverging scale honest.
 */
export function symmetricLimit(values: readonly (number | null)[]): number {
  let limit = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    const size = Math.abs(v);
    if (size > limit) limit = size;
  }
  return limit;
}

/**
 * The DS's diverging pair, brown falling to teal rising.
 *
 * The same five stops as the "Brown–Teal" entry in `color-ramp.ts`, which is
 * flagged colour-blind safe, and the same pair the dashboard's Change views
 * use. Repeated as a constant rather than looked up by name so that a reader
 * renaming a palette cannot silently change what a sign means.
 *
 * It does NOT follow the map scheme. Every other ramp on the map does, but
 * "teal is up" has to be learnable, and a sign that changes hue with the
 * basemap is not.
 */
export const DIVERGING_STOPS = [
  "#8c510a",
  "#d8b365",
  "#f5f5f5",
  "#5ab4ac",
  "#01665e",
] as const;

/** Blend two `#rrggbb` by `t` in 0..1. */
function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, at: number) =>
    parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  const out = [0, 1, 2].map((i) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t),
  );
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A signed value's colour on the diverging ramp.
 *
 * `limit` is the symmetric extreme: `-limit` lands on the first stop, 0 on the
 * middle one, `+limit` on the last. A value past the limit clamps rather than
 * wrapping.
 */
export function divergingColor(
  value: number,
  limit: number,
  stops: readonly string[] = DIVERGING_STOPS,
): string {
  const mid = (stops.length - 1) / 2;
  if (limit <= 0 || stops.length < 2) return stops[Math.floor(mid)] ?? "#f5f5f5";
  const clamped = Math.max(-1, Math.min(1, value / limit));
  const at = mid + clamped * mid;
  const low = Math.floor(at);
  const high = Math.min(stops.length - 1, low + 1);
  return mix(stops[low] ?? "#f5f5f5", stops[high] ?? "#f5f5f5", at - low);
}

/**
 * How opaque a unit should be drawn, given how far it moved.
 *
 * The map's answer to the charts' neutral midpoint. On a card the midpoint is
 * `var(--card)` and disappears into it; on a map a grey midpoint paints OVER
 * the basemap and reads as data. Fading the midpoint out instead lets an
 * unchanged area show the city through it, while the extremes stay solid.
 *
 * The floor is deliberately above zero, and every unit keeps its outline: "no
 * change" and "no data" must not look alike.
 */
export function divergingOpacity(
  value: number | null,
  limit: number,
  { min = 0.08, max = 0.8 }: { min?: number; max?: number } = {},
): number {
  if (value == null || limit <= 0) return min;
  return min + (max - min) * Math.min(1, Math.abs(value) / limit);
}

/**
 * Evenly spaced stops across the symmetric scale, for a legend.
 *
 * Returns the colours AND the values they stand for, because a diverging
 * legend that does not label its centre leaves the reader unable to tell which
 * band means "unchanged" -- the one value they most need to find.
 */
export function divergingLegend(
  limit: number,
  bands = 9,
  stops: readonly string[] = DIVERGING_STOPS,
): { value: number; color: string }[] {
  const steps = Math.max(3, bands % 2 === 0 ? bands + 1 : bands);
  return Array.from({ length: steps }, (_, i) => {
    const value = -limit + (2 * limit * i) / (steps - 1);
    return { value, color: divergingColor(value, limit, stops) };
  });
}

/**
 * What a layer's rows mean in time, which decides whether it can be compared.
 *
 * - `events`    one row per thing that happened, with a timestamp. Filterable
 *               into periods; this is the kind comparison was designed for.
 * - `aggregate` already summed over a period, so the LAYER is a period. Compared
 *               by loading it twice and joining on the unit's id.
 * - `snapshot`  one state at one moment. There is no period in it, and no
 *               comparison to make.
 * - `static`    geometry that does not change -- zones, districts. Compared only
 *               as the units something else is counted into.
 */
export type TemporalKind = "events" | "aggregate" | "snapshot" | "static";

/** Why a layer cannot be compared, or null when it can. */
export function compareBlockedReason(kind: TemporalKind): string | null {
  if (kind === "snapshot")
    return "This layer is a snapshot of one moment, so it has no period to compare.";
  if (kind === "static")
    return "This layer is fixed geometry. Compare something counted into it instead.";
  return null;
}
