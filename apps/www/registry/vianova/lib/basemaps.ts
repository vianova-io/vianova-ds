import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import { resolveCssColor } from "@/registry/vianova/lib/css-color";

/**
 * The basemaps a map can be drawn on, and the data ramp each one wants.
 *
 * This file is the only place a tile URL appears. Swapping imagery provider --
 * for a tenant's own WMTS, or for Mapbox once someone pays for it -- is a change
 * to one constant here, not a hunt through blocks.
 *
 * ## Why the five are not built the same way
 *
 * MapLibre v6 has no style `imports`/slots; that is a Mapbox GL v3 feature. So
 * "a style URL plus a raster underneath" cannot be declared, and the five split
 * into three kinds:
 *
 *   Plan, Muted      a CARTO style URL per scheme, nothing else
 *   Satellite        an authored StyleSpecification -- imagery needs to sit
 *                    UNDER labels, which only works if we own the layer list
 *   Terrain          a base style plus a layer injected at style-ready
 *
 * The asymmetry is forced, not stylistic.
 */

type StyleLike = string | StyleSpecification;

export type BasemapId = "plan" | "satellite" | "terrain";

/** The four data ramps the token pipeline emits as `[data-map-scheme]`. */
export type MapScheme = "brand" | "warm" | "viridis" | "blue";

export type Basemap = {
  id: BasemapId;
  /** On the control and in the popover. */
  label: string;
  /** One line under the label, saying what it is for. */
  hint: string;
  /**
   * The ramp that reads on this basemap. Keyed by colour scheme, because two
   * of the basemaps change with the theme and three do not.
   */
  mapScheme: Record<"light" | "dark", MapScheme>;
  /** Photographic. Carries a scrim, and is neither light nor dark. */
  imagery?: boolean;
  /** Gets a terrarium raster-dem and a hillshade layer under the roads. */
  hillshade?: boolean;
};

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Esri World Imagery.
 *
 * Note `{z}/{y}/{x}`: ArcGIS tile REST is row before column, unlike XYZ. Both
 * orders return HTTP 200 with a valid JPEG, so getting it wrong shows imagery
 * of a different place rather than failing -- there is no error to catch.
 *
 * Esri's terms do not clearly permit commercial redistribution. That was a
 * decision taken with eyes open; this constant is the one line to change if it
 * ever has to be undone.
 */
export const ESRI_WORLD_IMAGERY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Esri's own `copyrightText`, verbatim from the service metadata. */
export const ESRI_WORLD_IMAGERY_ATTRIBUTION =
  "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";

/** Terrarium-encoded elevation, AWS Open Data. Free, and with no SLA. */
export const TERRAIN_DEM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const TERRAIN_DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (AWS Open Data)';

const CARTO = "https://basemaps.cartocdn.com/gl";
const CARTO_VECTOR_TILES =
  "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json";
const CARTO_GLYPHS =
  "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf";

/**
 * CARTO serves `Open Sans`, not `Noto Sans`. Asking for a fontstack it does not
 * have returns 404 and the labels silently do not draw -- the map still renders,
 * just mute.
 */
const FONT_REGULAR = "Open Sans Regular";
const FONT_BOLD = "Open Sans Bold";

/**
 * Positron and Dark Matter -- CARTO's neutral pair, and the only pair where the
 * basemap is the same map in both schemes and only its luminance moves.
 *
 * Plan held Voyager in the light slot, which made it a different map by theme
 * rather than a lighter one: Voyager is the colourful street style, with green
 * landuse and tinted roads, against a neutral grey in dark. Over a data layer
 * that is itself carrying colour, the base has no business bringing its own.
 *
 * Plan and Terrain therefore resolve to the SAME style in both schemes, and
 * differ only by the hillshade over it -- which is the honest description of
 * what Terrain is. That makes the shared-style swap path in map-canvas the
 * normal case rather than a dark-mode edge case: no setStyle, overlays
 * reconciled in both directions. See the `appliedStyleRef` guard there.
 */
const NEUTRAL_STYLE = {
  light: `${CARTO}/positron-gl-style/style.json`,
  dark: `${CARTO}/dark-matter-gl-style/style.json`,
} as const;

const STYLE_URLS = {
  plan: NEUTRAL_STYLE,
  terrain: NEUTRAL_STYLE,
} as const;

// ---------------------------------------------------------------------------
// The basemaps
// ---------------------------------------------------------------------------

/**
 * Streets, imagery, relief -- the triad every GIS basemap gallery ships, and
 * the three that answer different questions: what is there, what it looks
 * like, what shape the ground is.
 *
 * Muted (a no-labels grey canvas) and Blank were here and are gone. Muted was
 * the default, and dropping it means Plan is: the data now sits on a basemap
 * that has colour of its own, which is the cost of the shorter list.
 */
