"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartPie,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Database,
  FilePlus2,
  Gauge,
  GripHorizontal,
  Grid3x3,
  Hash,
  ListFilter,
  ListOrdered,
  MoreHorizontal,
  Pentagon,
  Plus,
  Search,
  Table2,
  Trash2,
  TriangleAlert,
  Type,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  GridLayout,
  getCompactor,
  useContainerWidth,
  type Layout,
} from "react-grid-layout";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import { Avatar, AvatarFallback } from "@/registry/vianova/ui/avatar";
import { Button } from "@/registry/vianova/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/registry/vianova/ui/chart";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/vianova/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import { Label } from "@/registry/vianova/ui/label";
import { Popover, PopoverContent } from "@/registry/vianova/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";
import { Textarea } from "@/registry/vianova/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/vianova/ui/toggle-group";
import { ConfirmDialog } from "@/registry/vianova/patterns/confirm-dialog";
import { ActivityHeatmap } from "@/registry/vianova/product/activity-heatmap";
import { downloadFile, toCsv } from "@/registry/vianova/product/export-menu";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/registry/vianova/product/markdown-editor";
import {
  STYLE_STORAGE_KEY,
  readStyleSet,
  resolveStyles,
  type CategoryStyle,
  type CategoryStyleSet,
} from "@/registry/vianova/lib/category-style";
import { inferColumns, parseCsv } from "@/registry/vianova/lib/csv";
import {
  WEEKDAY_LABELS,
  byProvider,
  change,
  dailySeries,
  daysBetween,
  filterTrips,
  measure,
  previousPeriod,
  readTrips,
  weekHourGrid,
  type Metric,
  type Trip,
  type TripFilter,
  type Zone,
} from "@/registry/vianova/lib/trip-report";
import {
  GRID_COLUMNS,
  firstFit,
  moveTo,
  overlaps as overlapsRect,
  pack,
  readingOrder,
  resizeTo,
  roomAt,
  rowCount,
  type Rect,
} from "@/registry/vianova/lib/report-grid";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node. The
 * expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM, because
 * Next substitutes that exact text at build time.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * The same Lisbon trips the data hub ships as a sample. Operator colours and
 * logos are read from the styles saved there, under this dataset id and column,
 * so an operator is the same colour in the hub, on the map and in a report.
 */
const DEFAULT_TRIPS_URL = `${BASE_PATH}/data/mds-trips-lisbon.csv`;
const TRIPS_DATASET = "sample-mds-lisbon";
const TRIPS_COLUMN = "provider_name";
const SOURCE = "Lisbon MDS trips";

/** The sample feed holds September 2026 only, so every period sits inside it. */
const PERIODS = {
  sep: { label: "September 2026", from: "2026-09-01", to: "2026-09-30" },
  w39: { label: "Week of 21 Sep", from: "2026-09-21", to: "2026-09-27" },
  w38: { label: "Week of 14 Sep", from: "2026-09-14", to: "2026-09-20" },
  w37: { label: "Week of 7 Sep", from: "2026-09-07", to: "2026-09-13" },
  h2: { label: "16 to 30 Sep", from: "2026-09-16", to: "2026-09-30" },
} as const;
type PeriodKey = keyof typeof PERIODS;

const SLICES: Record<
  string,
  { label: string; days?: "work" | "weekend"; hours?: [number, number] }
> = {
  all: { label: "All days and hours" },
  work: { label: "Work days", days: "work" },
  weekend: { label: "Weekend", days: "weekend" },
  morning: { label: "Morning, 06–12h", hours: [6, 12] },
  afternoon: { label: "Afternoon, 12–18h", hours: [12, 18] },
  night: { label: "Night, 22–06h", hours: [22, 6] },
};
type SliceKey = keyof typeof SLICES;

/** Circles over central Lisbon, each holding a hundred or more of the sample's trips. */
const ZONES: Record<string, { label: string; zone?: Zone }> = {
  all: { label: "All zones" },
  baixa: {
    label: "Baixa-Chiado",
    zone: { center: [-9.139, 38.711], radiusM: 1200 },
  },
  arroios: {
    label: "Arroios",
    zone: { center: [-9.133, 38.728], radiusM: 1200 },
  },
  avenidas: {
    label: "Avenidas Novas",
    zone: { center: [-9.147, 38.737], radiusM: 1200 },
  },
  alvalade: {
    label: "Alvalade",
    zone: { center: [-9.142, 38.752], radiusM: 1200 },
  },
  ourique: {
    label: "Campo de Ourique",
    zone: { center: [-9.165, 38.718], radiusM: 1200 },
  },
  nacoes: {
    label: "Parque das Nações",
    zone: { center: [-9.095, 38.763], radiusM: 1200 },
  },
};
type ZoneKey = keyof typeof ZONES;

type Filters = {
  period: PeriodKey;
  slice: SliceKey;
  zone: ZoneKey;
  /** Also show the same filters over the period just before. */
  compare: boolean;
};

const DEFAULT_FILTERS: Filters = {
  period: "sep",
  slice: "all",
  zone: "all",
  compare: false,
};

const tripFilter = (f: Filters): TripFilter => ({
  from: PERIODS[f.period].from,
  to: PERIODS[f.period].to,
  days: SLICES[f.slice]?.days,
  hours: SLICES[f.slice]?.hours,
  zone: ZONES[f.zone]?.zone,
});

const METRICS: Record<
  Metric,
  { label: string; unit?: string; digits: number }
> = {
  trips: { label: "Number of trips", digits: 0 },
  vehicles: { label: "Fleet size", digits: 0 },
  distance: { label: "Average trip distance", unit: "km", digits: 2 },
  duration: { label: "Median trip duration", unit: "min", digits: 1 },
};

/* -------------------------------------------------------------------------- */
/* Widgets                                                                     */
/* -------------------------------------------------------------------------- */

type SeriesStyle = "line" | "bar" | "table";
/** "#" shows values, "%" each value's share, "#%" values with their share. */
type Display = "value" | "percent" | "both";

/** What a widget draws, before it has a place on the canvas. */
type WidgetSpec =
  | {
      kind: "series";
      title: string;
      metric: Metric;
      /** One line or stack per operator, rather than one total. */
      byOperator: boolean;
      style: SeriesStyle;
      display: Display;
    }
  | { kind: "kpi"; title: string; metric: Metric }
  | { kind: "barlist"; title: string }
  | { kind: "donut"; title: string }
  | { kind: "matrix"; title: string }
  | { kind: "summary"; title: string }
  /** Its heading is the first line of the Markdown, so it has no title of its own. */
  | { kind: "text"; markdown: string };

/** A widget on the canvas: what it draws, and the cells it covers. */
export type Widget = WidgetSpec & { id: string; layout: Rect };

/** What a widget looks like, which is how the library files it. */
type ChartType =
  "line" | "bar" | "table" | "kpi" | "barlist" | "donut" | "matrix" | "text";

const typeOf = (w: WidgetSpec): ChartType =>
  w.kind === "series" ? w.style : w.kind === "summary" ? "table" : w.kind;

