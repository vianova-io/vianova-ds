"use client";

import * as React from "react";
import { ChevronDown, Circle, MousePointer2, Spline } from "lucide-react";
import type {
  FilterSpecification,
  GeoJSONSource,
  LngLat,
  Map as MapLibreMap,
} from "maplibre-gl";

import { DrawZoneIcon } from "@/registry/vianova/product/draw-zone-icon";
import { Button } from "@/registry/vianova/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import { Kbd } from "@/registry/vianova/ui/kbd";
import { resolveCssColor } from "@/registry/vianova/lib/css-color";
import { cn } from "@/registry/vianova/lib/utils";

export type DrawMode = "freehand" | "circle" | "polygon";

/**
 * Select is `null`, not a fourth DrawMode.
 *
 * Production lists it beside the three shapes, and it belongs there -- it is
 * what the reader picks to stop drawing and go back to panning the map. But it
 * draws nothing, and giving it a DrawMode of its own would oblige every
 * consumer, `useMapDraw` included, to carry a mode that means "no mode" and to
 * remember never to draw in it. `null` already means exactly that, and the
 * menu is where the two are reconciled: one radio group, "select" standing in
 * for null at the edge.
 *
 * It also replaces the old "Stop drawing" item, which only appeared mid-draw.
 * A radio cannot be un-picked by clicking it again, so the way out had to be a
 * separate item; as a radio of its own, Select is the way out and is always
 * visible.
 */
const SELECT = "select";

/**
 * Every word the control can say, so a product that translates its interface
 * can translate this one. The menu is the only place some of these appear, so
 * leaving them hardcoded would strand a drawing tool in English inside an
 * otherwise translated map.
 */
export type MapDrawLabels = {
  select: string;
  freehand: string;
  circle: string;
  polygon: string;
  /** The tool button, and the prefix of its tooltip while idle. */
  draw: string;
  /** The prefix of the tool button's tooltip while a drawing is under way. */
  stop: string;
  /** The chevron beside it, which opens the menu. */
  chooseTool: string;
};

const DEFAULT_LABELS: MapDrawLabels = {
  select: "Select",
  freehand: "Free hand",
  circle: "Circle",
  polygon: "Polygon",
  draw: "Draw a zone",
  stop: "Stop drawing",
  chooseTool: "Choose a drawing tool",
};

const MODES: {
  value: DrawMode | null;
  id: keyof MapDrawLabels;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: null, id: "select", key: "S", icon: MousePointer2 },
  { value: "freehand", id: "freehand", key: "F", icon: Spline },
  { value: "circle", id: "circle", key: "C", icon: Circle },
  // The polygon glyph, not Lucide's Hexagon: this mode does not draw a
  // hexagon, it drops a vertex per click and closes the ring, and the handles
  // on the corners are what say so.
  { value: "polygon", id: "polygon", key: "P", icon: DrawZoneIcon },
];

/** `s` maps to null, so membership is tested with `in`, not truthiness. */
const KEY_TO_MODE: Record<string, DrawMode | null> = {
  s: null,
  f: "freehand",
  c: "circle",
  p: "polygon",
};

/**
 * Whether a keydown belongs to something other than the map.
 *
 * Single-letter shortcuts are only safe when nobody is typing: an "f" in a
 * search box must stay an "f". A held modifier means a browser or OS shortcut
 * (Cmd+C, Ctrl+P), which must never also start a drawing. And a key pressed
 * inside an open menu is the menu's -- Esc there closes the menu, and should
 * not also throw away the zone being drawn behind it.
 */
function isForeignKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.closest !== "function") return false;
  if (target.isContentEditable) return true;
  if (
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable='true']",
    )
  ) {
    return true;
  }
  return !!target.closest("[role=menu]");
}

/**
 * The "Draw a zone" button that floats on the map, and the menu of drawing
 * modes it opens.
 *
 * Controlled: it reports the mode the reader picked and shows the one it is
 * given, and leaves the drawing itself to `useMapDraw`. The two are split so a
 * toolbar elsewhere can drive the same hook without this button on screen.
 */
