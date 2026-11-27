"use client";

/**
 * The map that sits beside `ZonePickerPanel` while someone picks zones.
 *
 * It shows three things on a real basemap -- the zones already chosen, the
 * ones staged in the picker, and the one under the pointer in its list -- and
 * it is where a new zone is drawn. The panel holds the list and the tools;
 * this holds the geography they are about.
 *
 * ## Why it exists apart from RegulationMap
 *
 * The regulation editor had this behaviour first, inside its own
 * `RegulationMap`, wound together with things only a regulation has: a colour
 * per rule type and the legend that explains them, the selected rule drawn
 * over the others, a place search, a tray that stands in for the settings
 * column on a phone. Alerts needs the map and none of that. Lifting the map
 * out as it stood would have carried a regulation into every page that picks
 * a zone, so this is the part the two share and nothing else.
 *
 * ## Who owns what
 *
 * The parent owns the lists and the armed tool; the map owns the camera, the
 * basemap and the corridor width. That is the same split `RegulationEditor`
 * makes, and for the same reason: the tools are pressed in the panel, a
 * sibling of the map, so the state they share has to sit above both.
 *
 * A finished shape is handed up as a whole `PickerZone` rather than as a bare
 * ring. Every consumer would otherwise write the same five lines to mint an
 * id, a name and a timestamp, and two of them would disagree about the name.
 *
 * The tool stays armed after a shape, so a run of zones is a run of gestures
 * rather than a trip back to the panel for each one. Escape, Cancel or
 * pressing the armed tool again is how you stop.
 *
 * ## The camera
 *
 * It frames what is chosen and staged when HOW MANY there are changes, and
 * not otherwise: scrolling the list or hovering a row must not move the map,
 * and the preview outline answers a hover instead. Emptying the selection
 * leaves the camera where it is.
 *
 * A shape drawn here never moves it either, although it arrives back in
 * `candidates` like anything else staged. The map remembers which ids it
 * minted and leaves them out of the count -- a camera that flies off as each
 * shape lands is the map arguing with someone mid-draw.
 *
 * ## Size
 *
 * The root has no size of its own. Give it one through `className` -- `flex-1`
 * in a row, `h-full` in a column -- and the map fills it.
 *
 * Deliberately NOT here:
 *
 * - **No legend and no colour per kind.** One colour for what is chosen, one
 *   for what is staged. A surface whose zones mean different things draws its
 *   own layers; the two colours here say only "in" and "not in yet".
 * - **No place search.** `RegulationMap` has one because its consumer hands it
 *   a geocoder. A map that needs one composes it over this.
 * - **No tool buttons.** They are in the panel, the one place that stays on
 *   screen for the whole session. The keyboard shortcuts are here, because
 *   they belong to the map wherever the buttons live.
 * - **No draft list, no tray, no pane switching.** What has been drawn is the
 *   parent's list; where the map goes on a phone is the parent's layout.
 * - **No naming, renaming or removing.** `onDrawn` reports a shape once and
 *   the map forgets it, apart from its id.
 */

import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  useCategoryShapeLayer,
  type CategoryShape,
} from "@/registry/vianova/hooks/use-category-shape-layer";
import { DEFAULT_BASEMAP_ID, type BasemapId } from "@/registry/vianova/lib/basemaps";
import { CATEGORY_PALETTE } from "@/registry/vianova/lib/category-style";
import { cn } from "@/registry/vianova/lib/utils";
import { BasemapSwitcher } from "@/registry/vianova/product/basemap-switcher";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapControls } from "@/registry/vianova/product/map-controls";
import {
  DEFAULT_LINE_WIDTH_M,
  MapDrawBanner,
  useMapDraw,
  useMapDrawShortcuts,
} from "@/registry/vianova/product/map-draw-control";
import type {
  PickerZone,
  ZoneDrawTool,
} from "@/registry/vianova/product/zone-picker";

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node. The
 * expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM, because
 * Next substitutes that exact text at build time.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WORKER_URL = `${BASE_PATH}/maplibre/maplibre-gl-worker.mjs`;

/** Lisbon, where every sample zone is. The regulation editor opens here too. */
const LISBON: [number, number] = [-9.142, 38.722];

/**
 * The two looks a zone can have here. Module scope, because
 * useCategoryShapeLayer asks for a styles object that does not change
 * identity between renders.
 *
 * Chosen zones are the first categorical stop, which is the product primary.
 * Staged ones are the second, blue, exactly as the regulation editor draws
 * them: they are not in yet, and a colour of their own is what stops a
 * candidate being read as something already saved. Both are the design
 * system's `--chart-categorical-*` tokens as literals -- MapLibre paints with
 * a colour it parses itself and cannot resolve a custom property.
 */
const ZONE_STYLES = {
  zone: { color: CATEGORY_PALETTE[0] },
  candidate: { color: CATEGORY_PALETTE[1] },
};

const NO_ZONES: PickerZone[] = [];
const NO_SHAPES: CategoryShape[] = [];

