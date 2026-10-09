import {
  inferColumns,
  parseCsv,
  type InferredColumn,
  type ParsedCsv,
} from "@/registry/vianova/lib/csv";

/**
 * The fake Lisbon datasets, and how to read one onto a map.
 *
 * Shared because two blocks draw the same files and must agree about them. The
 * data hub lists and inspects them; the map workspace puts them on a map as
 * layers. Category styles are saved under `id`, so a colour or logo set in the
 * hub shows up on the map — which only works while both call the same dataset
 * by the same name. A second copy of this list would drift the first time
 * someone added a feed, and the symptom would be styles silently not applying.
 */

export type SampleSection = "data" | "zones" | "regulations";

export type SampleFeed = {
  /** The dataset's id. Category styles are saved under it. */
  id: string;
  file: string;
  /** Short name for a layer card or a list row. */
  title: string;
  section: SampleSection;
  description: string;
  rowRepresents: string;
  domain: string;
  uploadedAt: string;
  dateRange?: [string, string];
  /** Regulations only. */
  status?: "active" | "inactive";
  units?: Record<string, string>;
};

export const SAMPLE_FEEDS: SampleFeed[] = [
  {
    id: "sample-mds-lisbon",
    file: "mds-trips-lisbon.csv",
    title: "Trips (MDS)",
    section: "data",
    description:
      "Fake Mobility Data Specification trips for shared scooters and bikes in Lisbon, September 2026, from five operators.",
    rowRepresents: "a trip taken on a shared vehicle",
    domain: "micromobility",
    uploadedAt: "2026-10-01T09:00:00Z",
    dateRange: ["2026-09-01", "2026-09-30"],
    units: { trip_duration: "s", trip_distance: "m" },
  },
  {
    id: "sample-infringements-lisbon",
    file: "infringements-lisbon.csv",
    title: "Parking infringements",
    section: "data",
    description:
      "Fake parking infringements by shared scooters and bikes in Lisbon, September 2026: where a vehicle was left, what rule it broke and whether it was fined.",
    rowRepresents: "a parking infringement by a shared vehicle",
    domain: "micromobility",
    uploadedAt: "2026-10-02T09:00:00Z",
    dateRange: ["2026-09-01", "2026-09-30"],
    units: { fine_eur: "EUR" },
  },
  {
    id: "sample-mds-events-lisbon",
    file: "mds-events-lisbon.csv",
    title: "Vehicle events",
    section: "data",
    description:
      "Fake Mobility Data Specification vehicle events in Lisbon, September 2026: reservations, trip starts and ends, rebalancing, low batteries and maintenance.",
    rowRepresents: "a change in a vehicle's state",
    domain: "micromobility",
    uploadedAt: "2026-10-03T09:00:00Z",
    dateRange: ["2026-09-01", "2026-09-30"],
    units: { battery_pct: "%" },
  },
  {
    id: "sample-mds-vehicles-lisbon",
    file: "mds-vehicles-lisbon.csv",
    title: "Vehicle snapshot",
    section: "data",
    description:
      "Fake snapshot of every shared vehicle in Lisbon at the end of September 2026: where it is, who runs it and whether it can be rented.",
    rowRepresents: "a shared vehicle",
    domain: "micromobility",
    uploadedAt: "2026-10-01T00:00:00Z",
    units: { battery_pct: "%" },
  },
  {
    id: "sample-parking-zones-lisbon",
    file: "parking-zones-lisbon.csv",
    title: "Parking zones",
    section: "zones",
    description:
      "Fake parking bays, no-parking areas and slow zones for shared vehicles in Lisbon.",
    rowRepresents: "a zone",
    domain: "zones",
    uploadedAt: "2026-08-20T10:00:00Z",
    units: { speed_limit_kmh: "km/h" },
  },
  {
    id: "sample-districts-lisbon",
    file: "districts-lisbon.csv",
    title: "Districts",
    section: "zones",
    description:
      "Fake outlines of twelve Lisbon neighbourhoods, with the kind of area each is.",
    rowRepresents: "a neighbourhood",
    domain: "zones",
    uploadedAt: "2026-07-14T10:00:00Z",
  },
  {
    id: "sample-regulation-speed-limit",
    file: "regulation-speed-limit-baixa.csv",
    title: "Speed limit · Baixa",
    section: "regulations",
    status: "active",
    description: "Fake 15 km/h limit for shared vehicles in the centre of Lisbon.",
    rowRepresents: "an area the rule covers",
    domain: "regulations",
    uploadedAt: "2026-02-20T09:00:00Z",
  },
  {
    id: "sample-regulation-no-parking",
    file: "regulation-no-parking-historic-centre.csv",
    title: "No parking · Historic centre",
    section: "regulations",
    status: "active",
    description:
      "Fake parking restrictions in the historic centre: no parking, or bays only.",
    rowRepresents: "an area the rule covers",
    domain: "regulations",
    uploadedAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "sample-regulation-fleet-cap",
    file: "regulation-fleet-cap-per-operator.csv",
    title: "Fleet cap per operator",
    section: "regulations",
    status: "active",
    description: "Fake limit on how many vehicles each operator may leave in an area.",
    rowRepresents: "an operator's cap in an area",
    domain: "regulations",
    uploadedAt: "2026-05-18T09:00:00Z",
  },
  {
    id: "sample-regulation-night-curfew",
    file: "regulation-night-curfew-bairro-alto.csv",
    title: "Night curfew · Bairro Alto",
    section: "regulations",
    status: "inactive",
    description:
      "Fake summer night curfew for shared vehicles around Bairro Alto. No longer in force.",
    rowRepresents: "an area the rule covers",
    domain: "regulations",
    uploadedAt: "2025-05-20T09:00:00Z",
  },
];

