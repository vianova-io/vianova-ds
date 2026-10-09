/**
 * Turning an MDS trips feed into the numbers a report shows.
 *
 * The filtering, counting and daily series work on any `ReportEvent` -- a trip,
 * or anything else that happened somewhere at some time with an operator and a
 * vehicle -- so other feeds (see infringement-report.ts) reuse them.
 *
 * Pure and synchronous: a report recomputes on every filter change, and 2,000
 * trips aggregate in well under a frame. Days and hours are read in the city's
 * own time zone, not UTC -- a trip at 23:30 in Lisbon in September is 22:30 UTC,
 * and a "night riding" report that bucketed by UTC would miss an hour of it.
 */

/** Something that happened at a place and time, with an operator's vehicle. */
export type ReportEvent = {
  provider: string;
  vehicle: string;
  device: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  /** Local hour, 0-23. */
  hour: number;
  /** Local weekday, Monday = 0. */
  weekday: number;
  /** Where it happened. NaN when absent. */
  lon: number;
  lat: number;
};

/** A trip; its position is where it started, from the first vertex of `route`. */
export type Trip = ReportEvent & {
  durationS: number;
  distanceM: number;
};

/** A circle on the map, which is all a sample feed's zones need to be. */
export type Zone = { center: [lon: number, lat: number]; radiusM: number };

export type EventFilter = {
  /** First local day, inclusive, YYYY-MM-DD. */
  from: string;
  /** Last local day, inclusive. */
  to: string;
  /** Only this `vehicle_type`; every vehicle when absent. */
  vehicle?: string;
  /** Only these operators; every operator when absent or empty. */
  providers?: string[];
  /** Only these vehicle types; every type when absent or empty. */
  vehicles?: string[];
  /**
   * Local hours [start, end). Wraps past midnight when start > end, so
   * [22, 6] is 22:00 to 05:59.
   */
  hours?: [number, number];
  /** Monday to Friday, or Saturday and Sunday. Every day when absent. */
  days?: "work" | "weekend";
  /** Only events inside this zone. */
  zone?: Zone;
};

export type TripFilter = EventFilter;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Reads instants as a city's local day, hour and weekday. Built once per feed:
 * an Intl formatter is expensive to make and cheap to use.
 */
export function localClock(timeZone = "Europe/Lisbon") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  return (at: Date) => {
    const p: Record<string, string> = {};
    for (const { type, value } of parts.formatToParts(at)) p[type] = value;
    return {
      day: `${p.year}-${p.month}-${p.day}`,
      hour: Number(p.hour),
      weekday: WEEKDAYS.indexOf(p.weekday ?? ""),
    };
  };
}

/**
 * Rows from `parseCsv`, by header name, so a feed with its columns in another
 * order still reads. Rows missing a start time or a provider are dropped.
 */
export function readTrips(
  { header, rows }: { header: string[]; rows: string[][] },
  timeZone = "Europe/Lisbon",
): Trip[] {
  const at = (name: string) => header.indexOf(name);
  const c = {
    provider: at("provider_name"),
    vehicle: at("vehicle_type"),
    device: at("device_id"),
    start: at("start_time"),
    duration: at("trip_duration"),
    distance: at("trip_distance"),
    route: at("route"),
  };
  if (c.provider < 0 || c.start < 0) return [];

  const clock = localClock(timeZone);
  const trips: Trip[] = [];
  for (const row of rows) {
    const provider = row[c.provider];
    const start = new Date(row[c.start] ?? "");
    if (!provider || Number.isNaN(start.getTime())) continue;
    trips.push({
      provider,
      vehicle: row[c.vehicle] ?? "",
      device: row[c.device] ?? "",
      ...clock(start),
      durationS: Number(row[c.duration]) || 0,
      distanceM: Number(row[c.distance]) || 0,
      ...firstVertex(row[c.route]),
    });
  }
  return trips;
}

/** The first vertex of a WKT geometry: a POINT, or where a LINESTRING starts. */
const FIRST_VERTEX = /\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;

export function firstVertex(wkt: string | undefined): {
  lon: number;
  lat: number;
} {
  const m = FIRST_VERTEX.exec(wkt ?? "");
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : { lon: NaN, lat: NaN };
}

/**
 * Metres between two points, flat-earth. Inside a city the error is far below
 * the size of any zone, and it is an order of magnitude cheaper than haversine.
 */
export function metresBetween(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number],
) {
  const x =
    (lon2 - lon1) * 111_320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = (lat2 - lat1) * 110_540;
  return Math.hypot(x, y);
}

export const inZone = (t: Pick<ReportEvent, "lon" | "lat">, z: Zone) =>
  !Number.isNaN(t.lon) && metresBetween([t.lon, t.lat], z.center) <= z.radiusM;

const inHours = (hour: number, [start, end]: [number, number]) =>
  start <= end ? hour >= start && hour < end : hour >= start || hour < end;

/**
 * The events a filter keeps. `also` adds a feed's own conditions -- an
 * infringement's type, say -- without this module knowing about them.
 */
export function filterEvents<T extends ReportEvent>(
  events: T[],
  f: EventFilter,
  also?: (e: T) => boolean,
): T[] {
  return events.filter(
    (t) =>
      t.day >= f.from &&
      t.day <= f.to &&
      (!f.vehicle || t.vehicle === f.vehicle) &&
      (!f.providers?.length || f.providers.includes(t.provider)) &&
      (!f.vehicles?.length || f.vehicles.includes(t.vehicle)) &&
      (!f.hours || inHours(t.hour, f.hours)) &&
      (!f.days || (f.days === "work" ? t.weekday < 5 : t.weekday >= 5)) &&
      (!f.zone || inZone(t, f.zone)) &&
      (!also || also(t)),
  );
}

