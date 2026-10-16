import type { Schedule } from "@/registry/vianova/patterns/schedule-editor";
import type { RuleType } from "@/registry/vianova/product/rule-type-icon";
import type { PickerZone } from "@/registry/vianova/product/zone-picker";
import { parseSample, ringOf } from "@/registry/vianova/lib/sample-datasets";

/**
 * Fake Lisbon regulations for the regulations workspace, and the zone library
 * they draw their areas from.
 *
 * The zones are not new data. They are read from the same CSVs the data hub
 * lists under Zones and Regulations, so a district or a no-parking area is the
 * same shape in both workspaces. A second, hand-drawn copy here would drift
 * from those files the first time either was regenerated.
 *
 * The regulations themselves are declared here rather than generated into a
 * CSV: a regulation is a nested thing (rules, each with its own zones,
 * schedule and vehicles), which a flat file could only hold by inventing a
 * format nobody else reads.
 */

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

export type Vehicle = "scooter" | "bike" | "moped" | "seated_scooter" | "car";

export const VEHICLES: { value: Vehicle; label: string }[] = [
  { value: "scooter", label: "Scooter" },
  { value: "bike", label: "Bike" },
  { value: "moped", label: "Moped" },
  { value: "seated_scooter", label: "Seated scooter" },
  { value: "car", label: "Car" },
];

/** The five operators in the fake MDS feeds, so filters here match the data hub. */
export const OPERATORS = ["Bolt", "Dott", "Gira", "Lime", "Voi"] as const;

export type Rule = {
  id: string;
  type: RuleType;
  name: string;
  /** Parking only: whether leaving a vehicle outside the area is an infringement. */
  mode?: "recommended" | "enforced";
  /**
   * The number the rule is about, in the unit RULE_VALUE gives its type: a
   * fleet size, a speed, a time, a share. Undefined for types with none.
   */
  value?: number;
  /** Floor of a cap-and-floor rule; `value` is its cap. */
  min?: number;
  /** Metres added around every zone to absorb GPS error. May be negative. */
  buffer: number;
  zoneIds: string[];
  schedule: Schedule;
  /** Empty means every vehicle. */
  vehicles: Vehicle[];
  /** Empty means every operator. */
  operators: string[];
};

export type Regulation = {
  id: string;
  name: string;
  /** The type it was created as. Multi-parking holds several rules; the rest hold one. */
  kind: RuleType;
  rules: Rule[];
  /** Dates that bound every rule in the regulation, on top of each rule's own. */
  global: { start?: string; end?: string };
  visibility: "private" | "public";
  /** Switched off by hand, whatever its dates say. */
  deactivated: boolean;
  createdAt: string;
};

export type RegulationStatus = "active" | "scheduled" | "ending" | "inactive";

export const STATUS_LABELS: Record<RegulationStatus, string> = {
  active: "Active",
  scheduled: "Not active yet",
  ending: "Ending soon",
  inactive: "Inactive",
};

/**
 * "Today" for the sample. Fixed, not Date.now(): the statuses are part of what
 * the demo shows, and a regulation that quietly became inactive the day its
 * fake end date passed would look like a bug in the workspace.
 */
export const REFERENCE_DATE = "2026-10-01";

/** Ending soon: in force now, and over within this many days. */
const ENDING_WITHIN_DAYS = 30;

/** The dates a regulation is actually in force: its global dates, or else the widest span of its rules. */
export function effectiveDates(reg: Regulation): { start?: string; end?: string } {
  const starts = reg.rules.map((r) => r.schedule.start).filter(Boolean) as string[];
  const ends = reg.rules.map((r) => r.schedule.end);
  return {
    start: reg.global.start ?? (starts.length ? starts.sort()[0] : undefined),
    // One open-ended rule keeps the whole regulation open-ended.
    end:
      reg.global.end ??
      (ends.length && ends.every(Boolean) ? (ends as string[]).sort().at(-1) : undefined),
  };
}

export function regulationStatus(reg: Regulation, today = REFERENCE_DATE): RegulationStatus {
  if (reg.deactivated) return "inactive";
  const { start, end } = effectiveDates(reg);
  if (end && end < today) return "inactive";
  if (start && start > today) return "scheduled";
  if (end) {
    const days = (Date.parse(end) - Date.parse(today)) / 86_400_000;
    if (days <= ENDING_WITHIN_DAYS) return "ending";
  }
  return "active";
}

/**
 * What the number on a rule means, per type. A type missing here has no number
 * of its own: no parking, no go and the rest are defined by their zones alone.
 */
export const RULE_VALUE: Partial<
  Record<RuleType, { label: string; unit: string; min: number; max?: number; step?: number }>
