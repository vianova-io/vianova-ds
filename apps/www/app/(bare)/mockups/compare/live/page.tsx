"use client";

import * as React from "react";

import { DashboardWorkspace } from "@/registry/vianova/blocks/dashboard-workspace";

/**
 * The real dashboard, on a bare page, with the compare date working.
 *
 * TEMPORARY, like its sibling pages: the block itself is the deliverable, and
 * this route exists only because the docs shell takes minutes to compile and
 * puts a sidebar, a theme switcher and a table of contents between the
 * reviewer and the thing being reviewed.
 *
 * What to do on it, in order:
 *   1. Open a dashboard. Set a date range, then turn Compare on.
 *   2. Watch the bar list, the donut, the heatmap and the flow chart -- the
 *      four that ignored the previous period until now.
 *   3. Switch the data layer. Trips, fleet events and infringements are three
 *      different shapes, and the charts are supposed to survive all three.
 */
export default function CompareLivePage() {
  return (
    <main className="bg-background min-h-screen p-4">
      <DashboardWorkspace className="h-[calc(100svh-2rem)] md:h-[calc(100svh-2rem)] lg:h-[calc(100svh-2rem)]" />
    </main>
  );
}
