"use client";

import * as React from "react";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/registry/vianova/ui/badge";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import { Label } from "@/registry/vianova/ui/label";
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
import { SectionCard } from "@/registry/vianova/patterns/section-card";
import {
  StatTile,
  type StatTileTrend,
} from "@/registry/vianova/patterns/stat-tile";
import { ActivityHeatmap } from "@/registry/vianova/product/activity-heatmap";
import { ExportMenu } from "@/registry/vianova/product/export-menu";
import { RankedBars } from "@/registry/vianova/product/ranked-bars";
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
  daysBetween,
  filterTrips,
  previousPeriod,
  readTrips,
  summarize,
  tripsByDay,
  weekHourGrid,
  type Trip,
  type TripFilter,
} from "@/registry/vianova/lib/trip-report";
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
const DATASET_TITLE = "Lisbon MDS trips";

type SectionKind = "kpis" | "daily" | "share" | "heatmap" | "table";

const SECTION_LABELS: Record<SectionKind, string> = {
  kpis: "Headline numbers",
  daily: "Trips per day",
  share: "Share of trips",
  heatmap: "When people ride",
  table: "Operator breakdown",
};

const ALL_SECTIONS = Object.keys(SECTION_LABELS) as SectionKind[];

/** The periods the sample feed can answer: it holds September 2026 only. */
const PERIODS = {
  month: { label: "September 2026", from: "2026-09-01", to: "2026-09-30" },
  w39: { label: "Week of 21 Sep", from: "2026-09-21", to: "2026-09-27" },
  w38: { label: "Week of 14 Sep", from: "2026-09-14", to: "2026-09-20" },
} as const;
type PeriodKey = keyof typeof PERIODS;

const VEHICLES = {
  all: { label: "All vehicles", value: undefined },
  scooter: { label: "Scooters", value: "scooter" },
  bicycle: { label: "Bikes", value: "bicycle" },
} as const;
type VehicleKey = keyof typeof VEHICLES;

const HOURS = {
  all: { label: "All day", value: undefined },
  night: { label: "Night, 22:00 to 06:00", value: [22, 6] as [number, number] },
  morning: {
    label: "Morning peak, 07:00 to 10:00",
    value: [7, 10] as [number, number],
  },
} as const;
type HoursKey = keyof typeof HOURS;

export type Report = {
  id: string;
  title: string;
  description: string;
  status: "published" | "draft";
  /** How often it is sent, when it is. */
  schedule?: string;
  owner: string;
  updatedAt: string;
  period: PeriodKey;
  vehicle: VehicleKey;
  hours: HoursKey;
  sections: SectionKind[];
};

const SAMPLE_REPORTS: Report[] = [
  {
    id: "operator-performance-sep",
    title: "Operator performance, September",
    description:
      "How each operator did across the month: volume, share, trip length and fleet use.",
    status: "published",
    schedule: "Monthly, 1st",
    owner: "Mobility team",
    updatedAt: "2026-10-01T07:00:00Z",
    period: "month",
    vehicle: "all",
    hours: "all",
    sections: ["kpis", "daily", "share", "heatmap", "table"],
  },
  {
    id: "weekly-ridership",
    title: "Weekly ridership digest",
    description:
      "Last week's trips against the week before, by day and operator.",
    status: "published",
    schedule: "Weekly, Monday",
    owner: "Mobility team",
    updatedAt: "2026-09-28T07:00:00Z",
    period: "w39",
    vehicle: "all",
    hours: "all",
    sections: ["kpis", "daily", "share"],
  },
  {
    id: "night-riding",
    title: "Night riding",
    description:
      "Trips between 22:00 and 06:00, for the council's night-time safety review.",
    status: "draft",
    owner: "Ana Ribeiro",
    updatedAt: "2026-10-03T16:20:00Z",
    period: "month",
    vehicle: "all",
    hours: "night",
    sections: ["kpis", "heatmap", "table"],
  },
  {
    id: "bike-share",
    title: "Bike share in September",
    description: "Pedal-assist bikes only: who rides them, when, and how far.",
    status: "published",
    owner: "Ana Ribeiro",
    updatedAt: "2026-10-02T10:05:00Z",
    period: "month",
    vehicle: "bicycle",
    hours: "all",
    sections: ["kpis", "daily", "table"],
  },
];