/** What each column means, as a sentence, so the samples read like real feeds. */
export const SAMPLE_COLUMN_DESCRIPTIONS: Record<string, string> = {
  trip_id: "Unique identifier for the trip",
  provider_id: "Identifier of the operator that reported the record",
  provider_name: "Operator that runs the vehicle",
  device_id: "Identifier of the vehicle",
  vehicle_type: "Kind of vehicle: scooter, bike or moped",
  propulsion_types: "How the vehicle is powered",
  start_time: "When the trip began",
  end_time: "When the trip ended",
  trip_duration: "How long the trip lasted",
  trip_distance: "How far the vehicle travelled",
  route: "Path the vehicle took",
  infringement_id: "Unique identifier for the infringement",
  infringement_type: "Rule the parked vehicle broke",
  status: "Whether the infringement was fined, waived or is still open",
  fine_eur: "Amount charged",
  detected_at: "When the infringement was spotted",
  resolved_at: "When the infringement was closed",
  location: "Where the record happened",
  event_id: "Unique identifier for the event",
  event_type: "What changed about the vehicle",
  battery_pct: "Charge left in the battery",
  event_time: "When the event happened",
  state: "Whether the vehicle can be rented",
  last_event_time: "When the vehicle last changed state",
  zone_id: "Unique identifier for the zone",
  zone_type: "What the zone is for",
  max_vehicles: "How many vehicles the zone holds",
  speed_limit_kmh: "Speed ceiling inside the zone",
  district_id: "Unique identifier for the neighbourhood",
  area_type: "What kind of area the neighbourhood is",
  population: "People living there",
  name: "Display name",
  geometry: "Outline of the area",
  rule_id: "Unique identifier for the rule",
  area: "Area the rule covers",
  rule: "What the rule requires",
  applies_to: "Who or what the rule applies to",
  vehicle_cap: "How many vehicles are allowed",
  valid_from: "When the rule took effect",
  valid_to: "When the rule stops applying",
};

/**
 * Short names for the same columns.
 *
 * Separate from the descriptions because they do different jobs: a description
 * explains a column in a table, a label has to fit inside a select and read as
 * the thing you are colouring by. "Operator" works in a dropdown;
 * "Operator that runs the vehicle" does not.
 */
export const SAMPLE_COLUMN_LABELS: Record<string, string> = {
  provider_name: "Operator",
  provider_id: "Operator id",
  device_id: "Vehicle id",
  vehicle_type: "Vehicle type",
  propulsion_types: "Propulsion",
  trip_duration: "Trip duration",
  trip_distance: "Trip distance",
  start_time: "Start time",
  end_time: "End time",
  infringement_type: "Infringement",
  status: "Status",
  fine_eur: "Fine",
  detected_at: "Detected",
  resolved_at: "Resolved",
  event_type: "Event",
  battery_pct: "Battery",
  event_time: "Event time",
  state: "State",
  zone_type: "Zone type",
  max_vehicles: "Capacity",
  speed_limit_kmh: "Speed limit",
  area_type: "Area type",
  population: "Population",
  name: "Name",
  area: "Area",
  rule: "Rule",
  applies_to: "Applies to",
  vehicle_cap: "Vehicle cap",
  valid_from: "Valid from",
  valid_to: "Valid to",
};

