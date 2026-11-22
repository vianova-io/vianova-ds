/**
 * Turning an MDS fleet-event log into the numbers a report shows.
 *
 * A fleet event is a `ReportEvent` -- an operator's vehicle, at a place and a
 * local time -- so filtering, counting and daily series come from
 * trip-report.ts. What is here is only what these events have and trips do
 * not: what happened, and how much battery was left when it did.
 *
 * This is the third shape a report has to handle, and it is the one that
 * stresses the charts hardest: ten categories where trips have five operators
 * and two vehicle types, a measure that is a percentage rather than a count,
 * and a single position rather than two ends. A donut with ten slices and a
 * flow chart with nothing to flow between are both findings, not failures.
 */
import {
  firstVertex,
  localClock,
  median,
  type ReportEvent,
} from "@/registry/vianova/lib/trip-report";

export type FleetEvent = ReportEvent & {
  /** What happened, as a label: "Trip start", "Low battery". */
  type: string;
  /** Charge when the event was recorded, 0-100. NaN when the feed omits it. */
  batteryPct: number;
  /** Which band that charge falls in, one of `BATTERY_BANDS`. */
  batteryBand: string;
  /**
   * Where it happened, as a district. Filled in after the feed is read by
   * whoever knows the city's shapes, like a trip's origin.
   */
  district?: string;
};

/**
 * The feed's `event_type` values, in the order a chart should show them.
 *
 * Labelled rather than passed through: `trip_start` is a wire format, and a
 * legend is read by a person. The order is the vehicle's own day -- ridden,
 * reserved, then the reasons an operator touches it -- so a ten-slice donut
 * at least degrades into something with a shape.
 */
export const FLEET_EVENT_TYPES: Record<string, string> = {
  trip_start: "Trip start",
  trip_end: "Trip end",
  reserve: "Reserve",
  cancel_reservation: "Cancel reservation",
  low_battery: "Low battery",
  maintenance: "Maintenance",
  rebalance_pick_up: "Rebalance pick-up",
  rebalance_drop_off: "Rebalance drop-off",
  provider_pick_up: "Provider pick-up",
  provider_drop_off: "Provider drop-off",
};

export const FLEET_EVENT_LABELS = Object.values(FLEET_EVENT_TYPES);

/**
 * Three bands, low to high.
 *
 * Declared rather than discovered: these are ordered categories, and a set
 * built from whichever row the feed happens to list first would put them in
 * an order that means nothing and changes between loads.
 */
export const BATTERY_BANDS = ["Under 20%", "20-50%", "Over 50%"];

export const batteryBand = (pct: number) =>
  Number.isNaN(pct)
    ? ""
    : pct < 20
      ? BATTERY_BANDS[0]!
      : pct <= 50
        ? BATTERY_BANDS[1]!
        : BATTERY_BANDS[2]!;

/**
 * Rows from `parseCsv`, by header name. Rows missing an event time or an
 * operator are dropped, and an event type the feed invented keeps its raw
 * value rather than vanishing.
 */
export function readFleetEvents(
  { header, rows }: { header: string[]; rows: string[][] },
  timeZone = "Europe/Lisbon",
): FleetEvent[] {
  const at = (name: string) => header.indexOf(name);
  const c = {
    provider: at("provider_name"),
    vehicle: at("vehicle_type"),
    device: at("device_id"),
    type: at("event_type"),
    battery: at("battery_pct"),
    time: at("event_time"),
    location: at("location"),
  };
  if (c.provider < 0 || c.time < 0 || c.type < 0) return [];

  const clock = localClock(timeZone);
  const out: FleetEvent[] = [];
  for (const row of rows) {
    const provider = row[c.provider];
    const raw = row[c.type] ?? "";
    const when = new Date(row[c.time] ?? "");
    if (!provider || !raw || Number.isNaN(when.getTime())) continue;
    const battery = Number(row[c.battery]);
    const batteryPct = Number.isFinite(battery) ? battery : NaN;
    out.push({
      provider,
      vehicle: row[c.vehicle] ?? "",
      device: row[c.device] ?? "",
      ...clock(when),
      ...firstVertex(row[c.location]),
      type: FLEET_EVENT_TYPES[raw] ?? raw,
      batteryPct,
      batteryBand: batteryBand(batteryPct),
    });
  }
  return out;
}

export type FleetMetric = "events" | "fleetDevices" | "battery";

/** One number for a set of fleet events, in the unit a chart shows it in. */
export function measureFleet(
  events: FleetEvent[],
  metric: FleetMetric,
): number {
  switch (metric) {
    case "events":
      return events.length;
    case "fleetDevices":
      return new Set(events.map((e) => e.device)).size;
    case "battery":
      // A median, not a mean: a fleet with a few dead vehicles and many full
      // ones is not accurately described by the average of the two.
      return median(
        events.map((e) => e.batteryPct).filter((p) => !Number.isNaN(p)),
      );
  }
}