let seq = 0;
/**
 * Ids for shapes drawn here. Counted at module scope so two maps on one page
 * cannot mint the same one, and prefixed so they never collide with a zone
 * library's own or with the regulation editor's `zone-new-*`.
 */
const drawnId = () => `zone-drawn-${++seq}`;

type Bounds = [[number, number], [number, number]];

function boundsOf(rings: [number, number][][]): Bounds | null {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings)
    for (const [x, y] of ring) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/**
 * How many distinct zones are chosen or staged, not counting the ones drawn
 * on this map. The number the camera is keyed on -- see "The camera" above.
 */
function countPicked(
  zones: PickerZone[],
  candidates: PickerZone[],
  drawn: ReadonlySet<string>,
): number {
  const ids = new Set<string>();
  for (const z of zones) if (!drawn.has(z.id)) ids.add(z.id);
  for (const z of candidates) if (!drawn.has(z.id)) ids.add(z.id);
  return ids.size;
}

/**
 * Zones as the shape layer wants them, rebuilt only when a ring changes.
 *
 * useCategoryShapeLayer tears its source down and adds it again whenever the
 * array it is given is a new one. Keyed on the array's identity that would be
 * every render for a parent that writes `candidates={[...ticked, ...drawn]}`
 * -- and a parent re-renders on each row the pointer crosses, so the staged
 * zones would blink as the list is read. Rings are compared instead: renaming
 * a zone or re-spreading the list keeps them, and only a shape arriving,
 * leaving or changing rebuilds the layer.
 */
function useZoneShapes(zones: PickerZone[], category: string): CategoryShape[] {
  const held = React.useRef<CategoryShape[]>(NO_SHAPES);
  const same =
    held.current.length === zones.length &&
    zones.every((z, i) => held.current[i]!.ring === z.ring);
  if (!same) held.current = zones.map((z) => ({ ring: z.ring, category }));
  return held.current;
}

/* -------------------------------------------------------------------------- */
/* Map                                                                         */
/* -------------------------------------------------------------------------- */