/** Falls back to the raw column name, which is still better than nothing. */
export function columnLabel(name: string): string {
  return SAMPLE_COLUMN_LABELS[name] ?? name;
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

/** The first vertex of a WKT geometry: where a trip started, or the point itself. */
const FIRST_VERTEX = /\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;
/** Every longitude and latitude pair in a WKT geometry. */
const NUMBER_PAIR = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;

/** A map of this many points is already a blur; more would only cost memory. */
export const MAX_MAP_POINTS = 20_000;

/** A polygon needs four vertices to close: three corners and the repeat. */
const MIN_RING = 4;

export type SampleGeometry = "point" | "area" | "none";

/**
 * A parsed sample, kept in the shape the map needs.
 *
 * The rows are retained rather than converted once, because what the map draws
 * depends on choices made after loading: which column colours the layer, and
 * which rows a filter leaves. Re-deriving from rows is cheap; re-fetching is
 * not.
 */
export type ParsedSample = {
  header: string[];
  rows: string[][];
  columns: InferredColumn[];
  /** Index of the geometry column, or -1. */
  geometryAt: number;
  geometry: SampleGeometry;
};

const isPolygon = (cell: string) => /^\s*(MULTI)?POLYGON/i.test(cell);

/** Reads a WKT cell as a single position: the geometry's first vertex. */
export function firstPosition(cell: string): [number, number] | null {
  const m = FIRST_VERTEX.exec(cell);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Reads a WKT cell as an outer ring. Null when it is not a usable polygon. */
export function ringOf(cell: string): [number, number][] | null {
  const ring = [...cell.matchAll(NUMBER_PAIR)].map(
    (m) => [Number(m[1]), Number(m[2])] as [number, number],
  );
  return ring.length >= MIN_RING ? ring : null;
}

export function parseSample(text: string): ParsedSample | null {
  const parsed = parseCsv(text);
  if (!parsed.header.length || !parsed.rows.length) return null;
  const columns = inferColumns(parsed);
  const geometryAt = columns.findIndex((c) => c.type === "geometry");

  return {
    header: parsed.header,
    rows: parsed.rows,
    columns,
    geometryAt,
    geometry: geometryOf(parsed, geometryAt),
  };
}

/**
 * Whether the file draws as areas or as points.
 *
 * Decided from the first row that has a geometry at all, not from the column's
 * name or the file's: a regulation and a district both call the column
 * `geometry` and both hold polygons, while trips call theirs `route` and
 * infringements `location`.
 */
function geometryOf(parsed: ParsedCsv, geometryAt: number): SampleGeometry {
  if (geometryAt < 0) return "none";
  for (const row of parsed.rows) {
    const cell = row[geometryAt] ?? "";
    if (!cell.trim()) continue;
    return isPolygon(cell) ? "area" : "point";
  }
  return "none";
}

/**
 * The column a layer is coloured by until someone picks another.
 *
 * The first category column that actually varies. A column with one value
 * paints the whole layer one colour, which tells you nothing and looks like a
 * bug.
 */
export function defaultCategoryColumn(sample: ParsedSample): string | undefined {
  const varies = sample.columns.find(
    (c) => c.type === "category" && (c.values?.length ?? 0) > 1,
  );
  return (varies ?? sample.columns.find((c) => c.type === "category"))?.name;
}

/** Row indices that pass `keep`, or every row when there is no filter. */
export type RowPredicate = (row: Record<string, string>) => boolean;

function* geometryRows(sample: ParsedSample, keep?: RowPredicate) {
  if (sample.geometryAt < 0) return;
  for (const row of sample.rows) {
    const cell = row[sample.geometryAt] ?? "";
    if (!cell.trim()) continue;
    if (keep && !keep(Object.fromEntries(sample.header.map((h, i) => [h, row[i] ?? ""]))))
      continue;
    yield { row, cell };
  }
}

/** Points for a layer coloured by `column`, capped at MAX_MAP_POINTS. */
export function pointsBy(
  sample: ParsedSample,
  column: string | undefined,
  keep?: RowPredicate,
) {
  const at = column ? sample.header.indexOf(column) : -1;
  const points: { position: [number, number]; category: string }[] = [];
  for (const { row, cell } of geometryRows(sample, keep)) {
    const position = firstPosition(cell);
    if (!position) continue;
    points.push({ position, category: at >= 0 ? (row[at] ?? "") : "" });
    if (points.length >= MAX_MAP_POINTS) break;
  }
  return points;
}

/** Outer rings for a layer coloured by `column`. */
export function shapesBy(
  sample: ParsedSample,
  column: string | undefined,
  keep?: RowPredicate,
) {
  const at = column ? sample.header.indexOf(column) : -1;
  const shapes: { ring: [number, number][]; category: string }[] = [];
  for (const { row, cell } of geometryRows(sample, keep)) {
    const ring = ringOf(cell);
    if (!ring) continue;
    shapes.push({ ring, category: at >= 0 ? (row[at] ?? "") : "" });
  }
  return shapes;
}

/** Every value of `column`, as numbers, for a ramp's domain. */
export function numbersIn(sample: ParsedSample, column: string): number[] {
  const at = sample.header.indexOf(column);
  if (at < 0) return [];
  const out: number[] = [];
  for (const row of sample.rows) {
    const cell = row[at];
    // Blank first: Number("") is 0, not NaN, so an empty cell would otherwise
    // enter the domain as a real zero and drag the whole ramp down with it.
    if (!cell?.trim()) continue;
    const n = Number(cell);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}