/** The heading of a text widget, for menus and screen readers. */
const textName = (markdown: string) =>
  markdown
    .split("\n")
    .find((l) => l.trim())
    ?.replace(/^#+\s*/, "")
    .trim() || "Text";

const nameOf = (w: WidgetSpec) =>
  w.kind === "text" ? textName(w.markdown) : w.title || "Untitled";

const CHART_TYPES: Array<Exclude<ChartType, "text">> = [
  "line",
  "bar",
  "table",
  "kpi",
  "barlist",
  "donut",
  "matrix",
];

const TYPE_LABELS: Record<Exclude<ChartType, "text">, string> = {
  line: "Line",
  bar: "Bar",
  table: "Table",
  kpi: "KPI",
  barlist: "Barlist",
  donut: "Donut",
  matrix: "Matrix",
};

const TYPE_ICON: Record<
  ChartType,
  React.ComponentType<{ className?: string }>
> = {
  line: ChartLine,
  bar: ChartColumnStacked,
  table: Table2,
  kpi: Gauge,
  barlist: ListOrdered,
  donut: ChartPie,
  matrix: Grid3x3,
  text: Type,
};

/**
 * The smallest a widget may be resized to. A chart needs two rows for an axis
 * and a header; a KPI or a heading reads in one.
 */
const minCells = (w: WidgetSpec) =>
  w.kind === "text"
    ? { w: 2, h: 1 }
    : w.kind === "kpi"
      ? { w: 2, h: 1 }
      : { w: 3, h: 2 };

let nextId = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${++nextId}`;

type Template = {
  id: string;
  spec: WidgetSpec;
  cells: { w: number; h: number };
};

/**
 * What "Add charts" and the in-cell picker offer, each with the cells it asks
 * for. A chart is 4 by 2, as in the product; a time series reads better wide.
 */
const LIBRARY: Template[] = [
  {
    id: "lib-trips-operator",
    cells: { w: 12, h: 2 },
    spec: {
      kind: "series",
      title: "Trips over time per operator",
      metric: "trips",
      byOperator: true,
      style: "line",
      display: "value",
    },
  },
  {
    id: "lib-trips",
    cells: { w: 4, h: 2 },
    spec: {
      kind: "series",
      title: "Number of trips over time",
      metric: "trips",
      byOperator: false,
      style: "line",
      display: "value",
    },
  },
  {
    id: "lib-fleet",
    cells: { w: 4, h: 2 },
    spec: {
      kind: "series",
      title: "Fleet size over time",
      metric: "vehicles",
      byOperator: false,
      style: "line",
      display: "value",
    },
  },
  {
    id: "lib-distance",
    cells: { w: 4, h: 2 },
    spec: {
      kind: "series",
      title: "Average trip distance over time",
      metric: "distance",
      byOperator: false,
      style: "line",
      display: "value",
    },
  },
  {
    id: "lib-duration-operator",
    cells: { w: 12, h: 2 },
    spec: {
      kind: "series",
      title: "Median trip duration per operator",
      metric: "duration",
      byOperator: true,
      style: "line",
      display: "value",
    },
  },
  {
    id: "lib-trips-day",
    cells: { w: 12, h: 2 },
    spec: {
      kind: "series",
      title: "Trips by day by operator",
      metric: "trips",
      byOperator: true,
      style: "bar",
      display: "value",
    },
  },
  {
    id: "lib-share-day",
    cells: { w: 12, h: 2 },
    spec: {
      kind: "series",
      title: "Operator share by day",
      metric: "trips",
      byOperator: true,
      style: "bar",
      display: "percent",
    },
  },
  {
    id: "lib-summary",
    cells: { w: 12, h: 3 },
    spec: { kind: "summary", title: "Daily summary" },
  },
  {
    id: "lib-kpi-trips",
    cells: { w: 4, h: 2 },
    spec: { kind: "kpi", title: "Total trips", metric: "trips" },
  },
  {
    id: "lib-kpi-fleet",
    cells: { w: 4, h: 2 },
    spec: { kind: "kpi", title: "Vehicles in use", metric: "vehicles" },
  },
  {
    id: "lib-kpi-distance",
    cells: { w: 4, h: 2 },
    spec: { kind: "kpi", title: "Average trip distance", metric: "distance" },
  },
  {
    id: "lib-barlist",
    cells: { w: 6, h: 2 },
    spec: { kind: "barlist", title: "Trips by operator" },
  },
  {
    id: "lib-donut",
    cells: { w: 6, h: 2 },
    spec: { kind: "donut", title: "Trips by vehicle type" },
  },
  {
    id: "lib-matrix",
    cells: { w: 12, h: 2 },
    spec: { kind: "matrix", title: "Trips by weekday and hour" },
  },
];

const templateOf = (id: string) => LIBRARY.find((t) => t.id === id)!;

/** A new text widget's starting content, as the product seeds it. */
const TEXT_SEED = "## Section title\n\nDescribe what this section shows";

/** Lays templates out in order, each in the first spot it fits. */
function layOut(
  items: Array<{ spec: WidgetSpec; cells: { w: number; h: number } }>,
): Widget[] {
  const rects = pack(items.map((i) => i.cells));
  return items.map((i, k) => ({
    ...i.spec,
    id: newId("w"),
    layout: rects[k]!,
  }));
}

const place = (...ids: string[]) => layOut(ids.map(templateOf));

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export type Person = { name: string; email: string };

export type Report = {
  id: string;
  title: string;
  creator: Person;
  createdAt: string;
  updatedAt: string;
  filters: Filters;
  widgets: Widget[];
};

const ANA: Person = {
  name: "Ana Ribeiro",
  email: "ana.ribeiro@lisboa.example",
};
const TOMAS: Person = {
  name: "Tomás Costa",
  email: "tomas.costa@lisboa.example",
};
const INES: Person = {
  name: "Inês Martins",
  email: "ines.martins@lisboa.example",
};

const SAMPLE_REPORTS: Report[] = [
  {
    id: "operator-performance",
    title: "Operator performance",
    creator: ANA,
    createdAt: "2026-10-01T07:12:40Z",
    updatedAt: "2026-10-02T09:41:05Z",
    filters: DEFAULT_FILTERS,
    widgets: place(
      "lib-trips-operator",
      "lib-trips",
      "lib-fleet",
      "lib-distance",
      "lib-trips-day",
      "lib-summary",
      "lib-duration-operator",
    ),
  },
  {
    id: "fleet-overview",
    title: "Fleet overview",
    creator: TOMAS,
    createdAt: "2026-09-29T14:03:11Z",
    updatedAt: "2026-10-03T16:20:52Z",
    filters: { ...DEFAULT_FILTERS, period: "w39", compare: true },
    widgets: place(
      "lib-kpi-trips",
      "lib-kpi-fleet",
      "lib-kpi-distance",
      "lib-barlist",
      "lib-donut",
      "lib-trips",
    ),
  },
  {
    id: "night-riding",
    title: "Night riding",
    creator: INES,
    createdAt: "2026-09-24T10:30:00Z",
    updatedAt: "2026-09-24T11:02:18Z",
    filters: { ...DEFAULT_FILTERS, slice: "night" },
    widgets: layOut([
      {
        spec: {
          kind: "text",
          markdown:
            "## Trips between 22:00 and 06:00\n\nFor the council's **night-time safety review**. Hours are Lisbon time.",
        },
        cells: { w: 12, h: 1 },
      },
      ...["lib-kpi-trips", "lib-barlist", "lib-matrix"].map(templateOf),
    ]),
  },
  {
    id: "baixa-chiado",
    title: "Baixa-Chiado",
    creator: ANA,
    createdAt: "2026-09-18T08:45:27Z",
    updatedAt: "2026-09-30T17:11:43Z",
    filters: { ...DEFAULT_FILTERS, zone: "baixa" },
    widgets: place("lib-trips-day", "lib-fleet", "lib-donut"),
  },
];

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
/**
 * A moment in the viewer's own time zone. The page is rendered ahead of time
 * in UTC, so the text differs once it reaches a browser in Lisbon or New York;
 * the mismatch is expected, and this tells React so rather than letting it
 * throw away and rebuild the whole table.
 */
function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {dateTimeFormat.format(new Date(iso))}
    </time>
  );
}

const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "medium",
});
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const LONG_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// By hand rather than Intl: these are calendar days, not instants, so no
// viewer's time zone should be able to move them.
const parts = (day: string) => ({
  d: Number(day.slice(8, 10)),
  m: Number(day.slice(5, 7)) - 1,
  y: Number(day.slice(0, 4)),
  weekday: (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7,
});
const shortDay = (day: string) => `${MONTHS[parts(day).m]} ${parts(day).d}`;
const axisDay = (day: string) => `${shortDay(day)}, ${parts(day).y}`;
const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
/** "Wednesday, September 3rd, 2026", as the product's tooltips read. */
const longDay = (day: string) => {
  const p = parts(day);
  return `${LONG_DAYS[p.weekday]}, ${LONG_MONTHS[p.m]} ${ordinal(p.d)}, ${p.y}`;
};
const tableDay = (day: string) =>
  `${parts(day).d} ${MONTHS[parts(day).m]} ${parts(day).y}`;
const rangeLabel = (from: string, to: string) =>
  `${shortDay(from)} to ${shortDay(to)}`;

function formatMetric(value: number, metric: Metric) {
  const { digits, unit } = METRICS[metric];
  const n = new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
  return unit ? `${n} ${unit}` : n;
}

const formatPercent = (v: number) => `${v.toFixed(1)}%`;

/* -------------------------------------------------------------------------- */
/* Trips                                                                       */
/* -------------------------------------------------------------------------- */

type TripsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; trips: Trip[]; providers: string[] };

/**
 * Fetched once for every report: they all read the same feed, and 700KB of CSV
 * has no business in the JavaScript payload.
 */
function useTrips(url: string) {
  const [state, setState] = React.useState<TripsState>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(url, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
      )
      .then((text) => {
        const parsed = parseCsv(text);
        const trips = readTrips(parsed);
        if (trips.length === 0) throw new Error("No trips in the feed");
        // Same inference the data hub runs, so operators come out in the same
        // order and an unstyled one gets the same palette colour there and here.
        const by = parsed.header.indexOf(TRIPS_COLUMN);
        const providers = inferColumns(parsed)[by]?.values ?? [];
        setState({ status: "ready", trips, providers });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [url, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}

/** Styles someone set in the data hub, kept current when another tab changes them. */
function useOperatorStyles() {
  const [saved, setSaved] = React.useState<CategoryStyleSet | undefined>();
  // Read after mount, never in the initial state: the server has no storage.
  React.useEffect(() => {
    const read = () => setSaved(readStyleSet(TRIPS_DATASET, TRIPS_COLUMN));
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STYLE_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return saved;
}

/** Everything a widget draws from, filtered once per report rather than per widget. */
type ReportData = {
  status: TripsState["status"];
  trips: Trip[];
  days: string[];
  /** The period before, under the same filters. Null when not comparing. */
  previous: { trips: Trip[]; days: string[] } | null;
  providers: string[];
  styles: Record<string, CategoryStyle>;
};

function useReportData(
  state: TripsState,
  filters: Filters,
  styles: Record<string, CategoryStyle>,
): ReportData {
  return React.useMemo(() => {
    const f = tripFilter(filters);
    const days = daysBetween(f.from, f.to);
    if (state.status !== "ready") {
      return {
        status: state.status,
        trips: [],
        days,
        previous: null,
        providers: [],
        styles,
      };
    }
    const prev = previousPeriod(f);
    return {
      status: "ready",
      trips: filterTrips(state.trips, f),
      days,
      previous: filters.compare
        ? {
            trips: filterTrips(state.trips, prev),
            days: daysBetween(prev.from, prev.to),
          }
        : null,
      providers: state.providers,
      styles,
    };
  }, [state, filters, styles]);
}

/* -------------------------------------------------------------------------- */
/* Widget bodies                                                               */
/* -------------------------------------------------------------------------- */

type Column = {
  id: string;
  label: string;
  type: "date" | "number";
  format?: (value: unknown, row: Record<string, unknown>) => string;
};

const PAGE_SIZE = 7;

/**
 * A sortable, paged table: the daily summary, and any series shown as a table.
 * Sorting is on the raw values, never on the formatted strings.
 */
function WidgetTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: Record<string, unknown>[];
}) {
  const [sort, setSort] = React.useState<{ id: string; dir: "asc" | "desc" }>({
    id: columns[0]!.id,
    dir: "desc",
  });
  const [page, setPage] = React.useState(0);

  const sorted = React.useMemo(
    () =>
      [...rows].sort((a, b) => {
        const x = a[sort.id];
        const y = b[sort.id];
        const c =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? c : -c;
      }),
    [rows, sort],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => {
              const Icon = c.type === "date" ? Calendar : Hash;
              const active = sort.id === c.id;
              const SortIcon = !active
                ? ArrowUpDown
                : sort.dir === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <TableHead
                  key={c.id}
                  aria-sort={
                    active
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) => ({
                        id: c.id,
                        dir: s.id === c.id && s.dir === "desc" ? "asc" : "desc",
                      }))
                    }
                    className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1.5 rounded px-1 font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Icon
                      className="text-muted-foreground size-3.5"
                      aria-hidden
                    />
                    {c.label}
                    <SortIcon
                      className={cn("size-3", !active && "opacity-50")}
                      aria-hidden
                    />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((r, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  className="whitespace-nowrap tabular-nums"
                >
                  {c.format ? c.format(r[c.id], r) : String(r[c.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <nav
          aria-label="Table pages"
          className="flex items-center justify-center gap-2 text-sm"
        >
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums" aria-live="polite">
            Page {current + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

type SeriesWidget = Extract<WidgetSpec, { kind: "series" }>;

/**
 * The rows a series widget draws, which are also what its CSV holds. Keys are
 * s0, s1 ... rather than operator names: a key becomes a CSS variable, and an
 * operator called "Bird Rides" would not make a valid one.
 *
 * Per series i: `s` is what is plotted, `v` the value and `p` its share.
 */
function seriesRows(w: SeriesWidget, data: ReportData) {
  const groups = w.byOperator ? data.providers : null;
  const names = groups ?? [METRICS[w.metric].label];
  const series = dailySeries(data.trips, data.days, w.metric, groups);
  const prev =
    // No line at all beats a flat one at zero for a period with no trips.
    data.previous?.trips.length && !w.byOperator
      ? dailySeries(data.previous.trips, data.previous.days, w.metric, null)
      : null;
  // A share only means something for counts. A share of a median is nonsense,
  // so averages keep showing their values whatever Display says.
  const shareable = w.metric === "trips" || w.metric === "vehicles";
  const periodTotal = series.reduce(
    (s, d) => s + d.values.reduce((a, b) => a + b, 0),
    0,
  );

  const rows = series.map(({ day, values }, i) => {
    const dayTotal = values.reduce((a, b) => a + b, 0);
    const row: Record<string, number | string | null> = {
      day,
      total: dayTotal,
    };
    values.forEach((v, k) => {
      const base = w.byOperator ? dayTotal : periodTotal;
      const share = base ? (v / base) * 100 : 0;
      row[`s${k}`] = w.display === "percent" && shareable ? share : v;
      row[`v${k}`] = v;
      row[`p${k}`] = share;
    });
    // Aligned by position: day 1 of this period against day 1 of the last.
    if (prev) row.prev = prev[i]?.values[0] ?? null;
    return row;
  });

  return { rows, names, shareable, compared: !!prev };
}

/** An element's size, for charts that change what they show as their card shrinks. */
function useSize<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e!.contentRect.width, height: e!.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type SeriesKey = { key: string; label: string; color?: string };

/**
 * A legend that is also a control: click a series to hide it, point at one to
 * bring it forward. Hiding the last visible series is refused, so a chart is
 * never left empty by accident.
 */
function SeriesLegend({
  items,
  hidden,
  onToggle,
  onHover,
}: {
  items: SeriesKey[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  return (
    <ul className="draggable-cancel flex shrink-0 flex-wrap justify-center gap-x-1 gap-y-0.5 pt-1.5 text-xs">
      {items.map((s) => {
        const shown = !hidden.has(s.key);
        return (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={shown}
              title={shown ? `Hide ${s.label}` : `Show ${s.label}`}
              onClick={() => onToggle(s.key)}
              onMouseEnter={() => onHover(s.key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.key)}
              onBlur={() => onHover(null)}
              className={cn(
                "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                shown
                  ? "text-foreground/80 hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted line-through opacity-60",
              )}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: s.color }}
              />
              {s.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type TooltipRow = {
  key: string;
  label: string;
  color?: string;
  text: string;
  value: number;
};

/**
 * The product's tooltip: the full date, then each series largest first, with
 * a total when the series add up to something.
 */
function SeriesTooltip({
  day,
  rows,
  total,
  previous,
}: {
  day: string;
  rows: TooltipRow[];
  total?: string;
  previous?: string;
}) {
  return (
    <div className="bg-popover text-popover-foreground min-w-44 rounded-lg px-2.5 py-2 text-xs shadow-lg ring-1 ring-foreground/10">
      <p className="mb-1.5 font-medium">{longDay(day)}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: r.color }}
              />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="font-mono font-medium tabular-nums">{r.text}</span>
          </li>
        ))}
      </ul>
      {total ? (
        <p className="mt-1.5 flex justify-between gap-4 border-t pt-1.5">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-medium tabular-nums">{total}</span>
        </p>
      ) : null}
      {previous ? (
        <p className="text-muted-foreground mt-1 flex justify-between gap-4">
          <span>Previous period</span>
          <span className="font-mono tabular-nums">{previous}</span>
        </p>
      ) : null}
    </div>
  );
}

function SeriesBody({
  widget: w,
  data,
  preview,
}: {
  widget: SeriesWidget;
  data: ReportData;
  preview?: boolean;
}) {
  const { rows, names, shareable, compared } = React.useMemo(
    () => seriesRows(w, data),
    [w, data],
  );
  const percent = w.display === "percent" && shareable;
  const both = w.display === "both" && shareable;
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [focus, setFocus] = React.useState<string | null>(null);
  const [boxRef, box] = useSize<HTMLDivElement>();
  const gradient = `area-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const series: SeriesKey[] = React.useMemo(
    () =>
      names.map((n, i) => ({
        key: `s${i}`,
        label: n,
        color: w.byOperator
          ? (data.styles[n]?.color ?? "var(--chart-1)")
          : "var(--chart-1)",
      })),
    [names, w.byOperator, data.styles],
  );
  const config = React.useMemo(() => {
    const c: ChartConfig = Object.fromEntries(
      series.map((s) => [s.key, { label: s.label, color: s.color }]),
    );
    if (compared)
      c.prev = { label: "Previous period", color: "var(--muted-foreground)" };
    return c;
  }, [series, compared]);

  const valueText = (row: Record<string, unknown>, k: number) => {
    if (percent) return formatPercent(Number(row[`p${k}`]));
    const text = formatMetric(Number(row[`v${k}`]), w.metric);
    return both ? `${text} (${formatPercent(Number(row[`p${k}`]))})` : text;
  };

  if (w.style === "table") {
    const columns: Column[] = [
      {
        id: "day",
        label: "Date",
        type: "date",
        format: (v) => tableDay(String(v)),
      },
      ...names.map((n, i): Column => ({
        id: `s${i}`,
        label: n,
        type: "number",
        format: (_, row) => valueText(row, i),
      })),
    ];
    return <WidgetTable columns={columns} rows={rows} />;
  }

  // What the card has room for. A small card drops the legend and the y axis
  // before it squeezes the plot into a sliver.
  const multi = series.length > 1;
  const narrow = !preview && box.width > 0 && box.width < 360;
  const short = !preview && box.height > 0 && box.height < 150;
  const showLegend = multi && !preview && !short;
  const showY = !short;
  const visible = series.filter((s) => !hidden.has(s.key));
  const topKey = visible[visible.length - 1]?.key;
  const plotWidth = Math.max(0, box.width - 48);
  const labelsFit =
    !preview && !percent && rows.length > 0 && plotWidth / rows.length >= 26;
  const yMax = Math.max(
    0,
    ...rows.map((r) => visible.reduce((s, v) => s + Number(r[v.key] ?? 0), 0)),
  );
  const yWidth = percent
    ? 44
    : Math.max(28, compact.format(yMax).length * 7 + 12);
  const dim = (key: string) => (focus && focus !== key ? 0.2 : 1);

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key);
      return next;
    });

  const tooltip = (
    <ChartTooltip
      cursor={
        w.style === "bar"
          ? { fill: "var(--muted)", opacity: 0.6 }
          : {
              stroke: "var(--muted-foreground)",
              strokeDasharray: "4 4",
              strokeOpacity: 0.6,
            }
      }
      content={(props) => {
        const row = props.payload?.[0]?.payload as
          Record<string, unknown> | undefined;
        if (!props.active || !row) return null;
        const items: TooltipRow[] = visible
          .map((s) => {
            const k = Number(s.key.slice(1));
            return {
              key: s.key,
              label: s.label,
              color: s.color,
              value: Number(row[`v${k}`] ?? 0),
              text: valueText(row, k),
            };
          })
          .sort((a, b) => b.value - a.value);
        const sum = items.reduce((s, r) => s + r.value, 0);
        return (
          <SeriesTooltip
            day={String(row.day)}
            rows={items}
            total={
              multi && shareable && !percent
                ? formatMetric(sum, w.metric)
                : undefined
            }
            previous={
              compared && row.prev != null
                ? formatMetric(Number(row.prev), w.metric)
                : undefined
            }
          />
        );
      }}
    />
  );

  const xAxis = (
    <XAxis
      dataKey="day"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={preview || narrow ? 32 : 56}
      interval="preserveStartEnd"
      tickFormatter={(d: string) =>
        w.style === "bar" || narrow || preview ? shortDay(d) : axisDay(d)
      }
    />
  );
  const yAxis = showY ? (
    <YAxis
      tickLine={false}
      axisLine={false}
      width={yWidth}
      tickCount={short || preview ? 3 : 5}
      // A fleet barely moves day to day; from zero its line would be flat.
      domain={
        percent
          ? [0, 100]
          : w.metric === "vehicles"
            ? ["auto", "auto"]
            : [0, "auto"]
      }
      tickFormatter={(v: number) => (percent ? `${v}%` : compact.format(v))}
    />
  ) : (
    <YAxis
      hide
      domain={
        percent
          ? [0, 100]
          : w.metric === "vehicles"
            ? ["auto", "auto"]
            : [0, "auto"]
      }
    />
  );
  const grid = <CartesianGrid vertical={false} strokeDasharray="3 3" />;
  const legend = showLegend ? (
    <SeriesLegend
      items={series}
      hidden={hidden}
      onToggle={toggle}
      onHover={setFocus}
    />
  ) : null;

  const chart =
    w.style === "bar" ? (
      <BarChart
        data={rows}
        margin={{ top: labelsFit ? 18 : 6, right: 4, left: 0, bottom: 0 }}
        barCategoryGap="18%"
      >
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            hide={hidden.has(s.key)}
            fill={`var(--color-${s.key})`}
            fillOpacity={dim(s.key)}
            maxBarSize={36}
            // Only the stack's top is rounded, whichever series is on top now.
            radius={s.key === topKey ? [4, 4, 0, 0] : 0}
            isAnimationActive={!preview}
          >
            {s.key === topKey && labelsFit ? (
              <LabelList
                dataKey={(r: Record<string, number>) =>
                  visible.reduce((t, v) => t + Number(r[v.key] ?? 0), 0)
                }
                position="top"
                className="fill-muted-foreground"
                fontSize={10}
                formatter={(v: unknown) => compact.format(Number(v))}
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    ) : (
      <ComposedChart
        data={rows}
        margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-s0)" stopOpacity={0.32} />
            <stop
              offset="100%"
              stopColor="var(--color-s0)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        {grid}
        {xAxis}
        {yAxis}
        {tooltip}
        {multi ? (
          series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              hide={hidden.has(s.key)}
              stroke={`var(--color-${s.key})`}
              strokeWidth={focus === s.key ? 2.75 : 2}
              strokeOpacity={dim(s.key)}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={!preview}
            />
          ))
        ) : (
          <Area
            dataKey="s0"
            type="monotone"
            stroke="var(--color-s0)"
            strokeWidth={2}
            fill={`url(#${gradient})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={!preview}
          />
        )}
        {compared ? (
          <Line
            dataKey="prev"
            type="monotone"
            stroke="var(--color-prev)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            connectNulls
          />
        ) : null}
      </ComposedChart>
    );

  return (
    <div
      ref={boxRef}
      className={cn(
        "flex min-h-0 w-full flex-col",
        preview ? "h-36" : "h-full min-h-28",
      )}
    >
      <ChartContainer
        config={config}
        className="aspect-auto min-h-0 w-full flex-1"
      >
        {chart}
      </ChartContainer>
      {legend}
    </div>
  );
}

function summaryRows(data: ReportData) {
  const of = (m: Metric) => dailySeries(data.trips, data.days, m, null);
  const fleet = of("vehicles");
  const trips = of("trips");
  const distance = of("distance");
  const duration = of("duration");
  return data.days.map((day, i) => ({
    day,
    vehicles: fleet[i]!.values[0]!,
    trips: trips[i]!.values[0]!,
    distance: Number(distance[i]!.values[0]!.toFixed(2)),
    duration: Number(duration[i]!.values[0]!.toFixed(1)),
  }));
}

const SUMMARY_COLUMNS: Column[] = [
  {
    id: "day",
    label: "Date",
    type: "date",
    format: (v) => tableDay(String(v)),
  },
  { id: "vehicles", label: "Fleet size", type: "number" },
  { id: "trips", label: "Number of trips", type: "number" },
  {
    id: "distance",
    label: "Avg distance (km)",
    type: "number",
    format: (v) => Number(v).toFixed(2),
  },
  {
    id: "duration",
    label: "Median trip (min)",
    type: "number",
    format: (v) => Number(v).toFixed(1),
  },
];

function KpiBody({
  widget,
  data,
  preview,
}: {
  widget: Extract<WidgetSpec, { kind: "kpi" }>;
  data: ReportData;
  preview?: boolean;
}) {
  const now = measure(data.trips, widget.metric);
  const before = data.previous?.trips.length
    ? measure(data.previous.trips, widget.metric)
    : null;
  const delta = before === null ? null : change(now, before);
  const Arrow =
    delta === null || Math.abs(delta) < 0.005
      ? null
      : delta > 0
        ? ArrowUp
        : ArrowDown;
  const trend = React.useMemo(
    () =>
      dailySeries(data.trips, data.days, widget.metric, null).map((d) => ({
        day: d.day,
        v: d.values[0] ?? 0,
      })),
    [data, widget.metric],
  );
  const gradient = `kpi-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-1 text-center">
      <p className="text-primary text-4xl font-semibold tracking-tight tabular-nums">
        {widget.metric === "trips" || widget.metric === "vehicles"
          ? compact.format(now)
          : formatMetric(now, widget.metric)}
      </p>
      <p className="text-muted-foreground text-xs">
        {METRICS[widget.metric].label}
      </p>
      {delta !== null ? (
        <p
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
            // A rise in trips or fleet reads as good; distance and duration are
            // neither, so they stay neutral.
            widget.metric === "trips" || widget.metric === "vehicles"
              ? delta > 0
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          {Arrow ? <Arrow className="size-3" aria-hidden /> : null}
          {delta > 0 ? "+" : ""}
          {(delta * 100).toFixed(1)}% vs previous
        </p>
      ) : data.previous ? (
        <p className="text-muted-foreground text-xs">
          No earlier trips to compare with
        </p>
      ) : null}
      {/* The period's shape under the number: is it steady, or did one day make it? */}
      {!preview && trend.length > 1 ? (
        <div aria-hidden inert className="mt-1 h-10 w-full max-w-64">
          <ChartContainer
            config={{
              v: {
                label: METRICS[widget.metric].label,
                color: "var(--chart-1)",
              },
            }}
            className="aspect-auto size-full"
          >
            <AreaChart
              // Decoration: no keyboard stop or announcement of its own.
              accessibilityLayer={false}
              data={trend}
              margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-v)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-v)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              {/* Scaled to its own range: from zero, a steady month draws flat. */}
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                dataKey="v"
                type="monotone"
                stroke="var(--color-v)"
                strokeWidth={1.5}
                fill={`url(#${gradient})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      ) : null}
    </div>
  );
}

function BarlistBody({ data }: { data: ReportData }) {
  const rows = byProvider(data.trips, data.providers).sort(
    (a, b) => b.trips - a.trips,
  );
  const max = Math.max(1, ...rows.map((r) => r.trips));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.provider} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: data.styles[r.provider]?.color }}
              />
              <span className="truncate">{r.provider}</span>
            </span>
            <span className="tabular-nums">
              {r.trips.toLocaleString("en")}
              <span className="text-muted-foreground ml-1.5">
                {formatPercent(r.share * 100)}
              </span>
            </span>
          </div>
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(r.trips / max) * 100}%`,
                background: data.styles[r.provider]?.color ?? "var(--primary)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const VEHICLE_LABELS: Record<string, string> = {
  scooter: "Scooters",
  bicycle: "Bikes",
};

function donutRows(data: ReportData) {
  const counts = new Map<string, number>();
  for (const t of data.trips)
    counts.set(t.vehicle, (counts.get(t.vehicle) ?? 0) + 1);
  return [...counts].map(([vehicle, trips], i) => ({
    key: `v${i}`,
    vehicle: VEHICLE_LABELS[vehicle] ?? vehicle,
    trips,
  }));
}

// Two steps apart, so the two vehicle types do not read as one teal.
const DONUT_COLORS = ["var(--chart-1)", "var(--chart-4)", "var(--chart-2)"];

function DonutBody({ data, preview }: { data: ReportData; preview?: boolean }) {
  const rows = React.useMemo(() => donutRows(data), [data]);
  const config: ChartConfig = Object.fromEntries(
    rows.map((r, i) => [
      r.key,
      { label: r.vehicle, color: DONUT_COLORS[i % DONUT_COLORS.length] },
    ]),
  );
  const total = rows.reduce((s, r) => s + r.trips, 0);
  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        preview ? "h-36" : "h-full min-h-28",
      )}
    >
      <div className="relative min-h-0 w-full flex-1">
        {/* The whole in the middle; the parts are in the legend below. Drawn
            over the chart rather than in it, so it stays centred in the ring
            whatever size the card is. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="text-lg leading-none font-semibold tabular-nums">
            {compact.format(total)}
          </span>
          <span className="text-muted-foreground mt-1 text-[10px]">trips</span>
        </div>
        <ChartContainer config={config} className="aspect-auto size-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="key" hideLabel />}
            />
            <Pie
              data={rows}
              dataKey="trips"
              nameKey="key"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              cornerRadius={4}
              strokeWidth={0}
              isAnimationActive={!preview}
            >
              {rows.map((r) => (
                <Cell key={r.key} fill={`var(--color-${r.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
      {!preview ? (
        <ul className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 pt-1.5 text-xs">
          {rows.map((r) => (
            <li
              key={r.key}
              className="text-muted-foreground flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ background: config[r.key]?.color }}
              />
              {r.vehicle}
              <span className="text-foreground font-medium tabular-nums">
                {total ? Math.round((r.trips / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const HOUR_LABELS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

function MatrixBody({ data }: { data: ReportData }) {
  return (
    <div className="space-y-2">
      <ActivityHeatmap
        rows={WEEKDAY_LABELS}
        columns={HOUR_LABELS}
        values={weekHourGrid(data.trips)}
      />
      <div className="text-muted-foreground flex justify-between pl-16 text-[10px] tabular-nums">
        <span>00:00</span>
        <span>12:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

function WidgetBody({
  widget,
  data,
  preview,
}: {
  widget: WidgetSpec;
  data: ReportData;
  preview?: boolean;
}) {
  // Text draws itself, editable, in TextWidget.
  if (widget.kind === "text") return null;
  if (data.status === "loading")
    return (
      <Skeleton
        className={cn(preview ? "h-36" : "h-full min-h-28", "w-full")}
      />
    );
  if (data.status === "error") {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No data to show.
      </p>
    );
  }
  if (data.trips.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No trips match these filters.
      </p>
    );
  }
  switch (widget.kind) {
    case "series":
      return <SeriesBody widget={widget} data={data} preview={preview} />;
    case "summary":
      return (
        <WidgetTable
          columns={SUMMARY_COLUMNS}
          // A preview shows its last three days, which fit without a pager.
          rows={preview ? summaryRows(data).slice(-3) : summaryRows(data)}
        />
      );
    case "kpi":
      return <KpiBody widget={widget} data={data} preview={preview} />;
    case "barlist":
      return <BarlistBody data={data} />;
    case "donut":
      return <DonutBody data={data} preview={preview} />;
    case "matrix":
      return <MatrixBody data={data} />;
  }
}

type Csv = {
  rows: Record<string, unknown>[];
  columns: { id: string; label: string }[];
};

/** What "Export to CSV" writes: the numbers the widget draws, under its filters. */
function widgetCsv(widget: WidgetSpec, data: ReportData): Csv | null {
  switch (widget.kind) {
    case "series": {
      const { rows, names } = seriesRows(widget, data);
      return {
        rows,
        columns: [
          { id: "day", label: "date" },
          ...names.map((n, i) => ({ id: `v${i}`, label: n })),
        ],
      };
    }
    case "summary":
      return {
        rows: summaryRows(data),
        columns: SUMMARY_COLUMNS.map(({ id, label }) => ({ id, label })),
      };
    case "kpi":
      return {
        rows: [
          {
            metric: METRICS[widget.metric].label,
            value: measure(data.trips, widget.metric),
          },
        ],
        columns: [
          { id: "metric", label: "metric" },
          { id: "value", label: "value" },
        ],
      };
    case "barlist":
      return {
        rows: byProvider(data.trips, data.providers),
        columns: [
          { id: "provider", label: "operator" },
          { id: "trips", label: "trips" },
        ],
      };
    case "donut":
      return {
        rows: donutRows(data),
        columns: [
          { id: "vehicle", label: "vehicle type" },
          { id: "trips", label: "trips" },
        ],
      };
    case "matrix": {
      const grid = WEEKDAY_LABELS.map(() => HOUR_LABELS.map(() => 0));
      for (const t of data.trips)
        if (t.weekday >= 0) grid[t.weekday]![t.hour]!++;
      return {
        rows: grid.map((row, d) => ({
          weekday: WEEKDAY_LABELS[d],
          ...Object.fromEntries(row.map((v, h) => [HOUR_LABELS[h], v])),
        })),
        columns: [
          { id: "weekday", label: "weekday" },
          ...HOUR_LABELS.map((h) => ({ id: h, label: h })),
        ],
      };
    }
    case "text":
      return null;
  }
}

/**
 * Draws the widget's chart to a PNG. Every painted property is copied inline
 * from the live chart first: the SVG is drawn through an <img>, which cannot see
 * the page's stylesheet, so a fill of `var(--color-s0)` would come out black.
 */
async function chartToPng(
  root: HTMLElement,
  filename: string,
): Promise<boolean> {
  const svg = root.querySelector<SVGSVGElement>("svg.recharts-surface");
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = svg.querySelectorAll<SVGElement>("*");
  const to = clone.querySelectorAll<SVGElement>("*");
  const props = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-opacity",
    "opacity",
    "font-size",
    "font-family",
    "font-weight",
  ];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const p of props) to[i]?.style.setProperty(p, cs.getPropertyValue(p));
  });
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = getComputedStyle(root).backgroundColor || "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    if (!blob) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "chart";