export function MapDrawControl({
  mode,
  onModeChange,
  shortcuts = true,
  disabled,
  labels,
  className,
}: {
  mode: DrawMode | null;
  onModeChange: (mode: DrawMode | null) => void;
  /** Overrides any of the control's words; the rest keep their defaults. */
  labels?: Partial<MapDrawLabels>;
  /**
   * F, C and P pick a mode and Esc stops drawing. On by default because the
   * menu shows the keys, and a hint for a key that does nothing is worse than
   * no hint. Ignored while focus is in a text field or a modifier is held.
   */
  shortcuts?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const active = mode !== null;
  // Merged per render rather than memoised: it is four string reads, and a
  // caller passing an inline object would defeat the memo anyway.
  const t = { ...DEFAULT_LABELS, ...labels };

  // Read through a ref so the listener is attached once, not re-attached on
  // every mode change the reader makes.
  const stateRef = React.useRef({ mode, onModeChange });
  stateRef.current = { mode, onModeChange };

  React.useEffect(() => {
    if (!shortcuts || disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented || isForeignKey(event)) return;
      const { mode: current, onModeChange: change } = stateRef.current;
      if (event.key === "Escape") {
        if (current !== null) change(null);
        return;
      }
      const key = event.key.toLowerCase();
      // `in`, because KEY_TO_MODE.s is null and a truthiness test would drop
      // the one shortcut that stops a drawing.
      if (!(key in KEY_TO_MODE)) return;
      const picked = KEY_TO_MODE[key]!;
      if (picked !== current) {
        event.preventDefault();
        change(picked ?? null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, disabled]);

  const current = MODES.find((m) => m.value === mode) ?? MODES[0]!;
  const CurrentIcon = current.icon;
  // What the tool button switches TO when nothing is being drawn. Remembered,
  // so a reader who picked Circle once gets Circle back on the next click
  // rather than whatever the component thinks is the default.
  const lastToolRef = React.useRef<DrawMode>("polygon");
  if (mode !== null) lastToolRef.current = mode;

  /**
   * Shared with the zoom stack and the basemap tile, so the map corner reads
   * as one family. Sizing comes from --draw-size rather than a fixed `size-8`:
   * the same control sits in the corner at 32px and on a toolbar row at 36px,
   * and the control-size ladder pins that row. A consumer sets the whole
   * control with one class -- `[--draw-size:2.25rem]` -- instead of reaching
   * past the component with a descendant selector to override `size-8`.
   */
  const face =
    "flex h-[var(--draw-size)] cursor-pointer items-center justify-center border bg-card/95 backdrop-blur transition-colors " +
    "focus-visible:relative focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none " +
    "disabled:pointer-events-none disabled:opacity-50";
  const tone = active
    ? "border-primary text-primary"
    : "border-border text-muted-foreground hover:text-foreground";

  return (
    <div
      data-slot="map-draw-control"
      className={cn("flex [--draw-size:2rem]", className)}
    >
      {/*
        A split control, as production draws it: the tool on the left, the
        menu of tools behind a chevron on the right.

        The left button is not a second way to open the menu -- it toggles
        between Select and the last drawing tool, which is the one thing a
        reader does over and over while drawing several zones and which used
        to take two clicks through the menu every time.
      */}
      <button
        type="button"
        data-part="tool"
        disabled={disabled}
        aria-label={t.draw}
        // The label stays put while the glyph changes, so a screen reader is
        // not told the button became a different button; `title` and
        // aria-pressed carry the state.
        title={`${active ? t.stop : t.draw} (${t[current.id]})`}
        // aria-pressed says a drawing is under way even with the menu shut,
        // which aria-expanded on its own cannot. The colour change pairs with
        // a border change so it does not rest on hue alone.
        aria-pressed={active}
        onClick={() => onModeChange(active ? null : lastToolRef.current)}
        className={cn(face, tone, "w-[var(--draw-size)] rounded-l-lg")}
      >
        <CurrentIcon className="size-4" aria-hidden />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              data-part="chevron"
              aria-label={t.chooseTool}
              title={t.chooseTool}
              // -ml-px collapses the two borders between the halves into one.
              className={cn(
                face,
                tone,
                "-ml-px w-[calc(var(--draw-size)*0.75)] rounded-r-lg",
              )}
            />
          }
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </DropdownMenuTrigger>
        {/* w-auto: the content defaults to the trigger's width, and a 24px menu
            cannot hold "Free hand" and its key. */}
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          <DropdownMenuRadioGroup
            value={mode ?? SELECT}
            onValueChange={(value: string) =>
              onModeChange(value === SELECT ? null : (value as DrawMode))
            }
          >
            {MODES.map(({ value, id, key, icon: Icon }) => (
              // closeOnClick: Base UI keeps a menu open after a radio pick by
              // default, which here would leave the menu covering the map the
              // reader is about to draw on.
              <DropdownMenuRadioItem
                key={id}
                value={value ?? SELECT}
                closeOnClick
                // No tick on the selected item, as production has none: the
                // trigger already shows which tool is active -- it wears that
                // tool's glyph and carries aria-pressed -- so a tick repeats
                // it at the far end of the row, past the shortcut.
                //
                // Hidden, not removed. The item keeps role="menuitemradio"
                // and aria-checked, so a screen reader is still told which
                // one is selected; only the glyph goes. pr-2 reclaims the
                // pr-8 the component reserves for an indicator it no longer
                // draws.
                className="pr-2 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
              >
                <Icon aria-hidden />
                {t[id]}
                {shortcuts ? (
                  <Kbd className="ml-auto" aria-hidden>
                    {key}
                  </Kbd>
                ) : null}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const BANNER_TEXT: Record<DrawMode, string> = {
  polygon:
    "Click to add points. Click the first point or press Enter to finish.",
  circle: "Press and drag from the centre.",
  freehand: "Press and drag to draw the outline.",
};

/**
 * The one-line instruction for the mode being drawn, floated over the map.
 *
 * role="status" so a screen reader hears the instruction when drawing starts,
 * without the focus being pulled off the map.
 */
export function MapDrawBanner({
  mode,
  points = 0,
  onDone,
  onCancel,
  className,
}: {
  mode: DrawMode;
  /** Vertices placed so far. Only a polygon has a Done, and it needs three. */
  points?: number;
  onDone?: () => void;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="map-draw-banner"
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card/95 py-1.5 pr-1.5 pl-3 text-sm text-card-foreground shadow-md backdrop-blur",
        className,
      )}
    >
      <span>{BANNER_TEXT[mode]}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
          <Kbd aria-hidden>Esc</Kbd>
        </Button>
        {mode === "polygon" && onDone ? (
          <Button size="sm" onClick={onDone} disabled={points < 3}>
            Done
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

type Position = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function haversine(a: Position, b: Position) {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A circle of `radius` metres as a closed 64-gon.
 *
 * Built on the sphere with the destination-point formula rather than as a
 * screen-space circle, so it is a true circle on the ground: in Web Mercator a
 * screen circle at Lisbon's latitude would cover a visibly squashed area.
 */
function circleRing(centre: Position, radius: number, steps = 64): Position[] {
  const lat1 = toRad(centre[1]);
  const lon1 = toRad(centre[0]);
  const d = radius / EARTH_RADIUS_M;
  const ring: Position[] = [];
  for (let i = 0; i < steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([toDeg(lon2), toDeg(lat2)]);
  }
  ring.push(ring[0]!);
  return ring;
}

function closeRing(points: Position[]): Position[] {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return first[0] === last[0] && first[1] === last[1]
    ? points
    : [...points, first];
}

/** Ramer-Douglas-Peucker over screen points, returning the kept indices. */
function simplify(
  points: { x: number; y: number }[],
  tolerance: number,
): number[] {
  if (points.length < 3) return points.map((_, i) => i);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start]!;
    const b = points[end]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstDist = tolerance;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      const dist = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
      if (dist > worstDist) {
        worst = i;
        worstDist = dist;
      }
    }
    if (worst !== -1) {
      keep[worst] = true;
      stack.push([start, worst], [worst, end]);
    }
  }
  return keep.flatMap((k, i) => (k ? [i] : []));
}

/* -------------------------------------------------------------------------- */
/* The hook                                                                    */
/* -------------------------------------------------------------------------- */

const SOURCE_ID = "map-draw-preview";
const LAYERS = {
  fill: `${SOURCE_ID}-fill`,
  line: `${SOURCE_ID}-line`,
  live: `${SOURCE_ID}-live`,
  vertex: `${SOURCE_ID}-vertex`,
};
const kindIs = (kind: string) =>
  ["==", ["get", "kind"], kind] as FilterSpecification;

/** Within this many pixels of the first vertex, a click closes the polygon. */
const SNAP_PX = 10;
/** A press that moves further than this is a drag, not a click. */
const CLICK_SLOP_PX = 6;
/** Freehand samples closer together than this add nothing but weight. */
const FREEHAND_STEP_PX = 4;

/**
 * Spelled out here rather than taken from the `GeoJSON` namespace, which only
 * exists in a project that happens to have @types/geojson installed directly.
 */
type Feature = {
  type: "Feature";
  properties: { kind: string; snap?: boolean };
  geometry:
    | { type: "Point"; coordinates: Position }
    | { type: "LineString"; coordinates: Position[] }
    | { type: "Polygon"; coordinates: Position[][] };
};

/**
 * Lets the reader draw a zone on a MapLibre map: a polygon point by point, a
 * circle from its centre, or an outline by hand.
 *
 * Listens to pointer events on the canvas container rather than MapLibre's
 * mouse events, so a finger draws exactly as a mouse does. While a mode is
 * active the map stops panning under the pointer -- otherwise every drag would
 * move the map instead of drawing -- and both are put back as they were when
 * the mode ends.
 */
export function useMapDraw({
  map,
  mode,
  onComplete,
  onCancel,
}: {
  map: MapLibreMap | null;
  mode: DrawMode | null;
  /** A closed ring (first === last) of [longitude, latitude] pairs. */
  onComplete: (ring: [number, number][]) => void;
  onCancel?: () => void;
}): { points: number; finish: () => void; cancel: () => void } {
  const [points, setPoints] = React.useState(0);

  // Callbacks through refs: the effect below owns the map's handlers and the
  // preview layers, and re-running it because a parent re-rendered with a new
  // arrow function would tear down a half-drawn polygon.
  const callbacks = React.useRef({ onComplete, onCancel });
  callbacks.current = { onComplete, onCancel };

  const finishRef = React.useRef<() => void>(() => {});
  const cancelRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (!map || !mode) return;

    const canvas = map.getCanvas();
    const container = map.getCanvasContainer();

    // What is being drawn. Plain locals: none of it is rendered by React, and
    // a state update per pointermove would re-render the page sixty times a
    // second for nothing.
    let vertices: Position[] = [];
    let cursor: Position | null = null;
    let centre: Position | null = null;
    let radius = 0;
    let pressed: { id: number; x: number; y: number } | null = null;

    const reset = () => {
      vertices = [];
      cursor = null;
      centre = null;
      radius = 0;
      pressed = null;
      setPoints(0);
    };

    /* --- Map state, taken over and given back --------------------------- */

    const hadDragPan = map.dragPan.isEnabled();
    const hadDoubleClickZoom = map.doubleClickZoom.isEnabled();
    const previousCursor = canvas.style.cursor;
    const previousTouchAction = container.style.touchAction;
    map.dragPan.disable();
    // A polygon is finished with a double-click, which would otherwise also
    // zoom the map in on the zone the reader has just drawn.
    if (mode === "polygon") map.doubleClickZoom.disable();
    canvas.style.cursor = "crosshair";
    // MapLibre's `touch-action: none` hangs off a class that disabling dragPan
    // removes, so a finger drawing a circle would scroll the page instead.
    container.style.touchAction = "none";

    /* --- Preview layers -------------------------------------------------- */

    const hasStyle = () => {
      try {
        return !!map.getStyle();
      } catch {
        return false;
      }
    };

    const removeLayers = () => {
      // A map that is being torn down throws on any of these.
      try {
        for (const layer of [
          LAYERS.vertex,
          LAYERS.live,
          LAYERS.line,
          LAYERS.fill,
        ]) {
          if (map.getLayer(layer)) map.removeLayer(layer);
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* the map is gone */
      }
    };

    const features = (): Feature[] => {
      const out: Feature[] = [];
      const area = (ring: Position[]) =>
        out.push({
          type: "Feature",
          properties: { kind: "area" },
          geometry: { type: "Polygon", coordinates: [closeRing(ring)] },
        });
      const line = (kind: string, coords: Position[]) =>
        out.push({
          type: "Feature",
          properties: { kind },
          geometry: { type: "LineString", coordinates: coords },
        });
      const vertex = (p: Position, snap = false) =>
        out.push({
          type: "Feature",
          properties: { kind: "vertex", snap },
          geometry: { type: "Point", coordinates: p },
        });

      if (mode === "polygon") {
        const outline = cursor ? [...vertices, cursor] : vertices;
        if (outline.length >= 3) area(outline);
        if (vertices.length >= 2) line("edge", vertices);
        if (cursor && vertices.length >= 1) {
          line("live", [vertices[vertices.length - 1]!, cursor]);
          if (vertices.length >= 2) line("live", [cursor, vertices[0]!]);
        }
        const snapping =
          cursor !== null && vertices.length >= 3 && nearFirst(cursor);
        vertices.forEach((v, i) => vertex(v, i === 0 && snapping));
      } else if (mode === "circle") {
        if (centre && radius > 0) {
          const ring = circleRing(centre, radius);
          area(ring);
          line("edge", ring);
        }
        if (centre) vertex(centre);
      } else if (vertices.length >= 2) {
        if (vertices.length >= 3) area(vertices);
        line("edge", vertices);
        line("live", [vertices[vertices.length - 1]!, vertices[0]!]);
      }
      return out;
    };

    const build = () => {
      if (!hasStyle()) return;
      removeLayers();
      // Resolved on every build, not once: a theme switch arrives here as a
      // style.load, and --primary is a different colour in the new theme.
      const primary = resolveCssColor("--primary") ?? "#0f766e";
      const background = resolveCssColor("--background") ?? "#ffffff";
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: features() },
      });
      map.addLayer({
        id: LAYERS.fill,
        type: "fill",
        source: SOURCE_ID,
        filter: kindIs("area"),
        paint: { "fill-color": primary, "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: LAYERS.line,
        type: "line",
        source: SOURCE_ID,
        filter: kindIs("edge"),
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": primary, "line-width": 2 },
      });
      map.addLayer({
        id: LAYERS.live,
        type: "line",
        source: SOURCE_ID,
        filter: kindIs("live"),
        paint: {
          "line-color": primary,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: LAYERS.vertex,
        type: "circle",
        source: SOURCE_ID,
        filter: kindIs("vertex"),
        paint: {
          // The first vertex grows when the pointer is close enough to close
          // the polygon on it, so the reader can see the click will finish.
          "circle-radius": ["case", ["boolean", ["get", "snap"], false], 6, 4],
          "circle-color": background,
          "circle-stroke-color": primary,
          "circle-stroke-width": 2,
        },
      });
    };

    const render = () => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      // Missing means the style was swapped, or the build landed on a style
      // that was not ready and was dropped -- the Terrain overlay does that,
      // see MapCanvas. Rebuilding here heals either on the next pointer move.
      if (!source) return build();
      source.setData({ type: "FeatureCollection", features: features() });
    };

    /* --- Pointer input ---------------------------------------------------- */

    const toPosition = (lngLat: LngLat): Position => [lngLat.lng, lngLat.lat];
    const local = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const at = (event: PointerEvent) => {
      const p = local(event);
      return toPosition(map.unproject([p.x, p.y]));
    };
    const screenDistance = (a: Position, b: Position) => {
      const pa = map.project(a);
      const pb = map.project(b);
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    };
    function nearFirst(p: Position) {
      return vertices.length > 0 && screenDistance(p, vertices[0]!) <= SNAP_PX;
    }

    const complete = (ring: Position[]) => {
      const closed = closeRing(ring);
      reset();
      render();
      callbacks.current.onComplete(closed);
    };

    const finishPolygon = () => {
      if (mode !== "polygon" || vertices.length < 3) return;
      complete(vertices);
    };

    const cancel = () => {
      reset();
      render();
      callbacks.current.onCancel?.();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      pressed = { id: event.pointerId, ...local(event) };
      if (mode === "polygon") return;
      // Captured so a drag that leaves the map still ends the shape, rather
      // than leaving it stuck half-drawn waiting for a pointerup it never gets.
      container.setPointerCapture(event.pointerId);
      const p = at(event);
      if (mode === "circle") {
        centre = p;
        radius = 0;
      } else {
        vertices = [p];
      }
      render();
    };

    const onPointerMove = (event: PointerEvent) => {
      const p = at(event);
      if (mode === "polygon") {
        cursor = p;
        render();
        return;
      }
      if (!pressed || pressed.id !== event.pointerId) return;
      if (mode === "circle" && centre) {
        radius = haversine(centre, p);
      } else if (mode === "freehand") {
        const last = vertices[vertices.length - 1];
        if (last && screenDistance(last, p) < FREEHAND_STEP_PX) return;
        vertices.push(p);
      }
      render();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const start = pressed;
      pressed = null;
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
      const end = local(event);
      const moved = Math.hypot(end.x - start.x, end.y - start.y);

      if (mode === "polygon") {
        // A drag is the reader moving on, not placing a point. With dragPan
        // off it does nothing to the map, so ignoring it is the least surprise.
        if (moved > CLICK_SLOP_PX) return;
        const p = at(event);
        if (vertices.length >= 3 && nearFirst(p)) return finishPolygon();
        // A second click on the last vertex is the tail of a double-click.
        // Finishing on it is what makes double-click close the polygon without
        // a dblclick listener that would race the two clicks before it.
        const last = vertices[vertices.length - 1];
        if (last && screenDistance(last, p) <= CLICK_SLOP_PX) {
          if (vertices.length >= 3) finishPolygon();
          return;
        }
        vertices.push(p);
        setPoints(vertices.length);
        render();
        return;
      }

      if (mode === "circle") {
        // A tap without a drag has no radius; start again rather than emit a
        // zero-area zone.
        if (centre && moved >= FREEHAND_STEP_PX && radius > 0)
          complete(circleRing(centre, radius));
        else {
          reset();
          render();
        }
        return;
      }

      // Freehand: thin the samples before handing them over. The tolerance is
      // in screen pixels, so the outline keeps every corner the hand drew at
      // this zoom and drops only the jitter between them.
      if (vertices.length >= 3) {
        const screen = vertices.map((v) => map.project(v));
        const kept = simplify(screen, 1.5).map((i) => vertices[i]!);
        if (kept.length >= 3) return complete(kept);
      }
      reset();
      render();
    };

    const onPointerLeave = () => {
      if (mode !== "polygon" || !cursor) return;
      // Without this the rubber band stays pinned to wherever the pointer left
      // the map, pointing at nothing.
      cursor = null;
      render();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isForeignKey(event)) return;
      if (event.key === "Escape") {
        cancel();
      } else if (mode === "polygon" && event.key === "Enter") {
        event.preventDefault();
        finishPolygon();
      } else if (
        mode === "polygon" &&
        event.key === "Backspace" &&
        vertices.length > 0
      ) {
        // preventDefault: some browsers still treat Backspace as "go back".
        event.preventDefault();
        vertices.pop();
        setPoints(vertices.length);
        render();
      }
    };

    finishRef.current = finishPolygon;
    cancelRef.current = cancel;

    build();
    // setStyle (a basemap or theme switch) discards every custom layer, so
    // the preview is rebuilt -- with whatever is half-drawn -- when it lands.
    map.on("style.load", build);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("style.load", build);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      removeLayers();
      // Given back only if they were on: a map the consumer made static should
      // not come back pannable because someone drew on it.
      try {
        if (hadDragPan) map.dragPan.enable();
        if (hadDoubleClickZoom) map.doubleClickZoom.enable();
      } catch {
        /* the map is gone */
      }
      canvas.style.cursor = previousCursor;
      container.style.touchAction = previousTouchAction;
      finishRef.current = () => {};
      cancelRef.current = () => {};
      setPoints(0);
    };
  }, [map, mode]);

  const finish = React.useCallback(() => finishRef.current(), []);
  const cancel = React.useCallback(() => cancelRef.current(), []);

  return { points, finish, cancel };
}
