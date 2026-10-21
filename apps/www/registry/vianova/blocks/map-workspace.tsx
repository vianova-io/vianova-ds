"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  BarChart3,
  Hash,
  Layers,
  ListFilter,
  Minimize2,
  Plus,
  Search,
  Map as MapIcon,
  Sparkles,
  X,
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
  MapDrawBanner,
  MapDrawControl,
  useMapDraw,
  type DrawMode,
} from "@/registry/vianova/product/map-draw-control";
import { downloadFile, toCsv } from "@/registry/vianova/product/export-menu";
import {
  ColorizePanel,
  type ColorizeField,
} from "@/registry/vianova/product/colorize-panel";
import { type ColorStop } from "@/registry/vianova/product/color-stop-slider";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import { DataLibraryDialog } from "@/registry/vianova/product/data-library-dialog";
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
import { BasemapSwitcher } from "@/registry/vianova/product/basemap-switcher";
import { MapControls } from "@/registry/vianova/product/map-controls";
import {
  BASEMAP_BY_ID,
  DEFAULT_BASEMAP_ID,
  MAP_SCHEME_LABELS,
  mapSchemeFor,
  type BasemapId,
} from "@/registry/vianova/lib/basemaps";
import {
  PanelStep,
  PanelStepBody,
  PanelStepper,
} from "@/registry/vianova/product/panel-stepper";
import { PresetPicker } from "@/registry/vianova/product/preset-picker";
import { RankedBars } from "@/registry/vianova/product/ranked-bars";
import { SampleMapLayer } from "@/registry/vianova/product/sample-map-layer";
import type { VisualizationTypeId } from "@/registry/vianova/product/visualization-picker";
import { useColorScheme } from "@/registry/vianova/hooks/use-color-scheme";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import {
  countConditions,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";
import {
  CATEGORICAL_PALETTES,
  SEQUENTIAL_PALETTES,
  quantileEdges,
  rampFromStops,
  stopsFromRamp,
} from "@/registry/vianova/lib/color-ramp";
import {
  SAMPLE_FEEDS,
  columnLabel,
  type ParsedSample,
  type SampleFeed,
} from "@/registry/vianova/lib/sample-datasets";
import { compileFilter } from "@/registry/vianova/lib/filter-eval";
import { badgeColor } from "@/registry/vianova/lib/category-style";
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

/** What the export writes, in this order. Matches FlowProperties. */
const EXPORT_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "road", label: "Road type" },
  { id: "speed", label: "Speed limit" },
  { id: "junction", label: "Junction" },
  { id: "volume", label: "Volume" },
  { id: "avg", label: "Average" },
];

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
/**
 * Whether a point falls inside a drawn ring.
 *
 * Ray casting, counting crossings of a horizontal line to the right. Flat
 * lon/lat rather than spherical: a drawn zone spans a city at most, where the
 * error from ignoring curvature is far below the width of the road being
 * tested.
 */
