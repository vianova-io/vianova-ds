"use client";

import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  compareBlockedReason,
  compareCounts,
  divergingColor,
  divergingLegend,
  divergingOpacity,
  metricValue,
  percentChange,
  periodLength,
  previousPeriod,
  symmetricLimit,
  PERCENT_FLOOR,
  type CompareMetric,
  type Comparison,
  type Period,
} from "@/registry/vianova/lib/compare";
import { parseCsv } from "@/registry/vianova/lib/csv";
import {
  districtLocator,
  readDistricts,
  type District,
} from "@/registry/vianova/lib/districts";
import { LegendRamp } from "@/registry/vianova/product/legend-ramp";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Change mode on Zones -- the map half of the compare-date pass.
 *
 * A PROTOTYPE, and deliberately a route rather than a change to
 * `blocks/map-workspace.tsx`. The block composes one self-contained
 * `SampleMapLayer` per layer, each owning its own filter, colorize chain and
 * visualization state; colouring a zones layer by a quantity counted out of a
 * DIFFERENT layer has no home in that design yet, and inventing one before the
 * model is agreed would be the expensive way to find out it was wrong. The
 * mechanism underneath is the real one: the real `lib/compare.ts`, the real
 * districts and infringements CSVs, the real MapCanvas and LegendRamp.
 *
 * What it demonstrates, in the order the study argues them:
 *   1. The difference is carried by COLOUR, and the colour encodes the SIGN of
 *      the change -- not which period. One ramp, not two.
 *   2. Symmetric limits around a pinned zero, so "no change" cannot drift onto
 *      a colour.
 *   3. A transparent midpoint with the outline always drawn, so "no change"
 *      and "no data" never look alike.
 *   4. The percentage floor, which is what stops the map becoming a map of
 *      small denominators.
 *   5. A layer whose rows are a snapshot refuses to be compared, with a reason.
 */

declare const process: { env: Record<string, string | undefined> };
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WORKER_URL = `${BASE_PATH}/maplibre/maplibre-gl-worker.mjs`;
const data = (file: string) => `${BASE_PATH}/data/${file}`;

const FILL = "districts-change-fill";
const OUTLINE = "districts-change-outline";
const SOURCE = "districts-change";

/**
 * The layers this prototype can count into the districts.
 *
 * The third one is the point: it is a snapshot, it carries a timestamp column
 * that looks filterable, and compare has to refuse it.
 */
const SOURCES = [
  {
    id: "infringements",
    label: "Parking infringements",
    file: "infringements-lisbon.csv",
    dateColumn: "detected_at",
    geometryColumn: "location",
    temporal: "events",
    noun: "infringements",
  },
  {
    id: "events",
    label: "Vehicle events",
    file: "mds-events-lisbon.csv",
    dateColumn: "event_time",
    geometryColumn: "location",
    temporal: "events",
    noun: "events",
  },
  {
    id: "vehicles",
    label: "Vehicle snapshot",
    file: "mds-vehicles-lisbon.csv",
    dateColumn: "last_event_time",
    geometryColumn: "location",
    temporal: "snapshot",
    noun: "vehicles",
  },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

/**
 * Ranges that stay inside the sample data, which is September 2026 only.
 *
 * Each one's comparison is derived, not stored -- `previousPeriod` is the
 * default a reader expects and the same derivation the dashboard uses.
 */
const RANGES: { label: string; period: Period }[] = [
  { label: "16–30 Sep", period: { start: "2026-09-16", end: "2026-09-30" } },
  { label: "23–30 Sep", period: { start: "2026-09-23", end: "2026-09-30" } },
  { label: "8–14 Sep", period: { start: "2026-09-08", end: "2026-09-14" } },
];

/** `POINT (-9.1 38.7)` to a pair, or null. */
function pointOf(cell: string): [number, number] | null {
  const m = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)/i.exec(cell);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

const short = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

/**
 * Whether the page is rendering dark.
 *
 * The outline colour has to follow it. MapLibre paint cannot read a CSS
 * variable, so a hardcoded ink outline is invisible against the dark basemap
 * -- and the outline is doing real work here: it is the only thing keeping an
 * unchanged district (a near-transparent fill) distinct from one with no data.
 */
function useDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () =>
      setDark(
        document.documentElement.classList.contains("dark") ||
          (!document.documentElement.classList.contains("light") &&
            query.matches),
      );
    read();
    query.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      query.removeEventListener("change", read);
      observer.disconnect();
    };
  }, []);
  return dark;
}