export const BASEMAPS: readonly Basemap[] = [
  {
    id: "plan",
    label: "Plan",
    hint: "Neutral street map, light or dark with the theme",
    mapScheme: { light: "brand", dark: "viridis" },
  },
  {
    id: "satellite",
    label: "Satellite",
    hint: "Aerial imagery with roads and labels",
    // Warm, in both schemes. Imagery is neither light nor dark, and warm is the
    // loudest ramp -- the one that survives being laid over a photograph.
    mapScheme: { light: "warm", dark: "warm" },
    imagery: true,
  },
  {
    id: "terrain",
    label: "Terrain",
    hint: "Relief shading, for gradient and route choice",
    // Blue in light: hillshade is grey-brown, and blue is the ramp furthest
    // from it. Dark keeps viridis, which already reads on Dark Matter.
    mapScheme: { light: "blue", dark: "viridis" },
    hillshade: true,
  },
] as const;

export const BASEMAP_IDS: readonly BasemapId[] = BASEMAPS.map((b) => b.id);

export const BASEMAP_BY_ID: Record<BasemapId, Basemap> = Object.fromEntries(
  BASEMAPS.map((b) => [b.id, b]),
) as Record<BasemapId, Basemap>;

/** Plan. Muted held this until the gallery was cut to three. */
export const DEFAULT_BASEMAP_ID: BasemapId = "plan";

export const MAP_SCHEME_LABELS: Record<MapScheme, string> = {
  brand: "Brand",
  warm: "Warm",
  viridis: "Viridis",
  blue: "Blue",
};

/**
 * Which data ramp this basemap wants.
 *
 * The only copy of this mapping. `map-workspace` used to derive it from
 * light/dark in one hand-rolled line, with a comment calling the scheme "a
 * property of this map's basemap" that no code path made true. This is that
 * comment, implemented.
 */
export function mapSchemeFor(id: BasemapId, scheme: "light" | "dark"): MapScheme {
  return (BASEMAP_BY_ID[id] ?? BASEMAP_BY_ID[DEFAULT_BASEMAP_ID]).mapScheme[scheme];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** Resolved `--surface-sunken`, with the token's own values as the fallback. */
function surfaceSunken(scheme: "light" | "dark"): string {
  return (
    resolveCssColor("--surface-sunken", scheme) ??
    (scheme === "dark" ? "#18181b" : "#f4f4f5")
  );
}

/**
 * Imagery with just enough vector on top to navigate by.
 *
 * Six layers, and small on purpose: the only coupling to CARTO's tile schema is
 * the source-layers `transportation`, `transportation_name`, `place`, `boundary`
 * and the fields `class`, `admin_level`, `name`. If CARTO changes those, the
 * labels and roads vanish while the imagery keeps working -- degraded rather
 * than broken, and nothing will report it, since MapCanvas only treats HTTP 401
 * as fatal.
 *
 * The first two layers are the scrim: a background painted with the theme
 * surface, and the imagery composited over it below full opacity, so the photo
 * washes toward the surface instead of being greyed by a sheet laid on top.
 * Baking it into the style rather than injecting it at runtime is what
 * guarantees it stays underneath the data -- every layer hook re-adds without a
 * `beforeId`, so anything added later lands on top of the whole style.
 */
function satelliteStyle(scheme: "light" | "dark"): StyleSpecification {
  const ink = scheme === "dark" ? "#ffffff" : "#18181b";
  const halo = scheme === "dark" ? "rgba(0,0,0,0.78)" : "rgba(255,255,255,0.85)";
  return {
    version: 8,
    glyphs: CARTO_GLYPHS,
    sources: {
      imagery: {
        type: "raster",
        tiles: [ESRI_WORLD_IMAGERY_TILES],
        tileSize: 256,
        // Overzoomed above this rather than 404ing into blank tiles.
        maxzoom: 19,
        attribution: ESRI_WORLD_IMAGERY_ATTRIBUTION,
      },
      // CARTO's TileJSON carries its own attribution (CARTO + OpenStreetMap),
      // which MapLibre aggregates with Esri's above.
      carto: { type: "vector", url: CARTO_VECTOR_TILES },
    },
    layers: [
      {
        id: "scrim",
        type: "background",
        paint: { "background-color": surfaceSunken(scheme) },
      },
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
        paint: { "raster-opacity": scheme === "dark" ? 0.72 : 0.8 },
      },
      {
        id: "satellite-road",
        type: "line",
        source: "carto",
        "source-layer": "transportation",
        minzoom: 5,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ink,
          "line-opacity": 0.4,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 1.5, 16, 4],
        },
      },
      {
        id: "satellite-boundary",
        type: "line",
        source: "carto",
        "source-layer": "boundary",
        filter: ["<=", ["to-number", ["get", "admin_level"]], 4],
        paint: {
          "line-color": ink,
          "line-opacity": 0.35,
          "line-dasharray": [2, 2],
          "line-width": 0.8,
        },
      },
      {
        id: "satellite-place-label",
        type: "symbol",
        source: "carto",
        "source-layer": "place",
        filter: [
          "match",
          ["get", "class"],
          ["country", "state", "city", "town", "village", "suburb", "neighbourhood"],
          true,
          false,
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": [FONT_BOLD],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 13, 14, 15],
          "text-max-width": 8,
        },
        paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.3 },
      },
      {
        id: "satellite-road-label",
        type: "symbol",
        source: "carto",
        "source-layer": "transportation_name",
        minzoom: 12,
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": [FONT_REGULAR],
          "text-size": 11,
          "text-max-angle": 30,
        },
        paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.2 },
      },
    ],
  } satisfies StyleSpecification;
}

