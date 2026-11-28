"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/registry/vianova/ui/chart";
import { ActivityHeatmap } from "@/registry/vianova/product/activity-heatmap";
import { SankeyFlow } from "@/registry/vianova/product/sankey-flow";
import { cn } from "@/registry/vianova/lib/utils";

import {
  HOURS,
  PERIODS,
  WEEKDAYS,
  barlist,
  delta,
  donut,
  fmt,
  kpis,
  matrix,
  matrixCounts,
  matrixDiff,
  matrixMax,
  sankey,
  sankeyNodes,
  series,
  table,
} from "./data";
import {
  CURRENT,
  CompareLegend,
  DeltaChip,
  PREVIOUS_DASH,
  PREVIOUS_OPACITY,
  TreatmentCard,
  ViewSwitch,
} from "./vocabulary";

const config = {
  current: { label: PERIODS.current.label, color: CURRENT },
  previous: { label: PERIODS.previous.label, color: CURRENT },
} satisfies ChartConfig;

const axis = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 10 },
  className: "fill-muted-foreground",
} as const;

/* ======================================================= 1. series line === */

export function SeriesLine() {
  return (
    <TreatmentCard
      title="Trips per day"
      kind="series · line"
      note="Ghost line. Both periods on one axis, previous dashed and recessive behind current. This is the case where overlaying is simply correct — the shapes are directly comparable, the crossing in week three is visible at a glance, and nothing is hidden at any moment. No control: there is no second treatment worth offering."
    >
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis dataKey="day" interval={4} {...axis} />
          <YAxis width={44} tickFormatter={fmt} {...axis} />
          {/* Previous first, so current draws over it rather than under. */}
          <Line
            dataKey="previous"
            type="monotone"
            stroke="var(--color-previous)"
            strokeOpacity={PREVIOUS_OPACITY + 0.25}
            strokeDasharray={PREVIOUS_DASH}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="current"
            type="monotone"
            stroke="var(--color-current)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <CompareLegend className="mt-2" />
    </TreatmentCard>
  );
}

/* ======================================================== 2. series bar === */

export function SeriesBar() {
  // Ten days, not thirty: paired bars need width to stay distinguishable, and
  // sixty bars in 200px is a texture rather than a chart.
  const data = series.slice(0, 10);
  return (
    <TreatmentCard
      title="Trips per day"
      kind="series · bar"
      note="Paired bars, previous at lower opacity. Reads cleanly up to roughly a dozen categories and then collapses — which is the honest limit of this treatment, and the reason the line version keeps all thirty days while this one shows ten."
    >
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis dataKey="day" {...axis} />
          <YAxis width={44} tickFormatter={fmt} {...axis} />
          <Bar
            dataKey="previous"
            fill="var(--color-previous)"
            fillOpacity={PREVIOUS_OPACITY}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="current"
            fill="var(--color-current)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <CompareLegend className="mt-2" />
    </TreatmentCard>
  );
}

/* ====================================================== 3. series table === */