export const filterTrips = (trips: Trip[], f: TripFilter): Trip[] =>
  filterEvents(trips, f);

const DAY_MS = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = toMs(from); ms <= toMs(to); ms += DAY_MS) out.push(toDay(ms));
  return out;
}

/** The same filter over the same number of days, ending the day before. */
export function previousPeriod<F extends EventFilter>(f: F): F {
  const length = daysBetween(f.from, f.to).length;
  return {
    ...f,
    from: toDay(toMs(f.from) - length * DAY_MS),
    to: toDay(toMs(f.from) - DAY_MS),
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type TripSummary = {
  trips: number;
  vehicles: number;
  medianDurationMin: number;
  avgDistanceKm: number;
  /** Over the days in the period, including days with no trips. */
  tripsPerVehiclePerDay: number;
};

export function summarize(trips: Trip[], days: number): TripSummary {
  const vehicles = new Set(trips.map((t) => t.device)).size;
  const distance = trips.reduce((sum, t) => sum + t.distanceM, 0);
  return {
    trips: trips.length,
    vehicles,
    medianDurationMin: median(trips.map((t) => t.durationS)) / 60,
    avgDistanceKm: trips.length ? distance / trips.length / 1000 : 0,
    tripsPerVehiclePerDay:
      vehicles && days ? trips.length / vehicles / days : 0,
  };
}

/**
 * Relative change, or null when there is nothing to compare with. A period
 * before the feed starts has zero trips, and "+∞%" is not a number anyone wants.
 */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

/** One row per day, one count per provider: the shape a stacked bar chart takes. */
export function tripsByDay(
  trips: ReportEvent[],
  days: string[],
  providers: string[],
): Array<{ day: string; counts: number[] }> {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map((day) => ({ day, counts: providers.map(() => 0) }));
  for (const t of trips) {
    const d = index.get(t.day);
    const p = providers.indexOf(t.provider);
    if (d !== undefined && p >= 0) out[d]!.counts[p]!++;
  }
  return out;
}

export type ProviderRow = {
  provider: string;
  trips: number;
  /** 0-1 of all trips in the period. */
  share: number;
  vehicles: number;
  medianDurationMin: number;
  avgDistanceKm: number;
};

/** In `providers` order, so the table and the chart legend agree. */
export function byProvider(trips: Trip[], providers: string[]): ProviderRow[] {
  return providers.map((provider) => {
    const own = trips.filter((t) => t.provider === provider);
    const s = summarize(own, 1);
    return {
      provider,
      trips: own.length,
      share: trips.length ? own.length / trips.length : 0,
      vehicles: s.vehicles,
      medianDurationMin: s.medianDurationMin,
      avgDistanceKm: s.avgDistanceKm,
    };
  });
}

/** values[weekday][hour], scaled so the busiest cell is 1. */
export function weekHourGrid(trips: ReportEvent[]): number[][] {
  const grid = WEEKDAYS.map(() => Array.from({ length: 24 }, () => 0));
  for (const t of trips) if (t.weekday >= 0) grid[t.weekday]![t.hour]!++;
  const max = Math.max(1, ...grid.flat());
  return grid.map((row) => row.map((v) => v / max));
}

export const WEEKDAY_LABELS = WEEKDAYS;

export type CountRow = {
  value: string;
  count: number;
  /** 0-1 of all events counted. */
  share: number;
};

/**
 * How many events have each value of `key`, in `order` -- values not in it are
 * left out, so a chart's categories and colours stay in the feed's own order.
 */
export function countBy<T extends ReportEvent>(
  events: T[],
  key: (e: T) => string,
  order: string[],
): CountRow[] {
  const counts = new Map(order.map((v) => [v, 0]));
  for (const e of events) {
    const v = key(e);
    if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
  }
  return order.map((value) => ({
    value,
    count: counts.get(value)!,
    share: events.length ? counts.get(value)! / events.length : 0,
  }));
}

export type Metric = "trips" | "vehicles" | "distance" | "duration";

/** One number for a set of trips, in the unit a chart shows it in. */
export function measure(trips: Trip[], metric: Metric): number {
  switch (metric) {
    case "trips":
      return trips.length;
    case "vehicles":
      return new Set(trips.map((t) => t.device)).size;
    case "distance":
      return trips.length
        ? trips.reduce((s, t) => s + t.distanceM, 0) / trips.length / 1000
        : 0;
    case "duration":
      return median(trips.map((t) => t.durationS)) / 60;
  }
}

/**
 * A metric per day, split by provider or as one total.
 *
 * Averages are taken within each day and group, never summed from the groups:
 * the median of a day is not the sum of its operators' medians.
 */
export function dailySeries(
  trips: Trip[],
  days: string[],
  metric: Metric,
  providers: string[] | null,
): Array<{ day: string; values: number[] }>;
/** The same, for any feed: `metric` turns one day's events into a number. */
export function dailySeries<T extends ReportEvent>(
  events: T[],
  days: string[],
  metric: (events: T[]) => number,
  providers: string[] | null,
): Array<{ day: string; values: number[] }>;
export function dailySeries<T extends ReportEvent>(
  events: T[],
  days: string[],
  metric: Metric | ((events: T[]) => number),
  providers: string[] | null,
): Array<{ day: string; values: number[] }> {
  const of =
    typeof metric === "function"
      ? metric
      : (own: T[]) => measure(own as unknown as Trip[], metric);
  const byDay = new Map<string, T[]>(days.map((d) => [d, []]));
  for (const t of events) byDay.get(t.day)?.push(t);
  return days.map((day) => {
    const own = byDay.get(day)!;
    const values = providers
      ? providers.map((p) => of(own.filter((t) => t.provider === p)))
      : [of(own)];
    return { day, values };
  });
}