/**
 * The style for a basemap in a colour scheme.
 *
 * Returns a FRESH object for satellite, which is why callers must
 * memoise on the basemap id and never on this return value -- MapCanvas's swap
 * guard compares by identity, and a new object every render means `setStyle` on
 * every render.
 */
export function resolveBasemapStyle(
  id: BasemapId,
  scheme: "light" | "dark",
): StyleLike {
  switch (id) {
    case "satellite":
      return satelliteStyle(scheme);
    case "terrain":
      return STYLE_URLS.terrain[scheme];
    case "plan":
    default:
      return STYLE_URLS.plan[scheme];
  }
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

export const BASEMAP_DEM_SOURCE_ID = "basemap-dem";
export const BASEMAP_HILLSHADE_LAYER_ID = "basemap-hillshade";

/**
 * The id of the lowest layer of any of `types`, for use as a `beforeId`.
 *
 * `undefined` means "append", which is what MapLibre does with a missing
 * beforeId, so the caller needs no branch.
 */
export function firstLayerIdOfType(
  map: MapLibreMap,
  types: string[],
): string | undefined {
  try {
    return map.getStyle().layers.find((layer) => types.includes(layer.type))?.id;
  } catch {
    // getStyle() throws before a style exists.
    return undefined;
  }
}

/**
 * Adds whatever a basemap needs that its style could not declare.
 *
 * Idempotent, because it runs on every style-ready and `setStyle` discards
 * sources and layers unpredictably from the caller's point of view.
 *
 * Placed under the first line or symbol layer so the shading sits above
 * landcover fills and below roads and labels -- a hillshade over the road
 * casings reads as fog.
 */
export function applyBasemapOverlays(
  map: MapLibreMap,
  basemap: Basemap | undefined,
  scheme: "light" | "dark",
): void {
  if (!basemap?.hillshade) {
    // Idempotent in both directions. `setStyle` does clear these itself --
    // measured, by reading getStyle().sources either side of a swap -- so this
    // is belt and braces for a basemap that keeps its style and drops its
    // hillshade, not a workaround for a leak.
    if (map.getLayer(BASEMAP_HILLSHADE_LAYER_ID)) {
      map.removeLayer(BASEMAP_HILLSHADE_LAYER_ID);
    }
    if (map.getSource(BASEMAP_DEM_SOURCE_ID)) {
      map.removeSource(BASEMAP_DEM_SOURCE_ID);
    }
    return;
  }

  if (!map.getSource(BASEMAP_DEM_SOURCE_ID)) {
    map.addSource(BASEMAP_DEM_SOURCE_ID, {
      type: "raster-dem",
      tiles: [TERRAIN_DEM_TILES],
      tileSize: 256,
      // The dataset's ceiling. Above it MapLibre overzooms, which is softer
      // than the stair-stepping you get from asking for tiles that do not exist.
      maxzoom: 15,
      encoding: "terrarium",
      attribution: TERRAIN_DEM_ATTRIBUTION,
    });
  }

  if (map.getLayer(BASEMAP_HILLSHADE_LAYER_ID)) return;
  map.addLayer(
    {
      id: BASEMAP_HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: BASEMAP_DEM_SOURCE_ID,
      paint: {
        // Stronger in dark, because dark had almost nothing to work with.
        // Dark Matter's land is already near-black, so a black shadow lands on
        // black and #3f3f46 was barely a lift: measured against the same view
        // without the hillshade, light moved 52% of pixels by more than 4/255
        // with a peak delta of 101, dark moved 18% with a peak of 31 -- and at
        // thumbnail size that averaged away to nothing, leaving Terrain and
        // Plan the same picture. The shadow stays black (there is no darker
        // direction to go) and the highlight does the work instead.
        "hillshade-exaggeration": scheme === "dark" ? 0.6 : 0.45,
        "hillshade-shadow-color": scheme === "dark" ? "#000000" : "#52525b",
        "hillshade-highlight-color": scheme === "dark" ? "#8a8a95" : "#ffffff",
        "hillshade-accent-color": "#00000000",
      },
    },
    firstLayerIdOfType(map, ["line", "symbol"]),
  );
}
