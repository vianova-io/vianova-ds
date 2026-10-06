"use client";

import * as React from "react";
import {
  BarChart3,
  Hash,
  Layers,
  Menu,
  MousePointer2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import { ActivityHeatmap } from "@/registry/vianova/product/activity-heatmap";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardMetric,
} from "@/registry/vianova/product/chart-card";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapControls } from "@/registry/vianova/product/map-controls";
import { RankedBars } from "@/registry/vianova/product/ranked-bars";
import { RAMP_STOPS } from "@/registry/vianova/product/legend-ramp";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Seeded PRNG. The generated network and heatmap must be identical on the
 * server and the client — Math.random() here hydration-mismatches every render.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHART_SOURCES: Record<string, string> = {
  routes: "Routes OD Logistiques",
  stops: "Arrêts logistiques",
};

const SEGMENTS = [
  { label: "Segment name 05", percent: 80, count: "8721" },
  { label: "Segment name 04", percent: 70, count: "1777" },
  { label: "Segment name 03", percent: 60, count: "188" },
  { label: "Segment name 02", percent: 50, count: "134" },
  { label: "Segment name 01", percent: 40, count: "102" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${h}:00`);

/* -------------------------------------------------------------------------- */
/* Map placeholder                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Offline fallback for the basemap. Used when WebGL is unavailable or the
 * style fails to load, so the panels stay usable instead of floating over a
 * blank rectangle. Draws a deterministic pseudo road network from the map
 * ramp tokens.
 */
function MapFallback() {
  const paths = React.useMemo(() => {
    const rand = mulberry32(20240525);
    const out: { d: string; stop: number; w: number }[] = [];
    for (let i = 0; i < 260; i++) {
      // Bias towards the centre so it reads like a city rather than noise.
      let x = 600 + (rand() - 0.5) * 1150;
      let y = 350 + (rand() - 0.5) * 640;
      const segs = 2 + Math.floor(rand() * 5);
      let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
      for (let s = 0; s < segs; s++) {
        x += (rand() - 0.5) * 170;
        y += (rand() - 0.5) * 140;
        d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
      const centrality = 1 - Math.min(1, Math.hypot(x - 600, y - 350) / 620);
      const stop = RAMP_STOPS[Math.min(10, Math.floor(centrality * 11))]!;
      out.push({ d, stop, w: 0.5 + centrality * 2.4 });
    }
    return out;
  }, []);

  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full bg-surface-sunken"
      aria-label="Map canvas placeholder"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          strokeLinecap="round"
          stroke={`var(--map-ramp-${p.stop})`}
          strokeWidth={p.w}
          opacity={0.75}
        />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Block                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The maplibre worker is served from the app's own `public/`, so it has to
 * carry whatever basePath that app is deployed under. `basePath` does not
 * rewrite a raw string like this one, so the prefix is applied here.
 *
 * In a root-served app -- the normal case, and the one you get by installing
 * this component -- NEXT_PUBLIC_BASE_PATH is unset and this resolves to the
 * plain "/maplibre/maplibre-gl-worker.mjs" that shipped before. Set it, and a
 * sub-path deployment corrects itself.
 *
 * Worth knowing: a worker that fails to load makes the map render NOTHING and
 * report no error at all, so a wrong value here is invisible, not loud.
 */
/**
 * Declared locally so this file compiles in a project without @types/node.
 *
 * The repo's registry smoke test installs these components into a bare TS
 * project and typechecks them, and it caught a bare `process` reference here:
 * a consumer who has not installed node types gets TS2580 the moment they add
 * this block. The expression still has to read `process.env.NEXT_PUBLIC_BASE_PATH`
 * VERBATIM, because Next substitutes that exact text at build time -- routing
 * it through globalThis or an optional chain silently defeats the inlining and
 * leaves the prefix empty.
 */
declare const process: { env: Record<string, string | undefined> };

const WORKER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`;

export function ExploreMap({
  className,
  mapboxToken,
}: {
  className?: string;
  /**
   * Supply to render the genuine Mapbox Dark basemap. Without it the map uses
   * a free, token-free dark style — see MapCanvas for why Mapbox is opt-in.
   */
  mapboxToken?: string;
}) {
  /**
   * Which overlay panel is showing. Only consulted below lg, where the two
   * panels share the bottom of the block; from lg up CSS shows both and this
   * has no effect. See the longer note in map-workspace.tsx for why this is
   * state and a media query rather than useIsMobile().
   */
  const [pane, setPane] = React.useState<"data" | "charts">("data");
  // Namespaced so aria-controls still resolves if two of these share a page.
  const uid = React.useId();
  const dataPaneId = `${uid}-data`;
  const chartsPaneId = `${uid}-charts`;

  const heatmap = React.useMemo(() => {
    const rand = mulberry32(778899);
    return DAYS.map(() =>
      Array.from({ length: 24 }, (_, h) => {
        // Commute peaks make the grid read like real activity.
        const peak = Math.exp(-((h - 8) ** 2) / 8) + Math.exp(-((h - 18) ** 2) / 10);
        return Math.min(1, peak * 0.7 + rand() * 0.45);
      }),
    );
  }, []);

  return (
    <div
      className={cn(
        // svh rather than dvh, and a 480px floor for landscape phones -- see
        // the longer note on the same line in map-workspace.tsx.
        "relative isolate h-[max(480px,75svh)] w-full overflow-hidden rounded-xl border border-border md:h-[700px]",
        className,
      )}
    >
      <MapCanvas
        className="absolute inset-0"
        mapboxToken={mapboxToken}
        workerUrl={WORKER_URL}
        center={[-1.6778, 48.1173]}
        zoom={11.5}
        // Below lg this sits on a page that scrolls, so a one-finger drag must
        // reach the page rather than pan the map. Same boundary as the layout.
        cooperativeGesturesBelow={1024}
        fallback={<MapFallback />}
      />

      {/* Top bar. Below lg it keeps only the controls that do something; see
          the note on the same bar in map-workspace.tsx for the width budget
          this buys and why the menu button has to go with the rest. */}
      <div
        data-slot="map-toolbar"
        className="absolute inset-x-0 top-0 flex h-14 items-center gap-2 px-2 lg:px-4"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menu"
          className="hidden lg:inline-flex"
        >
          <Menu />
        </Button>
        {/* min-w-0 truncate, or this wraps to two lines inside a 56px row: a
            flex item will not shrink below its min-content width on its own,
            and the bar is overflow-hidden so there is nothing to scroll. */}
        <span className="min-w-0 truncate text-sm font-medium">
          Carte d&rsquo;Exploration
        </span>

        <div className="mx-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Layers"
            className="hidden lg:inline-flex"
          >
            <Layers />
          </Button>
          <InputGroup className="hidden w-[320px] bg-card/95 backdrop-blur lg:flex">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search for places, POIs" />
          </InputGroup>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Select tool"
            className="hidden lg:inline-flex"
          >
            <MousePointer2 />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Charts"
            className="hidden lg:inline-flex"
          >
            <BarChart3 />
          </Button>
        </div>

        {/* Panel switcher, below lg only. Disclosure semantics and the
            after:-inset-2 hit slop are explained in map-workspace.tsx. */}
        <div data-slot="panel-switcher" className="flex items-center gap-2 lg:hidden">
          {(
            [
              ["data", "Layers", Layers, dataPaneId],
              ["charts", "Charts", BarChart3, chartsPaneId],
            ] as const
          ).map(([id, label, Icon, controls]) => (
            <Button
              key={id}
              variant={pane === id ? "default" : "secondary"}
              size="icon"
              aria-label={label}
              aria-expanded={pane === id}
              aria-controls={controls}
              onClick={() => setPane(id)}
              className="relative after:absolute after:-inset-2 after:content-['']"
            >
              <Icon />
            </Button>
          ))}
        </div>

        <Button size="sm" className="gap-1.5" aria-label="Export report">
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Export report</span>
        </Button>
      </div>

      {/* Data panel */}
      {/* Docks to the bottom of the block below lg, returns to its 340px column
          from lg up. Every inset is named at both tiers because tailwind-merge
          does not pair them -- and bottom-10 clears MapLibre's attribution
          badge, which paints above this panel rather than below it. The full
          reasoning is in map-workspace.tsx. */}
      <FloatingPanel
        id={dataPaneId}
        className={cn(
          "absolute inset-x-2 bottom-10 top-auto max-h-[55%] w-auto",
          "lg:inset-x-auto lg:left-4 lg:right-auto lg:top-16 lg:bottom-auto lg:max-h-[calc(100%-10rem)] lg:w-[340px]",
          "lg:flex",
          pane === "data" ? "flex" : "hidden",
        )}
      >
        <FloatingPanelHeader>
          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="zones">Zones</TabsTrigger>
            </TabsList>
          </Tabs>
          <FloatingPanelActions>
            <Button variant="ghost" size="icon-sm" aria-label="Add data layer">
              <Plus />
            </Button>
          </FloatingPanelActions>
        </FloatingPanelHeader>

        <FloatingPanelBody>
          {/* p-2, not px-2 pb-2: FloatingPanelBody scrolls, so a control flush
    against its top edge gets its focus ring sliced off. */}
          <div className="space-y-2 p-2">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search data" />
            </InputGroup>

            <DataLayerCard
              name="Routes OD Logistiques"
              meta="Jan 1 – Dec 31, 2024 · Count distinct trip id"
              visualization="Lines"
              filterCount={3}
              defaultVisualization="lines"
            />
            <DataLayerCard name="Arrêts logistiques" expanded={false} visible={false} />
            <DataLayerCard name="Flux logistiques OD" expanded={false} visible={false} />
          </div>
        </FloatingPanelBody>
      </FloatingPanel>

      {/* Charts panel */}
      {/* Same docking rules as the data panel above. */}
      <FloatingPanel
        id={chartsPaneId}
        className={cn(
          "absolute inset-x-2 bottom-10 top-auto max-h-[55%] w-auto",
          "lg:inset-x-auto lg:right-4 lg:left-auto lg:top-16 lg:bottom-auto lg:max-h-[calc(100%-10rem)] lg:w-[340px]",
          "lg:flex",
          pane === "charts" ? "flex" : "hidden",
        )}
      >
        <FloatingPanelHeader className="border-b border-border p-3">
          <FloatingPanelTitle className="px-0">Charts</FloatingPanelTitle>
          <FloatingPanelActions>
            <Button variant="ghost" size="icon-sm" aria-label="Add chart">
              <Plus />
            </Button>
          </FloatingPanelActions>
        </FloatingPanelHeader>

        <div className="space-y-2 p-2">
          <Select defaultValue="routes">
            <SelectTrigger className="w-full">
              {/* Base UI renders the raw value unless given a mapping, which
                  would show "routes" instead of the layer name. */}
              <SelectValue>{(value: string) => CHART_SOURCES[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHART_SOURCES).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search charts" />
          </InputGroup>
        </div>

        <FloatingPanelBody>
          {/* p-2, not px-2 pb-2: FloatingPanelBody scrolls, so a control flush
    against its top edge gets its focus ring sliced off. */}
          <div className="space-y-2 p-2">
            <ChartCard>
              <ChartCardHeader title="Nombre de trajets uniques" icon={<Hash />} />
              <ChartCardMetric value="32 908" unit="Vehicles" />
            </ChartCard>

            <ChartCard>
              <ChartCardHeader
                title="Segments les plus fréquemment utilisés"
                icon={<Hash />}
              />
              <RankedBars items={SEGMENTS} />
            </ChartCard>

            <ChartCard>
              <ChartCardHeader title="Chronométrage du trajet" icon={<BarChart3 />} />
              <ActivityHeatmap rows={DAYS} columns={HOURS} values={heatmap} />
            </ChartCard>
          </div>
        </FloatingPanelBody>
      </FloatingPanel>

      {/* bottom-12, not bottom-4: the basemap attribution is a 24px bar
          pinned to the bottom-right of the canvas, and at bottom-4 it covers
          the zoom-out button completely. */}
      {/* Desktop only -- decorative in this block, so hiding it below lg costs
          no behaviour and frees the strip the docked panel needs. */}
      <MapControls
        className="absolute bottom-12 right-4 hidden lg:flex"
        basemapLabel="Plan"
      />
    </div>
  );
}

export default ExploreMap;