export function ZoneDrawMap({
  className,
  zones,
  candidates = NO_ZONES,
  preview = null,
  tool,
  onToolChange,
  onDrawn,
  nextName,
  center = LISBON,
  zoom = 12.5,
  label = "Map of the zones",
}: {
  className?: string;
  /** Zones already chosen. Drawn filled and outlined. */
  zones: PickerZone[];
  /** Zones staged in the picker (ticked, imported or drawn) but not added yet. Drawn highlighted. */
  candidates?: PickerZone[];
  /** The zone under the pointer in the picker's list, or null. Drawn emphasised. */
  preview?: PickerZone | null;
  /** The armed drawing tool, or null when not drawing. Controlled. */
  tool: ZoneDrawTool | null;
  onToolChange: (tool: ZoneDrawTool | null) => void;
  /**
   * A shape finished on the map. The component builds the PickerZone
   * (id unique within the session, name "Zone N" where N counts up from 1
   * within this component instance unless `nextName` is given, tags ["drawn"],
   * ring = closed outer ring as [lng, lat][], createdAt = now ISO) and hands
   * it over; the parent keeps the list.
   */
  onDrawn: (zone: PickerZone) => void;
  /** Optional: names the next drawn zone. */
  nextName?: () => string;
  /** [lng, lat]. Defaults to Lisbon, the same constant regulations uses. */
  center?: [number, number];
  zoom?: number;
  /** aria-label of the map region. Default "Map of the zones". */
  label?: string;
}): React.JSX.Element {
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const sectionRef = React.useRef<HTMLElement>(null);
  /*
   * The parent decides where this goes, and on a narrow screen that is often
   * a pane that is display:none until asked for. A map created at 0x0 keeps
   * that canvas when it is shown, so the section is watched and the map told
   * to measure again; `visible` lets the framing wait for a real size --
   * fitBounds on a 0x0 map lands on the wrong zoom.
   */
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // Both ways: the root has no size of its own, so a parent that forgot
      // to give it a height is as unshown as one that hid it.
      const box = entry?.contentRect;
      const shown = (box?.width ?? 0) > 0 && (box?.height ?? 0) > 0;
      setVisible(shown);
      if (shown) map?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  const [basemapId, setBasemapId] = React.useState<BasemapId>(DEFAULT_BASEMAP_ID);
  // Kept across drawings rather than reset with the tool: someone marking up
  // a street network sets the corridor once and then draws a dozen streets at
  // that width.
  const [lineWidth, setLineWidth] = React.useState(DEFAULT_LINE_WIDTH_M);

  /* --- What is drawn ---------------------------------------------------- */

  const zoneShapes = useZoneShapes(zones, "zone");
  const candidateShapes = useZoneShapes(candidates, "candidate");
  const previewShapes = useZoneShapes(preview ? [preview] : NO_ZONES, "candidate");

  useCategoryShapeLayer({
    map,
    enabled: zoneShapes.length > 0,
    shapes: zoneShapes,
    styles: ZONE_STYLES,
    id: "zone-draw-map-zones",
  });
  // What the picker is about to add, over the top of what is already chosen.
  useCategoryShapeLayer({
    map,
    enabled: candidateShapes.length > 0,
    shapes: candidateShapes,
    styles: ZONE_STYLES,
    width: 2,
    id: "zone-draw-map-candidates",
  });
  // The row being read, drawn again on top with a heavier outline. A second
  // layer rather than a second colour: the zone is the same zone, and what
  // the reader needs is to find it, not to be told it is a different kind.
  useCategoryShapeLayer({
    map,
    enabled: previewShapes.length > 0,
    shapes: previewShapes,
    styles: ZONE_STYLES,
    width: 4,
    id: "zone-draw-map-preview",
  });

  /* --- Drawing ---------------------------------------------------------- */

  /** Ids minted here, so the camera can tell a drawn shape from a picked one. */
  const drawnIds = React.useRef(new Set<string>());
  /** How many shapes this map has named itself. */
  const named = React.useRef(0);

  const draw = useMapDraw({
    map,
    mode: tool,
    lineWidthMeters: lineWidth,
    /*
     * The tool stays armed, so a run of zones is a run of drags rather than a
     * trip back through the picker for each one. `useMapDraw`'s effect is
     * keyed on the mode, so leaving it alone means no teardown: the pointer
     * handlers, the held `dragPan` and the banner's corridor width all stay
     * live. Escape or Cancel is how you stop.
     */
    onComplete: (ring) => {
      const id = drawnId();
      // Before the hand-over, so the render it causes already knows this id
      // is one of the map's own and leaves the camera alone.
      drawnIds.current.add(id);
      onDrawn({
        id,
        name: nextName ? nextName() : `Zone ${++named.current}`,
        tags: ["drawn"],
        ring,
        createdAt: new Date().toISOString(),
      });
    },
    onCancel: () => onToolChange(null),
  });

  /*
   * p / c / f / l arm a tool and s stops. The buttons are in the panel; the
   * shortcuts belong to the map either way, so they are held here. The hook
   * ignores keys typed into a field, which is what keeps naming a draft
   * "Circle" from arming one -- and the tool is controlled, so a parent with
   * a reason not to draw declines in `onToolChange`.
   */
  useMapDrawShortcuts({ mode: tool, onModeChange: onToolChange });

  /* --- Camera ----------------------------------------------------------- */

  /*
   * Frame what is chosen and staged, as it changes.
   *
   * Keyed on how many there are rather than on the zones themselves, so the
   * camera moves when the selection grows or shrinks and stays put while
   * someone scrolls the list or hovers a row -- which the preview layer
   * answers instead. Counted by id across both lists, so a staged zone
   * becoming a chosen one is not a change: it was already in frame.
   *
   * Shapes drawn here are left out of the count, and so never move it.
   */
  const framedCount = countPicked(zones, candidates, drawnIds.current);
  /** The count last framed. null until the first, which lands without a flight. */
  const framed = React.useRef<number | null>(null);
  React.useEffect(() => {
    // Compared with the last count framed, not just listed as a dependency:
    // a pane hidden and shown again re-runs this, and flying back to the
    // selection then would undo wherever someone had panned to.
    if (!map || !visible || framed.current === framedCount) return;
    const first = framed.current === null;
    framed.current = framedCount;
    // Emptied: the camera stays where it is. Flying back on an untick would
    // be the map arguing with the reader.
    if (framedCount === 0) return;
    map.resize();
    const b = boundsOf([...zones, ...candidates].map((z) => z.ring));
    if (!b) return;
    map.fitBounds(b, {
      padding: 64,
      maxZoom: 16,
      // Arriving on zones that are already there is not a journey.
      ...(first ? { duration: 0 } : null),
    });
    // The lists are read for their rings but deliberately not depended on;
    // see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visible, framedCount]);

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      data-slot="zone-draw-map"
      className={cn(
        "relative isolate min-h-0 min-w-0 overflow-hidden",
        className,
      )}
    >
      <MapCanvas
        className="absolute inset-0"
        basemap={basemapId}
        workerUrl={WORKER_URL}
        center={center}
        zoom={zoom}
        cooperativeGesturesBelow={1024}
        onStyleReady={setMap}
        fallback={
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
            The map can&apos;t be shown here because WebGL is unavailable.
          </div>
        }
      />

      {tool ? (
        <MapDrawBanner
          className="absolute top-3 left-1/2 w-[min(30rem,calc(100%-6rem))] -translate-x-1/2"
          mode={tool}
          points={draw.points}
          lineWidthMeters={lineWidth}
          onLineWidthChange={setLineWidth}
          onDone={draw.finish}
          onCancel={draw.cancel}
        />
      ) : null}

      {/* Lifted clear of MapLibre's attribution, which sits in this corner. */}
      <MapControls
        className="absolute right-3 bottom-10"
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        basemap={
          <BasemapSwitcher
            value={basemapId}
            onValueChange={setBasemapId}
            side="left"
            align="end"
          />
        }
      />
    </section>
  );
}