/* -------------------------------------------------------------------------- */
/* Widget card                                                                 */
/* -------------------------------------------------------------------------- */

function SingleToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: React.ReactNode; name: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={label}
        value={[value]}
        onValueChange={(v: string[]) => {
          // A single choice: clicking the pressed item must not leave none.
          if (v[0]) onChange(v[0] as T);
        }}
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            aria-label={o.name}
            title={o.name}
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

const STYLE_OPTIONS: Array<{
  value: SeriesStyle;
  label: React.ReactNode;
  name: string;
}> = [
  { value: "line", label: <ChartLine />, name: "Line" },
  { value: "table", label: <Table2 />, name: "Table" },
  { value: "bar", label: <ChartColumn />, name: "Bar" },
];

type ChartWidget = Exclude<Widget, { kind: "text" }>;

/** The product's "Edit": how a chart is drawn, not what it is built from. Size is on the canvas. */
function WidgetSettings({
  widget,
  onChange,
}: {
  widget: ChartWidget;
  onChange: (w: ChartWidget) => void;
}) {
  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel htmlFor={`${widget.id}-title`}>Title</FieldLabel>
        <Input
          id={`${widget.id}-title`}
          value={widget.title}
          onChange={(e) => onChange({ ...widget, title: e.target.value })}
        />
      </Field>
      {widget.kind === "series" ? (
        <>
          <SingleToggle
            label="Style"
            value={widget.style}
            onChange={(style) => onChange({ ...widget, style })}
            options={STYLE_OPTIONS}
          />
          <SingleToggle
            label="Display"
            value={widget.display}
            onChange={(display) => onChange({ ...widget, display })}
            options={[
              { value: "value", label: "#", name: "Values" },
              { value: "percent", label: "%", name: "Share" },
              { value: "both", label: "#%", name: "Values and share" },
            ]}
          />
          {widget.metric === "distance" || widget.metric === "duration" ? (
            <p className="text-muted-foreground text-xs">
              A share of an average means nothing, so this chart always shows
              values.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function WidgetCard({
  widget,
  data,
  onChange,
  onDelete,
}: {
  widget: ChartWidget;
  data: ReportData;
  onChange: (w: ChartWidget) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [exportFailed, setExportFailed] = React.useState(false);
  const menuRef = React.useRef<HTMLButtonElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const Icon = TYPE_ICON[typeOf(widget)];
  const name = nameOf(widget);
  const loading = refreshing || data.status === "loading";
  const hasChart =
    (widget.kind === "series" && widget.style !== "table") ||
    widget.kind === "donut";

  React.useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(t);
  }, [refreshing]);

  return (
    <section
      aria-label={name}
      data-slot="report-widget"
      className="bg-card text-card-foreground relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      {/* The product's loading line: a thin bar along the card's top edge. */}
      {loading ? (
        <div
          role="progressbar"
          aria-label={`Loading ${name}`}
          data-slot="report-loading"
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
        >
          <div className="bg-primary h-full w-1/3 animate-[report-load_1s_ease-in-out_infinite]" />
        </div>
      ) : null}
      <div className="flex shrink-0 items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Icon
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <span className="truncate">{name}</span>
          </h3>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Database className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{SOURCE}</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                ref={menuRef}
                variant="ghost"
                size="icon-xs"
                aria-label={`Options for ${name}`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRefreshing(true)}>
              Refresh
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={data.status !== "ready"}
              onClick={() => {
                const csv = widgetCsv(widget, data);
                if (csv)
                  downloadFile(
                    toCsv(csv.rows, csv.columns),
                    `${slug(name)}.csv`,
                    "text/csv;charset=utf-8",
                  );
              }}
            >
              Export to CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasChart || data.status !== "ready"}
              onClick={async () => {
                if (bodyRef.current)
                  setExportFailed(
                    !(await chartToPng(bodyRef.current, slug(name))),
                  );
              }}
            >
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Anchored to the options button, since the menu that opened it has closed. */}
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverContent anchor={menuRef} align="end" className="w-80">
          <p className="text-sm font-medium">Settings</p>
          <WidgetSettings widget={widget} onChange={onChange} />
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${name}”?`}
        description="It comes off this report. The chart stays in the library."
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />

      <div
        ref={bodyRef}
        className="bg-card flex min-h-0 flex-1 flex-col overflow-auto p-3"
      >
        {exportFailed ? (
          <p role="alert" className="text-destructive mb-2 text-xs">
            Couldn&apos;t draw this chart as an image.
          </p>
        ) : null}
        <WidgetBody widget={widget} data={data} />
      </div>
    </section>
  );
}

type TextWidgetT = Extract<Widget, { kind: "text" }>;

/**
 * A heading and a note, written in place as in the product: no frame until it
 * is pointed at or focused, a formatting bar over any selection, and a switch
 * to the Markdown underneath.
 */
function TextWidget({
  widget,
  autoSelect,
  onChange,
  onDelete,
}: {
  widget: TextWidgetT;
  /** Just placed: focus it and select the heading, so typing replaces it. */
  autoSelect: boolean;
  onChange: (w: TextWidgetT) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = React.useState<"rich" | "markdown">("rich");
  const editorRef = React.useRef<MarkdownEditorHandle>(null);
  const name = nameOf(widget);

  React.useEffect(() => {
    if (!autoSelect) return;
    // The editor mounts a frame or two after the widget does.
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      if (editorRef.current?.selectFirstBlock() || ++tries > 30) return;
      raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [autoSelect]);

  return (
    <section
      aria-label={name}
      data-slot="report-text"
      className="group/text hover:border-border focus-within:border-border bg-background relative h-full min-w-0 overflow-auto rounded-xl border border-transparent px-3 py-2 transition-colors"
    >
      <div className="bg-background/90 absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-md opacity-0 transition-opacity group-hover/text:opacity-100 group-focus-within/text:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            mode === "rich" ? "Edit Markdown" : "Edit as formatted text"
          }
          title={mode === "rich" ? "Edit Markdown" : "Edit as formatted text"}
          onClick={() => setMode((m) => (m === "rich" ? "markdown" : "rich"))}
        >
          {mode === "rich" ? <Code2 /> : <Type />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Options for ${name}`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MarkdownEditor
        ref={editorRef}
        label="Section text"
        value={widget.markdown}
        mode={mode}
        onValueChange={(markdown) => onChange({ ...widget, markdown })}
        className="pr-14"
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas                                                                      */
/* -------------------------------------------------------------------------- */

/** The product's grid: 132px rows and 16px gutters, so a 4 by 2 chart is 280px tall. */
const ROW_PX = 132;
const GAP_PX = 16;
/** Below this the grid would make cells too small to use, so it stacks. */
const STACK_BELOW_PX = 560;
/** What a chart asks for when it is added from a cell, as in the product. */
const DEFAULT_CHART = { w: 4, h: 2 };

/**
 * Free placement, as in the product: no gravity pulling widgets to the top,
 * and a widget dragged onto another pushes it out of the way.
 */
const FREE_LAYOUT = getCompactor(null, false, false);

const cellSpan = (r: Rect) => ({
  gridColumn: `${r.x + 1} / span ${r.w}`,
  gridRow: `${r.y + 1} / span ${r.h}`,
});

type Placement = { spec: WidgetSpec; cells: { w: number; h: number } };

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** The rectangle between two cells, whichever way the pointer went. */
const spanning = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x) + 1,
  h: Math.abs(a.y - b.y) + 1,
});

const PICKER_TYPES: Array<"all" | Exclude<ChartType, "text">> = [
  "all",
  ...CHART_TYPES,
];

/**
 * The chart library, in one step: type chips over a list of previews. One
 * click places a chart, and pointing at one moves the landing outline to the
 * cells that chart would take, so the choice is made seeing where it goes.
 */
function ChartPicker({
  data,
  onPreview,
  onPick,
}: {
  data: ReportData;
  onPreview: (t: Template | null) => void;
  onPick: (t: Template) => void;
}) {
  const [type, setType] = React.useState<(typeof PICKER_TYPES)[number]>("all");
  const hoveredRef = React.useRef<string | null>(null);
  const items = LIBRARY.filter(
    (t) => type === "all" || typeOf(t.spec) === type,
  );
  return (
    <div className="flex max-h-[min(30rem,70svh)] flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Chart type"
        className="flex shrink-0 flex-wrap gap-1"
      >
        {PICKER_TYPES.map((t) => {
          const Icon = t === "all" ? null : TYPE_ICON[t];
          const n =
            t === "all"
              ? LIBRARY.length
              : LIBRARY.filter((l) => typeOf(l.spec) === t).length;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              disabled={n === 0}
              onClick={() => setType(t)}
              className="aria-checked:bg-primary aria-checked:text-primary-foreground aria-checked:border-primary hover:bg-muted focus-visible:ring-ring inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
            >
              {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
              {t === "all" ? "All" : TYPE_LABELS[t]}
              <span
                // Faded only when unselected: on the teal chip it would drop
                // below 4.5:1.
                className={cn("tabular-nums", type !== t && "opacity-60")}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
      <ul
        className="-mx-1 grid min-h-0 grid-cols-2 gap-2 overflow-auto px-1 pb-1"
        onPointerLeave={() => {
          hoveredRef.current = null;
          onPreview(null);
        }}
      >
        {items.map((t) => {
          const Icon = TYPE_ICON[typeOf(t.spec)];
          return (
            <li key={t.id} className="min-w-0">
              <button
                type="button"
                data-pick
                // Pointer move rather than enter: the preview inside the card is
                // what the pointer lands on, and an enter is not reliably seen
                // through it. The id check keeps it from re-rendering per pixel.
                onPointerMove={() => {
                  if (hoveredRef.current === t.id) return;
                  hoveredRef.current = t.id;
                  onPreview(t);
                }}
                onFocus={() => {
                  hoveredRef.current = t.id;
                  onPreview(t);
                }}
                onClick={() => onPick(t)}
                className="hover:border-primary/60 focus-visible:ring-ring bg-card flex w-full flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                  <Icon
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                  <span className="truncate">{nameOf(t.spec)}</span>
                </span>
                <span
                  inert
                  className="pointer-events-none block h-24 overflow-hidden"
                >
                  <span className="block origin-top-left scale-[0.66] [width:151%]">
                    <WidgetBody widget={t.spec} data={data} preview />
                  </span>
                </span>
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {t.cells.w} × {t.cells.h} cells
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Where one free cell is, for the arrow keys: the next free cell that way. */
function nextFree(
  from: { x: number; y: number },
  dx: number,
  dy: number,
  taken: Rect[],
  rows: number,
) {
  let { x, y } = from;
  for (;;) {
    x += dx;
    y += dy;
    if (x < 0 || x >= GRID_COLUMNS || y < 0 || y >= rows) return null;
    if (
      !taken.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
    )
      return { x, y };
  }
}

/**
 * Where a new widget will land: the cells it was drawn over, or the room at the
 * chosen cell for its own size. `drawn` keeps a drawn size over a chart's own.
 */
type Target = { rect: Rect; drawn: boolean; mode: "choose" | "chart" };

/**
 * The report as the product lays it out: a 12-column grid of cells, at least
 * six rows deep, with widgets placed by react-grid-layout as in the product.
 *
 * An empty cell under the pointer shows where a chart would land and offers a
 * chart or a text; dragging across empty cells draws a slot of any size first.
 * A widget is moved by its grip and resized by its corner -- or, from the
 * keyboard, by the grip with the arrow keys (Shift to resize).
 *
 * Narrower than a usable grid, it stacks the widgets in reading order and
 * offers the same two choices at the end.
 */
function ReportCanvas({
  widgets,
  data,
  autoSelectId,
  onChange,
  onPlacedText,
}: {
  widgets: Widget[];
  data: ReportData;
  /** A text widget to focus as soon as it mounts. */
  autoSelectId: string | null;
  onChange: (widgets: Widget[]) => void;
  onPlacedText: (id: string) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const gridRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(
    null,
  );
  const [hoverKind, setHoverKind] = React.useState<"chart" | "text">("chart");
  const [draw, setDraw] = React.useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [target, setTarget] = React.useState<Target | null>(null);
  const [previewRect, setPreviewRect] = React.useState<Rect | null>(null);
  const [moving, setMoving] = React.useState<Rect | null>(null);
  // Fixed while a widget is dragged or resized. Growing the canvas under the
  // pointer makes the browser scroll, which reads as more drag, which grows the
  // canvas again: a card dragged past the bottom edge would never stop growing.
  const [frozenRows, setFrozenRows] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [stackPicking, setStackPicking] = React.useState(false);
  const [said, setSaid] = React.useState("");

  const stacked = mounted && width < STACK_BELOW_PX;
  const layouts = widgets.map((w) => w.layout);
  const drawRect = draw ? spanning(draw.from, draw.to) : null;
  const drawFits = drawRect
    ? !layouts.some((r) => overlapsRect(r, drawRect))
    : false;
  const rows =
    frozenRows ??
    rowCount([
      ...layouts,
      ...(target ? [target.rect] : []),
      ...(previewRect ? [previewRect] : []),
      ...(drawRect ? [drawRect] : []),
    ]);
  const colPx = (width - GAP_PX * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const height = rows * ROW_PX + (rows - 1) * GAP_PX;
  const taken = (x: number, y: number) =>
    layouts.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  const update = (id: string, next: Widget) =>
    onChange(widgets.map((w) => (w.id === id ? next : w)));
  const remove = (id: string) => onChange(widgets.filter((w) => w.id !== id));

  const cellAt = (clientX: number, clientY: number) => {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = Math.floor((clientX - box.left + GAP_PX / 2) / (colPx + GAP_PX));
    const y = Math.floor((clientY - box.top + GAP_PX / 2) / (ROW_PX + GAP_PX));
    if (x < 0 || x >= GRID_COLUMNS || y < 0 || y >= rows) return null;
    return { x, y };
  };

  const focusCell = (c: { x: number; y: number }) => {
    setActive(c);
    requestAnimationFrame(() =>
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-cell="${c.x}-${c.y}"]`)
        ?.focus(),
    );
  };

  /** The cells a chart or text would take from a cell, for the hover outline. */
  const footprint = (c: { x: number; y: number }, kind: "chart" | "text") =>
    roomAt(
      c.x,
      c.y,
      kind === "text" ? { w: GRID_COLUMNS - c.x, h: 1 } : DEFAULT_CHART,
      layouts,
    );

  const place = (t: Target | null, p: Placement) => {
    const min = minCells(p.spec);
    let rect: Rect;
    if (t?.drawn) rect = t.rect;
    else {
      const room = t ? roomAt(t.rect.x, t.rect.y, p.cells, layouts) : null;
      rect =
        room && room.w >= min.w && room.h >= min.h
          ? room
          : firstFit(Math.max(p.cells.w, min.w), p.cells.h, layouts);
    }
    const widget = { ...p.spec, id: newId("w"), layout: rect } as Widget;
    onChange([...widgets, widget]);
    setTarget(null);
    setPreviewRect(null);
    setStackPicking(false);
    setFlash(widget.id);
    setSaid(
      `Added ${nameOf(p.spec)} at row ${rect.y + 1}, column ${rect.x + 1}, ${rect.w} by ${rect.h} cells.`,
    );
    if (p.spec.kind === "text") onPlacedText(widget.id);
  };

  const placeText = (t: Target | null) =>
    place(t, {
      spec: { kind: "text", markdown: TEXT_SEED },
      cells: { w: t ? GRID_COLUMNS - t.rect.x : GRID_COLUMNS, h: 1 },
    });

  /** Commits what react-grid-layout settled on, for every widget it moved. */
  const commitLayout = (next: Layout) => {
    const byId = new Map(next.map((l) => [l.i, l]));
    let changed = false;
    const out = widgets.map((w) => {
      const l = byId.get(w.id);
      if (!l) return w;
      const rect = { x: l.x, y: l.y, w: l.w, h: l.h };
      if (sameRect(rect, w.layout)) return w;
      changed = true;
      return { ...w, layout: rect };
    });
    if (changed) onChange(out);
  };

  /** The grip's keyboard: arrows move a cell, Shift and arrows resize. */
  const nudge = (e: React.KeyboardEvent, w: Widget) => {
    const d = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    const [dx, dy] = d as [number, number];
    const o = w.layout;
    const others = widgets.filter((x) => x.id !== w.id).map((x) => x.layout);
    const resizing = e.shiftKey;
    const next = resizing
      ? resizeTo(o, o.w + dx, o.h + dy, others, minCells(w))
      : moveTo(o, o.x + dx, o.y + dy, others);
    if (next && !sameRect(next, o)) {
      update(w.id, { ...w, layout: next });
      setSaid(
        resizing
          ? `${nameOf(w)} is now ${next.w} columns by ${next.h} rows.`
          : `${nameOf(w)} moved to row ${next.y + 1}, column ${next.x + 1}.`,
      );
    } else {
      setSaid(
        resizing
          ? "Can't resize further that way."
          : "Can't move further that way.",
      );
    }
  };

  const renderWidget = (w: Widget) =>
    w.kind === "text" ? (
      <TextWidget
        widget={w}
        autoSelect={w.id === autoSelectId}
        onChange={(next) => update(w.id, next)}
        onDelete={() => remove(w.id)}
      />
    ) : (
      <WidgetCard
        widget={w}
        data={data}
        onChange={(next) => update(w.id, next)}
        onDelete={() => remove(w.id)}
      />
    );

  const live = (
    <p aria-live="polite" className="sr-only">
      {said}
    </p>
  );

  if (stacked) {
    return (
      <div
        ref={containerRef}
        className="space-y-4"
        data-slot="report-canvas"
        data-layout="stacked"
      >
        {readingOrder(widgets).map((w) => (
          <div
            key={w.id}
            style={{ height: w.layout.h * ROW_PX + (w.layout.h - 1) * GAP_PX }}
          >
            {renderWidget(w)}
          </div>
        ))}
        <div
          className="rounded-xl border border-dashed p-3"
          style={{ minHeight: ROW_PX }}
        >
          {stackPicking ? (
            <ChartPicker
              data={data}
              onPreview={() => {}}
              onPick={(t) => place(null, t)}
            />
          ) : (
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              style={{ minHeight: ROW_PX - 26 }}
            >
              <Button variant="outline" onClick={() => setStackPicking(true)}>
                <ChartColumn data-icon="inline-start" />
                Create a chart
              </Button>
              <Button variant="outline" onClick={() => placeText(null)}>
                <Type data-icon="inline-start" />
                Create text
              </Button>
            </div>
          )}
        </div>
        {live}
      </div>
    );
  }

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < GRID_COLUMNS; x++) cells.push({ x, y });
  const free = cells.filter((c) => !taken(c.x, c.y));
  // One cell is the canvas's single tab stop; the arrow keys move between the rest.
  const current = active && !taken(active.x, active.y) ? active : free[0];
  const showHover =
    hover && !target && !draw && !moving && !taken(hover.x, hover.y);
  const hoverRect = showHover ? footprint(hover, hoverKind) : null;
  const landing = previewRect ?? target?.rect ?? null;

  const rglLayout: Layout = widgets.map((w) => {
    const min = minCells(w);
    return { i: w.id, ...w.layout, minW: min.w, minH: min.h };
  });

  return (
    <div
      ref={containerRef}
      data-slot="report-canvas"
      data-layout="grid"
      className="report-canvas"
    >
      <p id="report-canvas-help" className="sr-only">
        Empty cells: use the arrow keys to move between them, then Tab to Chart
        or Text. Move a widget with its grip and the arrow keys; hold Shift to
        resize it.
      </p>
      <div className="relative" style={{ height }}>
        {/* The cells: drawn under everything, and where pointing, drawing and adding happen. */}
        <div
          ref={gridRef}
          role="group"
          aria-label="Report canvas"
          aria-describedby="report-canvas-help"
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, ${ROW_PX}px)`,
            gap: `${GAP_PX}px`,
          }}
          onPointerMove={(e) => {
            const c = cellAt(e.clientX, e.clientY);
            if (draw && c) {
              setDraw({ ...draw, to: c });
              return;
            }
            if (!c || (hover && c.x === hover.x && c.y === hover.y)) return;
            setHover(c);
            setHoverKind("chart");
          }}
          onPointerLeave={() => {
            if (!draw) setHover(null);
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || target) return;
            if ((e.target as HTMLElement).closest("button")) return;
            const c = cellAt(e.clientX, e.clientY);
            if (!c || taken(c.x, c.y)) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraw({ from: c, to: c });
          }}
          onPointerUp={() => {
            if (!draw) return;
            const rect = spanning(draw.from, draw.to);
            setDraw(null);
            // A press without a drag is a hover, not a drawing.
            if (rect.w === 1 && rect.h === 1) return;
            if (!drawFits) {
              setSaid("That area covers a widget. Draw over empty cells only.");
              return;
            }
            setTarget({ rect, drawn: true, mode: "choose" });
          }}
        >
          {cells.map((c) => {
            const isTaken = taken(c.x, c.y);
            const isCurrent =
              !isTaken && current?.x === c.x && current?.y === c.y;
            const isHover = showHover && hover!.x === c.x && hover!.y === c.y;
            return (
              <div
                key={`${c.x}-${c.y}`}
                data-cell={`${c.x}-${c.y}`}
                // A group, so it may carry a name: a plain div may not.
                role={isTaken ? undefined : "group"}
                aria-label={
                  isTaken
                    ? undefined
                    : `Empty cell, row ${c.y + 1}, column ${c.x + 1}`
                }
                aria-hidden={isTaken || undefined}
                tabIndex={isCurrent ? 0 : -1}
                onFocus={(e) => {
                  if (e.target !== e.currentTarget) return;
                  setActive(c);
                  setHover(c);
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const d = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  }[e.key];
                  if (!d) return;
                  e.preventDefault();
                  const next = nextFree(c, d[0]!, d[1]!, layouts, rows);
                  if (next) focusCell(next);
                }}
                style={cellSpan({ ...c, w: 1, h: 1 })}
                className={cn(
                  "@container relative rounded-lg transition-colors duration-150 focus-visible:outline-none",
                  "bg-muted/40 focus-visible:ring-ring focus-visible:ring-2",
                  isHover && "bg-muted",
                )}
              >
                {isHover ? (
                  <div className="draggable-cancel absolute inset-0 z-20 flex flex-col items-stretch justify-center gap-1 p-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label="Create a chart here"
                      title="Create a chart"
                      className="bg-background hover:border-primary hover:text-primary w-full min-w-0 shadow-xs"
                      onMouseEnter={() => setHoverKind("chart")}
                      onFocus={() => setHoverKind("chart")}
                      onClick={() =>
                        setTarget({
                          rect: hoverRect ?? { ...c, ...DEFAULT_CHART },
                          drawn: false,
                          mode: "chart",
                        })
                      }
                    >
                      <ChartColumn />
                      <span className="hidden truncate @[4.5rem]:inline">
                        Chart
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label="Create text here"
                      title="Create text"
                      className="bg-background hover:border-primary hover:text-primary w-full min-w-0 shadow-xs"
                      onMouseEnter={() => setHoverKind("text")}
                      onFocus={() => setHoverKind("text")}
                      onClick={() =>
                        placeText({
                          rect: { ...c, w: 1, h: 1 },
                          drawn: false,
                          mode: "chart",
                        })
                      }
                    >
                      <Type />
                      <span className="hidden truncate @[4.5rem]:inline">
                        Text
                      </span>
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Where it will land: the hover footprint, a drawn area, or the open picker's target. */}
          {hoverRect ? (
            <div
              aria-hidden
              style={cellSpan(hoverRect)}
              className="border-primary/50 bg-primary/5 pointer-events-none z-10 rounded-xl border-2 border-dashed transition-all duration-150"
            />
          ) : null}
          {drawRect && !(drawRect.w === 1 && drawRect.h === 1) ? (
            <div
              aria-hidden
              style={cellSpan(drawRect)}
              className={cn(
                "pointer-events-none z-10 flex items-center justify-center rounded-xl border-2 border-dashed text-xs font-medium",
                drawFits
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-destructive bg-destructive/10 text-destructive",
              )}
            >
              {drawRect.w} × {drawRect.h}
            </div>
          ) : null}
          {landing ? (
            <div
              aria-hidden
              style={cellSpan(landing)}
              className="border-primary bg-primary/10 pointer-events-none z-10 rounded-xl border-2 border-dashed transition-all duration-200"
            />
          ) : null}
          {/* The picker hangs off the cell it was opened from, not off the
              outline: the outline grows as charts are pointed at, and a
              popover that moved with it would slide out from under the
              pointer and undo the preview it was showing. */}
          {target ? (
            <div
              ref={anchorRef}
              aria-hidden
              style={cellSpan(
                target.drawn
                  ? target.rect
                  : { x: target.rect.x, y: target.rect.y, w: 1, h: 1 },
              )}
              className="pointer-events-none"
            />
          ) : null}
        </div>

        {mounted ? (
          <GridLayout
            className="report-rgl"
            width={width}
            layout={rglLayout}
            gridConfig={{
              cols: GRID_COLUMNS,
              rowHeight: ROW_PX,
              margin: [GAP_PX, GAP_PX],
              containerPadding: [0, 0],
              maxRows: rows,
            }}
            dragConfig={{
              handle: ".report-grip",
              cancel: ".draggable-cancel",
              threshold: 4,
            }}
            resizeConfig={{
              handles: ["se"],
              handleComponent: (axis, ref) => (
                <span
                  ref={ref as React.Ref<HTMLSpanElement>}
                  aria-hidden
                  className={`react-resizable-handle react-resizable-handle-${axis} report-resize`}
                />
              ),
            }}
            compactor={FREE_LAYOUT}
            autoSize={false}
            style={{ height, position: "absolute", inset: 0 }}
            onDragStart={(_l, item) => {
              setHover(null);
              setFrozenRows(rowCount(layouts) + 3);
              if (item)
                setMoving({ x: item.x, y: item.y, w: item.w, h: item.h });
            }}
            onDrag={(_l, _o, item) => {
              if (item)
                setMoving({ x: item.x, y: item.y, w: item.w, h: item.h });
            }}
            onDragStop={(next) => {
              setMoving(null);
              setFrozenRows(null);
              commitLayout(next);
            }}
            onResizeStart={(_l, item) => {
              setHover(null);
              setFrozenRows(rowCount(layouts) + 3);
              if (item)
                setMoving({ x: item.x, y: item.y, w: item.w, h: item.h });
            }}
            onResize={(_l, _o, item) => {
              if (item)
                setMoving({ x: item.x, y: item.y, w: item.w, h: item.h });
            }}
            onResizeStop={(next) => {
              setMoving(null);
              setFrozenRows(null);
              commitLayout(next);
            }}
          >
            {widgets.map((w) => (
              <div
                key={w.id}
                data-slot="report-slot"
                className={cn("group/widget", flash === w.id && "report-flash")}
              >
                {renderWidget(w)}
                <button
                  type="button"
                  aria-label={`Move ${nameOf(w)}`}
                  aria-describedby="report-canvas-help"
                  title="Drag to move. Arrow keys move, Shift and arrow keys resize."
                  onKeyDown={(e) => nudge(e, w)}
                  className="report-grip bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute -top-3 left-1/2 z-20 flex h-4 w-10 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border opacity-0 shadow-xs transition-opacity group-hover/widget:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
                >
                  <GripHorizontal className="size-3" aria-hidden />
                </button>
              </div>
            ))}
          </GridLayout>
        ) : null}
      </div>

      <Popover
        open={!!target}
        onOpenChange={(open) => {
          if (open) return;
          const at = target?.rect;
          setTarget(null);
          setPreviewRect(null);
          if (at) focusCell({ x: at.x, y: at.y });
        }}
      >
        <PopoverContent
          anchor={anchorRef}
          side="right"
          align="start"
          sideOffset={10}
          className="w-[26rem] max-w-[calc(100vw-2rem)] p-3"
        >
          {target?.mode === "choose" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Add to this {target.rect.w} × {target.rect.h} area
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-pick
                  autoFocus
                  onClick={() => setTarget({ ...target, mode: "chart" })}
                  className="hover:border-primary/60 focus-visible:ring-ring flex flex-col items-start gap-1 rounded-lg border p-3 text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <ChartColumn className="text-primary size-5" aria-hidden />
                  <span className="text-sm font-medium">Chart</span>
                  <span className="text-muted-foreground text-xs">
                    Pick one from your chart library
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => placeText(target)}
                  className="hover:border-primary/60 focus-visible:ring-ring flex flex-col items-start gap-1 rounded-lg border p-3 text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Type className="text-primary size-5" aria-hidden />
                  <span className="text-sm font-medium">Text</span>
                  <span className="text-muted-foreground text-xs">
                    A heading or a note for a section
                  </span>
                </button>
              </div>
            </div>
          ) : target ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Add a chart</p>
              <ChartPicker
                data={data}
                onPreview={(t) => {
                  if (!t || target.drawn) return setPreviewRect(null);
                  const room = roomAt(
                    target.rect.x,
                    target.rect.y,
                    t.cells,
                    layouts,
                  );
                  setPreviewRect(room);
                }}
                onPick={(t) => place(target, t)}
              />
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {live}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add charts                                                                  */
/* -------------------------------------------------------------------------- */

const TYPE_FILTERS = [
  "all",
  "line",
  "bar",
  "table",
  "kpi",
  "barlist",
  "donut",
  "matrix",
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

function NewChartForm({
  onAdd,
  onBack,
}: {
  onAdd: (t: Placement) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [metric, setMetric] = React.useState<Metric>("trips");
  const [byOperator, setByOperator] = React.useState(true);
  const [style, setStyle] = React.useState<SeriesStyle>("line");
  const fallback = `${METRICS[metric].label}${byOperator ? " per operator" : ""} over time`;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({
          spec: {
            kind: "series",
            title: title.trim() || fallback,
            metric,
            byOperator,
            style,
            display: "value",
          },
          cells: { w: 12, h: 2 },
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-chart-title">Title</FieldLabel>
          <Input
            id="new-chart-title"
            value={title}
            placeholder={fallback}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-chart-data">Data</FieldLabel>
          {/* One dataset in the sample; a select so the shape is already right. */}
          <Select value={TRIPS_DATASET} disabled>
            <SelectTrigger id="new-chart-data" className="w-full">
              <SelectValue>{() => SOURCE}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TRIPS_DATASET}>{SOURCE}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-chart-metric">Measure</FieldLabel>
          <Select
            value={metric}
            onValueChange={(v) => v && setMetric(v as Metric)}
          >
            <SelectTrigger id="new-chart-metric" className="w-full">
              <SelectValue>
                {(v: string) => METRICS[v as Metric]?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METRICS) as Metric[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {METRICS[m].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Label className="font-normal">
          <Checkbox
            // Named outright: the wrapping label names Base UI's hidden input,
            // not the span that carries role="checkbox".
            aria-label="Split by operator"
            checked={byOperator}
            onCheckedChange={(on) => setByOperator(!!on)}
          />
          Split by operator
        </Label>
        <SingleToggle
          label="Style"
          value={style}
          onChange={setStyle}
          options={STYLE_OPTIONS}
        />
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to library
        </Button>
        <Button type="submit">Add chart</Button>
      </div>
    </form>
  );
}

function AddChartsDialog({
  open,
  onOpenChange,
  data,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReportData;
  onAdd: (items: Placement[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("all");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setPicked([]);
    setCreating(false);
    setQuery("");
    setType("all");
  }, [open]);

  const q = query.trim().toLowerCase();
  const items = LIBRARY.filter(
    (w) =>
      (type === "all" || typeOf(w.spec) === type) &&
      (!q || nameOf(w.spec).toLowerCase().includes(q)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>
            {creating ? "Create a new chart" : "Add charts"}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? `A chart over ${SOURCE}, by day.`
              : "Pick one or more from your chart library."}
          </DialogDescription>
        </DialogHeader>
        {creating ? (
          <div className="overflow-auto p-4">
            <NewChartForm
              onBack={() => setCreating(false)}
              onAdd={(w) => {
                onAdd([w]);
                onOpenChange(false);
              }}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b p-4">
              <InputGroup className="min-w-48 flex-1">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search charts…"
                  aria-label="Search charts"
                />
              </InputGroup>
              <Select
                value={type}
                onValueChange={(v) => setType((v ?? "all") as TypeFilter)}
              >
                <SelectTrigger className="w-40" aria-label="Chart type">
                  <SelectValue>
                    {(v: string) =>
                      v === "all"
                        ? "Chart type"
                        : TYPE_LABELS[v as Exclude<TypeFilter, "all">]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "all" ? "All types" : TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ul className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
              <li className="flex">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Plus
                    className="size-8 rounded-full border p-1.5"
                    aria-hidden
                  />
                  Create a new chart
                </button>
              </li>
              {items.map((w) => {
                const on = picked.includes(w.id);
                const Icon = TYPE_ICON[typeOf(w.spec)];
                return (
                  <li key={w.id} className="flex min-w-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPicked((p) =>
                          on ? p.filter((x) => x !== w.id) : [...p, w.id],
                        )
                      }
                      className={cn(
                        "bg-card focus-visible:ring-ring relative flex w-full min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        on
                          ? "border-primary ring-primary ring-1"
                          : "hover:border-foreground/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                          <Icon
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden
                          />
                          <span className="truncate">{nameOf(w.spec)}</span>
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                            on &&
                              "bg-primary border-primary text-primary-foreground",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                      </span>
                      {/* A picture of the chart, not a second chart to use: no
                          tooltips, sorting or focus stops inside the button. */}
                      <div inert className="pointer-events-none">
                        <WidgetBody widget={w.spec} data={data} preview />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {items.length === 0 ? (
              <p className="text-muted-foreground px-4 pb-4 text-center text-sm">
                No chart in the library matches these filters.
              </p>
            ) : null}
            <DialogFooter className="m-0 border-t p-4">
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button
                disabled={picked.length === 0}
                onClick={() => {
                  onAdd(picked.map(templateOf));
                  onOpenChange(false);
                }}
              >
                Add charts ({picked.length})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

function FilterRow({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 pt-1.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          {label}
        </p>
        {hint ? <div className="pl-6 text-xs">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function FilterSelect<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: K;
  options: Record<K, { label: string }>;
  onChange: (v: K) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as K)}>
      <SelectTrigger
        aria-label={label}
        className="text-muted-foreground w-auto max-w-44 border-transparent bg-transparent shadow-none dark:bg-transparent"
      >
        <SelectValue>{(v: string) => options[v as K]?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(options) as K[]).map((k) => (
          <SelectItem key={k} value={k}>
            {options[k].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const linkClass =
  "text-muted-foreground hover:text-foreground whitespace-nowrap underline-offset-2 hover:underline";

/** The product's "Overall filters": they apply to every widget in the report. */
function FiltersPanel({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const period = PERIODS[filters.period];
  const prev = previousPeriod({ from: period.from, to: period.to });
  const prevHasData = prev.from >= PERIODS.sep.from;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <aside
      aria-label="Overall filters"
      className="bg-card h-fit rounded-xl border"
    >
      <h3 className="px-3 pt-3 pb-1 text-sm font-medium">Overall filters</h3>
      <div className="divide-y">
        <FilterRow
          icon={Calendar}
          label="Date"
          hint={
            filters.compare ? null : (
              <button
                type="button"
                className={linkClass}
                onClick={() => set("compare", true)}
              >
                Add compare
              </button>
            )
          }
        >
          <FilterSelect
            label="Date"
            value={filters.period}
            options={PERIODS}
            onChange={(v) => set("period", v)}
          />
        </FilterRow>
        {filters.compare ? (
          <FilterRow
            icon={Calendar}
            label="Compare date"
            hint={
              <button
                type="button"
                className={linkClass}
                onClick={() => set("compare", false)}
              >
                Remove compare
              </button>
            }
          >
            <p className="text-muted-foreground pt-1.5 text-right text-sm">
              {rangeLabel(prev.from, prev.to)}
              {prevHasData ? null : (
                <span className="block text-xs">No trips before Sep 1</span>
              )}
            </p>
          </FilterRow>
        ) : null}
        <FilterRow icon={Clock} label="Time">
          <FilterSelect
            label="Time"
            value={filters.slice}
            options={SLICES}
            onChange={(v) => set("slice", v)}
          />
        </FilterRow>
        <FilterRow icon={Pentagon} label="Zone">
          <FilterSelect
            label="Zone"
            value={filters.zone}
            options={ZONES}
            onChange={(v) => set("zone", v)}
          />
        </FilterRow>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

function ExportReportDialog({
  open,
  onOpenChange,
  title,
  aiAnalysis,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  aiAnalysis: boolean;
  onExport: (name: string) => void;
}) {
  const [name, setName] = React.useState(title);
  React.useEffect(() => {
    if (open) setName(title);
  }, [open, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            onExport(name.trim() || title);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Export report</DialogTitle>
            {aiAnalysis ? (
              <DialogDescription>
                This report will include AI-written analysis. You can turn this
                off in Settings → Security.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="export-name">File name</FieldLabel>
            <Input
              id="export-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit">Export report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportView({
  report,
  state,
  styles,
  aiAnalysis,
  onBack,
  onChange,
  onRetry,
  onExport,
}: {
  report: Report;
  state: TripsState;
  styles: Record<string, CategoryStyle>;
  aiAnalysis: boolean;
  onBack: () => void;
  onChange: (r: Report) => void;
  onRetry: () => void;
  onExport: (name: string) => void;
}) {
  const data = useReportData(state, report.filters, styles);
  // Closed to start: open beside the canvas it takes 18rem, and on an ordinary
  // laptop window that pushes the grid down to its stacked, phone layout.
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exported, setExported] = React.useState<string | null>(null);
  // Committed on blur, so every keystroke is not a save.
  const [title, setTitle] = React.useState(report.title);
  React.useEffect(() => setTitle(report.title), [report.title]);

  // The text placed last, focused with its heading selected once it mounts.
  const [autoSelectId, setAutoSelectId] = React.useState<string | null>(null);

  const setWidgets = (widgets: Widget[]) => onChange({ ...report, widgets });
  /** From the header's "+": each item goes in the first spot it fits. */
  const append = (items: Placement[]) => {
    const placed = [...report.widgets];
    for (const it of items) {
      const rect = firstFit(
        it.cells.w,
        it.cells.h,
        placed.map((w) => w.layout),
      );
      placed.push({ ...it.spec, id: newId("w"), layout: rect } as Widget);
    }
    setWidgets(placed);
    return placed.slice(report.widgets.length);
  };
  const addText = () => {
    const [w] = append([
      {
        spec: { kind: "text", markdown: TEXT_SEED },
        cells: { w: GRID_COLUMNS, h: 1 },
      },
    ]);
    if (w) setAutoSelectId(w.id);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to reports"
        >
          <ArrowLeft />
        </Button>
        <Input
          aria-label="Report name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== report.title)
              onChange({ ...report, title: next });
            else setTitle(report.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitle(report.title);
              e.currentTarget.blur();
            }
          }}
          className="h-9 max-w-md min-w-40 flex-1 text-base font-medium"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button onClick={() => setExporting(true)}>
            <WandSparkles data-icon="inline-start" />
            Export report
          </Button>
          <Button
            variant="outline"
            aria-pressed={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <ListFilter data-icon="inline-start" />
            Filters
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Add to report"
                >
                  <Plus />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={() => setAdding(true)}
                className="items-start"
              >
                <ChartColumn className="mt-0.5" />
                <span>
                  <span className="block font-medium">Chart</span>
                  <span className="text-muted-foreground block text-xs">
                    Pick one from your chart library
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addText} className="items-start">
                <Type className="mt-0.5" />
                <span>
                  <span className="block font-medium">Text</span>
                  <span className="text-muted-foreground block text-xs">
                    Introduce a section with a heading or a note
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Couldn&apos;t load the trips</AlertTitle>
          <AlertDescription>
            {SOURCE} didn&apos;t load, so these charts are empty. Nothing was
            changed.
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="xs" onClick={onRetry}>
              Try again
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {exported ? (
        <Alert>
          <WandSparkles />
          <AlertTitle>Exporting “{exported}”</AlertTitle>
          <AlertDescription>
            The file will download when it is ready.
          </AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="xs" onClick={() => setExported(null)}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <div
        className={cn(
          "@container grid gap-4",
          filtersOpen && "lg:grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        {filtersOpen ? (
          <FiltersPanel
            filters={report.filters}
            onChange={(filters) => onChange({ ...report, filters })}
          />
        ) : null}
        <div className="min-w-0">
          <ReportCanvas
            widgets={report.widgets}
            data={data}
            autoSelectId={autoSelectId}
            onPlacedText={setAutoSelectId}
            onChange={setWidgets}
          />
        </div>
      </div>

      <AddChartsDialog
        open={adding}
        onOpenChange={setAdding}
        data={data}
        onAdd={(items) => append(items)}
      />
      <ExportReportDialog
        open={exporting}
        onOpenChange={setExporting}
        title={report.title}
        aiAnalysis={aiAnalysis}
        onExport={(name) => {
          setExported(name);
          onExport(name);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* List                                                                        */
/* -------------------------------------------------------------------------- */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

function ReportList({
  reports,
  status,
  onRetry,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  reports: Report[];
  status: "ready" | "loading" | "error";
  onRetry?: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (r: Report) => void;
  onDelete: (r: Report) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [dir, setDir] = React.useState<"desc" | "asc">("desc");
  const [deleting, setDeleting] = React.useState<Report | null>(null);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .sort((a, b) =>
        dir === "desc"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt),
      );
  }, [reports, query, dir]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
          <p className="text-muted-foreground text-sm">
            Here&apos;s a list of all your reports
          </p>
        </div>
        <Button onClick={onCreate}>
          <FilePlus2 data-icon="inline-start" />
          Create report
        </Button>
      </header>

      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for reports"
          aria-label="Search for reports"
        />
      </InputGroup>

      {status === "loading" ? (
        <div role="status" aria-label="Loading reports" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : status === "error" ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>Couldn&apos;t load your reports</EmptyTitle>
            <EmptyDescription>
              Something went wrong fetching them. Nothing was changed.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {query ? <Search /> : <FilePlus2 />}
            </EmptyMedia>
            <EmptyTitle>{query ? "No results" : "No reports yet"}</EmptyTitle>
            <EmptyDescription>
              {query
                ? `No report matches “${query}”.`
                : "Create one to put charts from your data side by side."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {query ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : (
              <Button onClick={onCreate}>
                <FilePlus2 data-icon="inline-start" />
                Create report
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead
                  aria-sort={dir === "desc" ? "descending" : "ascending"}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDir((d) => (d === "desc" ? "asc" : "desc"))
                    }
                    className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1 rounded px-1 font-medium focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Created at
                    {dir === "desc" ? (
                      <ArrowDown className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowUp className="size-3.5" aria-hidden />
                    )}
                  </button>
                </TableHead>
                <TableHead>Last update</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-64">
                    <button
                      type="button"
                      data-slot="report-link"
                      onClick={() => onOpen(r.id)}
                      className="focus-visible:ring-ring block max-w-full truncate rounded text-left font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {r.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {initials(r.creator.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate">{r.creator.name}</span>
                        {r.creator.email ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {r.creator.email}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <LocalTime iso={r.createdAt} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <LocalTime iso={r.updatedAt} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${r.title}`}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Duplicate ${r.title}`}
                        onClick={() => onDuplicate(r)}
                      >
                        <Copy />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The report and its layout are deleted for everyone. The data behind it is not touched."
        confirmLabel="Delete report"
        destructive
        onConfirm={() => {
          if (deleting) onDelete(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/**
 * The grid's moving parts. react-grid-layout positions items inline; these
 * rules only animate them, draw the placeholder that shows where a dragged
 * card will land, and draw the resize corner.
 */
const REPORT_CSS = `
@keyframes report-load { from { transform: translateX(-100%) } to { transform: translateX(300%) } }
@keyframes report-flash { 0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--primary) 55%, transparent) } 100% { box-shadow: 0 0 0 14px transparent } }
.report-rgl { pointer-events: none; }
.report-rgl > .react-grid-item { pointer-events: auto; transition: transform 200ms ease, width 200ms ease, height 200ms ease; }
.report-rgl > .react-grid-item.react-draggable-dragging { transition: none; z-index: 30; }
.report-rgl > .react-grid-item.react-draggable-dragging > section { box-shadow: 0 18px 40px -12px rgb(0 0 0 / 0.45); transform: rotate(0.6deg) scale(1.01); }
.report-rgl > .react-grid-item.resizing { transition: none; z-index: 30; }
.report-rgl > .react-grid-placeholder { background: color-mix(in oklab, var(--primary) 12%, transparent); border: 2px dashed var(--primary); border-radius: 0.75rem; opacity: 1; z-index: 5; transition-duration: 120ms; }
.report-rgl .report-resize { position: absolute; right: 2px; bottom: 2px; width: 18px; height: 18px; cursor: se-resize; z-index: 20; opacity: 0; transition: opacity 150ms; }
.report-rgl .report-resize::after { content: ""; position: absolute; right: 4px; bottom: 4px; width: 7px; height: 7px; border-right: 2px solid var(--muted-foreground); border-bottom: 2px solid var(--muted-foreground); border-bottom-right-radius: 2px; }
.report-rgl > .react-grid-item:hover .report-resize, .report-rgl > .react-grid-item.resizing .report-resize { opacity: 1; }
.report-flash > section { animation: report-flash 1.2s ease-out 1; }
@media (prefers-reduced-motion: reduce) {
  [data-slot=report-loading] > div { animation: none !important; width: 100% !important; opacity: .6; }
  .report-rgl > .react-grid-item, .report-rgl > .react-grid-placeholder { transition: none !important; }
  .report-flash > section { animation: none; }
  .report-rgl > .react-grid-item.react-draggable-dragging > section { transform: none; }
}
`;

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reports: a table of saved reports, each a grid of charts over the Lisbon trips
 * feed with filters that apply to all of them.
 *
 * Laid out after the product's dashboards. In a report: an editable name,
 * Export report, an Overall filters panel (date, compare, time, zone) and "+"
 * to add charts from a library or a text section. Each chart's menu edits how
 * it is drawn, refreshes it, exports it as CSV or PNG, or deletes it.
 *
 * `status` is how the report catalogue itself is doing; the host owns that
 * fetch. The trips every chart draws from are fetched here, once. Export report
 * hands the chosen name to `onExportReport`: producing the file is the host's job.
 */
export function ReportsWorkspace({
  className,
  reports: initial = SAMPLE_REPORTS,
  tripsUrl = DEFAULT_TRIPS_URL,
  status = "ready",
  currentUser = { name: "You", email: "" },
  aiAnalysis = true,
  onRetry,
  onSave,
  onExportReport,
}: {
  className?: string;
  reports?: Report[];
  /** The MDS trips CSV every chart reads. */
  tripsUrl?: string;
  status?: "ready" | "loading" | "error";
  /** Credited as the creator of reports made or duplicated here. */
  currentUser?: Person;
  /** Whether an export includes AI-written analysis, which its dialog then says. */
  aiAnalysis?: boolean;
  onRetry?: () => void;
  /** Called after any change to a report: its name, filters or charts. */
  onSave?: (report: Report) => void;
  onExportReport?: (report: Report, name: string) => void;
}) {
  const [reports, setReports] = React.useState(initial);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const { state, retry } = useTrips(tripsUrl);
  const saved = useOperatorStyles();
  const styles = React.useMemo(
    () => resolveStyles(state.status === "ready" ? state.providers : [], saved),
    [state, saved],
  );

  const open = (id: string | null) => {
    setOpenId(id);
    // Each view starts at its top, not wherever the last one was scrolled to.
    rootRef.current?.scrollTo({ top: 0 });
  };

  const commit = (report: Report) => {
    const next = { ...report, updatedAt: new Date().toISOString() };
    setReports((all) =>
      all.some((r) => r.id === next.id)
        ? all.map((r) => (r.id === next.id ? next : r))
        : [next, ...all],
    );
    onSave?.(next);
    return next;
  };

  const current = reports.find((r) => r.id === openId);

  return (
    <div
      ref={rootRef}
      data-slot="reports-workspace"
      className={cn(
        // Same envelope as the other workspace blocks, so the docs page does not
        // jump when one replaces another.
        "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
        className,
      )}
    >
      {/* The loading line's sweep, the grid's motion and its placeholder, in the
          DS's own tokens rather than react-grid-layout's stylesheet. All of it
          holds still for anyone who asked for less motion. */}
      <style>{REPORT_CSS}</style>
      {current ? (
        <ReportView
          report={current}
          state={state}
          styles={styles}
          aiAnalysis={aiAnalysis}
          onBack={() => open(null)}
          onChange={commit}
          onRetry={retry}
          onExport={(name) => onExportReport?.(current, name)}
        />
      ) : (
        <ReportList
          reports={reports}
          status={status}
          onRetry={onRetry}
          onOpen={open}
          onCreate={() => {
            const now = new Date().toISOString();
            const r = commit({
              id: newId("report"),
              title: "New report",
              creator: currentUser,
              createdAt: now,
              updatedAt: now,
              filters: DEFAULT_FILTERS,
              widgets: [],
            });
            open(r.id);
          }}
          onDuplicate={(r) => {
            const now = new Date().toISOString();
            commit({
              ...r,
              id: newId("report"),
              title: `Copy of ${r.title}`,
              creator: currentUser,
              createdAt: now,
              widgets: r.widgets.map((w) => ({ ...w, id: newId("w") })),
            });
          }}
          onDelete={(r) =>
            setReports((all) => all.filter((x) => x.id !== r.id))
          }
        />
      )}
    </div>
  );
}

export default ReportsWorkspace;
