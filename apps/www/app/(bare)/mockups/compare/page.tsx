"use client";

import * as React from "react";

import { PERIODS } from "./data";
import {
  Barlist,
  Donut,
  Kpi,
  Matrix,
  Sankey,
  SeriesBar,
  SeriesLine,
  SeriesTable,
} from "./treatments";

/**
 * Compare-date treatments, one per chart type.
 *
 * TEMPORARY. Deleted in the commit that implements whichever treatments win.
 *
 * ## What this page is for
 *
 * The dashboard already knows how to compute a previous period -- the
 * `previousPeriod()` / `comparing()` machinery in `dashboard-workspace` -- but
 * only the series family and KPIs ever drew it. Barlist, donut and matrix
 * ignore it entirely, and sankey is not a widget kind at all. This page
 * proposes what each of the eight should do, so the question can be settled by
 * looking rather than by describing.
 *
 * The brief it was built to:
 *   - best fit PER chart type, with one shared vocabulary -- colour, legend,
 *     delta and wording are constant; the mechanics are not,
 *   - the compare date is a DASHBOARD-level filter, so no card asks for one,
 *   - a per-card control ONLY where there is a genuine choice, which is the
 *     two charts that cannot overlay: matrix and sankey.
 *
 * The toggle below is a stand-in for that dashboard filter. Turning compare
 * off is not decoration: half of reviewing a comparison treatment is checking
 * that the chart still looks right -- and uncluttered -- when there is nothing
 * to compare against.
 */
export default function CompareMockupPage() {
  const [on, setOn] = React.useState(true);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold">Compare date — treatments</h1>
          <p className="text-sm text-muted-foreground">
            One proposal per chart type. Mockup, not shipped code. Every card
            here is 544px wide; the companion page renders the same eight at
            the four widths a real dashboard widget can have.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="size-4 accent-[var(--chart-categorical-1)]"
            />
            Compare to previous period
          </label>
          <span className="font-mono text-xs text-muted-foreground">
            {PERIODS.current.range}
            {on ? ` vs ${PERIODS.previous.range}` : null}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Stands in for the dashboard filter — in the real thing this lives
            once, at the top of the dashboard.
          </span>
        </div>
      </header>

      {on ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SeriesLine />
          <SeriesBar />
          <Barlist />
          <SeriesTable />
          <Kpi />
          <Donut />
          {/* Full width: both need the horizontal room to be judged at all. */}
          <div className="lg:col-span-2">
            <Matrix />
          </div>
          <div className="lg:col-span-2">
            <Sankey />
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Compare is off. Each chart renders exactly as it does today — no
          legend, no delta, no second series. Turn it back on to see the
          treatments.
        </p>
      )}
    </main>
  );
}