export function SeriesTable() {
  return (
    <TreatmentCard
      title="Trips by operator"
      kind="series · table"
      note="Columns, not colour. A table is the one place where the comparison can be exact rather than impressionistic, so it shows both figures and the change as a number. Voi has no previous value and says so instead of showing a misleading 100%."
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Operator</th>
            <th className="py-1.5 text-right font-medium">{PERIODS.current.label}</th>
            <th className="py-1.5 text-right font-medium">{PERIODS.previous.label}</th>
            <th className="py-1.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {table.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{fmt(r.current)}</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                {r.previous ? fmt(r.previous) : "—"}
              </td>
              <td className="py-1.5 text-right">
                <DeltaChip value={delta(r.current, r.previous)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TreatmentCard>
  );
}

/* ============================================================== 4. kpi === */

export function Kpi() {
  return (
    <TreatmentCard
      title="Headline metrics"
      kind="kpi"
      note="A number cannot overlay anything, so compare becomes a second, quieter number and a signed change. Note the arrow is directional only — never green-up/red-down, because this component cannot know whether more collisions is good news."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.id} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {typeof k.current === "number" && k.current < 100
                ? k.current.toFixed(2)
                : fmt(k.current)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {k.unit}
              </span>
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <DeltaChip value={delta(k.current, k.previous)} />
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                was{" "}
                {typeof k.previous === "number" && k.previous < 100
                  ? k.previous.toFixed(2)
                  : fmt(k.previous)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </TreatmentCard>
  );
}

/* ========================================================== 5. barlist === */

export function Barlist() {
  const max = Math.max(...barlist.map((r) => Math.max(r.current, r.previous)));
  return (
    <TreatmentCard
      title="Trips by operator"
      kind="barlist"
      note="One track per row: the solid bar is this period, the dashed tick is where the previous one reached. Rows stay in CURRENT order, so Tier visibly slipped below Dott rather than the whole list reshuffling — a side-by-side barlist would have moved both rows and shown neither change."
    >
      <div className="space-y-2.5">
        {barlist.map((r) => {
          const d = delta(r.current, r.previous);
          return (
            <div key={r.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>{r.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{fmt(r.current)}</span>
                  <DeltaChip value={d} />
                </span>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(r.current / max) * 100}%`, background: CURRENT }}
                />
                {r.previous ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-[-2px] w-0 border-l-2 border-dashed"
                    style={{
                      left: `${(r.previous / max) * 100}%`,
                      borderColor: CURRENT,
                      opacity: PREVIOUS_OPACITY + 0.35,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <CompareLegend className="mt-3" />
    </TreatmentCard>
  );
}

/* ============================================================ 6. donut === */

const DONUT_COLORS = [
  "var(--chart-categorical-1)",
  "var(--chart-categorical-2)",
  "var(--chart-categorical-3)",
  "var(--chart-categorical-4)",
];

/**
 * A donut, drawn for THIS period only.
 *
 * It stays a donut. The composition question -- what the mix is -- is what
 * the chart is for and what it answers well, so the chart keeps its job and
 * compare does not get to change it.
 *
 * Which leaves one decision: where the previous period goes. Not a second
 * ring, because two rings means judging two sets of angles against each
 * other at two different radii, and the inner ring's segments are shorter
 * for the same share. So the previous period is carried in the legend
 * underneath, as a figure and a signed change per slice -- numbers being
 * exactly what angles are bad at and a legend row is good at.
 */
const donutConfig = Object.fromEntries(
  donut.map((r, i) => [
    r.label,
    { label: r.label, color: DONUT_COLORS[i % DONUT_COLORS.length] ?? CURRENT },
  ]),
) satisfies ChartConfig;

/*
  118px, not 132. The ring plus a four-row legend has to clear a 2-row card,
  and at 132 it ran 6px past it at every width -- a chart that does not fit
  the size the library gives it is not finished.
*/
function DonutRing() {
  return (
    <ChartContainer config={donutConfig} className="aspect-auto h-[118px] w-full">
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={donut}
          dataKey="current"
          nameKey="label"
          innerRadius="56%"
          outerRadius="92%"
          /*
            The 2px surface ring is the house rule for adjacent fills: without
            it the boundary between two categorical hues reads as a third.
          */
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {donut.map((r, i) => (
            <Cell
              key={r.label}
              fill={DONUT_COLORS[i % DONUT_COLORS.length] ?? CURRENT}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export function Donut() {
  return (
    <TreatmentCard
      title="Trips by vehicle type"
      kind="donut"
      note="The donut stays a donut. The ring draws this period, and the previous one lives in the legend below as a figure and a signed change per slice — the comparison carried by numbers rather than by a second set of angles, which is the one thing a donut genuinely cannot show. Colour keeps meaning vehicle type in both periods, so no hue is spent on the comparison. If the previous composition has to be DRAWN rather than tabulated, the honest option is a second donut beside this one, not a second ring inside it: an inner ring's segments are shorter for the same share, which makes every slice look like it shrank."
    >
      <DonutRing />

      <ul className="mt-3 space-y-1.5 text-xs">
        {donut.map((r, i) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              {r.label}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono tabular-nums">{fmt(r.current)}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                was {fmt(r.previous)}
              </span>
              <DeltaChip value={delta(r.current, r.previous)} />
            </span>
          </li>
        ))}
      </ul>
    </TreatmentCard>
  );
}

/* =========================================================== 7. matrix === */

/**
 * The DS's own "Brown-Teal" diverging pair (`lib/color-ramp.ts`), flagged
 * colour-blind safe there. Red-Blue is the other one and is the more common
 * convention, but red already means "critical" in the status palette and
 * spending it on an arithmetic sign both misleads here and devalues it there.
 *
 * The neutral midpoint is `var(--card)` rather than the ramp's `#f5f5f5`, so
 * "no change" is the surface itself and the grid is correct in both themes
 * without a second set of values.
 */
const DIFF_UP = "#01665e";
const DIFF_DOWN = "#8c510a";
const DIFF_MAX = Math.max(...matrixDiff.flat().map(Math.abs));

function Heat({ period }: { period: "current" | "previous" }) {
  return (
    <ActivityHeatmap
      rows={WEEKDAYS}
      columns={HOURS}
      values={matrix[period]}
      counts={matrixCounts[period]}
      countUnit="trips"
      className="h-full"
    />
  );
}

/**
 * current - previous on one grid.
 *
 * Hand-rolled rather than `ActivityHeatmap`, because that component colours
 * from the map ramp and takes no ramp of its own -- a real gap if this view
 * is the one you pick, and the smallest honest fix is a `ramp` prop on it.
 */
function DiffGrid() {
  return (
    <div className="flex h-full flex-col gap-px text-[10px]">
      {WEEKDAYS.map((d, di) => (
        <div key={d} className="flex min-h-0 flex-1 items-center gap-1.5">
          <span className="w-7 shrink-0 text-muted-foreground">{d}</span>
          <div className="flex h-full min-w-0 flex-1 gap-px">
            {HOURS.map((h, hi) => {
              const v = matrixDiff[di]?.[hi] ?? 0;
              const n =
                (matrixCounts.current[di]?.[hi] ?? 0) -
                (matrixCounts.previous[di]?.[hi] ?? 0);
              const pct = Math.round((Math.abs(v) / DIFF_MAX) * 100);
              return (
                <div
                  key={h}
                  title={`${d} ${h}:00 — ${n > 0 ? "+" : ""}${fmt(n)} trips`}
                  className="min-w-0 flex-1 rounded-[1px] border border-border/30"
                  style={{
                    background: `color-mix(in oklab, ${
                      v >= 0 ? DIFF_UP : DIFF_DOWN
                    } ${pct}%, var(--card))`,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One ruler, drawn once -- the visible proof that there is only one. */
function ScaleLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span>0</span>
      {/*
        The heatmap colours from `--map-ramp-0..100` (activity-heatmap.tsx:159),
        so the legend is built from those same ten stops. A teal gradient here
        would be a legend for a chart that is not on the card.
      */}
      <span aria-hidden className="flex h-2 w-28 overflow-hidden rounded-full">
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            className="flex-1"
            style={{ background: `var(--map-ramp-${i * 10})` }}
          />
        ))}
      </span>
      <span className="tabular-nums">{fmt(matrixMax)} trips</span>
      <span className="opacity-70">— one scale, both periods</span>
    </div>
  );
}

function DiffLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">
        −{fmt(Math.round(DIFF_MAX * matrixMax))}
      </span>
      <span
        aria-hidden
        className="h-2 w-28 rounded-full"
        style={{
          background: `linear-gradient(to right, ${DIFF_DOWN}, var(--card), ${DIFF_UP})`,
        }}
      />
      <span className="tabular-nums">
        +{fmt(Math.round(DIFF_MAX * matrixMax))} trips
      </span>
      <span className="opacity-70">— no change is the card itself</span>
    </div>
  );
}

export function Matrix() {
  const [view, setView] = React.useState<"diff" | "side">("diff");
  return (
    <TreatmentCard
      title="Trips by weekday and hour"
      kind="matrix · heatmap"
      control={
        <ViewSwitch
          value={view}
          onChange={setView}
          /*
            Named for the question each answers, not the mechanism. "Side by
            side" describes a layout; "Levels" says what you will learn.
          */
          options={[
            { id: "diff", label: "Change" },
            { id: "side", label: "Levels" },
          ]}
        />
      }
      note="Here the colour already means the metric, so there is no faded second series to add — and two ramps would be two rulers. Change is the default: one grid, a diverging ramp, neutral at no-change, and you read the 08:00 block going brown and 17:00 going teal without being told. It is the one view that cannot report a level, so Levels keeps both grids on ONE shared maximum — which is why September is paler there, a fact the old per-period scaling hid. The wipe-reveal that used to sit here is gone: its only real advantage was making a moved peak unmissable, and Change does that without asking anyone to drag anything. It stays on the sankey, and it is the right control for a map, where two of them side by side will not fit."
    >
      <div className="space-y-2">
        {view === "side" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["previous", "current"] as const).map((p) => (
              <div key={p} className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  {PERIODS[p].label}{" "}
                  <span className="opacity-70">{PERIODS[p].range}</span>
                </p>
                <div className="h-[150px]">
                  <Heat period={p} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[170px]">
            <DiffGrid />
          </div>
        )}

        {view === "diff" ? <DiffLegend /> : <ScaleLegend />}
      </div>
    </TreatmentCard>
  );
}

/* =========================================================== 8. sankey === */

/**
 * Every origin-destination pair across both periods, with its change.
 *
 * Built once and shared by the Change ribbon colouring and the flow list, so
 * the two views cannot disagree about what moved.
 */
const FLOWS = (() => {
  const key = (f: { source: string; target: string }) => `${f.source}>${f.target}`;
  const prev = new Map(sankey.previous.map((f) => [key(f), f.value]));
  const curr = new Map(sankey.current.map((f) => [key(f), f.value]));
  const label = (id: string) =>
    sankeyNodes.find((n) => n.id === id)?.label ?? id;

  return [...new Set([...prev.keys(), ...curr.keys()])]
    .map((k) => {
      const [source = "", target = ""] = k.split(">");
      const current = curr.get(k) ?? 0;
      const previous = prev.get(k) ?? 0;
      return {
        key: k,
        source,
        target,
        label: `${label(source)} → ${label(target)}`,
        current,
        previous,
        change: current - previous,
      };
    })
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
})();

const FLOW_MAX_CHANGE = Math.max(...FLOWS.map((f) => Math.abs(f.change)));
const FLOW_MAX_VALUE = Math.max(...FLOWS.map((f) => f.current));

/** The heatmap's diverging rule, reused verbatim. One rule, two charts. */
const divergingFill = (change: number) =>
  `color-mix(in oklab, ${change >= 0 ? DIFF_UP : DIFF_DOWN} ${Math.round(
    (Math.abs(change) / FLOW_MAX_CHANGE) * 100,
  )}%, var(--card))`;

/** Proposal A: one diagram, ribbons coloured by direction of change. */
function FlowChange() {
  const byKey = new Map(FLOWS.map((f) => [f.key, f.change]));
  return (
    <SankeyFlow
      nodes={sankeyNodes}
      links={sankey.current}
      linkColor={({ source, target }) =>
        divergingFill(byKey.get(`${source}>${target}`) ?? 0)
      }
      className="h-full w-full"
    />
  );
}

/** Proposal D: not a sankey at all. */
function FlowList() {
  return (
    <div className="space-y-1.5">
      {FLOWS.map((f) => (
        <div key={f.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">{f.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums">{fmt(f.current)}</span>
              <DeltaChip value={f.previous ? f.change / f.previous : null} />
            </span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="rounded-full"
              style={{
                width: `${(f.current / FLOW_MAX_VALUE) * 100}%`,
                background: divergingFill(f.change),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FlowChangeLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">−{fmt(FLOW_MAX_CHANGE)}</span>
      <span
        aria-hidden
        className="h-2 w-24 rounded-full"
        style={{
          background: `linear-gradient(to right, ${DIFF_DOWN}, var(--card), ${DIFF_UP})`,
        }}
      />
      <span className="tabular-nums">+{fmt(FLOW_MAX_CHANGE)} trips</span>
      <span className="opacity-70">— thickness is still the volume</span>
    </div>
  );
}

export function Sankey() {
  const [view, setView] = React.useState<"change" | "list">("change");
  return (
    <TreatmentCard
      title="Trips from origin to destination"
      kind="sankey"
      control={
        <ViewSwitch
          value={view}
          onChange={setView}
          options={[
            { id: "change", label: "Change" },
            { id: "list", label: "Flow list" },
          ]}
        />
      }
      note="Two views, chosen after building four. CHANGE is the default: October's layout, each ribbon recoloured by its direction of travel — the heatmap's rule applied to ribbons, so Airport reads as pure gain. It needed a new `linkColor` prop on SankeyFlow, which tints by source otherwise. FLOW LIST is the drill-down: every origin-destination pair ranked by what moved, with the figures Change cannot report. The two that were cut: side-by-side diagrams, because Change already makes an appearing ribbon unmistakable and two sankeys at widget width are cramped; and the wipe-reveal, which is simply broken here — adding Airport shifts every node, so the two diagrams' labels land on top of each other rather than one ribbon changing."
    >
      <div className="space-y-2">
        {view === "change" ? (
          <div className="h-[240px]">
            <FlowChange />
          </div>
        ) : (
          <FlowList />
        )}

        {view === "change" ? <FlowChangeLegend /> : null}
      </div>
    </TreatmentCard>
  );
}

/* --------------------------------------------------------------- export -- */

export const TREATMENTS = [
  SeriesLine,
  SeriesBar,
  SeriesTable,
  Kpi,
  Barlist,
  Donut,
  Matrix,
  Sankey,
];

export { cn };