> = {
  cap: { label: "Maximum fleet size", unit: "vehicles", min: 0 },
  floor: { label: "Minimum fleet size", unit: "vehicles", min: 0 },
  cap_and_floor: { label: "Maximum fleet size", unit: "vehicles", min: 0 },
  low_speed: { label: "Speed limit", unit: "km/h", min: 5, max: 25 },
  max_parked: { label: "Longest a vehicle may stay parked", unit: "hours", min: 1, max: 168 },
  max_unavailable: { label: "Largest share of a fleet out of service", unit: "%", min: 0, max: 100 },
  fees_subsidies: { label: "Subsidy per trip", unit: "€", min: 0, step: 0.05 },
};

/** Recommended GPS buffer for a new rule, in metres. */
export const DEFAULT_BUFFER = 10;

const ALL_DAY: Schedule = { allDay: true, days: [] };

export function newRule(type: RuleType, id: string, name: string): Rule {
  return {
    id,
    type,
    name,
    mode: type === "parking" ? "recommended" : undefined,
    value: RULE_VALUE[type] ? (type === "low_speed" ? 15 : undefined) : undefined,
    buffer: DEFAULT_BUFFER,
    zoneIds: [],
    schedule: { ...ALL_DAY, start: REFERENCE_DATE },
    vehicles: [],
    operators: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Zone library                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The CSVs the zone library is read from, and how each one's columns map onto
 * a zone. Order matters only for the picker's default sort.
 */
const ZONE_SOURCES: {
  file: string;
  id: string;
  name: string;
  tag: string;
  createdAt: string;
}[] = [
  { file: "districts-lisbon.csv", id: "district_id", name: "name", tag: "area_type", createdAt: "2026-07-14" },
  { file: "parking-zones-lisbon.csv", id: "zone_id", name: "name", tag: "zone_type", createdAt: "2026-08-02" },
  { file: "regulation-no-parking-historic-centre.csv", id: "rule_id", name: "area", tag: "rule", createdAt: "2026-01-10" },
  { file: "regulation-speed-limit-baixa.csv", id: "rule_id", name: "area", tag: "rule", createdAt: "2026-02-20" },
  { file: "regulation-night-curfew-bairro-alto.csv", id: "rule_id", name: "area", tag: "rule", createdAt: "2025-05-20" },
];

/**
 * Every zone a rule can be given, read from the sample CSVs.
 *
 * A file that cannot be fetched is left out rather than failing the lot: the
 * picker with four sources of five is still a picker, and a regulation that
 * points at a missing zone simply shows one zone fewer.
 */
export async function loadZoneLibrary(basePath: string, signal?: AbortSignal): Promise<PickerZone[]> {
  const loaded = await Promise.all(
    ZONE_SOURCES.map(async (src) => {
      try {
        const res = await fetch(`${basePath}/data/${src.file}`, { signal });
        if (!res.ok) return [];
        const sample = parseSample(await res.text());
        if (!sample || sample.geometryAt < 0) return [];
        const at = (col: string) => sample.header.indexOf(col);
        const [idAt, nameAt, tagAt] = [at(src.id), at(src.name), at(src.tag)];
        const zones: PickerZone[] = [];
        for (const row of sample.rows) {
          const ring = ringOf(row[sample.geometryAt] ?? "");
          if (!ring) continue;
          const tag = (row[tagAt] ?? "").toLowerCase();
          zones.push({
            id: row[idAt] ?? `${src.file}-${zones.length}`,
            name: row[nameAt] ?? "Untitled zone",
            tags: tag ? [tag] : [],
            ring,
            createdAt: `${src.createdAt}T09:00:00Z`,
          });
        }
        return zones;
      } catch {
        return [];
      }
    }),
  );
  return loaded.flat();
}

/* -------------------------------------------------------------------------- */
/* Regulations                                                                 */
/* -------------------------------------------------------------------------- */

const weekdays: Schedule["days"] = ["mon", "tue", "wed", "thu", "fri"];

/** Every parking bay in Baixa and Chiado in parking-zones-lisbon.csv. */
const BAIXA_BAYS = [
  "PZ-009", "PZ-021", "PZ-025", "PZ-028", "PZ-029", "PZ-030",
  "PZ-042", "PZ-045", "PZ-046", "PZ-053", "PZ-061", "PZ-064",
];

export const SAMPLE_REGULATIONS: Regulation[] = [
  {
    id: "reg-parking-baixa-chiado",
    name: "Parking · Baixa and Chiado",
    kind: "multi_parking",
    visibility: "private",
    deactivated: false,
    createdAt: "2026-09-12T10:31:54Z",
    global: { start: "2026-09-15" },
    rules: [
      {
        id: "rule-bays",
        type: "parking",
        name: "Parking bays",
        mode: "enforced",
        buffer: 10,
        zoneIds: BAIXA_BAYS,
        schedule: { ...ALL_DAY, start: "2026-09-15" },
        vehicles: ["scooter", "bike"],
        operators: [],
      },
      {
        id: "rule-no-parking-baixa",
        type: "no_parking",
        name: "No parking outside bays",
        buffer: -7,
        zoneIds: ["D-01", "D-03"],
        schedule: { ...ALL_DAY, start: "2026-09-15" },
        vehicles: [],
        operators: [],
      },
    ],
  },
  {
    id: "reg-speed-baixa",
    name: "Speed limit · Baixa",
    kind: "low_speed",
    visibility: "public",
    deactivated: false,
    createdAt: "2026-02-20T09:00:00Z",
    global: {},
    rules: [
      {
        id: "rule-speed-baixa",
        type: "low_speed",
        name: "15 km/h in the centre",
        value: 15,
        buffer: 10,
        zoneIds: ["SPD-001", "SPD-002", "SPD-003", "SPD-004", "SPD-005"],
        schedule: { ...ALL_DAY, start: "2026-03-01", end: "2026-12-31" },
        vehicles: [],
        operators: [],
      },
    ],
  },
  {
    id: "reg-no-parking-historic",
    name: "No parking · Historic centre",
    kind: "no_parking",
    visibility: "public",
    deactivated: false,
    createdAt: "2026-01-10T09:00:00Z",
    global: {},
    rules: [
      {
        id: "rule-npk",
        type: "no_parking",
        name: "Historic centre",
        buffer: -7,
        zoneIds: ["NPK-001", "NPK-002", "NPK-003", "NPK-004", "NPK-005", "NPK-006"],
        schedule: { ...ALL_DAY, start: "2026-01-15", end: "2027-01-14" },
        vehicles: [],
        operators: [],
      },
    ],
  },
  {
    id: "reg-cap-centre",
    name: "Fleet cap · Baixa and Avenidas Novas",
    kind: "cap",
    visibility: "public",
    deactivated: false,
    createdAt: "2026-05-18T09:00:00Z",
    global: {},
    rules: [
      {
        id: "rule-cap",
        type: "cap",
        name: "Fleet cap",
        value: 1694,
        buffer: -7,
        zoneIds: ["D-01", "D-07"],
        schedule: { ...ALL_DAY, start: "2026-06-01", end: "2026-12-31" },
        vehicles: [],
        operators: [],
      },
    ],
  },
  {
    id: "reg-slow-marques",
    name: "Slow zones · Marquês and Liberdade",
    kind: "low_speed",
    visibility: "private",
    deactivated: false,
    createdAt: "2026-06-03T14:12:00Z",
    global: {},
    rules: [
      {
        id: "rule-slow",
        type: "low_speed",
        name: "Weekday slow zones",
        value: 10,
        buffer: 10,
        zoneIds: ["PZ-001", "PZ-022", "PZ-060"],
        schedule: { allDay: false, from: "07:00", to: "20:00", days: weekdays, start: "2026-06-15", end: "2026-10-20" },
        vehicles: ["scooter", "moped"],
        operators: [],
      },
    ],
  },
  {
    id: "reg-parking-saldanha",
    name: "Parking · Saldanha and Alvalade",
    kind: "multi_parking",
    visibility: "private",
    deactivated: false,
    createdAt: "2026-09-28T16:40:00Z",
    global: { start: "2026-11-01" },
    rules: [
      {
        id: "rule-saldanha-parking",
        type: "parking",
        name: "Recommended areas",
        mode: "recommended",
        buffer: 10,
        zoneIds: ["PZ-004", "PZ-015", "PZ-017", "PZ-023", "PZ-027", "PZ-048"],
        schedule: { ...ALL_DAY, start: "2026-11-01" },
        vehicles: [],
        operators: [],
      },
    ],
  },
  {
    id: "reg-floor-nacoes",
    name: "Fleet floor · Parque das Nações",
    kind: "floor",
    visibility: "private",
    deactivated: false,
    createdAt: "2026-04-02T11:00:00Z",
    global: {},
    rules: [
      {
        id: "rule-floor",
        type: "floor",
        name: "Minimum service",
        value: 150,
        buffer: 0,
        zoneIds: ["D-06"],
        schedule: { ...ALL_DAY, start: "2026-04-15" },
        vehicles: ["bike"],
        operators: ["Gira"],
      },
    ],
  },
  {
    id: "reg-curfew-bairro-alto",
    name: "Night curfew · Nightlife areas",
    kind: "no_go",
    visibility: "public",
    deactivated: false,
    createdAt: "2025-05-20T09:00:00Z",
    global: {},
    rules: [
      {
        id: "rule-curfew",
        type: "no_go",
        name: "Summer nights",
        buffer: 0,
        zoneIds: ["CUR-001", "CUR-002", "CUR-003"],
        schedule: { allDay: false, from: "01:00", to: "06:00", days: [], start: "2025-06-01", end: "2025-09-30" },
        vehicles: [],
        operators: [],
      },
    ],
  },
];
