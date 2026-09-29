"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  BarChart3,
  ChevronDown,
  Hash,
  Layers,
  ListFilter,
  Minimize2,
  MousePointer2,
  PanelLeft,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from "maplibre-gl";

import { Button } from "@/registry/vianova/ui/button";
import { ButtonGroup } from "@/registry/vianova/ui/button-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/registry/vianova/ui/chart";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/vianova/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardMetric,
} from "@/registry/vianova/product/chart-card";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import { FilterBuilder } from "@/registry/vianova/product/filter-builder";
import { FilterChipBar } from "@/registry/vianova/product/filter-chip-bar";
import {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";
import { LegendRamp, RAMP_STOPS } from "@/registry/vianova/product/legend-ramp";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapControls } from "@/registry/vianova/product/map-controls";
import { RankedBars } from "@/registry/vianova/product/ranked-bars";
import type { VisualizationTypeId } from "@/registry/vianova/product/visualization-picker";
import { useColorScheme } from "@/registry/vianova/hooks/use-color-scheme";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import {
  countConditions,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";
import { compileFilter } from "@/registry/vianova/lib/filter-eval";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node.
 * The expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM,
 * because Next substitutes that exact text at build time — routing it through
 * globalThis or an optional chain silently defeats the inlining.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WORKER_URL = `${BASE_PATH}/maplibre/maplibre-gl-worker.mjs`;

/**
 * Zürich vehicle flows, built from the network export by
 * `scripts/build-vehicle-flows.mjs`. Fetched rather than imported: it is 2MB,
 * and bundling it would put every byte in the JavaScript payload of a page
 * that has not decided to show a map yet.
 */
const DEFAULT_DATA_URL = `${BASE_PATH}/data/vehicle-flows.json`;

type FlowProperties = {
  name: string;
  road: string;
  speed: number;
  junction: boolean;
  volume: number;
  avg: number;
};

type FlowFeature = {
  type: "Feature";
  properties: FlowProperties;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

const ROAD_LABELS: Record<string, string> = {
  motorway: "Motorway",
  motorway_link: "Motorway link",
  trunk: "Trunk",
  trunk_link: "Trunk link",
  primary: "Primary",
  primary_link: "Primary link",
  secondary: "Secondary",
  secondary_link: "Secondary link",
  tertiary: "Tertiary",
  tertiary_link: "Tertiary link",
  residential: "Residential",
  living_street: "Living street",
  unclassified: "Unclassified",
};

/**
 * The fields the filter panel offers, matching the properties in the GeoJSON.
 *
 * Module scope, not a useMemo: FilterBuilder and the compiled predicate both
 * take this array, and a new array every render would rebuild the predicate on
 * every keystroke for no reason.
 */
const FILTER_FIELDS: FilterField[] = [
  {
    name: "road",
    label: "Road type",
    type: "enum",
    options: Object.entries(ROAD_LABELS).map(([value, label]) => ({ value, label })),
  },
  { name: "speed", label: "Speed limit", type: "number", unit: "km/h" },
  { name: "volume", label: "Vehicle volume", type: "number", unit: "vehicles" },
  { name: "junction", label: "At a junction", type: "boolean" },
  { name: "name", label: "Road name", type: "string" },
];

/**
 * A road network can be drawn five of the seven ways. It has no zone polygons
 * to fill and no timestamps to animate, so those two are offered greyed rather
 * than quietly doing nothing when clicked.
 */
const UNAVAILABLE: readonly VisualizationTypeId[] = ["zones", "trips"];

/** Every source and layer this block owns, so a redraw can clear them all. */
const SOURCES = ["flows-lines", "flows-points", "flows-cluster", "flows-grid"] as const;
const LAYERS = [
  "flows-line",
  "flows-point",
  "flows-heat",
  "flows-cluster-circle",
  "flows-cluster-count",
  "flows-cluster-single",
  "flows-grid-fill",
] as const;

/**
 * Point along the line at half its length, for the visualisations that need a
 * position rather than a path.
 *
 * Measured, not the middle vertex: vertices cluster where a road bends, so the
 * middle one sits at the sharpest corner rather than the middle of the
 * segment. Planar maths on degrees is fine at this scale -- the error over a
 * street is far below the 5-decimal precision the coordinates carry.
 */
function midpoint(coordinates: [number, number][]): [number, number] {
  if (coordinates.length < 2) return coordinates[0]!;
  const spans: number[] = [];
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const d = Math.hypot(
      coordinates[i]![0] - coordinates[i - 1]![0],
      coordinates[i]![1] - coordinates[i - 1]![1],
    );
    spans.push(d);
    total += d;
  }
  if (!total) return coordinates[0]!;
  let remaining = total / 2;
  for (let i = 0; i < spans.length; i++) {
    if (remaining <= spans[i]!) {
      const t = spans[i] ? remaining / spans[i]! : 0;
      const a = coordinates[i]!;
      const b = coordinates[i + 1]!;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= spans[i]!;
  }
  return coordinates[coordinates.length - 1]!;
}

/** Grid cell edge in metres. ~300m reads as city blocks at this extent. */
const CELL_METRES = 300;

/**
 * Bins the segment midpoints into equal-area-ish cells and sums their volume.
 *
 * A degree of longitude is shorter than a degree of latitude everywhere except
 * the equator, so the cell's width is divided by cos(latitude) -- without that
 * the "squares" come out visibly oblong at Zürich's 47°.
 */
function gridCells(points: { position: [number, number]; volume: number }[]) {
  const latSize = CELL_METRES / 111_320;
  const cells = new Map<string, { x: number; y: number; volume: number; count: number }>();
  for (const { position, volume } of points) {
    const lonSize = latSize / Math.max(0.1, Math.cos((position[1] * Math.PI) / 180));
    const x = Math.floor(position[0] / lonSize);
    const y = Math.floor(position[1] / latSize);
    const key = `${x}:${y}`;
    const cell = cells.get(key);
    if (cell) {
      cell.volume += volume;
      cell.count += 1;
    } else {
      cells.set(key, { x, y, volume, count: 1 });
    }
  }
  return [...cells.values()].map((cell) => {
    const lat0 = cell.y * latSize;
    const lonSize = latSize / Math.max(0.1, Math.cos(((lat0 + latSize / 2) * Math.PI) / 180));
    const lon0 = cell.x * lonSize;
    const lon1 = lon0 + lonSize;
    const lat1 = lat0 + latSize;
    return {
      type: "Feature" as const,
      properties: { volume: cell.volume, count: cell.count },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [lon0, lat0],
            [lon1, lat0],
            [lon1, lat1],
            [lon0, lat1],
            [lon0, lat0],
          ] as [number, number][],
        ],
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Scales                                                                      */
/* -------------------------------------------------------------------------- */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat("en");

/**
 * Quantile edges, one per ramp stop.
 *
 * Equal intervals are useless on this measure. Volume runs from 8 to 19,778
 * but its median is 251, so ten equal slices put ~97% of the network in the
 * first colour and leave nine colours for the motorways. Quantiles spend the
 * ramp where the roads actually are.
 *
 * Ties are collapsed rather than repeated: `step` requires strictly increasing
 * inputs and throws on a duplicate, and the lower deciles of a skewed count
 * repeat constantly.
 */
function quantileEdges(values: number[], count: number): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const edges: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = sorted[Math.floor(((sorted.length - 1) * i) / (count - 1))]!;
    if (!edges.length || v > edges[edges.length - 1]!) edges.push(v);
  }
  return edges;
}

/**
 * Resolves --map-ramp-* to real colours.
 *
 * MapLibre paints on a canvas and cannot read a CSS custom property, so the
 * values have to be pulled out of the cascade here. Read fresh on every sync
 * rather than cached: the ramp changes with the map scheme AND with light/dark,
 * and a cached copy is how the legend and the lines end up disagreeing.
 *
 * Resolved against the block's own element, not documentElement. The scheme is
 * set as `data-map-scheme` on that element so it applies to this map alone, and
 * the document root would report whatever the page-wide default is instead.
 */
function readRamp(scope: HTMLElement | null): string[] {
  if (typeof document === "undefined") return [];
  const style = getComputedStyle(scope ?? document.documentElement);
  return RAMP_STOPS.map((stop) => style.getPropertyValue(`--map-ramp-${stop}`).trim()).filter(
    Boolean,
  );
}

function colorExpression(
  ramp: string[],
  edges: number[],
  /** What to colour by. Defaults to the feature's own volume. */
  input: unknown = ["get", "volume"],
): DataDrivenPropertyValueSpecification<string> {
  if (ramp.length < 2 || edges.length < 2) return ramp[0] ?? "#888";
  // Built as a tuple rather than typed piecewise: a `step` expression is a
  // heterogeneous array the spec types cannot describe element by element.
  // One colour per band, sampled across the ramp so a short edge list still
  // spans the full scheme rather than crowding into its pale end.
  const steps: unknown[] = ["step", input, ramp[0]];
  for (let i = 1; i < edges.length; i++) {
    const colour = ramp[Math.round(((ramp.length - 1) * i) / (edges.length - 1))] ?? ramp.at(-1)!;
    steps.push(edges[i], colour);
  }
  return steps as DataDrivenPropertyValueSpecification<string>;
}

/** Busy roads read heavier, and everything thickens as you zoom in. */
function widthExpression(edges: number[]): DataDrivenPropertyValueSpecification<number> {
  const mid = edges[Math.floor(edges.length * 0.6)] ?? 1;
  const high = edges[Math.floor(edges.length * 0.9)] ?? mid + 1;
  const tier = (a: number, b: number, c: number): unknown =>
    high > mid ? ["step", ["get", "volume"], a, mid, b, high, c] : a;
  const expression: unknown[] = [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    tier(0.5, 0.9, 1.6),
    16,
    tier(1.4, 2.8, 5.5),
  ];
  return expression as DataDrivenPropertyValueSpecification<number>;
}

/* -------------------------------------------------------------------------- */
/* Block                                                                       */
/* -------------------------------------------------------------------------- */

const VOLUME_CONFIG = {
  volume: { label: "Vehicles", color: "var(--chart-1)" },
} satisfies ChartConfig;

const CHART_LAYERS: Record<string, string> = {
  flows: "Vehicle Flows",
  accidents: "Accidents ZH 2011-2023",
  overspeeding: "Overspeeding Events",
};

export function MapWorkspace({
  className,
  mapboxToken,
  dataUrl = DEFAULT_DATA_URL,
}: {
  className?: string;
  /**
   * Supply to render the genuine Mapbox Dark basemap. Without it the map uses
   * a free, token-free dark style — see MapCanvas for why Mapbox is opt-in.
   */
  mapboxToken?: string;
  /** GeoJSON LineStrings carrying the properties FILTER_FIELDS names. */
  dataUrl?: string;
}) {
  const [title, setTitle] = React.useState("Zürich vehicle flows");
  const [all, setAll] = React.useState<FlowFeature[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterGroup>(() => newGroup("and"));
  const [visible, setVisible] = React.useState(true);
  const [viz, setViz] = React.useState<VisualizationTypeId>("lines");
  const [chartLayer, setChartLayer] = React.useState("flows");
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  /**
   * Brand and Blue run light to dark, so their loudest colour is their
   * darkest -- which is the one that disappears into a dark basemap, leaving
   * the quietest streets the most visible thing on the map. Viridis runs the
   * other way, dark blue to bright yellow, so volume and prominence agree.
   * Set per block rather than globally: it is a property of this map's
   * basemap, not of the reader's whole theme.
   */
  const scheme = useColorScheme() ?? "dark";
  const mapScheme = scheme === "dark" ? "viridis" : "brand";

  React.useEffect(() => {
    let cancelled = false;
    fetch(dataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((collection: { features: FlowFeature[] }) => {
        if (!cancelled) setAll(collection.features);
      })
      // Installed without the data file, most likely. Say so in the panel
      // instead of leaving an empty map that looks like a rendering bug.
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  // One predicate drives the map AND the charts, so the totals beside the map
  // can never describe a different set of roads than the map is drawing.
  const predicate = React.useMemo(() => compileFilter(filter, FILTER_FIELDS), [filter]);
  const features = React.useMemo(
    () => (all ? all.filter((f) => predicate(f.properties)) : []),
    [all, predicate],
  );

  const points = React.useMemo(
    () =>
      features.map((f) => ({
        position: midpoint(f.geometry.coordinates),
        volume: f.properties.volume,
      })),
    [features],
  );

  const cells = React.useMemo(() => (viz === "grid" ? gridCells(points) : []), [viz, points]);

  /**
   * The legend describes whatever the active visualisation encodes. A grid
   * cell sums the segments inside it, so its numbers run an order of magnitude
   * above a single segment's -- showing the segment scale beside a grid would
   * mislabel every colour on the map.
   */
  const edges = React.useMemo(() => {
    const values =
      viz === "grid"
        ? cells.map((c) => c.properties.volume)
        : features.map((f) => f.properties.volume);
    return quantileEdges(values, RAMP_STOPS.length);
  }, [viz, cells, features]);

  /**
   * Adds the layer if it is missing, then pushes the current data, paint and
   * visibility. Safe to call repeatedly, which it has to be: it runs on every
   * filter change and again after each basemap swap.
   */
  const syncLayer = React.useCallback(
    (map: MapLibreMap) => {
      if (!map.isStyleLoaded()) return;

      // Torn down and rebuilt rather than diffed. Five visualisations need
      // different geometry, different source options (clustering is a property
      // of the SOURCE, not the layer) and different layer types, so there is no
      // shared shape to mutate -- and a stale layer left behind draws the old
      // visualisation underneath the new one.
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);
      if (!visible || !features.length) return;

      const ramp = readRamp(rootRef.current);
      const colour = colorExpression(ramp, edges);
      const hot = ramp.at(-1) ?? "#888";

      if (viz === "lines") {
        map.addSource("flows-lines", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
        map.addLayer({
          id: "flows-line",
          type: "line",
          source: "flows-lines",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colour,
            "line-width": widthExpression(edges),
            "line-opacity": 0.9,
          },
        });
        return;
      }

      if (viz === "grid") {
        map.addSource("flows-grid", {
          type: "geojson",
          data: { type: "FeatureCollection", features: cells },
        });
        map.addLayer({
          id: "flows-grid-fill",
          type: "fill",
          source: "flows-grid",
          // No fill-outline-color: it defaults to the fill, which is what a
          // choropleth wants. Outlining each cell in the ramp's brightest
          // colour draws a lattice that reads louder than the data inside it.
          paint: { "fill-color": colour, "fill-opacity": 0.75 },
        });
        return;
      }

      const pointFeatures = points.map(({ position, volume }) => ({
        type: "Feature" as const,
        properties: { volume },
        geometry: { type: "Point" as const, coordinates: position },
      }));

      if (viz === "clusters") {
        map.addSource("flows-cluster", {
          type: "geojson",
          data: { type: "FeatureCollection", features: pointFeatures },
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 15,
          // Summed here so the circle can be coloured by the MEAN below. A sum
          // would run far above any single segment and fall off the end of the
          // ramp the legend is describing; a mean stays on the same scale, so
          // one legend remains true for every visualisation.
          clusterProperties: { volume: ["+", ["get", "volume"]] },
        });
        map.addLayer({
          id: "flows-cluster-circle",
          type: "circle",
          source: "flows-cluster",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": colorExpression(ramp, edges, [
              "/",
              ["get", "volume"],
              ["get", "point_count"],
            ]),
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": hot,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "point_count"],
              2,
              10,
              50,
              18,
              300,
              30,
            ],
          },
        });
        map.addLayer({
          id: "flows-cluster-count",
          type: "symbol",
          source: "flows-cluster",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 11,
          },
          // No text-font: the basemap's glyph set is the only one guaranteed to
          // be available, and naming a face it does not ship drops the labels.
          paint: { "text-color": "#000", "text-halo-color": "#fff", "text-halo-width": 1 },
        });
        map.addLayer({
          id: "flows-cluster-single",
          type: "circle",
          source: "flows-cluster",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": colour,
            "circle-radius": 4,
            "circle-opacity": 0.9,
          },
        });
        return;
      }

      map.addSource("flows-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: pointFeatures },
      });

      if (viz === "heatmap") {
        map.addLayer({
          id: "flows-heat",
          type: "heatmap",
          source: "flows-points",
          paint: {
            // Weighted by volume, so a busy road counts for more than a quiet
            // one in the same place -- otherwise this draws where segments are
            // dense, which is a map of how the network was cut, not of traffic.
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "volume"],
              edges[0] ?? 0,
              0.05,
              edges.at(-1) ?? 1,
              1,
            ],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 2.4],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 16, 26],
            "heatmap-opacity": 0.85,
            // A heatmap ramp must start transparent at density 0 or it paints
            // the whole viewport with its lowest colour.
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.15,
              ramp[2] ?? "#444",
              0.4,
              ramp[5] ?? "#888",
              0.7,
              ramp[8] ?? "#ccc",
              1,
              hot,
            ],
          },
        });
        return;
      }

      // points, and the fallback for anything else selectable.
      map.addLayer({
        id: "flows-point",
        type: "circle",
        source: "flows-points",
        paint: {
          "circle-color": colour,
          "circle-opacity": 0.85,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ["interpolate", ["linear"], ["get", "volume"], edges[0] ?? 0, 1.5, edges.at(-1) ?? 1, 6],
            16,
            ["interpolate", ["linear"], ["get", "volume"], edges[0] ?? 0, 3, edges.at(-1) ?? 1, 16],
          ],
        },
      });
    },
    [viz, features, points, cells, edges, visible, mapScheme],
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (map) syncLayer(map);
  }, [syncLayer]);

  const stats = React.useMemo(() => {
    let total = 0;
    const byRoad = new Map<string, number>();
    const bySpeed = new Map<number, number>();
    const byName = new Map<string, number>();
    for (const { properties } of features) {
      total += properties.volume;
      byRoad.set(properties.road, (byRoad.get(properties.road) ?? 0) + properties.volume);
      bySpeed.set(properties.speed, (bySpeed.get(properties.speed) ?? 0) + properties.volume);
      byName.set(properties.name, (byName.get(properties.name) ?? 0) + properties.volume);
    }
    const roads = [...byRoad.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([key, volume]) => ({ label: ROAD_LABELS[key] ?? key, volume }));
    const speeds = [...bySpeed.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([limit, volume]) => ({ label: String(limit), volume }));
    const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const peak = top[0]?.[1] ?? 1;
    const ranked = top.map(([label, volume]) => ({
      label,
      percent: Math.round((volume / peak) * 100),
      count: compact.format(volume),
    }));
    return { total, roads, speeds, ranked };
  }, [features]);

  /** Six labels under eleven swatches: the domain, not the ramp's own stops. */
  const ticks = React.useMemo(() => {
    if (edges.length < 2) return undefined;
    return [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) =>
      compact.format(edges[Math.round((edges.length - 1) * f)]!),
    );
  }, [edges]);

  const loading = !all && !failed;
  const meta = failed
    ? "Data unavailable — vehicle-flows.json did not load"
    : all
      ? `${plain.format(features.length)} of ${plain.format(all.length)} segments · sum vehicle volume`
      : "Loading segments…";

  const conditions = countConditions(filter);

  return (
    <div
      ref={rootRef}
      data-map-scheme={mapScheme}
      className={cn(
        "relative isolate h-[760px] w-full overflow-hidden rounded-xl border border-border",
        className,
      )}
    >
      <MapCanvas
        className="absolute inset-0"
        mapboxToken={mapboxToken}
        workerUrl={WORKER_URL}
        center={[8.5417, 47.3769]} // Zürich, the extent of the flow export
        zoom={11.6}
        onStyleReady={(map) => {
          mapRef.current = map;
          syncLayer(map);
        }}
      />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex h-14 items-center gap-2 px-4">
        <Button variant="secondary" size="icon" aria-label="Collapse sidebar">
          <PanelLeft />
        </Button>
        <InlineEdit value={title} onValueChange={setTitle} label="Map name" className="font-medium" />

        <div className="mx-auto flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Data layers">
            <Layers />
          </Button>
          <InputGroup className="w-[320px] bg-card/95 backdrop-blur">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search for places, POIs" />
          </InputGroup>
          {/* Split control: the tool on the left, its alternatives on the
              right, so picking the current tool never costs a trip through a
              menu. */}
          <ButtonGroup>
            <Button variant="secondary" size="icon" aria-label="Drawing tools">
              <MousePointer2 />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Choose a drawing tool">
              <ChevronDown />
            </Button>
          </ButtonGroup>
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
          {/* p-2, not px-2 pb-2: the body scrolls, so a control flush against
              its top edge gets its focus ring sliced off. */}
          <div className="space-y-2 p-2">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search data" />
            </InputGroup>

            <DataLayerCard
              name="Vehicle Flows"
              meta={meta}
              metaIcon={<Hash />}
              visualizationType={viz}
              onVisualizationTypeChange={setViz}
              unavailableVisualizations={UNAVAILABLE}
              unavailableVisualizationReason="this layer is road segments, with no zone polygons and no timestamps"
              visible={visible}
              onVisibilityChange={setVisible}
              filters
              filterCount={conditions || undefined}
              legend={
                loading ? (
                  <Skeleton className="h-2.5 w-full" />
                ) : (
                  <LegendRamp ticks={ticks} showTicks={Boolean(ticks)} />
                )
              }
              filtersAction={
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" aria-label="Edit Vehicle Flows filters">
                        <ListFilter />
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[440px] p-3">
                    <FilterBuilder fields={FILTER_FIELDS} value={filter} onValueChange={setFilter} />
                  </PopoverContent>
                </Popover>
              }
              filtersContent={
                <FilterChipBar
                  value={filter}
                  fields={FILTER_FIELDS}
                  onValueChange={setFilter}
                  onClear={() => setFilter(newGroup("and"))}
                  emptyMessage="No filters — showing every measured segment."
                />
              }
            />

            <DataLayerCard name="Accidents ZH 2011-2023" expanded={false} visible={false} />
            <DataLayerCard name="Speed by Roads" expanded={false} visible={false} />
            <DataLayerCard name="Overspeeding Events" expanded={false} visible={false} />
            <DataLayerCard name="Overspeeding" expanded={false} visible={false} />
            <DataLayerCard name="Heavy braking Events" expanded={false} visible={false} />
          </div>
        </FloatingPanelBody>
      </FloatingPanel>

      {/* Charts panel */}
      <FloatingPanel className="absolute right-4 top-16 max-h-[calc(100%-10rem)] w-[340px]">
        <FloatingPanelHeader className="border-b border-border p-3">
          <FloatingPanelTitle className="px-0">Charts</FloatingPanelTitle>
          <FloatingPanelActions>
            <Button variant="ghost" size="icon-sm" aria-label="Collapse charts">
              <Minimize2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Add chart">
              <Plus />
            </Button>
          </FloatingPanelActions>
        </FloatingPanelHeader>

        <div className="space-y-2 p-2">
          <Select value={chartLayer} onValueChange={(value) => setChartLayer(value ?? "flows")}>
            <SelectTrigger className="w-full" aria-label="Chart source layer">
              {/* Base UI renders the raw value unless given a mapping, which
                  would show "flows" instead of the layer name. */}
              <SelectValue>{(value: string) => CHART_LAYERS[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHART_LAYERS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
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
          <div className="space-y-2 p-2">
            {chartLayer !== "flows" ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                No data loaded for {CHART_LAYERS[chartLayer]}.
              </p>
            ) : loading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-44 w-full" />
                <Skeleton className="h-44 w-full" />
              </>
            ) : (
              <>
                <ChartCard>
                  <ChartCardHeader title="Total vehicle volume" icon={<Hash />} />
                  {/* A hero number, with no ring drawn round it. A ring encodes
                      a share of something, and a running total is not a share
                      of anything. */}
                  <ChartCardMetric
                    value={compact.format(stats.total)}
                    unit={`vehicles · ${plain.format(features.length)} segments`}
                  />
                </ChartCard>

                <ChartCard>
                  <ChartCardHeader title="Volume by road type" icon={<BarChart3 />} />
                  {/* Horizontal: "Motorway link" and "Living street" do not fit
                      under a vertical bar at this width without turning
                      sideways or being cut in half. */}
                  <ChartContainer config={VOLUME_CONFIG} className="h-44 w-full">
                    <BarChart data={stats.roads} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={88}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="volume" fill="var(--color-volume)" radius={3} />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>

                <ChartCard>
                  <ChartCardHeader title="Volume by speed limit" icon={<BarChart3 />} />
                  <ChartContainer config={VOLUME_CONFIG} className="h-40 w-full">
                    {/* No negative left margin: these ticks read "3.2M", and
                        pulling the axis outside the plot clips the first
                        character against the panel. */}
                    <BarChart data={stats.speeds} margin={{ left: 0, top: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tickFormatter={(v: number) => compact.format(v)}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent labelFormatter={(l) => `${l} km/h`} />
                        }
                      />
                      <Bar dataKey="volume" fill="var(--color-volume)" radius={3} />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>

                <ChartCard>
                  <ChartCardHeader title="Busiest roads" icon={<BarChart3 />} />
                  {stats.ranked.length ? (
                    <RankedBars items={stats.ranked} />
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No segments match these filters.
                    </p>
                  )}
                </ChartCard>
              </>
            )}
          </div>
        </FloatingPanelBody>
      </FloatingPanel>

      {/* bottom-12, not bottom-4: the basemap attribution is a 24px bar pinned
          to the bottom-right of the canvas, and at bottom-4 it covers the
          zoom-out button completely. */}
      <MapControls className="absolute bottom-12 right-4" basemapLabel="Satellite" />
    </div>
  );
}

export default MapWorkspace;