export default function CompareMapPage() {
  const [districts, setDistricts] = React.useState<District[]>([]);
  const [rows, setRows] = React.useState<{ key: string | null; at: string }[]>(
    [],
  );
  const [sourceId, setSourceId] = React.useState<SourceId>("infringements");
  const [rangeIndex, setRangeIndex] = React.useState(0);
  const [comparing, setComparing] = React.useState(true);
  const [metric, setMetric] = React.useState<CompareMetric>("absolute");
  const [loading, setLoading] = React.useState(true);
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const dark = useDark();

  const source = SOURCES.find((s) => s.id === sourceId) ?? SOURCES[0];
  const blocked = compareBlockedReason(source.temporal);
  const period = RANGES[rangeIndex]?.period ?? RANGES[0]!.period;
  const previous = React.useMemo(() => previousPeriod(period), [period]);

  /* ---------------------------------------------------------------- data -- */

  React.useEffect(() => {
    let live = true;
    fetch(data("districts-lisbon.csv"))
      .then((r) => r.text())
      .then((text) => {
        if (!live) return;
        const { header, rows: raw } = parseCsv(text);
        setDistricts(readDistricts({ header, rows: raw }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // The point-in-polygon join. Rebuilt only when the districts change, since
  // the locator precomputes a bounding box per ring.
  const locate = React.useMemo(
    () => (districts.length ? districtLocator(districts) : null),
    [districts],
  );

  React.useEffect(() => {
    if (!locate) return;
    let live = true;
    setLoading(true);
    fetch(data(source.file))
      .then((r) => r.text())
      .then((text) => {
        if (!live) return;
        const parsed = parseCsv(text);
        const at = (name: string) => parsed.header.indexOf(name);
        const timeAt = at(source.dateColumn);
        const geoAt = at(source.geometryColumn);
        const out: { key: string | null; at: string }[] = [];
        if (timeAt >= 0 && geoAt >= 0) {
          for (const row of parsed.rows) {
            const point = pointOf(row[geoAt] ?? "");
            out.push({
              key: point ? locate(point[0], point[1]) : null,
              at: row[timeAt] ?? "",
            });
          }
        }
        setRows(out);
        setLoading(false);
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [locate, source]);

  /* ------------------------------------------------------------ compare -- */

  const names = React.useMemo(() => districts.map((d) => d.name), [districts]);

  /**
   * Counted over EVERY district, not just the ones with rows, so a district
   * that emptied shows as a fall instead of disappearing.
   */
  const comparisons = React.useMemo(
    () =>
      compareCounts({
        rows,
        keyOf: (r) => r.key,
        timeOf: (r) => r.at,
        period,
        previous,
        keys: names,
      }),
    [rows, period, previous, names],
  );

  const values = React.useMemo(
    () => comparisons.map((c) => metricValue(c, metric)),
    [comparisons, metric],
  );
  const limit = React.useMemo(() => symmetricLimit(values), [values]);

  /** Current-period counts, for the levels view when compare is off. */
  const levelLimit = React.useMemo(
    () => Math.max(1, ...comparisons.map((c) => c.now)),
    [comparisons],
  );

  const byName = React.useMemo(
    () => new Map(comparisons.map((c) => [c.key, c])),
    [comparisons],
  );

  const withheld = React.useMemo(
    () =>
      metric === "percent" && comparing
        ? comparisons.filter((c) => c.percent === null && c.previous < PERCENT_FLOOR)
            .length
        : 0,
    [comparisons, metric, comparing],
  );

  /* ---------------------------------------------------------------- map -- */

  const geojson = React.useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: districts.map((d) => {
        const row = byName.get(d.name);
        const value = row ? metricValue(row, metric) : null;
        // Compare off: the ordinary single-period choropleth, one sequential
        // hue. Compare on: the sign of the change, on the diverging pair.
        const color = comparing
          ? divergingColor(value ?? 0, limit)
          : "#0f766e";
        const opacity = comparing
          ? divergingOpacity(value, limit)
          : 0.12 + 0.68 * ((row?.now ?? 0) / levelLimit);
        return {
          type: "Feature" as const,
          properties: {
            name: d.name,
            color,
            opacity,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [d.ring],
          },
        };
      }),
    };
  }, [districts, byName, metric, comparing, limit, levelLimit]);

  React.useEffect(() => {
    if (!map) return;
    const existing = map.getSource(SOURCE);
    if (existing && "setData" in existing) {
      (existing as { setData: (d: unknown) => void }).setData(geojson);
      return;
    }
    map.addSource(SOURCE, { type: "geojson", data: geojson });
    map.addLayer({
      id: FILL,
      type: "fill",
      source: SOURCE,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["get", "opacity"],
      },
    });
    // Always drawn, at full strength, whatever the fill is doing. This is what
    // keeps "no change" -- a near-transparent fill -- distinct from "no data".
    map.addLayer({
      id: OUTLINE,
      type: "line",
      source: SOURCE,
      paint: {
        "line-color": dark ? "#e2e8f0" : "#0f172a",
        "line-opacity": 0.45,
        "line-width": 0.8,
      },
    });
  }, [map, geojson, dark]);

  // The outline is added once with the source; recolour it when the theme
  // flips rather than tearing the layer down.
  React.useEffect(() => {
    if (!map?.getLayer(OUTLINE)) return;
    map.setPaintProperty(OUTLINE, "line-color", dark ? "#e2e8f0" : "#0f172a");
  }, [map, dark]);

  /* --------------------------------------------------------------- view -- */

  const ranked = React.useMemo(
    () =>
      [...comparisons]
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 12),
    [comparisons],
  );
  const rankPeak = Math.max(1, ...ranked.map((r) => Math.max(r.now, r.previous)));

  const unit = metric === "percent" ? "%" : ` ${source.noun}`;
  const legend = divergingLegend(limit, 9);

  return (
    <main className="bg-background text-foreground flex h-svh flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-base font-semibold">Change on Zones</h1>
        <p className="text-muted-foreground text-xs">
          {source.noun} per district, {short(period.start)}–{short(period.end)}
          {comparing && !blocked ? (
            <> vs {short(previous.start)}–{short(previous.end)}</>
          ) : null}{" "}
          · {periodLength(period)} days
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Field label="Layer">
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value as SourceId)}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date">
          {/* SegmentedControl is w-full with evenly divided items and no
              horizontal padding of its own -- it is built to fill a panel, so
              in a toolbar row it has to be given a width. */}
          <SegmentedControl
            className="w-[232px]"
            value={String(rangeIndex)}
            onValueChange={(v) => setRangeIndex(Number(v))}
            items={RANGES.map((r, i) => ({
              value: String(i),
              label: r.label,
            }))}
          />
        </Field>

        <Field label="Compare">
          <button
            type="button"
            disabled={!!blocked}
            onClick={() => setComparing((c) => !c)}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
              blocked
                ? "border-input text-muted-foreground cursor-not-allowed opacity-60"
                : comparing
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent",
            )}
          >
            {comparing && !blocked ? "On" : "Off"}
          </button>
        </Field>

        {comparing && !blocked ? (
          <Field label="Measure">
            <SegmentedControl
              className="w-[176px]"
              value={metric}
              onValueChange={(v) => setMetric(v as CompareMetric)}
              items={[
                { value: "absolute", label: "Absolute" },
                { value: "percent", label: "% change" },
              ]}
            />
          </Field>
        ) : null}
      </div>

      {blocked ? (
        <p className="border-input bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs">
          <b className="text-foreground font-medium">
            Compare is unavailable for this layer.
          </b>{" "}
          {blocked} Its <code className="text-[11px]">last_event_time</code>{" "}
          column looks filterable, but filtering it gives a map of which
          vehicles happened to report in the window, not a period.
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="border-input relative min-h-64 overflow-hidden rounded-lg border">
          <MapCanvas
            className="absolute inset-0"
            workerUrl={WORKER_URL}
            center={[-9.145, 38.725]}
            zoom={11.6}
            onStyleReady={setMap}
          />

          {/* Top-left, not bottom-left: MapCanvas puts its own compass and
              attribution along the bottom edge, and they draw over a legend
              parked there. */}
          <div className="bg-card/95 border-input absolute left-3 top-3 w-60 rounded-md border p-2.5 shadow-sm backdrop-blur">
            {comparing && !blocked ? (
              <>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                  Change in {source.noun}
                </p>
                <LegendRamp
                  colors={legend.map((l) => l.color)}
                  ticks={[
                    `−${Math.round(limit)}${unit}`,
                    "0",
                    `+${Math.round(limit)}${unit}`,
                  ]}
                />
                <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
                  Symmetric around zero — unchanged districts stay neutral.
                  {withheld > 0 ? (
                    <>
                      {" "}
                      {withheld} district{withheld === 1 ? "" : "s"} held at
                      neutral: under {PERCENT_FLOOR} {source.noun} before, too
                      few for a percentage.
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                  {source.noun} this period
                </p>
                <LegendRamp
                  colors={Array.from(
                    { length: 9 },
                    (_, i) =>
                      // The same single hue the fill uses, stepped by the same
                      // opacity the layer paints with, so the legend and the
                      // map cannot drift.
                      `color-mix(in oklab, #0f766e ${Math.round(12 + (i * 68) / 8)}%, transparent)`,
                  )}
                  ticks={["0", `${Math.round(levelLimit / 2)}`, `${levelLimit}`]}
                />
                <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
                  One sequential hue. Turn Compare on to see what moved.
                </p>
              </>
            )}
          </div>
        </div>

        {/* The widget panel. The treatment previewed here is what
            `RankedBars` would take a `previous` prop to do: same hue for both
            periods, the earlier one faded behind, and a NEUTRAL delta -- the
            component cannot know whether more infringements is good news. */}
        <aside className="border-input flex min-h-0 flex-col overflow-hidden rounded-lg border">
          <div className="border-input border-b px-3 py-2">
            <h2 className="text-sm font-medium">
              {comparing && !blocked ? "Districts by change" : "Districts"}
            </h2>
            <p className="text-muted-foreground text-[11px]">
              {loading
                ? "Loading…"
                : comparing && !blocked
                  ? "Ranked by how much moved"
                  : "Ranked by this period"}
            </p>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto p-2">
            {ranked.map((row) => (
              <Row
                key={row.key}
                row={row}
                peak={rankPeak}
                comparing={comparing && !blocked}
                metric={metric}
              />
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap [&_button]:whitespace-nowrap">
      <span className="text-muted-foreground text-[11px] font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({
  row,
  peak,
  comparing,
  metric,
}: {
  row: Comparison;
  peak: number;
  comparing: boolean;
  metric: CompareMetric;
}) {
  const pct = percentChange(row.now, row.previous);
  const delta =
    metric === "percent"
      ? pct === null
        ? "—"
        : `${pct > 0 ? "+" : "−"}${Math.abs(Math.round(pct))}%`
      : signed(row.delta);

  return (
    <li className="group rounded px-1.5 py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs">{row.key}</span>
        <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
          <span className="text-xs font-medium">{row.now}</span>
          {comparing ? (
            // Neutral, never green-up / red-down: the component cannot know
            // whether more of this is good.
            <span className="text-muted-foreground bg-muted rounded px-1 text-[10px]">
              {delta}
            </span>
          ) : null}
        </span>
      </div>
      <div className="relative h-1.5">
        {comparing ? (
          // The earlier period: SAME hue, faded. Identity, not a second
          // colour -- the rule the dashboard's bars already follow.
          <div
            className="bg-primary-ink/25 absolute inset-y-0 left-0 rounded-sm"
            style={{ width: `${(row.previous / peak) * 100}%` }}
          />
        ) : null}
        <div
          className="bg-primary absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${(row.now / peak) * 100}%`, opacity: 0.85 }}
        />
      </div>
    </li>
  );
}