const filterOf = (
  r: Pick<Report, "period" | "vehicle" | "hours">,
): TripFilter => ({
  from: PERIODS[r.period].from,
  to: PERIODS[r.period].to,
  vehicle: VEHICLES[r.vehicle].value,
  hours: HOURS[r.hours].value,
});

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

const count = new Intl.NumberFormat("en");
const oneDecimal = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 0,
});
const signedPercent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
// By hand rather than Intl: these are calendar days, not instants, and en-GB
// abbreviates September as "Sept" in current ICU builds but not older ones.
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

const dayLabel = (day: string) =>
  `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const rangeLabel = (f: TripFilter) =>
  `${dayLabel(f.from)} to ${dayLabel(f.to)}`;

/** "September 2026 · Bikes · Night, 22:00 to 06:00", leaving out the defaults. */
function scopeLabel(r: Pick<Report, "period" | "vehicle" | "hours">) {
  return [
    PERIODS[r.period].label,
    r.vehicle !== "all" ? VEHICLES[r.vehicle].label : null,
    r.hours !== "all" ? HOURS[r.hours].label : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

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

/* -------------------------------------------------------------------------- */
/* Report body                                                                 */
/* -------------------------------------------------------------------------- */

function OperatorSwatch({ style }: { style: CategoryStyle }) {
  return style.logo ? (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ background: style.color }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL */}
      <img
        src={style.logo}
        alt=""
        className={cn(
          "object-contain",
          style.logoKind === "solid" ? "size-full" : "size-3.5",
        )}
      />
    </span>
  ) : (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: style.color }}
    />
  );
}

function trendOf(delta: number | null): StatTileTrend | undefined {
  if (delta === null) return undefined;
  return Math.abs(delta) < 0.005 ? "flat" : delta > 0 ? "up" : "down";
}

function Kpis({
  report,
  trips,
}: {
  report: Pick<Report, "period" | "vehicle" | "hours">;
  trips: Trip[];
}) {
  const filter = filterOf(report);
  const prevFilter = previousPeriod(filter);
  const now = summarize(
    filterTrips(trips, filter),
    daysBetween(filter.from, filter.to).length,
  );
  const before = summarize(
    filterTrips(trips, prevFilter),
    daysBetween(prevFilter.from, prevFilter.to).length,
  );
  const hint = before.trips ? `vs ${rangeLabel(prevFilter)}` : undefined;

  const tile = (
    label: string,
    value: string,
    unit: string | undefined,
    current: number,
    previous: number,
    // Longer and further are not better or worse on their own, so they are
    // shown without a colour.
    intent: "auto" | "neutral" = "auto",
  ) => {
    const delta = before.trips ? change(current, previous) : null;
    return (
      <StatTile
        label={label}
        value={value}
        unit={unit}
        delta={delta === null ? undefined : signedPercent.format(delta)}
        trend={trendOf(delta)}
        intent={intent}
        hint={hint}
      />
    );
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {tile(
          "Trips",
          count.format(now.trips),
          undefined,
          now.trips,
          before.trips,
        )}
        {tile(
          "Vehicles in use",
          count.format(now.vehicles),
          undefined,
          now.vehicles,
          before.vehicles,
        )}
        {tile(
          "Median trip",
          oneDecimal.format(now.medianDurationMin),
          "min",
          now.medianDurationMin,
          before.medianDurationMin,
          "neutral",
        )}
        {tile(
          "Average distance",
          oneDecimal.format(now.avgDistanceKm),
          "km",
          now.avgDistanceKm,
          before.avgDistanceKm,
          "neutral",
        )}
      </div>
      {before.trips ? null : (
        <p className="text-muted-foreground text-xs">
          No change shown: {DATASET_TITLE} has no trips before{" "}
          {dayLabel(filter.from)} to compare with.
        </p>
      )}
    </div>
  );
}

function DailyChart({
  trips,
  filter,
  providers,
  styles,
}: {
  trips: Trip[];
  filter: TripFilter;
  providers: string[];
  styles: Record<string, CategoryStyle>;
}) {
  // Keyed op0, op1 ... rather than by name: the key becomes a CSS variable, and
  // an operator called "Bird Rides" would not make a valid one.
  const config = React.useMemo(
    () =>
      Object.fromEntries(
        providers.map((p, i) => [
          `op${i}`,
          { label: p, color: styles[p]?.color },
        ]),
      ) satisfies ChartConfig,
    [providers, styles],
  );
  const data = React.useMemo(
    () =>
      tripsByDay(trips, daysBetween(filter.from, filter.to), providers).map(
        ({ day, counts }) => ({
          label: dayLabel(day),
          ...Object.fromEntries(counts.map((n, i) => [`op${i}`, n])),
        }),
      ),
    [trips, filter.from, filter.to, providers],
  );

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        {providers.map((_, i) => (
          <Bar
            key={i}
            dataKey={`op${i}`}
            stackId="trips"
            fill={`var(--color-op${i})`}
            // Only the top segment is rounded, or the stack reads as separate bars.
            radius={i === providers.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function OperatorTable({
  rows,
  styles,
}: {
  rows: ReturnType<typeof byProvider>;
  styles: Record<string, CategoryStyle>;
}) {
  return (
    // Edge cells padded to the card header's 16px, so the table lines up with
    // the title above it while still scrolling edge to edge on a phone.
    <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
      <TableHeader>
        <TableRow>
          <TableHead>Operator</TableHead>
          <TableHead className="text-right">Trips</TableHead>
          <TableHead className="text-right">Share</TableHead>
          <TableHead className="text-right">Vehicles</TableHead>
          <TableHead className="text-right">Median trip</TableHead>
          <TableHead className="text-right">Avg distance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.provider}>
            <TableCell>
              <span className="flex items-center gap-2">
                {styles[r.provider] ? (
                  <OperatorSwatch style={styles[r.provider]!} />
                ) : null}
                {r.provider}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {count.format(r.trips)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {percent.format(r.share)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {count.format(r.vehicles)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.trips ? `${oneDecimal.format(r.medianDurationMin)} min` : "–"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.trips ? `${oneDecimal.format(r.avgDistanceKm)} km` : "–"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const HOUR_LABELS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

function ReportSkeleton({ sections }: { sections: SectionKind[] }) {
  return (
    <div role="status" aria-label="Loading report" className="space-y-4">
      {sections.includes("kpis") ? (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : null}
      {sections
        .filter((s) => s !== "kpis")
        .map((s) => (
          <Skeleton key={s} className="h-72 rounded-xl" />
        ))}
    </div>
  );
}

/**
 * Everything below a report's header. The viewer and the builder's preview both
 * render this, so what someone builds is exactly what they will publish.
 */
function ReportBody({
  report,
  data,
  styles,
  onRetry,
}: {
  report: Pick<Report, "period" | "vehicle" | "hours" | "sections">;
  data: TripsState;
  styles: Record<string, CategoryStyle>;
  onRetry: () => void;
}) {
  const filter = filterOf(report);
  const filtered = React.useMemo(
    () => (data.status === "ready" ? filterTrips(data.trips, filter) : []),
    // filter is rebuilt each render; its parts are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data,
      filter.from,
      filter.to,
      filter.vehicle,
      filter.hours?.[0],
      filter.hours?.[1],
    ],
  );

  if (report.sections.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>Nothing in this report yet</EmptyTitle>
          <EmptyDescription>
            Pick at least one section to show.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (data.status === "loading")
    return <ReportSkeleton sections={report.sections} />;

  if (data.status === "error") {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t load the trips</EmptyTitle>
          <EmptyDescription>
            {DATASET_TITLE} didn&apos;t load, so this report can&apos;t be
            drawn. Nothing was changed.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (filtered.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>No trips in this period</EmptyTitle>
          <EmptyDescription>
            {DATASET_TITLE} has no trips for {scopeLabel(report)}. Try a wider
            period or all vehicles.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { providers } = data;
  const rows = byProvider(filtered, providers);
  const has = (s: SectionKind) => report.sections.includes(s);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {has("kpis") ? (
        <div className="lg:col-span-2">
          <Kpis report={report} trips={data.trips} />
        </div>
      ) : null}
      {has("daily") ? (
        <SectionCard
          className="lg:col-span-2"
          title={SECTION_LABELS.daily}
          description={`By operator, ${rangeLabel(filter)}`}
        >
          <DailyChart
            trips={filtered}
            filter={filter}
            providers={providers}
            styles={styles}
          />
        </SectionCard>
      ) : null}
      {has("share") ? (
        <SectionCard
          // Alone on its row it would stretch a five-item list across the page.
          className={cn(!has("heatmap") && "lg:col-span-2")}
          title={SECTION_LABELS.share}
          description="Each operator's part of all trips"
        >
          <RankedBars
            items={[...rows]
              .sort((a, b) => b.trips - a.trips)
              .map((r) => ({
                label: r.provider,
                percent: Math.round(r.share * 100),
                count: count.format(r.trips),
              }))}
          />
        </SectionCard>
      ) : null}
      {has("heatmap") ? (
        <SectionCard
          className={cn(!has("share") && "lg:col-span-2")}
          title={SECTION_LABELS.heatmap}
          description="Trips by weekday and hour, Lisbon time"
        >
          <div className="space-y-2">
            <ActivityHeatmap
              rows={WEEKDAY_LABELS}
              columns={HOUR_LABELS}
              values={weekHourGrid(filtered)}
            />
            <div className="text-muted-foreground flex justify-between pl-16 text-[10px] tabular-nums">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </div>
        </SectionCard>
      ) : null}
      {has("table") ? (
        <SectionCard
          className="lg:col-span-2"
          title={SECTION_LABELS.table}
          contentClassName="px-0 py-0"
        >
          <OperatorTable rows={rows} styles={styles} />
        </SectionCard>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A sparkline of the report's own daily trips, so cards differ by what they
 * hold rather than by a decorative pattern.
 */
function Sparkline({ report, data }: { report: Report; data: TripsState }) {
  if (data.status !== "ready") {
    return <div className="bg-muted h-20" aria-hidden />;
  }
  const filter = filterOf(report);
  const series = tripsByDay(
    filterTrips(data.trips, filter),
    daysBetween(filter.from, filter.to),
    [...data.providers],
  ).map((d) => d.counts.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...series);
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const points = series.map(
    (v, i) => `${(i * step).toFixed(2)},${(38 - (v / max) * 32).toFixed(2)}`,
  );

  return (
    <div className="bg-muted/50 h-20 px-3 pt-3" aria-hidden>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="size-full overflow-visible"
      >
        <polygon
          points={`0,40 ${points.join(" ")} 100,40`}
          className="fill-primary/10"
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ReportCard({
  report,
  data,
  onOpen,
}: {
  report: Report;
  data: TripsState;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group bg-card text-card-foreground focus-visible:ring-ring flex w-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:outline-none"
    >
      <Sparkline report={report} data={data} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate text-sm font-medium">{report.title}</h3>
        {report.description ? (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {report.description}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {report.status === "draft" ? (
            <Badge variant="secondary">Draft</Badge>
          ) : null}
          {report.schedule ? (
            <Badge variant="outline">
              <CalendarClock data-icon="inline-start" />
              {report.schedule}
            </Badge>
          ) : null}
        </div>
        <div className="text-muted-foreground mt-auto space-y-0.5 pt-2 text-xs">
          <p className="truncate">{scopeLabel(report)}</p>
          <p>Updated {dateTimeFormat.format(new Date(report.updatedAt))}</p>
        </div>
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border" aria-hidden>
      <Skeleton className="h-20 rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

type StatusFilter = "all" | "published" | "draft" | "scheduled";

const STATUS_FILTERS: Record<StatusFilter, string> = {
  all: "All reports",
  published: "Published",
  draft: "Drafts",
  scheduled: "Scheduled",
};

type SortKey = "recent" | "name";

const SORTS: Record<SortKey, string> = {
  recent: "Most recent",
  name: "Name",
};

/* -------------------------------------------------------------------------- */
/* Viewer                                                                      */
/* -------------------------------------------------------------------------- */

function ReportView({
  report,
  data,
  styles,
  onBack,
  onEdit,
  onPublish,
  onRetry,
}: {
  report: Report;
  data: TripsState;
  styles: Record<string, CategoryStyle>;
  onBack: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onRetry: () => void;
}) {
  // What the export holds is the operator breakdown, as filtered: the one table
  // someone will paste into a council paper.
  const exportRows = React.useMemo(() => {
    if (data.status !== "ready") return [];
    return byProvider(
      filterTrips(data.trips, filterOf(report)),
      data.providers,
    ).map((r) => ({
      operator: r.provider,
      trips: r.trips,
      share: Number(r.share.toFixed(4)),
      vehicles: r.vehicles,
      median_trip_min: Number(r.medianDurationMin.toFixed(1)),
      avg_distance_km: Number(r.avgDistanceKm.toFixed(2)),
    }));
  }, [data, report]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onBack}
            aria-label="Back to reports"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {report.title}
              </h2>
              {report.status === "draft" ? (
                <Badge variant="secondary">Draft</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">
              {DATASET_TITLE} · {scopeLabel(report)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            rows={exportRows}
            columns={[
              { id: "operator", label: "Operator" },
              { id: "trips", label: "Trips" },
              { id: "share", label: "Share" },
              { id: "vehicles", label: "Vehicles" },
              { id: "median_trip_min", label: "Median trip (min)" },
              { id: "avg_distance_km", label: "Average distance (km)" },
            ]}
            filename={report.id}
          />
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          {report.status === "draft" ? (
            <Button size="sm" onClick={onPublish}>
              <Send data-icon="inline-start" />
              Publish
            </Button>
          ) : null}
        </div>
      </header>

      {report.description ? (
        <p className="text-muted-foreground text-sm">{report.description}</p>
      ) : null}

      <ReportBody
        report={report}
        data={data}
        styles={styles}
        onRetry={onRetry}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                     */
/* -------------------------------------------------------------------------- */

type Draft = Pick<
  Report,
  "title" | "description" | "period" | "vehicle" | "hours" | "sections"
>;

const BLANK: Draft = {
  title: "",
  description: "",
  period: "month",
  vehicle: "all",
  hours: "all",
  sections: ["kpis", "daily", "table"],
};

function OptionSelect<K extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: K;
  options: Record<K, { label: string }>;
  onChange: (v: K) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as K)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{(v: string) => options[v as K]?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(options) as K[]).map((k) => (
          <SelectItem key={k} value={k}>
            {options[k].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Choose what a report covers and which sections it shows, with the report
 * drawn live beside the form. Scheduling and sharing are not here yet.
 */
function ReportBuilder({
  initial,
  editing,
  data,
  styles,
  onCancel,
  onSave,
  onRetry,
}: {
  initial: Draft;
  editing: boolean;
  data: TripsState;
  styles: Record<string, CategoryStyle>;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [tried, setTried] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const sectionsRef = React.useRef<HTMLFieldSetElement>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const titleError = !draft.title.trim() ? "Give the report a name." : null;
  const sectionsError =
    draft.sections.length === 0 ? "Pick at least one section." : null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    // Focus goes to the first thing to fix, so a keyboard or screen-reader user
    // is not left on a button that silently did nothing.
    if (titleError) return titleRef.current?.focus();
    if (sectionsError) {
      sectionsRef.current
        ?.querySelector<HTMLElement>("[role=checkbox]")
        ?.focus();
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Back to reports"
        >
          <ArrowLeft />
        </Button>
        <h2 className="truncate text-lg font-semibold tracking-tight">
          {editing ? "Edit report" : "New report"}
        </h2>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <form
          onSubmit={save}
          noValidate
          className="bg-card h-fit space-y-5 rounded-xl border p-4"
          aria-label="Report settings"
        >
          <FieldGroup>
            <Field data-invalid={tried && !!titleError}>
              <FieldLabel htmlFor="report-title">Name</FieldLabel>
              <Input
                ref={titleRef}
                id="report-title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Weekly ridership digest"
                aria-invalid={tried && !!titleError}
              />
              {tried && titleError ? (
                <FieldError>{titleError}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="report-description">Description</FieldLabel>
              <Input
                id="report-description"
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What it is for, and who reads it"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="report-dataset">Data</FieldLabel>
              {/* One dataset for now; a select so the shape is already right. */}
              <Select value={TRIPS_DATASET} disabled>
                <SelectTrigger id="report-dataset" className="w-full">
                  <SelectValue>{() => DATASET_TITLE}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TRIPS_DATASET}>{DATASET_TITLE}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="report-period">Period</FieldLabel>
              <OptionSelect
                id="report-period"
                value={draft.period}
                options={PERIODS}
                onChange={(v) => set("period", v)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="report-vehicle">Vehicles</FieldLabel>
              <OptionSelect
                id="report-vehicle"
                value={draft.vehicle}
                options={VEHICLES}
                onChange={(v) => set("vehicle", v)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="report-hours">Time of day</FieldLabel>
              <OptionSelect
                id="report-hours"
                value={draft.hours}
                options={HOURS}
                onChange={(v) => set("hours", v)}
              />
            </Field>
          </FieldGroup>

          <FieldSet ref={sectionsRef} data-invalid={tried && !!sectionsError}>
            <FieldLegend variant="label">Sections</FieldLegend>
            <div className="grid gap-2.5">
              {ALL_SECTIONS.map((s) => (
                <Label key={s} className="font-normal">
                  <Checkbox
                    // Named outright: the wrapping label names Base UI's hidden
                    // input, not the span that carries role="checkbox".
                    aria-label={SECTION_LABELS[s]}
                    checked={draft.sections.includes(s)}
                    onCheckedChange={(on) =>
                      set(
                        "sections",
                        // Kept in the canonical order, whatever order they were ticked in.
                        ALL_SECTIONS.filter((x) =>
                          x === s ? on : draft.sections.includes(x),
                        ),
                      )
                    }
                  />
                  {SECTION_LABELS[s]}
                </Label>
              ))}
            </div>
            {tried && sectionsError ? (
              <FieldError>{sectionsError}</FieldError>
            ) : null}
          </FieldSet>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {editing ? "Save changes" : "Save as draft"}
            </Button>
          </div>
        </form>

        <section aria-label="Preview" className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">
              {draft.title.trim() || "Untitled report"}
            </h3>
            <p className="text-muted-foreground text-xs">
              Preview · {DATASET_TITLE} · {scopeLabel(draft)}
            </p>
          </div>
          <ReportBody
            report={draft}
            data={data}
            styles={styles}
            onRetry={onRetry}
          />
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

type View =
  | { kind: "list" }
  | { kind: "report"; id: string }
  | { kind: "builder"; id: string | null };

/**
 * Reports: browse the saved ones, open one to read it, or build a new one over
 * the Lisbon trips feed.
 *
 * `status` is how the report catalogue itself is doing -- "loading" shows
 * skeletons in place of cards, "error" shows a retry. It is a prop rather than
 * internal state because the host owns that fetch. The trips each report draws
 * from are fetched here, once.
 */
export function ReportsWorkspace({
  className,
  reports: initial = SAMPLE_REPORTS,
  tripsUrl = DEFAULT_TRIPS_URL,
  status = "ready",
  onRetry,
  onSave,
}: {
  className?: string;
  reports?: Report[];
  /** The MDS trips CSV every report reads. */
  tripsUrl?: string;
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  /** Called after a report is created, edited or published. */
  onSave?: (report: Report) => void;
}) {
  const [reports, setReports] = React.useState(initial);
  const [view, setView] = React.useState<View>({ kind: "list" });
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("recent");
  const created = React.useRef(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const { state: data, retry } = useTrips(tripsUrl);
  const saved = useOperatorStyles();
  const styles = React.useMemo(
    () => resolveStyles(data.status === "ready" ? data.providers : [], saved),
    [data, saved],
  );

  const go = (next: View) => {
    setView(next);
    // Each view starts at its top, not wherever the last one was scrolled to.
    rootRef.current?.scrollTo({ top: 0 });
  };

  const commit = (report: Report) => {
    setReports((all) =>
      all.some((r) => r.id === report.id)
        ? all.map((r) => (r.id === report.id ? report : r))
        : [report, ...all],
    );
    onSave?.(report);
  };

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) =>
        statusFilter === "all"
          ? true
          : statusFilter === "scheduled"
            ? !!r.schedule
            : r.status === statusFilter,
      )
      .filter(
        (r) => !q || `${r.title} ${r.description}`.toLowerCase().includes(q),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.title.localeCompare(b.title)
          : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [reports, query, statusFilter, sort]);

  const open =
    view.kind === "report" ? reports.find((r) => r.id === view.id) : undefined;
  const editing =
    view.kind === "builder" && view.id
      ? reports.find((r) => r.id === view.id)
      : undefined;

  let body: React.ReactNode;
  if (view.kind === "builder") {
    body = (
      <ReportBuilder
        // Remount per report, so the form never carries one report's edits into another.
        key={view.id ?? "new"}
        initial={editing ?? BLANK}
        editing={!!editing}
        data={data}
        styles={styles}
        onRetry={retry}
        onCancel={() =>
          go(editing ? { kind: "report", id: editing.id } : { kind: "list" })
        }
        onSave={(d) => {
          const report: Report = editing
            ? { ...editing, ...d, updatedAt: new Date().toISOString() }
            : {
                ...d,
                id: `report-${Date.now().toString(36)}-${++created.current}`,
                status: "draft",
                owner: "You",
                updatedAt: new Date().toISOString(),
              };
          commit(report);
          go({ kind: "report", id: report.id });
        }}
      />
    );
  } else if (open) {
    body = (
      <ReportView
        report={open}
        data={data}
        styles={styles}
        onRetry={retry}
        onBack={() => go({ kind: "list" })}
        onEdit={() => go({ kind: "builder", id: open.id })}
        onPublish={() =>
          commit({
            ...open,
            status: "published",
            updatedAt: new Date().toISOString(),
          })
        }
      />
    );
  } else {
    body = (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
            <p className="text-muted-foreground text-sm">
              Saved views of your data, to read, export or send on a schedule
            </p>
          </div>
          <Button onClick={() => go({ kind: "builder", id: null })}>
            <Plus data-icon="inline-start" />
            New report
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="min-w-48 flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports"
              aria-label="Search reports"
            />
          </InputGroup>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)}
          >
            <SelectTrigger className="w-36" aria-label="Show">
              <SelectValue>
                {(v: string) => STATUS_FILTERS[v as StatusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {STATUS_FILTERS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(v) => setSort((v ?? "recent") as SortKey)}
          >
            <SelectTrigger className="w-36" aria-label="Sort">
              <SelectValue>{(v: string) => SORTS[v as SortKey]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORTS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {status === "loading" ? (
          <div
            role="status"
            aria-label="Loading reports"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
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
                {query ? <Search /> : <FileText />}
              </EmptyMedia>
              <EmptyTitle>
                {query
                  ? "No results"
                  : statusFilter === "all"
                    ? "No reports yet"
                    : `No ${STATUS_FILTERS[statusFilter].toLowerCase()} reports`}
              </EmptyTitle>
              <EmptyDescription>
                {query
                  ? `No report matches “${query}”.`
                  : "Build one from your data to read it here, export it or send it on a schedule."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {query ? (
                <Button variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => go({ kind: "builder", id: null })}>
                  <Plus data-icon="inline-start" />
                  New report
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <li key={r.id} className="flex min-w-0">
                <ReportCard
                  report={r}
                  data={data}
                  onOpen={() => go({ kind: "report", id: r.id })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

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
      {body}
    </div>
  );
}

export default ReportsWorkspace;
