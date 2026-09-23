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
        "relative isolate h-[700px] w-full overflow-hidden rounded-xl border border-border",
        className,
      )}
    >
      <MapCanvas
        className="absolute inset-0"
        mapboxToken={mapboxToken}
        workerUrl="/maplibre/maplibre-gl-worker.mjs"
        center={[-1.6778, 48.1173]}
        zoom={11.5}
        fallback={<MapFallback />}
      />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex h-14 items-center gap-2 px-4">
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu />
        </Button>
        <span className="text-sm font-medium">Carte d&rsquo;Exploration</span>

        <div className="mx-auto flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Layers">
            <Layers />
          </Button>
          <InputGroup className="w-[320px] bg-card/95 backdrop-blur">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search for places, POIs" />
          </InputGroup>
          <Button variant="secondary" size="icon" aria-label="Select tool">
            <MousePointer2 />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Charts">
            <BarChart3 />
          </Button>
        </div>

        <Button size="sm" className="gap-1.5">
          <Sparkles className="size-4" />
          Export report
        </Button>
      </div>

      {/* Data panel */}
      <FloatingPanel className="absolute left-4 top-16 max-h-[calc(100%-10rem)] w-[340px]">
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
      <FloatingPanel className="absolute right-4 top-16 max-h-[calc(100%-10rem)] w-[340px]">
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

      <MapControls className="absolute bottom-4 right-4" basemapLabel="Plan" />
    </div>
  );
}

export default ExploreMap;