function ringContains(
  ring: [number, number][],
  [x, y]: [number, number],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

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

/**
 * The panel's two lists.
 *
 * "zones" holds the hub's `zones` AND `regulations` sections: both are areas
 * drawn on the map, and a third tab would leave two lists of four and two.
 */
type LayerTab = "data" | "zones";

const tabOf = (section: string): LayerTab =>
  section === "data" ? "data" : "zones";

/*
 * MAP_SCHEME_LABELS is imported from lib/basemaps now. The copy that lived here
 * listed only viridis and brand, which was true while the scheme was derived
 * from light/dark. The basemap picks it now, so warm and blue are reachable for
 * the first time and a two-entry record would hand the Preset row undefined.
 */

/** The one layer with data behind it, named once so the card, the colorize
 *  step's title and the chart selector cannot drift apart. */
const LAYER_NAME = "Vehicle Flows";

/** How many bars a breakdown shows before the tail is dropped. */
const CHART_BARS = 8;

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

  /**
   * Panel visibility from lg up, where `pane` has nothing to say.
   *
   * Below lg the two panels are mutually exclusive and `pane` picks the one on
   * screen. From lg up both fit, so visibility is per panel and both start
   * open -- which is what the layout did unconditionally before, via a bare
   * `lg:flex` that no control could override. That is why the Data layers and
   * Charts icons in the bar used to be decorative: there was nothing for them
   * to toggle.
   *
   * Two pieces of state rather than one because the question genuinely differs
   * by width: "which one" below lg, "which ones" above it. Collapsing them
   * would make one of the two controls lie about the other's width.
   */
  const [deskPanels, setDeskPanels] = React.useState({
    data: true,
    charts: true,
  });

  /** Null when the pointer is a pointer; a mode while a zone is being drawn. */
  const [drawMode, setDrawMode] = React.useState<DrawMode | null>(null);
  /** A drawn ring, kept as a spatial filter over the flows. */
  const [selection, setSelection] = React.useState<[number, number][] | null>(
    null,
  );
  const [place, setPlace] = React.useState("");
  /**
   * Phone only: the field is an icon until it is asked for.
   *
   * At 390px the bar has room for the title and four icon buttons, and a
   * 220px field is not one of them -- which is why this control used to be
   * `hidden md:flex` and simply vanished below 768, taking with it the only
   * way to move the camera by name. Open, it covers the row rather than
   * squeezing it: the block root is overflow-hidden, so a field that pushed
   * its neighbours would clip them with no scrollbar and nothing on screen to
   * show it had happened.
   */
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchFieldRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (searchOpen) searchFieldRef.current?.focus();
  }, [searchOpen]);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  // State as well as the ref: the ref is what the layer code reads, but a hook
  // that must re-run when the map arrives needs something React can see change.
  const [map, setMap] = React.useState<MapLibreMap | null>(null);

  // Draws onto the live map and hands back a closed ring. Same wiring as
  // regulations-workspace, which is the other block that draws zones.
  const draw = useMapDraw({
    map,
    mode: drawMode,
    onComplete: (ring) => {
      setSelection(ring);
      setDrawMode(null);
    },
    onCancel: () => setDrawMode(null),
  });

  /* --------------------------- sample layers ---------------------------- */

  const [tab, setTab] = React.useState<LayerTab>("data");
  const [query, setQuery] = React.useState("");
  /**
   * The layers this map has, by feed id.
   *
   * Empty to begin with: the map opens with its own flows and nothing else,
   * and everything beyond that is added from the library behind the panel's +
   * button. The panel used to list the whole catalogue with every row switched
   * off, which read as a map that already had nine layers it was refusing to
   * draw -- and left the + button with nothing it could possibly add.
   */
  const [added, setAdded] = React.useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  /**
   * Feeds that came from the reader's machine rather than the catalogue.
   *
   * Kept beside it rather than merged into it: SAMPLE_FEEDS is a module
   * constant shared with the data hub, and pushing onto it would leak one
   * block's uploads into the other's list for the rest of the session.
   */
  const [uploads, setUploads] = React.useState<SampleFeed[]>([]);
  /** Which sample layers are switched on, by feed id. */
  const [layerOn, setLayerOn] = React.useState<Record<string, boolean>>({});
  /** The rows each visible sample layer is showing, for the charts. */
  const [layerData, setLayerData] = React.useState<
    Record<string, { sample: ParsedSample; rows: Record<string, string>[] }>
  >({});

  const onSampleChange = React.useCallback(
    (
      id: string,
      state: { sample: ParsedSample; rows: Record<string, string>[] } | null,
    ) =>
      setLayerData((all) => {
        if (!state) {
          if (!(id in all)) return all;
          const { [id]: _gone, ...rest } = all;
          return rest;
        }
        // Same rows as last time means the same object: this runs on every
        // render of every layer, and a fresh map each time would re-render the
        // charts panel for nothing.
        if (all[id]?.rows === state.rows && all[id]?.sample === state.sample)
          return all;
        return { ...all, [id]: state };
      }),
    [],
  );

  const setLayerVisible = React.useCallback((id: string, on: boolean) => {
    setLayerOn((all) => ({ ...all, [id]: on }));
    // Switching a layer on points the charts at it. Otherwise the panel keeps
    // describing Zürich while the map has flown to Lisbon, which reads as the
    // charts being broken rather than as a selection waiting to be made.
    if (on) setChartLayer(id);
  }, []);

  /** The catalogue the library offers, plus anything uploaded this session. */
  const catalogue = React.useMemo(
    () => [...SAMPLE_FEEDS, ...uploads],
    [uploads],
  );

  const addedFeeds = React.useMemo(
    () => catalogue.filter((feed) => added.includes(feed.id)),
    [catalogue, added],
  );

  const visibleFeeds = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return addedFeeds.filter(
      (feed) =>
        tabOf(feed.section) === tab &&
        (!needle ||
          feed.title.toLowerCase().includes(needle) ||
          feed.description.toLowerCase().includes(needle)),
    );
  }, [addedFeeds, query, tab]);

  /**
   * Adding switches a layer on as well as listing it. Adding a layer and then
   * having to find its eye to see anything would make the library's own button
   * a half-measure -- you asked for the layer, so it is drawn.
   */
  const addLayers = React.useCallback(
    (ids: string[]) => {
      setAdded((all) => [...all, ...ids.filter((id) => !all.includes(id))]);
      ids.forEach((id) => setLayerVisible(id, true));
    },
    [setLayerVisible],
  );

  /**
   * An uploaded CSV becomes a feed like any other, pointed at an object URL.
   * SampleMapLayer fetches an absolute source as it stands, so the file is
   * parsed, filtered, coloured and charted by exactly the same code as the
   * catalogue's own -- no second path that could rot.
   */
  const uploadFeed = React.useCallback(
    (file: File) => {
      const id = `upload-${Date.now()}`;
      const feed: SampleFeed = {
        id,
        file: URL.createObjectURL(file),
        title: file.name.replace(/\.csv$/i, ""),
        section: "data",
        description: `Uploaded from this device, ${(file.size / 1024).toFixed(0)} KB.`,
        rowRepresents: "a row of the uploaded file",
        domain: "upload",
        uploadedAt: new Date().toISOString(),
      };
      setUploads((all) => [...all, feed]);
      addLayers([id]);
      setTab("data");
    },
    [addLayers],
  );

  /**
   * What the Charts panel can describe: the flows, plus every sample layer that
   * is switched on. A layer that is off has no rows loaded, so offering it
   * would only ever produce an empty panel.
   */
  const chartSources = React.useMemo(
    () => [
      { value: "flows", label: LAYER_NAME },
      ...SAMPLE_FEEDS.filter((f) => layerData[f.id]).map((f) => ({
        value: f.id,
        label: f.title,
      })),
    ],
    [layerData],
  );

  /**
   * Counts of a sample layer's own category columns.
   *
   * Generic on purpose: these files are not known in advance, and the two
   * columns worth charting are simply the first two that vary. Percentages are
   * against the commonest value rather than the total, so the longest bar is
   * always full and a long tail stays readable -- the same shape the flows
   * charts use.
   */
  const sampleCharts = React.useMemo(() => {
    const state = layerData[chartLayer];
    if (!state) return null;
    const { sample, rows } = state;
    const breakdowns = sample.columns
      .filter((c) => c.type === "category" && (c.values?.length ?? 0) > 1)
      .slice(0, 2)
      .map((column) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const value = row[column.name] ?? "";
          if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        const ranked = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, CHART_BARS);
        const peak = ranked[0]?.[1] ?? 1;
        return {
          name: column.name,
          label: columnLabel(column.name),
          items: ranked.map(([label, count]) => ({
            label,
            percent: Math.round((count / peak) * 100),
            count: plain.format(count),
          })),
        };
      });
    return { shown: rows.length, total: sample.rows.length, breakdowns };
  }, [chartLayer, layerData]);

  // A layer switched OFF takes its charts with it, so the panel falls back to
  // the one source that is always there. Keyed on `layerOn` rather than on the
  // loaded rows: a layer whose fetch is still running is a valid selection, and
  // testing for rows here undid the selection the click had just made.
  React.useEffect(() => {
    if (chartLayer !== "flows" && !layerOn[chartLayer]) setChartLayer("flows");
  }, [chartLayer, layerOn]);

  // The flows are Zürich and every sample is Lisbon, so switching one on would
  // otherwise show nothing at all. Keyed on the set of layers that are on, so
  // turning a second one on does not re-fly the camera.
  const lisbonOn = SAMPLE_FEEDS.some((f) => layerOn[f.id]);
  React.useEffect(() => {
    if (lisbonOn && map)
      map.flyTo({ center: LISBON, zoom: 11.5, duration: 1200 });
  }, [lisbonOn, map]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Namespaced so aria-controls still resolves if two of these ever share a page.
  const uid = React.useId();
  const dataPaneId = `${uid}-data`;
  const chartsPaneId = `${uid}-charts`;

  const scheme = useColorScheme() ?? "dark";
  const [basemapId, setBasemapId] =
    React.useState<BasemapId>(DEFAULT_BASEMAP_ID);

  /**
   * The ramp is a property of the basemap, which this used to claim and not do.
   *
   * It was `scheme === "dark" ? "viridis" : "brand"` -- a reading of the
   * reader's theme, with a comment explaining that the basemap was what really
   * mattered. Now the basemap decides: Satellite takes warm because a
   * photograph is neither light nor dark and warm is the ramp that survives
   * being laid over one; Terrain takes blue in light because hillshade is
   * grey-brown and blue is furthest from it. Brand and Blue run light to dark,
   * so their loudest colour is their darkest -- the one that disappears into a
   * dark basemap -- which is why the dark rungs are viridis.
   */
  const mapScheme = mapSchemeFor(basemapId, scheme);

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
  const features = React.useMemo(() => {
    const matched = all ? all.filter((f) => predicate(f.properties)) : [];
    // A drawn zone filters like any other condition, so the stats, the charts,
    // the legend and the painted layer all follow it without knowing it exists
    // -- they already read `features`. Tested against the segment's midpoint
    // rather than its whole geometry: a flow is one road segment, and asking
    // whether a line is "in" a zone has no single answer worth defending here.
    if (!selection) return matched;
    return matched.filter((f) =>
      ringContains(selection, midpoint(f.geometry.coordinates)),
    );
  }, [all, predicate, selection]);

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
  const [preset, setPreset] = React.useState(CATEGORICAL_PALETTES[0]!.name);
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
  // Read rather than depended on: this effect fires when the SCHEME changes,
  // and adding the flag to its deps would make editing the ramp re-run the
  // reset that the flag exists to prevent.
  const rampCustomRef = React.useRef(rampCustom);
  rampCustomRef.current = rampCustom;

  React.useEffect(() => {
    setThemeRamp(readRamp(rootRef.current));
    // A hand-edited ramp survives. The scheme used to change only when the
    // reader switched theme, where discarding their stops was defensible;
    // it now changes when they switch basemap, and throwing away their work
    // for looking at the same data on a photograph would not be.
    if (rampCustomRef.current) return;
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
    const palette =
      CATEGORICAL_PALETTES.find((p) => p.name === preset) ??
      CATEGORICAL_PALETTES[0]!;
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

  /**
   * syncLayer, plus a record of what actually landed.
   *
   * syncLayer opens with `if (!map.isStyleLoaded()) return` -- correct, since
   * addSource throws against a half-built style, but it means a sync can do
   * nothing at all and say nothing about it. That is exactly how the data
   * layer vanished on Satellite -> Terrain and nowhere else: MapCanvas handed
   * over a style that applying the hillshade had just un-readied, this bailed,
   * and no error was raised anywhere. The attribute is read by
   * map-workspace-basemap.spec, which is the only way that failure is visible
   * from outside the WebGL canvas.
   */
  const [dataLayerPainted, setDataLayerPainted] = React.useState(false);
  const syncAndReport = React.useCallback(
    (map: MapLibreMap) => {
      syncLayer(map);
      setDataLayerPainted(LAYERS.some((id) => !!map.getLayer(id)));
    },
    [syncLayer],
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (map) syncAndReport(map);
  }, [syncAndReport]);

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

  /**
   * One behaviour behind two fields -- the row's at md and up, the overlay's
   * below -- so the phone cannot quietly diverge from the desktop.
   *
   * Searches the flows already loaded, not a geocoder: the placeholder said
   * "places, POIs", which means a network service and a key, for a field that
   * was uncontrolled and wired to nothing. The names are on the features --
   * street and junction -- so the honest version of this control searches
   * those and moves the camera.
   */
  const runSearch = () => {
    const needle = place.trim().toLowerCase();
    if (!needle) return;
    const hit = features.find((f) =>
      f.properties.name.toLowerCase().includes(needle),
    );
    if (!hit) return;
    mapRef.current?.flyTo({
      center: midpoint(hit.geometry.coordinates),
      zoom: 14,
    });
    // Collapses on a hit, and only on the phone, where the field is covering
    // the map it was asked to fly.
    setSearchOpen(false);
  };

  return (
    <div
      ref={rootRef}
      data-map-scheme={mapScheme}
      data-map-layer={dataLayerPainted ? "on" : "off"}
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
        basemap={basemapId}
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
          syncAndReport(ready);
        }}
      />

      {/*
        Top bar.

        Every control on this row does something. Seven of them did not: the
        collapse button, the Data layers and Charts icons, the search field and
        both drawing buttons were decorative, and so was Export report -- under
        a comment calling it "the one control here that is not decorative".

        What survives below lg is still a width decision, not a behaviour one.
        The budget is tight enough to be worth writing down: a 375px phone
        minus the docs page's px-6 gutters leaves the block 327px; minus the
        border and px-2 that is 309px of bar. The switcher is 2x36 + 8 = 80px,
        the basemap another 36, export another 36, and the gaps between them
        32 -- which leaves the title around 125px against a 180px floor in its
        edit state. So search and the draw tools start at md, where there is
        room for them, and the title keeps the phone to itself.

        A hidden child is display:none, so it is not a flex item and does not
        contribute a gap either.
      */}
      <div
        data-slot="map-toolbar"
        // Labelled, but deliberately NOT role="toolbar".
        //
        // The role promises arrow-key traversal and a single tab stop, and
        // this row cannot keep that promise: it holds two text fields. The
        // repo's patterns/toolbar.tsx implements the behaviour, but its
        // focusables() matches `input:not([disabled])` and its handler calls
        // preventDefault() on ArrowLeft/Right with no guard for a text field,
        // so adopting it here would move focus out of the map title instead of
        // moving the caret inside it. Its only consumer is a pill of ten icon
        // buttons, which is why that has never bitten.
        //
        // A role nothing implements is worse than no role: it tells a screen
        // reader user to expect arrow keys that do nothing.
        aria-label="Map controls"
        className={cn(
          "absolute inset-x-0 top-0 flex h-14 items-center px-2 lg:px-4",
          // While the phone's search field is open it covers the row, and a
          // covered control must not still be tabbable or announced -- or the
          // keyboard walks into buttons nobody can see. visibility, not
          // display: it takes them out of the tab order and the a11y tree
          // while they keep their boxes, so opening the field reflows nothing.
          // The overlay is the last child, which is why it is spared.
          searchOpen && "max-md:[&>*:not(:last-child)]:invisible",
        )}
      >
        {/*
          A real heading, which this block had none of: `<h1>`..`<h6>` and
          aria-level both returned nothing across the whole file, so the
          workspace gave a screen reader no outline at all and the map's name
          read as one more button in a row of them.

          An `h2` element rather than role="heading": InlineEdit's title
          variant is built to be wrapped in one -- it "takes its type from the
          parent" -- and Tailwind's preflight strips the browser's own h2 type,
          so this is semantics at no visual cost. Level 2, one under the page
          title, matching how reports-workspace labels its report name.

          min-w-0 on both: the h2 is now the flex item that has to be allowed
          to shrink, and InlineEdit still needs it for its own `truncate` span.
        */}
        {/*
          Three columns, as production builds this bar: `flex-1/3` on each of
          three children, 8px between their members. Measured off the live app
          rather than guessed from a screenshot -- at a 2560px viewport the
          columns are 843px each, the control cluster starts at 859 (the 1/3
          mark plus the bar's p-4), and the search field is a fixed 350.

          The cluster is NOT centred on the bar, which is what the previous
          attempt here did: it begins at the one-third mark and runs left to
          right -- data, search, drawing, charts -- so the row reads as a
          title, then a workbench, then the one action that leaves the page.
          Centring the field put it 192px right of where production has it and
          split the two panel toggles to opposite ends of the row.

          A third is the BASIS, not a fixed width -- `flex: 1 1 33.333%`, the
          same as production's, whose title input carries `min-width: 0` for
          exactly this reason. Our bar is never 2560px wide: at the narrowest
          lg viewport it is 726, where a third of a column, the cluster and
          Export add up to 861. Something has to give, and it is the title,
          which truncates. Fixing the column at a third instead pushed Export
          151px outside a root that is overflow-hidden -- clipped away with no
          scrollbar and nothing to show it had gone.
        */}
        <div className="flex min-w-0 grow basis-1/3 items-center gap-2 pr-2">
          <h2 className="min-w-0">
            <InlineEdit
              value={title}
              onValueChange={setTitle}
              label="Map name"
              variant="title"
              // min-w-0 so the title can actually truncate. InlineEdit is a
              // flex item whose read state is itself inline-flex around a
              // `truncate` span, and truncation needs min-w-0 at every level
              // of that chain -- without it the span refuses to shrink below
              // its text and pushes the controls to its right out of a bar
              // that is overflow-hidden, which clips them with no scrollbar
              // and no ellipsis to show for it.
              className="min-w-0"
            />
          </h2>
        </div>

        {/*
          The middle third: the workbench. Data, search, drawing, charts, in
          production's order.

          The two panel toggles sit together here rather than at opposite ends
          of the row. They were decorative before, because CSS forced both
          panels open at this width and there was nothing to toggle;
          `deskPanels` is that missing state. Below lg they give way to the
          switcher in the third column, which answers the different question
          of which single panel is on screen.
        */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={deskPanels.data ? "default" : "secondary"}
            size="icon"
            aria-label="Data layers"
            aria-expanded={deskPanels.data}
            aria-controls={dataPaneId}
            onClick={() =>
              setDeskPanels((open) => ({ ...open, data: !open.data }))
            }
            className="hidden lg:inline-flex"
          >
            <Layers />
          </Button>

          {/* Behaviour lives in runSearch, which the phone overlay shares.
              Production's field is a fixed 350px; 320 at lg is the nearest
              step that leaves the cluster inside a 726px bar at the smallest
              lg viewport, and 12rem is what fits at md, where the third
              column also carries the panel switcher and the basemap tile. */}
          <InputGroup className="hidden w-48 bg-card/95 backdrop-blur md:flex lg:w-80">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Search streets and junctions"
              aria-label="Search streets and junctions"
            />
          </InputGroup>

          {/* Below md the field is this button, and opening it reveals the
              overlay at the end of the bar. A disclosure, so aria-expanded --
              but no aria-controls: the overlay only exists while it is open,
              and an aria-controls pointing at nothing is worse than none.

              The same after:-inset-2 hit slop as the switcher and the basemap
              trigger, for the same reason: 36px is what the control-size
              ladder pins, and the pseudo-element buys a thumb 52px without
              moving a pixel. */}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Search streets and junctions"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(true)}
            className="relative after:absolute after:-inset-2 after:content-[''] md:hidden"
          >
            <Search />
          </Button>

          {/* The real control, from the registry: Select, freehand, circle and
              polygon with S/F/C/P, drawing onto the live map. The two buttons
              here before were a pointer icon and a chevron that opened
              nothing -- this is that shape, made real.

              --draw-size, not a descendant selector on its buttons: the
              component is built for the map corner, where 32px matches the
              zoom stack and the basemap tile, and this row is 36px. It takes
              its size from one custom property, so a consumer sets the whole
              control without reaching past it. */}
          <MapDrawControl
            className="hidden md:flex [--draw-size:2.25rem]"
            mode={drawMode}
            onModeChange={setDrawMode}
          />

          <Button
            variant={deskPanels.charts ? "default" : "secondary"}
            size="icon"
            aria-label="Charts"
            aria-expanded={deskPanels.charts}
            aria-controls={chartsPaneId}
            onClick={() =>
              setDeskPanels((open) => ({ ...open, charts: !open.charts }))
            }
            className="hidden lg:inline-flex"
          >
            <BarChart3 />
          </Button>
        </div>

        {/*
          The last third. Production leaves it empty and pins Export to the
          bar's right edge; justify-end reaches the same place without taking
          the button out of flow, which matters here because this column also
          holds the two controls that only exist below lg.
        */}
        <div className="flex grow basis-1/3 items-center justify-end gap-2 pl-2">
          {/*
            Panel switcher, below lg only.

            Two buttons with aria-expanded/aria-controls, not a toggle group:
            this reveals and hides a region, which is the disclosure pattern,
            and aria-controls states a relationship a toggle group has no way
            to express.

            The 36px box stays -- the control-size ladder pins icon buttons to
            exactly 36px -- and `after:-inset-2` grows the hit area to 52px for
            a thumb without moving a pixel. Same trick sidebar.tsx uses, and
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

          {/* The basemap's phone home, a sibling of the panel switcher rather
              than a member of it -- that slot means the two panel disclosures,
              and the responsive suite counts them.
              MapControls is desktop-only, which was free while its buttons did
              nothing. One of them does now, so it needs somewhere below lg,
              and the bottom-right corner is not it: the data panel docks there
              and MapLibre's attribution owns what is left. */}
          <BasemapSwitcher
            className="lg:hidden"
            value={basemapId}
            onValueChange={setBasemapId}
            side="bottom"
            align="end"
            trigger={
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Basemap: ${BASEMAP_BY_ID[basemapId]?.label ?? ""}`}
                className="relative after:absolute after:-inset-2 after:content-['']"
              >
                <MapIcon />
              </Button>
            }
          />

          {/* Downloads what is on screen -- the filtered flows, including any
              drawn zone -- through the registry's own toCsv/downloadFile. It
              had no onClick at all.

              size="default", not "sm": every other control on this row is a
              36px icon button, and this was 32. That is the mismatch
              control-size.spec.ts was written about, which it missed here
              because it only measured /preview/button-control-ladder. */}
          <Button
            aria-label="Export report"
            disabled={!features.length}
            onClick={() =>
              downloadFile(
                toCsv(
                  features.map(
                    (f) => f.properties as unknown as Record<string, unknown>,
                  ),
                  EXPORT_COLUMNS,
                ),
                `${title || "flows"}.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            <Sparkles data-icon="inline-start" />
            {/* xl, not sm. The label is ~90px, and below xl that 90px is the
                difference between a readable map name and "Zür...": at the
                narrowest lg viewport the bar is 726px, the cluster takes 478
                of it, and whatever Export does not use goes to the title.
                Measured both ways -- with the label the title gets 72px, and
                without it 164. */}
            <span className="hidden xl:inline">Export report</span>
          </Button>
        </div>

        {searchOpen ? (
          <div className="bg-card/95 absolute inset-0 flex items-center gap-2 px-2 backdrop-blur md:hidden">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchFieldRef}
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runSearch();
                  if (event.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Search streets and junctions"
                aria-label="Search streets and junctions"
              />
            </InputGroup>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
              className="relative shrink-0 after:absolute after:-inset-2 after:content-['']"
            >
              <X />
            </Button>
          </div>
        ) : null}
      </div>

      {/*
        The library. Mounted at the block's root rather than inside the panel
        so its overlay covers the workspace, and kept out of the panel's own
        scrolling body -- a dialog rendered inside a scroll container inherits
        its clipping.
      */}
      <DataLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        added={added}
        onAdd={addLayers}
        onUpload={uploadFeed}
        feeds={catalogue}
        // The same directory the layers themselves load from, so a card draws
        // the dataset it is offering rather than a stand-in for it.
        dataUrl={`${BASE_PATH}/data`}
      />

      {drawMode ? (
        <MapDrawBanner
          className="absolute top-16 left-1/2 w-[min(22rem,calc(100%-6rem))] -translate-x-1/2"
          mode={drawMode}
          points={draw.points}
          onDone={draw.finish}
          onCancel={draw.cancel}
        />
      ) : null}

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
            // Below lg `pane` decides; from lg up the bar's own disclosure
            // does, which is what makes that button honest.
            pane === "data" ? "flex" : "hidden",
            deskPanels.data ? "lg:flex" : "lg:hidden",
          )}
        >
          <FloatingPanelHeader>
            <Tabs value={tab} onValueChange={(v) => setTab(v as LayerTab)}>
              <TabsList>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="zones">Zones</TabsTrigger>
              </TabsList>
            </Tabs>
            <FloatingPanelActions>
              {/* Opens the library. It had no onClick: the panel already
                  listed every sample feed, so there was nothing this could
                  add, and it sat there claiming otherwise. */}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add data layer"
                aria-haspopup="dialog"
                onClick={() => setLibraryOpen(true)}
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
                <InputGroupInput
                  placeholder={tab === "data" ? "Search data" : "Search zones"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </InputGroup>

              {/* Zürich, so it belongs with the feeds rather than the
                  areas -- and it is the only layer here that is not one of
                  the hub's samples. */}
              {tab === "data" ? (
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
              ) : null}

              {/* The data hub's own sample feeds, as layers. Each card loads
                  its CSV the first time it is switched on, infers its own
                  columns, and so brings its own colorize fields, filters and
                  legend -- a feed added to the catalogue needs no code here.

                  Split by the feed's section: the Data tab lists the feeds, the
                  Zones tab the areas and the regulations. That is the
                  distinction the hub already draws, and the reason the Zones
                  tab exists. */}
              {visibleFeeds.map((feed) => (
                <SampleMapLayer
                  key={feed.id}
                  feed={feed}
                  map={map}
                  dataUrl={`${BASE_PATH}/data`}
                  visible={Boolean(layerOn[feed.id])}
                  onVisibleChange={(on) => setLayerVisible(feed.id, on)}
                  onSampleChange={onSampleChange}
                />
              ))}

              {/* Two different emptinesses, and they want different words: a
                  search that matched nothing is the reader's filter, while a
                  tab with no layers in it is an invitation to add one. Saying
                  "nothing matches" over an empty map would be a dead end. */}
              {visibleFeeds.length === 0 ? (
                query.trim() ? (
                  <p className="text-muted-foreground px-1 py-6 text-center text-sm">
                    Nothing here matches &ldquo;{query}&rdquo;.
                  </p>
                ) : (
                  <div className="px-1 py-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      {tab === "data"
                        ? "No other layers yet."
                        : "No zones or regulations yet."}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => setLibraryOpen(true)}
                    >
                      <Plus data-icon="inline-start" />
                      Add from library
                    </Button>
                  </div>
                )
              ) : null}
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
                  SEQUENTIAL_PALETTES for why the two sets are kept apart. */}
              <PresetPicker
                palettes={
                  categorical ? CATEGORICAL_PALETTES : SEQUENTIAL_PALETTES
                }
                value={categorical ? preset : (rampPreset ?? "")}
                onValueChange={(name) => {
                  if (categorical) {
                    setPreset(name);
                    return;
                  }
                  // A ramp is chosen by its colours, so selecting one writes
                  // the stops the editor and the map both read.
                  const chosen = SEQUENTIAL_PALETTES.find(
                    (p) => p.name === name,
                  );
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
          pane === "charts" ? "flex" : "hidden",
          deskPanels.charts ? "lg:flex" : "lg:hidden",
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
                {(value: string) =>
                  chartSources.find((s) => s.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {chartSources.map(({ value, label }) => (
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
              sampleCharts ? (
                <>
                  <ChartCard>
                    <ChartCardHeader title="Rows on the map" icon={<Hash />} />
                    <ChartCardMetric
                      value={plain.format(sampleCharts.shown)}
                      unit={`of ${plain.format(sampleCharts.total)} · ${
                        chartSources.find((s) => s.value === chartLayer)
                          ?.label ?? ""
                      }`}
                    />
                  </ChartCard>
                  {sampleCharts.breakdowns.map((breakdown) => (
                    <ChartCard key={breakdown.name}>
                      <ChartCardHeader
                        title={`By ${breakdown.label.toLowerCase()}`}
                        icon={<BarChart3 />}
                      />
                      {breakdown.items.length ? (
                        <RankedBars items={breakdown.items} />
                      ) : (
                        <p className="text-muted-foreground py-4 text-center text-xs">
                          No rows match these filters.
                        </p>
                      )}
                    </ChartCard>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                  Loading{" "}
                  {chartSources.find((src) => src.value === chartLayer)?.label}…
                </p>
              )
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
          zoom-out button completely.

          right-4 at every width: map controls belong in the corner, and a
          cluster floating mid-canvas to dodge the charts panel looked like a
          mistake even when it dodged successfully.

          This did briefly sit at `xl:right-[372px]`, against the inner edge of
          the charts panel, because the basemap menu opens upward and landed on
          that panel. What made the corner workable again is the menu itself:
          as a stacked list of five it was 224x290 and swallowed the panel, and
          as a row of three squares with no title it is 192x82 -- a small
          popover over a panel, which is what a popover should look like. Below xl the
          offset never helped anyway: at 1024 the canvas is 728px and the two
          340px panels plus insets take 712 of it, so it only traded the charts
          panel for the data panel. Its elevation is what carries it now. */}
      {/* Desktop only, and now for a different reason than before: these used
          to be decorative -- no handlers at all, and a tile labelled
          "Satellite" over a map that was not -- so hiding them below lg cost
          nothing. They do something now, which is why the basemap moved into
          the toolbar above rather than disappearing with them. The zoom pair
          stays desktop-only: pinch and double-tap are MapLibre's own handlers
          and are what a thumb reaches for. */}
      <MapControls
        className="absolute bottom-12 right-4 hidden lg:flex"
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        basemap={
          <BasemapSwitcher
            value={basemapId}
            onValueChange={setBasemapId}
            // Left, not top. Opening upward from a corner trigger stacks the
            // menu on the charts panel; opening leftward runs it along the
            // free band under that panel instead, where a 192x82 row of three
            // mostly fits. The mobile instance keeps `bottom`: its trigger is
            // in the toolbar at the top, where leftward would leave the panel.
            side="left"
            align="end"
          />
        }
      />
    </div>
  );
}

export default MapWorkspace;
