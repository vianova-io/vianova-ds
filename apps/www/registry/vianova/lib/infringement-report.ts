/**
 * Turning a log of parking infringements into the numbers a report shows.
 *
 * An infringement is a `ReportEvent` -- an operator's vehicle, at a place and a
 * local time -- so filtering, counting and daily series come from
 * trip-report.ts. What is here is only what infringements have and trips do
 * not: a type, a status, a fine, and how long the case took to close.
 */
import {
  firstVertex,
  localClock,
  median,
  type ReportEvent,
} from "@/registry/vianova/lib/trip-report";

export type InfringementStatus = "Resolved" | "Fined" | "Open";

export type Infringement = ReportEvent & {
  /** `infringement_type`, e.g. "Sidewalk parking". */
  type: string;
  status: InfringementStatus;
  /** Euros; 0 unless the case was fined. */
  fineEur: number;
  /** Minutes from detection to resolution; NaN while the case is open. */
  resolutionMin: number;
};

const STATUSES: InfringementStatus[] = ["Resolved", "Fined", "Open"];

/**
 * Rows from `parseCsv`, by header name. Rows missing a detection time or an
 * operator are dropped, and an unknown status reads as Open.
 */
export function readInfringements(
  { header, rows }: { header: string[]; rows: string[][] },
  timeZone = "Europe/Lisbon",
): Infringement[] {
  const at = (name: string) => header.indexOf(name);
  const c = {
    provider: at("provider_name"),
    vehicle: at("vehicle_type"),
    device: at("device_id"),
    type: at("infringement_type"),
    status: at("status"),
    fine: at("fine_eur"),
    detected: at("detected_at"),
    resolved: at("resolved_at"),
    location: at("location"),
  };
  if (c.provider < 0 || c.detected < 0) return [];

  const clock = localClock(timeZone);
  const out: Infringement[] = [];
  for (const row of rows) {
    const provider = row[c.provider];
    const detected = new Date(row[c.detected] ?? "");
    if (!provider || Number.isNaN(detected.getTime())) continue;
    const resolved = new Date(row[c.resolved] ?? "");
    const status = STATUSES.find((s) => s === row[c.status]) ?? "Open";
    out.push({
      provider,
      vehicle: row[c.vehicle] ?? "",
      device: row[c.device] ?? "",
      ...clock(detected),
      ...firstVertex(row[c.location]),
      type: row[c.type] ?? "",
      status,
      fineEur: Number(row[c.fine]) || 0,
      resolutionMin:
        status === "Open" || Number.isNaN(resolved.getTime())
          ? NaN
          : (resolved.getTime() - detected.getTime()) / 60_000,
    });
  }
  return out;
}

export type InfringementMetric =
  "infringements" | "fines" | "resolution" | "devices";

/** One number for a set of infringements, in the unit a chart shows it in. */
export function measureInfringements(
  events: Infringement[],
  metric: InfringementMetric,
): number {
  switch (metric) {
    case "infringements":
      return events.length;
    case "fines":
      return events.reduce((s, e) => s + e.fineEur, 0);
    case "resolution":
      // Open cases have no resolution time yet; they are not zero.
      return median(
        events.map((e) => e.resolutionMin).filter((m) => !Number.isNaN(m)),
      );
    case "devices":
      return new Set(events.map((e) => e.device)).size;
  }
}
