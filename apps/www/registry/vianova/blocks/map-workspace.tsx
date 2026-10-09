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
import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
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
import {
  ColorizePanel,
  type ColorizeField,
} from "@/registry/vianova/product/colorize-panel";
import {
  sortStops,
  type ColorStop,
} from "@/registry/vianova/product/color-stop-slider";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import { FilterBuilder } from "@/registry/vianova/product/filter-builder";
import { FilterFacets } from "@/registry/vianova/product/filter-facets";
import {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";
import { LegendCategorical } from "@/registry/vianova/product/legend-categorical";
import { LegendRamp, RAMP_STOPS } from "@/registry/vianova/product/legend-ramp";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapControls } from "@/registry/vianova/product/map-controls";
import {
  PanelStep,
  PanelStepBody,
  PanelStepper,
} from "@/registry/vianova/product/panel-stepper";
import {
  PresetPicker,
  type ColorPalette,
} from "@/registry/vianova/product/preset-picker";
import { RankedBars } from "@/registry/vianova/product/ranked-bars";
import type { VisualizationTypeId } from "@/registry/vianova/product/visualization-picker";
import {
  useCategoryPointLayer,
  type CategoryPoint,
} from "@/registry/vianova/hooks/use-category-point-layer";
import { useColorScheme } from "@/registry/vianova/hooks/use-color-scheme";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import {
  countConditions,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";
import { parseHex } from "@/registry/vianova/lib/category-style";
import { compileFilter } from "@/registry/vianova/lib/filter-eval";
import {
  DEFAULT_LOGO_ZOOM,
  STYLE_STORAGE_KEY,
  badgeColor,
  readStyleSet,
  resolveStyles,
  type CategoryStyleSet,
} from "@/registry/vianova/lib/category-style";
import { inferColumns, parseCsv } from "@/registry/vianova/lib/csv";
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

/**
 * The Lisbon trips the data hub ships as a sample. The map reads the colours and
 * logos someone set there, from this browser's storage, under the same dataset
 * id and column -- so these two strings are the contract between the two blocks.
 */
const TRIPS_URL = `${BASE_PATH}/data/mds-trips-lisbon.csv`;
const TRIPS_DATASET = "sample-mds-lisbon";
const TRIPS_COLUMN = "provider_name";
const LISBON: [number, number] = [-9.14, 38.735];

/** The first vertex of a WKT LINESTRING: where the trip started. */
const FIRST_VERTEX = /\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;

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
    options: Object.entries(ROAD_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
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

/**
 * What the layer can be coloured by, and which body the colorize panel shows.
 *
 * The same properties the filters offer, minus `junction`: a boolean has two
 * values and a visibility toggle already covers "show only these". `type`
 * picks the panel's body -- a string field gets a palette and one swatch per
 * value, a numeric one gets the classification ramp.
 */
const COLOR_FIELDS: ColorizeField[] = [
  { name: "road", label: "Road type", type: "string" },
  { name: "name", label: "Road name", type: "string" },
  { name: "volume", label: "Vehicle volume", type: "number" },
  { name: "speed", label: "Speed limit", type: "number" },
  { name: "avg", label: "Average volume", type: "number" },
];

/** The field the layer arrives coloured by, matching the ramp legend. */
const DEFAULT_COLOR_FIELD = "volume";

/**
 * Palettes for a categorical colouring.
 *
 * Only Categorical: a road type has no order, so a sequential ramp would imply
 * that motorway outranks residential. The numeric body does not use these at
 * all -- it reads `--map-ramp-*` through readRamp, so it follows the map scheme
 * the way the legend does.
 */
const PALETTES: ColorPalette[] = [
  {
    name: "Spectrum",
    family: "Categorical",
    colors: [
      "#3b82f6",
      "#ef4444",
      "#22c55e",
      "#f59e0b",
      "#a855f7",
      "#06b6d4",
      "#ec4899",
      "#84cc16",
    ],
  },
  {
    name: "Accessible",
    family: "Categorical",
    colorBlindSafe: true,
    colors: [
      "#0072b2",
      "#e69f00",
      "#009e73",
      "#cc79a7",
      "#56b4e9",
      "#d55e00",
      "#f0e442",
      "#000000",
    ],
  },
  {
    name: "Tableau",
    family: "Categorical",
    colorBlindSafe: true,
    colors: [
      "#4e79a7",
      "#f28e2b",
      "#59a14f",
      "#e15759",
      "#b07aa1",
      "#76b7b2",
      "#edc948",
      "#9c755f",
    ],
  },
  {
    name: "Pastel",
    family: "Categorical",
    colors: [
      "#93c5fd",
      "#fca5a5",
      "#86efac",
      "#fcd34d",
      "#d8b4fe",
      "#67e8f9",
      "#f9a8d4",
      "#bef264",
    ],
  },
  {
    name: "Deep 700",
    family: "Categorical",
    colors: [
      "#1d4ed8",
      "#15803d",
      "#c2410c",
      "#be185d",
      "#6d28d9",
      "#0e7490",
      "#b91c1c",
      "#4d7c0f",
    ],
  },
];

/**
 * Ramps for a numeric colouring.
 *
 * Kept apart from the categorical set rather than filtered out of one list: a
 * sequential ramp on a road type implies that motorway outranks residential,
 * and an unordered set on a measure throws away the order that is the whole
 * point. Offering either for the wrong field type is a mistake waiting to be
 * made, so the panel is only ever handed the half that applies.
 */
const RAMP_PALETTES: ColorPalette[] = [
  {
    name: "Viridis",
    family: "Sequential",
    colorBlindSafe: true,
    colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  },
  {
    name: "Blues",
    family: "Sequential",
    colors: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
  },
  {
    name: "Heat",
    family: "Sequential",
    colors: ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"],
  },
  {
    name: "Teal",
    family: "Sequential",
    colors: ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0f766e", "#134e4a"],
  },
  {
    name: "Red\u2013Blue",
    family: "Diverging",
    colorBlindSafe: true,
    colors: ["#b2182b", "#ef8a62", "#f7f7f7", "#67a9cf", "#2166ac"],
  },
  {
    name: "Brown\u2013Teal",
    family: "Diverging",
    colorBlindSafe: true,
    colors: ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"],
  },
];

/** Everything past the top N, on the map and in the panel alike. */
const OTHER_COLOR = "#a1a1aa";

/** Matches the colorize panel's own default, so the two agree about the tail. */
const MAX_CATEGORIES = 8;

/** Every source and layer this block owns, so a redraw can clear them all. */
const SOURCES = [
  "flows-lines",
  "flows-points",
  "flows-cluster",
  "flows-grid",
] as const;
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
  const cells = new Map<
    string,
    { x: number; y: number; volume: number; count: number }
  >();
  for (const { position, volume } of points) {
    const lonSize =
      latSize / Math.max(0.1, Math.cos((position[1] * Math.PI) / 180));
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
    const lonSize =
      latSize / Math.max(0.1, Math.cos(((lat0 + latSize / 2) * Math.PI) / 180));
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

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
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
  return RAMP_STOPS.map((stop) =>
    style.getPropertyValue(`--map-ramp-${stop}`).trim(),
  ).filter(Boolean);
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
    const colour =
      ramp[Math.round(((ramp.length - 1) * i) / (edges.length - 1))] ??
      ramp.at(-1)!;
    steps.push(edges[i], colour);
  }
  return steps as DataDrivenPropertyValueSpecification<string>;
}

/**
 * Spreads a handful of editable stops into one colour per ramp band.
 *
 * The panel gives the user five anchors; the map and the legend both want a
 * colour for every band, so the gaps are filled by interpolating between the
 * surrounding pair. sRGB on purpose rather than a perceptual space: these are
 * the exact colours someone picked, and bending them through Lab hands back
 * shades they did not choose.
 */
function rampFromStops(stops: ColorStop[], count: number): string[] {
  const sorted = sortStops(stops).filter((s) => parseHex(s.color));
  if (!sorted.length) return [];
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const hex = (rgb: number[]) =>
    `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

  return Array.from({ length: count }, (_, i) => {
    const at = (i / (count - 1)) * 100;
    // Clamped rather than extrapolated: a stop list that starts at 20% means
    // everything below 20% is that colour, not a colour nobody chose.
    if (at <= first.position) return hex(parseHex(first.color)!);
    if (at >= last.position) return hex(parseHex(last.color)!);

    let lo = first;
    let hi = last;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (at >= sorted[j]!.position && at <= sorted[j + 1]!.position) {
        lo = sorted[j]!;
        hi = sorted[j + 1]!;
        break;
      }
    }
    const span = hi.position - lo.position;
    const t = span > 0 ? (at - lo.position) / span : 0;
    const a = parseHex(lo.color)!;
    const b = parseHex(hi.color)!;
    return hex(a.map((v, k) => v + (b[k]! - v) * t));
  });
}

/** Five editable anchors sampled out of a full ramp. */
function stopsFromRamp(ramp: readonly string[]): ColorStop[] {
  if (ramp.length < 2) return [];
  return [0, 25, 50, 75, 100].map((position) => ({
    position,
    color: ramp[Math.round(((ramp.length - 1) * position) / 100)]!,
    opacity: 100,
  }));
}

/**
 * One colour per category, everything else grey.
 *
 * A `match` rather than the `step` the numeric body uses: step needs an ordered
 * numeric input and these values have neither order nor number. The fallback is
 * the last element, which is what paints the long tail past the top N -- so the
 * map agrees with the panel's "Other" row without being told twice.
 */
function matchExpression(
  field: string,
  categories: { value: string; color: string }[],
  other: string,
): DataDrivenPropertyValueSpecification<string> {
  if (!categories.length) return other;
  const match: unknown[] = ["match", ["get", field]];
  for (const { value, color } of categories) match.push(value, color);
  match.push(other);
  return match as DataDrivenPropertyValueSpecification<string>;
}

/** Busy roads read heavier, and everything thickens as you zoom in. */
function widthExpression(
  edges: number[],
): DataDrivenPropertyValueSpecification<number> {
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

/** Names the scheme's own ramp in the Preset row, before one is chosen. */
const MAP_SCHEME_LABELS: Record<string, string> = {
  viridis: "Viridis",
  brand: "Brand",
};

/** The one layer with data behind it, named once so the card, the colorize
 *  step's title and the chart selector cannot drift apart. */
const LAYER_NAME = "Vehicle Flows";

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
  const [filter, setFilter] = React.useState<FilterGroup>(() =>
    newGroup("and"),
  );
  const [visible, setVisible] = React.useState(true);
  const [viz, setViz] = React.useState<VisualizationTypeId>("lines");
  const [chartLayer, setChartLayer] = React.useState("flows");
  /**
   * Which overlay panel is showing.
   *
   * Only consulted below lg. From lg up there is room for both panels side by
   * side -- two 340px panels plus their 16px margins need 712px -- so CSS
   * forces both visible and this state has no effect. Below that they share
   * the bottom of the block, so one at a time.
   *
   * Deliberately NOT derived from a media query. useIsMobile() reports false on
   * the first paint, and this site is statically exported, so every phone
   * visitor would get a frame of the desktop layout before it snapped. Leaving
   * the decision to CSS also means neither panel ever unmounts, so the filter,
   * layer and chart state survives a rotation -- as does the uncontrolled
   * expand/collapse state inside each DataLayerCard.
   */
  const [pane, setPane] = React.useState<"data" | "charts">("data");
  const mapRef = React.useRef<MapLibreMap | null>(null);
  // State as well as the ref: the ref is what the layer code reads, but a hook
  // that must re-run when the map arrives needs something React can see change.
  const [map, setMap] = React.useState<MapLibreMap | null>(null);

  const [tripsVisible, setTripsVisible] = React.useState(false);
  const [trips, setTrips] = React.useState<{
    points: CategoryPoint[];
    providers: string[];
  } | null>(null);
  const [savedStyles, setSavedStyles] = React.useState<
    CategoryStyleSet | undefined
  >();

  // Read after mount, never in the initial state: the server has no storage.
  React.useEffect(() => {
    const read = () =>
      setSavedStyles(readStyleSet(TRIPS_DATASET, TRIPS_COLUMN));
    read();
    // Fires in this tab when ANOTHER tab writes, which is how a logo set in the
    // data hub shows up here without a reload.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STYLE_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fetched the first time the layer is switched on, not on mount: most visitors
  // never turn it on, and it is 700KB.
  React.useEffect(() => {
    if (!tripsVisible || trips) return;
    const controller = new AbortController();
    fetch(TRIPS_URL, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
      )
      .then((text) => {
        const parsed = parseCsv(text);
        const at = parsed.header.indexOf("route");
        const by = parsed.header.indexOf(TRIPS_COLUMN);
        if (at < 0 || by < 0) return;
        const points: CategoryPoint[] = [];
        for (const row of parsed.rows) {
          const m = FIRST_VERTEX.exec(row[at] ?? "");
          if (m)
            points.push({
              position: [Number(m[1]), Number(m[2])],
              category: row[by] ?? "",
            });
        }
        // Same inference the data hub runs, so providers come out in the same
        // order and an unstyled one is the same colour in both places.
        const providers = inferColumns(parsed)[by]?.values ?? [];
        setTrips({ points, providers });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tripsVisible, trips]);

  const tripStyles = React.useMemo(
    () => resolveStyles(trips?.providers ?? [], savedStyles),
    [trips, savedStyles],
  );
  const logoZoom = savedStyles?.logoZoom ?? DEFAULT_LOGO_ZOOM;

  // Whether the map is drawing logos right now. The layer swaps dots for logos
  // at logoZoom by minzoom/maxzoom, which MapLibre applies itself, so the legend
  // has to be told the same fact. Only a boolean is kept: a zoom value would
  // re-render the whole workspace on every frame of a pinch.
  const [logosShown, setLogosShown] = React.useState(false);
  React.useEffect(() => {
    if (!map) return;
    const update = () => setLogosShown(map.getZoom() >= logoZoom);
    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [map, logoZoom]);

  useCategoryPointLayer({
    map,
    enabled: tripsVisible,
    points: trips?.points ?? [],
    styles: tripStyles,
    logoZoom,
  });

  // The flows are Zürich and the trips are Lisbon, so switching the layer on
  // would otherwise show nothing at all.
  React.useEffect(() => {
    if (tripsVisible && map)
      map.flyTo({ center: LISBON, zoom: 11.5, duration: 1200 });
  }, [tripsVisible, map]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Namespaced so aria-controls still resolves if two of these ever share a page.
  const uid = React.useId();
  const dataPaneId = `${uid}-data`;
  const chartsPaneId = `${uid}-charts`;

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
  /**
   * The facets, their ranges and their choices, derived from the WHOLE layer
   * rather than from what is currently selected.
   *
   * Deriving them from the filtered set instead would make the controls close
   * in behind the reader: narrow the speed range and the slider's own limits
   * would shrink to match, so widening it again becomes impossible.
   *
   * A field is only offered as a facet if the data can actually tell its
   * values apart. `junction` is false on all 7,205 segments in this extract,
   * so a Yes/No control for it would offer a "Yes" that always empties the
   * map -- a control that can only mislead. Choice fields also need to be
   * countable: road NAME has 1,574 distinct values here, which is a search
   * problem rather than a pick-list, and stays in the advanced builder.
   */
  const { facetFields, bounds, choices } = React.useMemo(() => {
    const rows = all ?? [];
    const bounds: Record<string, { min: number; max: number }> = {};
    const choices: Record<string, { value: string; label: string }[]> = {};
    const facetFields: typeof FILTER_FIELDS = [];

    for (const field of FILTER_FIELDS) {
      if (field.type === "number") {
        const values = rows
          .map((r) => Number(r.properties[field.name as keyof FlowProperties]))
          .filter(Number.isFinite);
        if (!values.length) continue;
        const min = Math.floor(Math.min(...values));
        const max = Math.ceil(Math.max(...values));
        if (min >= max) continue;
        bounds[field.name] = { min, max };
        facetFields.push(field);
        continue;
      }
      if (
        field.type === "enum" ||
        field.type === "string" ||
        field.type === "boolean"
      ) {
        const present = new Set(
          rows.map((r) =>
            String(r.properties[field.name as keyof FlowProperties]),
          ),
        );
        if (present.size < 2 || present.size > 50) continue;
        if (field.type !== "boolean") {
          const known = field.options ?? [];
          choices[field.name] = [...present]
            .map((value) => ({
              value,
              label: known.find((o) => o.value === value)?.label ?? value,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        }
        facetFields.push(field);
      }
    }
    return { facetFields, bounds, choices };
  }, [all]);

  const predicate = React.useMemo(
    () => compileFilter(filter, FILTER_FIELDS),
    [filter],
  );
  const features = React.useMemo(
    () => (all ? all.filter((f) => predicate(f.properties)) : []),
    [all, predicate],
  );

  const points = React.useMemo(
    () =>
      features.map((f) => ({
        position: midpoint(f.geometry.coordinates),
        volume: f.properties.volume,
        // The whole property bag travels with the point, not just the volume
        // the grid aggregates by: a point layer is one dot per segment, so it
        // can be coloured by road type exactly as the line layer is, and that
        // needs the value on the feature MapLibre paints.
        properties: f.properties,
      })),
    [features],
  );

  const cells = React.useMemo(
    () => (viz === "grid" ? gridCells(points) : []),
    [viz, points],
  );

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

  /* ------------------------------- colour ------------------------------- */

  const [colorField, setColorField] = React.useState(DEFAULT_COLOR_FIELD);
  const [preset, setPreset] = React.useState(PALETTES[0]!.name);
  /** Null until a ramp is chosen, while the theme's own scheme is in force. */
  const [rampPreset, setRampPreset] = React.useState<string | null>(null);
  /** The stops have been dragged away from whatever the row names. */
  const [rampCustom, setRampCustom] = React.useState(false);
  /** Null means "follow the theme"; an array means the user has taken over. */
  const [stops, setStops] = React.useState<ColorStop[] | null>(null);
  const [themeRamp, setThemeRamp] = React.useState<string[]>([]);
  const [reversed, setReversed] = React.useState(false);
  const [colorOpacity, setColorOpacity] = React.useState(100);
  const [colorizeOpen, setColorizeOpen] = React.useState(false);
  const [presetOpen, setPresetOpen] = React.useState(false);
  /** The panel the chain cascades beside -- not a step itself. */
  const [dataPanel, setDataPanel] = React.useState<HTMLElement | null>(null);
  const colorizeTriggerId = React.useId();
  const browsePresetsId = React.useId();

  const colorFieldType =
    COLOR_FIELDS.find((f) => f.name === colorField)?.type ?? "number";

  /**
   * The scheme's ramp, pulled out of the cascade.
   *
   * MapLibre cannot read a CSS custom property and neither can the stop
   * editor, so the tokens have to be resolved here. Re-read when the scheme
   * changes, and the user's own stops are dropped at the same time: picking a
   * scheme IS picking a ramp, so letting edits survive it would leave the
   * block showing colours from a scheme that is no longer selected.
   */
  React.useEffect(() => {
    setThemeRamp(readRamp(rootRef.current));
    setStops(null);
    setRampPreset(null);
    setRampCustom(false);
  }, [mapScheme]);

  const themeStops = React.useMemo(() => stopsFromRamp(themeRamp), [themeRamp]);
  const rampStops = stops ?? themeStops;

  /**
   * What the numeric branch actually paints with -- the user's stops when they
   * have any, the scheme's ramp otherwise. One value feeds the map, the legend
   * and the panel's gradient, so the three cannot disagree.
   */
  const rampColors = React.useMemo(
    () =>
      rampStops.length
        ? rampFromStops(rampStops, RAMP_STOPS.length)
        : themeRamp,
    [rampStops, themeRamp],
  );

  /**
   * Grid cells, clusters and the heatmap draw an AGGREGATE of many segments, so
   * there is no single road type to match on -- and no honest way to show a
   * category legend beside them. They keep the magnitude ramp whatever the
   * panel says, and the legend follows, which is the same rule the `edges` memo
   * above already applies to the scale itself.
   */
  const aggregate = viz === "grid" || viz === "clusters" || viz === "heatmap";
  const categorical = colorFieldType === "string" && !aggregate;

  const paletteColors = React.useMemo(() => {
    const palette = PALETTES.find((p) => p.name === preset) ?? PALETTES[0]!;
    return reversed ? [...palette.colors].reverse() : palette.colors;
  }, [preset, reversed]);

  /**
   * The categories actually present, commonest first.
   *
   * Derived from the FILTERED features, so narrowing the filters narrows the
   * list -- the count in "showing top 8 of 13 values" is a fact about the data
   * on screen, not about the file.
   */
  const categories = React.useMemo(() => {
    if (colorFieldType !== "string") return { shown: [], total: 0 };
    const counts = new Map<string, number>();
    for (const f of features) {
      const value = String(
        f.properties[colorField as keyof FlowProperties] ?? "",
      );
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const shown = ranked.slice(0, MAX_CATEGORIES).map(([value], i) => ({
      value,
      label: colorField === "road" ? (ROAD_LABELS[value] ?? value) : value,
      color: paletteColors[i % paletteColors.length]!,
    }));
    return { shown, total: ranked.length };
  }, [colorField, colorFieldType, features, paletteColors]);

  /**
   * Quantiles of whatever numeric field the colours encode.
   *
   * Separate from `edges`, which stays bound to volume because the line WIDTH
   * encodes volume regardless of colour. Colouring by speed limit while
   * thickness still tracks volume is two encodings on one layer, and they need
   * two domains.
   */
  const colorEdges = React.useMemo(() => {
    if (aggregate || colorFieldType !== "number") return edges;
    if (colorField === DEFAULT_COLOR_FIELD) return edges;
    const values = features.map((f) =>
      Number(f.properties[colorField as keyof FlowProperties]),
    );
    return quantileEdges(values, RAMP_STOPS.length);
  }, [aggregate, colorField, colorFieldType, edges, features]);

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

      // rampColors already resolved the tokens, and carries the user's stops
      // when they have edited them. readRamp is the fallback for the first
      // paint, before the effect above has run.
      const ramp = rampColors.length ? rampColors : readRamp(rootRef.current);
      const colour = categorical
        ? matchExpression(colorField, categories.shown, OTHER_COLOR)
        : colorExpression(ramp, colorEdges, [
            "get",
            aggregate ? "volume" : colorField,
          ]);
      const hot = ramp.at(-1) ?? "#888";
      // Multiplied into each layer's designed opacity rather than replacing
      // it: the cluster circles and the grid fill sit at different weights on
      // purpose, and overwriting them would flatten that at 100%.
      const alpha = colorOpacity / 100;

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
            "line-opacity": 0.9 * alpha,
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
          paint: { "fill-color": colour, "fill-opacity": 0.75 * alpha },
        });
        return;
      }

      const pointFeatures = points.map(({ position, properties }) => ({
        type: "Feature" as const,
        properties,
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
            // Always the volume ramp, even when the panel is set to a
            // category: a cluster is many segments, and the mean of their road
            // types is not a thing. `aggregate` covers this visualisation, so
            // `colour` above is this same ramp.
            "circle-color": colorExpression(ramp, edges, [
              "/",
              ["get", "volume"],
              ["get", "point_count"],
            ]),
            "circle-opacity": 0.85 * alpha,
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
          paint: {
            "text-color": "#000",
            "text-halo-color": "#fff",
            "text-halo-width": 1,
          },
        });
        map.addLayer({
          id: "flows-cluster-single",
          type: "circle",
          source: "flows-cluster",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": colour,
            "circle-radius": 4,
            "circle-opacity": 0.9 * alpha,
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
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              0.6,
              16,
              2.4,
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              8,
              16,
              26,
            ],
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
          "circle-opacity": 0.85 * alpha,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            [
              "interpolate",
              ["linear"],
              ["get", "volume"],
              edges[0] ?? 0,
              1.5,
              edges.at(-1) ?? 1,
              6,
            ],
            16,
            [
              "interpolate",
              ["linear"],
              ["get", "volume"],
              edges[0] ?? 0,
              3,
              edges.at(-1) ?? 1,
              16,
            ],
          ],
        },
      });
    },
    [
      viz,
      features,
      points,
      cells,
      edges,
      visible,
      mapScheme,
      aggregate,
      categorical,
      categories.shown,
      colorEdges,
      colorField,
      colorOpacity,
      rampColors,
    ],
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
      byRoad.set(
        properties.road,
        (byRoad.get(properties.road) ?? 0) + properties.volume,
      );
      bySpeed.set(
        properties.speed,
        (bySpeed.get(properties.speed) ?? 0) + properties.volume,
      );
      byName.set(
        properties.name,
        (byName.get(properties.name) ?? 0) + properties.volume,
      );
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

  /**
   * Six labels under eleven swatches: the domain, not the ramp's own stops.
   *
   * colorEdges, not edges: these label what the COLOURS mean. Colour by speed
   * limit while the line width still tracks volume and the two domains differ,
   * so labelling the ramp with volume would misread every swatch.
   */
  const ticks = React.useMemo(() => {
    if (colorEdges.length < 2) return undefined;
    return [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) =>
      compact.format(colorEdges[Math.round((colorEdges.length - 1) * f)]!),
    );
  }, [colorEdges]);

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
        // svh, not dvh. dvh tracks the mobile address bar as it hides and
        // shows, so every scroll gesture would resize this box -- and MapLibre
        // watches the container with a ResizeObserver, so each one would cost a
        // map resize. It would also reflow the block when the title's input
        // takes focus and raises the soft keyboard. svh does not move.
        //
        // The 480px floor is for landscape phones: 75svh of a 390px-tall
        // viewport is 292px, which cannot hold a 56px bar and a docked panel.
        "relative isolate h-[max(480px,75svh)] w-full overflow-hidden rounded-xl border border-border md:h-[700px] lg:h-[760px]",
        className,
      )}
    >
      <MapCanvas
        className="absolute inset-0"
        mapboxToken={mapboxToken}
        workerUrl={WORKER_URL}
        center={[8.5417, 47.3769]} // Zürich, the extent of the flow export
        zoom={11.6}
        // Below lg this block is a panel on a page that scrolls, so the map
        // must not swallow a one-finger drag. 1024 is the same boundary the
        // layout switches on.
        cooperativeGesturesBelow={1024}
        onStyleReady={(ready) => {
          mapRef.current = ready;
          setMap(ready);
          syncLayer(ready);
        }}
      />

      {/*
        Top bar.

        Below lg this keeps only the controls that do something. Everything
        hidden here -- the collapse button, the search field, the drawing tools,
        the two panel icons -- has no handler in this block, so hiding it costs
        no behaviour and buys back the width the title and the panel switcher
        need. A hidden child is display:none, so it is not a flex item and does
        not contribute a gap either.

        The budget is tight enough to be worth writing down. A 375px phone minus
        the docs page's px-6 gutters leaves the block 327px; minus the border and
        px-2 that is 309px of bar. The switcher is 2x36 + 8 = 80px, leaving the
        title ~221px against a 182px read state and a 180px floor in the edit
        state (InlineEdit's input is min-w-32 plus confirm and cancel). Keeping
        the collapse button as well would overrun it, and the thing that
        disappears is the edit state's cancel button -- silently, because this
        bar is overflow-hidden.
      */}
      <div
        data-slot="map-toolbar"
        className="absolute inset-x-0 top-0 flex h-14 items-center gap-2 px-2 lg:px-4"
      >
        <Button
          variant="secondary"
          size="icon"
          aria-label="Collapse sidebar"
          className="hidden lg:inline-flex"
        >
          <PanelLeft />
        </Button>
        <InlineEdit
          value={title}
          onValueChange={setTitle}
          label="Map name"
          // min-w-0 so the title can actually truncate. InlineEdit is a flex
          // item whose read state is itself inline-flex around a `truncate`
          // span, and truncation needs min-w-0 at every level of that chain --
          // without it the span refuses to shrink below its text and pushes
          // the controls to its right out of a bar that is overflow-hidden,
          // which clips them with no scrollbar and no ellipsis to show for it.
          className="min-w-0 font-medium"
        />

        <div className="mx-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Data layers"
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
          {/* Split control: the tool on the left, its alternatives on the
              right, so picking the current tool never costs a trip through a
              menu. */}
          <ButtonGroup className="hidden lg:flex">
            <Button variant="secondary" size="icon" aria-label="Drawing tools">
              <MousePointer2 />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Choose a drawing tool"
            >
              <ChevronDown />
            </Button>
          </ButtonGroup>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Charts"
            className="hidden lg:inline-flex"
          >
            <BarChart3 />
          </Button>
        </div>

        {/*
          Panel switcher, below lg only.

          A separate control rather than wiring the Layers and Charts icons
          above, because from lg up CSS shows both panels no matter what `pane`
          says -- a control that existed at every width would announce
          aria-expanded="false" over a panel that is plainly on screen. One that
          only exists below lg cannot lie about it.

          Two buttons with aria-expanded/aria-controls, not a toggle group: this
          reveals and hides a region, which is the disclosure pattern, and
          aria-controls states a relationship a toggle group has no way to
          express. Plain Buttons also keep this block's registry dependencies
          unchanged.

          The 36px box stays -- the control-size ladder pins icon buttons to
          exactly 36px -- and `after:-inset-2` grows the hit area to 52px for a
          thumb without moving a pixel. Same trick sidebar.tsx uses, and
          elementFromPoint resolves a hit on the pseudo-element back to the
          button, so it is testable rather than merely asserted.
        */}
        <div
          data-slot="panel-switcher"
          className="flex items-center gap-2 lg:hidden"
        >
          {(
            [
              ["data", "Data layers", Layers, dataPaneId],
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

        {/* The one control here that is not decorative, so it survives on a
            phone -- as an icon until there is room for its label. */}
        <Button size="sm" className="gap-1.5" aria-label="Export report">
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Export report</span>
        </Button>
      </div>

      {/*
        Data panel.

        Below lg it docks to the bottom of the block at full width; from lg up
        it returns to the 340px column on the left. Every inset is named at both
        tiers on purpose. tailwind-merge treats top/right/bottom/left as four
        separate conflict groups, and inset-x collides only with left and right,
        so `inset-x-2 bottom-10` + `lg:left-4 lg:top-16` leaves ALL FOUR set at
        lg -- left:16px and right:8px, top:64px and bottom:40px -- and an
        absolutely positioned box with both insets on an axis stretches. Nothing
        gets dropped to warn you; the panel just goes full-bleed and the
        invisible half swallows clicks. Hence the explicit *-auto resets.

        bottom-10 rather than bottom-2 because MapLibre's attribution sits
        bottom-right at z-index 2 while everything in here is z-auto, so the
        badge paints OVER this panel rather than under it. Compact, it occupies
        10px to 34px from the bottom; 40px is the first value that clears it, so
        the badge is not stealing a tap target from the panel's own corner.
      */}
      {/* PanelStepper adds no wrapper of its own -- children render straight
          through, and only the dock it owns is a real element -- so wrapping
          the data panel here does not disturb its absolute positioning. */}
      <PanelStepper anchor={dataPanel}>
        <FloatingPanel
          ref={setDataPanel}
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
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add data layer"
              >
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
                name={LAYER_NAME}
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
                onColorize={() => setColorizeOpen((open) => !open)}
                colorizeOpen={colorizeOpen}
                colorizeTriggerId={colorizeTriggerId}
                // The legend describes what is actually painted, which is not
                // always what the panel is set to: an aggregate visualisation
                // keeps the magnitude ramp even while the panel says "Road type",
                // because a grid cell has no single road type. `categorical` is
                // already false in that case, so this follows the map by
                // construction rather than by remembering to.
                legend={
                  loading ? (
                    <Skeleton className="h-2.5 w-full" />
                  ) : categorical && categories.shown.length ? (
                    <LegendCategorical
                      items={categories.shown.map((c) => ({
                        label: c.label,
                        color: c.color,
                      }))}
                    />
                  ) : (
                    <LegendRamp
                      colors={rampColors.length ? rampColors : undefined}
                      ticks={ticks}
                      showTicks={Boolean(ticks)}
                    />
                  )
                }
                filtersAction={
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit Vehicle Flows filters"
                        >
                          <ListFilter />
                        </Button>
                      }
                    />
                    {/* 440px is wider than a phone. The popup is portalled and
                      fixed-positioned, and Base UI's collision handling SHIFTS
                      it but never SHRINKS it, so at 375px the right-hand ~65px
                      -- the value inputs -- hangs off-screen with no way to
                      reach it. --available-width comes off the positioner and
                      inherits down to here, so it already accounts for the
                      anchor and the collision padding; a viewport calc() would
                      not. */}
                    <PopoverContent
                      align="end"
                      className="w-[440px] max-w-[var(--available-width)] p-3"
                    >
                      <FilterBuilder
                        fields={FILTER_FIELDS}
                        value={filter}
                        onValueChange={setFilter}
                      />
                    </PopoverContent>
                  </Popover>
                }
                filtersContent={
                  loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <FilterFacets
                      fields={facetFields}
                      value={filter}
                      onValueChange={setFilter}
                      bounds={bounds}
                      choices={choices}
                    />
                  )
                }
              />

              <DataLayerCard
                name="Lisbon trips (MDS)"
                meta="Sep 1 – Sep 30, 2026 · Trips by provider"
                visualizationType="points"
                unavailableVisualizations={[
                  "clusters",
                  "grid",
                  "heatmap",
                  "lines",
                  "zones",
                  "trips",
                ]}
                unavailableVisualizationReason="This layer draws each trip's start point"
                expanded
                visible={tripsVisible}
                onVisibilityChange={setTripsVisible}
                legend={
                  trips ? (
                    <div className="space-y-1.5">
                      <LegendCategorical
                        showLogos={logosShown}
                        items={trips.providers.map((label) => {
                          const style = tripStyles[label];
                          return {
                            label,
                            color: style?.color ?? "#888888",
                            logo: style?.logo
                              ? {
                                  src: style.logo,
                                  solid: style.logoKind === "solid",
                                  background: badgeColor(style),
                                }
                              : undefined,
                          };
                        })}
                      />
                      <p className="text-muted-foreground text-[11px]">
                        Logos from zoom {logoZoom}
                      </p>
                    </div>
                  ) : null
                }
              />
              <DataLayerCard
                name="Accidents ZH 2011-2023"
                expanded={false}
                visible={false}
              />
              <DataLayerCard
                name="Speed by Roads"
                expanded={false}
                visible={false}
              />
              <DataLayerCard
                name="Overspeeding Events"
                expanded={false}
                visible={false}
              />
              <DataLayerCard
                name="Overspeeding"
                expanded={false}
                visible={false}
              />
              <DataLayerCard
                name="Heavy braking Events"
                expanded={false}
                visible={false}
              />
            </div>
          </FloatingPanelBody>
        </FloatingPanel>

        {/* Colorize cascades beside the data PANEL, not beside the legend that
            opens it: anchoring to the control would staircase the chain down
            the screen instead of lining each panel up with its parent.

            The step draws the header, so ColorizePanel's own is suppressed and
            its outer box flattened -- the step already supplies the border, the
            radius and the frosted background. */}
        <PanelStep
          id="colorize"
          title={`Colorize · ${LAYER_NAME}`}
          width={360}
          open={colorizeOpen}
          onOpenChange={setColorizeOpen}
          triggerId={colorizeTriggerId}
        >
          <ColorizePanel
            showHeader={false}
            className="w-auto rounded-none border-0 bg-transparent shadow-none"
            layerName={LAYER_NAME}
            fields={COLOR_FIELDS}
            field={colorField}
            onFieldChange={setColorField}
            categories={categories.shown}
            totalCategories={categories.total}
            maxCategories={MAX_CATEGORIES}
            otherColor={OTHER_COLOR}
            opacity={colorOpacity}
            onOpacityChange={setColorOpacity}
            presetName={
              categorical
                ? preset
                : (rampPreset ?? MAP_SCHEME_LABELS[mapScheme])
            }
            presetCustom={rampCustom}
            presetColors={categorical ? paletteColors : undefined}
            // The numeric body's gradient and its stop rows are the ramp the
            // map is painted with, not an unrelated default: showing "Greys"
            // beside a green map is the panel lying about the layer.
            stops={rampStops.length ? rampStops : undefined}
            // Dragging a stop keeps the ramp's name but marks it edited, so the
            // row reads "Heat + Custom" rather than silently claiming to still
            // be Heat or forgetting where the colours came from.
            onStopsChange={(next) => {
              setStops(next);
              setRampCustom(true);
            }}
            onBrowsePresets={() => setPresetOpen((open) => !open)}
            browsePresetsId={browsePresetsId}
            presetsOpen={presetOpen}
          />

          {/* Declared inside the Colorize step so it anchors to that step's
              panel. Driven by `open` rather than a trigger: the control that
              opens it is the Preset row inside ColorizePanel, which reports
              through onBrowsePresets. */}
          <PanelStep
            id="preset"
            title="Preset"
            width={420}
            open={presetOpen}
            onOpenChange={setPresetOpen}
            triggerId={browsePresetsId}
          >
            <PanelStepBody className="max-h-80 p-0">
              {/* Only the half that applies to the field in play -- see
                  RAMP_PALETTES for why the two sets are kept apart. */}
              <PresetPicker
                palettes={categorical ? PALETTES : RAMP_PALETTES}
                value={categorical ? preset : (rampPreset ?? "")}
                onValueChange={(name) => {
                  if (categorical) {
                    setPreset(name);
                    return;
                  }
                  // A ramp is chosen by its colours, so selecting one writes
                  // the stops the editor and the map both read.
                  const chosen = RAMP_PALETTES.find((p) => p.name === name);
                  if (!chosen) return;
                  setRampPreset(name);
                  setRampCustom(false);
                  setStops(
                    stopsFromRamp(
                      reversed ? [...chosen.colors].reverse() : chosen.colors,
                    ),
                  );
                }}
                reversed={reversed}
                onReversedChange={setReversed}
              />
            </PanelStepBody>
          </PanelStep>
        </PanelStep>
      </PanelStepper>

      {/* Charts panel. Same docking rules as the data panel above, including
          why every inset is spelled out at both tiers. */}
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
            <Button variant="ghost" size="icon-sm" aria-label="Collapse charts">
              <Minimize2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Add chart">
              <Plus />
            </Button>
          </FloatingPanelActions>
        </FloatingPanelHeader>

        <div className="space-y-2 p-2">
          <Select
            value={chartLayer}
            onValueChange={(value) => setChartLayer(value ?? "flows")}
          >
            <SelectTrigger className="w-full" aria-label="Chart source layer">
              {/* Base UI renders the raw value unless given a mapping, which
                  would show "flows" instead of the layer name. */}
              <SelectValue>
                {(value: string) => CHART_LAYERS[value] ?? value}
              </SelectValue>
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
                  <ChartCardHeader
                    title="Total vehicle volume"
                    icon={<Hash />}
                  />
                  {/* A hero number, with no ring drawn round it. A ring encodes
                      a share of something, and a running total is not a share
                      of anything. */}
                  <ChartCardMetric
                    value={compact.format(stats.total)}
                    unit={`vehicles · ${plain.format(features.length)} segments`}
                  />
                </ChartCard>

                <ChartCard>
                  <ChartCardHeader
                    title="Volume by road type"
                    icon={<BarChart3 />}
                  />
                  {/* Horizontal: "Motorway link" and "Living street" do not fit
                      under a vertical bar at this width without turning
                      sideways or being cut in half. */}
                  <ChartContainer
                    config={VOLUME_CONFIG}
                    className="h-44 w-full"
                  >
                    <BarChart
                      data={stats.roads}
                      layout="vertical"
                      margin={{ left: 4, right: 8 }}
                    >
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
                      <Bar
                        dataKey="volume"
                        fill="var(--color-volume)"
                        radius={3}
                      />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>

                <ChartCard>
                  <ChartCardHeader
                    title="Volume by speed limit"
                    icon={<BarChart3 />}
                  />
                  <ChartContainer
                    config={VOLUME_CONFIG}
                    className="h-40 w-full"
                  >
                    {/* No negative left margin: these ticks read "3.2M", and
                        pulling the axis outside the plot clips the first
                        character against the panel. */}
                    <BarChart data={stats.speeds} margin={{ left: 0, top: 4 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tickFormatter={(v: number) => compact.format(v)}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(l) => `${l} km/h`}
                          />
                        }
                      />
                      <Bar
                        dataKey="volume"
                        fill="var(--color-volume)"
                        radius={3}
                      />
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
      {/* Desktop only. These controls are decorative in this block -- no
          onZoomIn, onZoomOut or onBasemapClick is passed -- so hiding them
          below lg removes no behaviour, frees the right-hand strip that the
          docked panel needs, and drops two no-op buttons from a phone's tab
          order. Pinch and double-tap are MapLibre's own handlers and are
          untouched, which is the affordance a touch user reaches for anyway. */}
      <MapControls
        className="absolute bottom-12 right-4 hidden lg:flex"
        basemapLabel="Satellite"
      />
    </div>
  );
}

export default MapWorkspace;
