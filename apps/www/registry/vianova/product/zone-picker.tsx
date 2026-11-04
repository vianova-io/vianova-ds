"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Circle,
  Download,
  LayoutGrid,
  List as ListIcon,
  PencilLine,
  Route,
  Search,
  Shapes,
  Spline,
  X,
} from "lucide-react";

import {
  ShapefileError,
  collectShapefileParts,
  readShapefile,
  unzip,
} from "@/registry/vianova/lib/shapefile";
import { cn } from "@/registry/vianova/lib/utils";
import { FileDropzone } from "@/registry/vianova/patterns/file-dropzone";
import { DrawZoneIcon } from "@/registry/vianova/product/draw-zone-icon";
import {
  circleAround,
  corridorAround,
  type Position,
} from "@/registry/vianova/lib/zone-geometry";
import {
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";
import { SliderField } from "@/registry/vianova/patterns/slider-field";
import { TagInput } from "@/registry/vianova/patterns/tag-input";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import { Input } from "@/registry/vianova/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/registry/vianova/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/registry/vianova/ui/sheet";
import { Spinner } from "@/registry/vianova/ui/spinner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/vianova/ui/tabs";
import { Textarea } from "@/registry/vianova/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/vianova/ui/toggle-group";

export type PickerZone = {
  id: string;
  name: string;
  tags: string[];
  /** Outer ring as [longitude, latitude] pairs, GeoJSON order. */
  ring: [number, number][];
  /** ISO 8601. */
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* Thumbnail                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A zone's outline, drawn small enough to sit beside its name.
 *
 * Plain equirectangular with the longitude scaled by cos(latitude). Without
 * that correction a degree of longitude is drawn as wide as a degree of
 * latitude, and at Lisbon's 38.7 deg every zone comes out about 28% too wide;
 * at Oslo it is double. A real projection would be overkill at 40px, but
 * shapes people recognise from the map must not look stretched here.
 *
 * Projected straight to pixel coordinates rather than through a viewBox, so
 * the stroke stays 1.5px whatever the zone's size in degrees.
 */
export function ZoneThumbnail({
  ring,
  size = 40,
  className,
}: {
  ring: [number, number][];
  /** Width and height in px. */
  size?: number;
  className?: string;
}) {
  const d = React.useMemo(() => ringPath(ring, size), [ring, size]);
  return (
    <svg
      aria-hidden
      data-slot="zone-thumbnail"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 text-primary", className)}
    >
      {d ? (
        <path
          d={d}
          fill="currentColor"
          fillOpacity={0.15}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function ringPath(ring: [number, number][], size: number) {
  if (ring.length < 3) return "";
  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  // y is negated: latitude grows north, SVG y grows down.
  const pts = ring.map(([lng, lat]) => [lng * k, -lat] as const);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Padding leaves room for half the stroke, and a little air, at the edges.
  const pad = Math.max(2, size * 0.1);
  const inner = size - pad * 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = inner / span;
  // Centre the shorter axis, so a long thin zone sits in the middle.
  const offX = pad + (inner - (maxX - minX) * scale) / 2;
  const offY = pad + (inner - (maxY - minY) * scale) / 2;

  return (
    pts
      .map(([x, y], i) => {
        const px = (offX + (x - minX) * scale).toFixed(2);
        const py = (offY + (y - minY) * scale).toFixed(2);
        return `${i === 0 ? "M" : "L"}${px} ${py}`;
      })
      .join("") + "Z"
  );
}

/* -------------------------------------------------------------------------- */
/* GeoJSON parsing                                                            */
/* -------------------------------------------------------------------------- */

type Feature = { geometry: unknown; properties: Record<string, unknown> };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

class GeoJsonError extends Error {}

function toPosition(value: unknown): Position {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    throw new GeoJsonError("A coordinate is not a pair of numbers.");
  }
  const [lng, lat] = value as number[];
  // The most common paste mistake is [lat, lng]. It only surfaces here when a
  // longitude above 90 lands in the latitude slot, so this catches some swaps,
  // not all, and the message names the fix either way.
  if (Math.abs(lat!) > 90 || Math.abs(lng!) > 180) {
    throw new GeoJsonError(
      "A coordinate is out of range. GeoJSON lists longitude first, then latitude.",
    );
  }
  return [lng!, lat!];
}

function toRing(value: unknown): Position[] {
  if (!Array.isArray(value))
    throw new GeoJsonError("A polygon ring is not a list of coordinates.");
  const ring = value.map(toPosition);
  if (ring.length < 3)
    throw new GeoJsonError("A polygon needs at least three points.");
  return ring;
}

function toFeatures(json: unknown): Feature[] {
  if (!isRecord(json))
    throw new GeoJsonError("Paste a GeoJSON object, starting with {.");
  switch (json.type) {
    case "FeatureCollection":
      if (!Array.isArray(json.features)) {
        throw new GeoJsonError("This FeatureCollection has no features list.");
      }
      return json.features.flatMap(toFeatures);
    case "Feature":
      return [
        {
          geometry: json.geometry,
          properties: isRecord(json.properties) ? json.properties : {},
        },
      ];
    case "GeometryCollection":
      if (!Array.isArray(json.geometries)) return [];
      return json.geometries.map((geometry) => ({ geometry, properties: {} }));
    case "Polygon":
    case "MultiPolygon":
    case "Point":
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
      return [{ geometry: json, properties: {} }];
    default:
      throw new GeoJsonError(
        typeof json.type === "string"
          ? `"${json.type}" is not a GeoJSON type this picker reads.`
          : "This JSON has no GeoJSON type. Paste a Feature, FeatureCollection or geometry.",
      );
  }
}

/**
 * Turns pasted GeoJSON into zones, or a sentence saying why it could not.
 *
 * Errors are returned, not thrown, because they are shown to the person who
 * pasted: every message says what to change, never a parser's position.
 *
 * Only polygons are zones. Points and lines become zones only when given a
 * radius, as circles and corridors. Each part of a MultiPolygon is its own
 * zone, and holes are dropped, since a zone here is one outline.
 */
export function parseGeoJsonZones(
  text: string,
  opts: { radiusMeters?: number; namePrefix?: string } = {},
): { zones: PickerZone[] } | { error: string } {
  const radius = opts.radiusMeters ?? 0;
  const prefix = opts.namePrefix ?? "Pasted zone";
  if (!text.trim()) return { error: "Paste some GeoJSON to preview it." };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      error:
        "This is not valid JSON. Check for a missing comma, quote or bracket.",
    };
  }

  const zones: PickerZone[] = [];
  let needsRadius: "points" | "lines" | null = null;
  const createdAt = new Date().toISOString();

  try {
    for (const { geometry, properties } of toFeatures(json)) {
      if (!isRecord(geometry)) continue;
      const coords = geometry.coordinates;
      const rings: Position[][] = [];

      switch (geometry.type) {
        case "Polygon":
          if (!Array.isArray(coords) || !coords.length)
            throw new GeoJsonError("A polygon has no rings.");
          rings.push(toRing(coords[0]));
          break;
        case "MultiPolygon":
          if (!Array.isArray(coords))
            throw new GeoJsonError("A MultiPolygon has no polygons.");
          for (const polygon of coords) {
            if (Array.isArray(polygon) && polygon.length)
              rings.push(toRing(polygon[0]));
          }
          break;
        case "Point":
        case "MultiPoint": {
          const points =
            geometry.type === "Point"
              ? [coords]
              : Array.isArray(coords)
                ? coords
                : [];
          if (radius > 0)
            points.forEach((p) =>
              rings.push(circleAround(toPosition(p), radius)),
            );
          else needsRadius ??= "points";
          break;
        }
        case "LineString":
        case "MultiLineString": {
          const lines =
            geometry.type === "LineString"
              ? [coords]
              : Array.isArray(coords)
                ? coords
                : [];
          if (radius > 0) {
            for (const line of lines) {
              if (!Array.isArray(line)) continue;
              const positions = line.map(toPosition);
              if (positions.length >= 2)
                rings.push(corridorAround(positions, radius));
            }
          } else needsRadius ??= "lines";
          break;
        }
      }

      const baseName =
        typeof properties.name === "string" && properties.name.trim()
          ? properties.name.trim()
          : null;
      const tags = Array.isArray(properties.tags)
        ? properties.tags.filter((t): t is string => typeof t === "string")
        : [];

      rings.forEach((ring, part) => {
        const n = zones.length + 1;
        zones.push({
          id: `pasted-${n}`,
          name: baseName
            ? rings.length > 1
              ? `${baseName} ${part + 1}`
              : baseName
            : `${prefix} ${n}`,
          tags,
          ring,
          createdAt,
        });
      });
    }
  } catch (e) {
    if (e instanceof GeoJsonError) return { error: e.message };
    throw e;
  }

  if (zones.length) return { zones };
  if (needsRadius === "points")
    return { error: "Points need a radius above 0" };
  if (needsRadius === "lines") return { error: "Lines need a radius above 0" };
  return {
    error:
      "No polygons found. Paste a Polygon or MultiPolygon, or a point with a radius.",
  };
}

/* -------------------------------------------------------------------------- */
/* Picker                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rows rendered at once. Zone libraries run to tens of thousands, and a
 * checkbox row per zone would stall the sheet's opening animation long before
 * anyone could scroll that far. Search is the way to reach the rest, and the
 * list says so rather than pretending to be complete.
 */
const ROW_LIMIT = 100;

/**
 * One empty list, shared.
 *
 * `[]` written inline is a new array every render, and anything downstream
 * that watches it by identity -- a memo, an effect reporting the selection to
 * a map -- would then fire on every render. This is what stops that.
 */
const NO_ZONES: PickerZone[] = [];

/**
 * Three, not five.
 *
 * Pasting, uploading and fetching a link were three tiles, but they are one
 * thing: bytes, parsed, previewed, added. Only the way the bytes arrive
 * differs, and a reader who has a file does not need to be asked which of
 * three doors it came through -- `import` takes all three and works out which
 * it was given. What is left are the three answers that are genuinely
 * different: zones you already have, a zone that does not exist yet, and a
 * zone someone else made.
 */
type Source = "zones" | "draw" | "import";
type View = "cards" | "list";

/**
 * The source row.
 *
 * `label` is the visible word and therefore the accessible name; `hint` is a
 * `title` only. Putting the hint in `aria-label` would be
 * label-content-name-mismatch -- a serious WCAG 2.1 A failure that the block's
 * own axe run treats as blocking -- because "Library" is not contained in
 * "Select from your zones".
 */
const SOURCES: {
  value: Source;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "zones",
    label: "Library",
    hint: "Select from your zones",
    icon: <Shapes />,
  },
  {
    value: "draw",
    label: "Draw",
    hint: "Draw on the map",
    icon: <PencilLine />,
  },
  {
    value: "import",
    label: "Import",
    hint: "Bring in shapes from a file, your clipboard or a link",
    icon: <Download />,
  },
];

/**
 * The drawing tools this sheet can hand off to.
 *
 * Spelled out here rather than imported from the map's draw control, which
 * would drag MapLibre into every project that installs the picker -- a sheet
 * that lists zones has no business pulling in a mapping engine. The names are
 * the same, so a consumer passes the chosen tool straight through, and a
 * subset stays assignable if the map ever grows a tool this sheet omits.
 */
export type ZoneDrawTool = "polygon" | "circle" | "freehand" | "line";

const DRAW_TOOLS: {
  value: ZoneDrawTool;
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "polygon",
    title: "Polygon",
    description: "A point per corner",
    Icon: DrawZoneIcon,
  },
  {
    value: "circle",
    title: "Circle",
    description: "Out from a centre",
    Icon: Circle,
  },
  {
    value: "freehand",
    title: "Free hand",
    description: "Trace the outline",
    Icon: Spline,
  },
  {
    value: "line",
    title: "Line",
    description: "A street and its width",
    Icon: Route,
  },
];

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const count = new Intl.NumberFormat("en-GB");
const plural = (n: number, one: string, many: string) =>
  `${count.format(n)} ${n === 1 ? one : many}`;

/**
 * The "Add zones" step of a regulation rule.
 *
 * Everything inside the sheet lives in `ZonePickerBody`, which the sheet
 * unmounts on close. That is the reset: reopening always starts from a clean
 * search, no selection and an empty paste box, without an effect chasing
 * `open` to clear a list of state that would grow out of step with it.
 */
export function ZonePicker({
  open,
  onOpenChange,
  zones,
  excludeIds,
  onAdd,
  onDraw,
  urlSample,
  title = "Add zones",
  side = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: PickerZone[];
  /** Zones already in the rule. Shown as added and not selectable. */
  excludeIds?: string[];
  /** Called with the chosen zones; the sheet then closes. */
  onAdd: (zones: PickerZone[]) => void;
  /**
   * Arms a drawing tool on the map behind the sheet, which then closes.
   *
   * Left out, the sheet offers no drawing at all -- a picker with no map to
   * draw on should not say otherwise. Given, drawing becomes one of the ways
   * zones get here, beside the library and a pasted shape, instead of a
   * separate habit parked on the map's own toolbar.
   */
  onDraw?: (tool: ZoneDrawTool) => void;
  /**
   * A GeoJSON URL to offer as "Try a sample" in Import.
   *
   * Left out, the link path is still there -- it just cannot be demonstrated,
   * because only a host that allows requests from other sites can be fetched
   * from a browser and most open-data portals do not. A file served beside
   * the page always can, so the URL belongs to whoever is serving it.
   */
  urlSample?: string;
  title?: string;
  side?: "left" | "right";
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="gap-0 data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md"
      >
        <ZonePickerBody
          chrome="sheet"
          zones={zones}
          excludeIds={excludeIds}
          urlSample={urlSample}
          title={title}
          onCancel={() => onOpenChange(false)}
          onAdd={(chosen) => {
            onAdd(chosen);
            onOpenChange(false);
          }}
          onDraw={
            onDraw &&
            ((tool) => {
              // Closed first: the map it hands over to is behind this sheet,
              // and a tool armed under an open overlay would look broken.
              onOpenChange(false);
              onDraw(tool);
            })
          }
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Everything the picker does, without the sheet around it.
 *
 * Use this where there is a panel to fill -- the regulation editor swaps its
 * settings column for it, so the map stays on screen while zones are chosen
 * and the chosen ones can be shown on it. The sheet remains for surfaces with
 * no column to give up.
 *
 * It fills its parent and scrolls inside itself, so the back row and the Add
 * button stay put while the list moves.
 */
export function ZonePickerPanel({
  zones,
  excludeIds,
  onAdd,
  onDraw,
  urlSample,
  onBack,
  backLabel = "Back",
  title = "Add zones",
  onPreviewChange,
  onSelectionChange,
  className,
}: {
  zones: PickerZone[];
  excludeIds?: string[];
  onAdd: (zones: PickerZone[]) => void;
  onDraw?: (tool: ZoneDrawTool) => void;
  /**
   * A GeoJSON URL to offer as "Try a sample" in Import.
   *
   * Left out, the link path is still there -- it just cannot be demonstrated,
   * because only a host that allows requests from other sites can be fetched
   * from a browser and most open-data portals do not. A file served beside
   * the page always can, so the URL belongs to whoever is serving it.
   */
  urlSample?: string;
  /** Leaves without adding anything. The back arrow and Cancel both call it. */
  onBack: () => void;
  /** What the back arrow names: where leaving returns to, not this screen. */
  backLabel?: string;
  title?: string;
  /**
   * The zone under the pointer or keyboard focus, or null when none is.
   *
   * For a map beside the panel to pick out the row being read. The whole
   * reason this is a panel and not a sheet is that such a map is visible.
   */
  onPreviewChange?: (zone: PickerZone | null) => void;
  /** Everything currently chosen, as it changes, for that same map. */
  onSelectionChange?: (zones: PickerZone[]) => void;
  className?: string;
}) {
  return (
    <div
      data-slot="zone-picker-panel"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <ZonePickerBody
        chrome="panel"
        zones={zones}
        excludeIds={excludeIds}
        title={title}
        backLabel={backLabel}
        onCancel={onBack}
        onAdd={onAdd}
        onDraw={onDraw}
        urlSample={urlSample}
        onPreviewChange={onPreviewChange}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}

function ZonePickerBody({
  chrome,
  zones,
  excludeIds,
  title,
  backLabel,
  onCancel,
  onAdd,
  onDraw,
  urlSample,
  onPreviewChange,
  onSelectionChange,
}: {
  /** Sheet chrome, or a back row and a heading for a panel in a column. */
  chrome: "sheet" | "panel";
  zones: PickerZone[];
  excludeIds?: string[];
  title: string;
  backLabel?: string;
  onCancel: () => void;
  onAdd: (zones: PickerZone[]) => void;
  onDraw?: (tool: ZoneDrawTool) => void;
  /** A GeoJSON URL to offer as "Try a sample" in Import. */
  urlSample?: string;
  onPreviewChange?: (zone: PickerZone | null) => void;
  onSelectionChange?: (zones: PickerZone[]) => void;
}) {
  const [source, setSource] = React.useState<Source>("zones");
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Import state lives here, not in the body that draws it, so switching to
  // the library to check a name and coming back does not throw away a dropped
  // file or a half-typed link. The bodies are swapped, not kept mounted --
  // keeping all three alive would mount the library's hundred rows while
  // someone is pasting -- so anything that must survive the swap lives above
  // it.
  const [imported, setImported] = React.useState<ImportState>({
    status: "empty",
  });
  const [importText, setImportText] = React.useState("");
  const [importRadius, setImportRadius] = React.useState(0);

  const parsed = React.useMemo(
    () => parseImport(imported, importRadius),
    [imported, importRadius],
  );
  const importedZones = parsed && "zones" in parsed ? parsed.zones : NO_ZONES;

  const chosen = React.useMemo(
    () =>
      source === "zones"
        ? zones.filter((z) => selected.has(z.id))
        : source === "import"
          ? importedZones
          : NO_ZONES,
    [source, zones, selected, importedZones],
  );

  // Reported rather than returned, because what the map beside the panel has
  // to draw is whatever is chosen right now -- a ticked library zone, a
  // pasted shape, an uploaded one -- and only this component knows which of
  // the three the reader is looking at.
  React.useEffect(() => {
    onSelectionChange?.(chosen);
  }, [chosen, onSelectionChange]);

  // Leaving the panel, or switching source, must not leave a zone lit on the
  // map that nothing on screen is pointing at any more.
  React.useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);
  React.useEffect(() => onPreviewChange?.(null), [source, onPreviewChange]);

  return (
    <>
      {chrome === "sheet" ? (
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Choose where the zones come from.</SheetDescription>
        </SheetHeader>
      ) : (
        /* The same back row the editor itself uses, one level deeper: the
           arrow names where it returns to, and the heading names where you
           are. A breadcrumb would say both at once, in a block that has no
           other breadcrumb to look like. */
        <header className="space-y-2 border-b px-4 pt-3 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 max-w-full"
            onClick={onCancel}
          >
            <ArrowLeft data-icon="inline-start" />
            <span className="truncate">{backLabel}</span>
          </Button>
          <div className="space-y-0.5">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground text-sm">
              Choose where the zones come from.
            </p>
          </div>
        </header>
      )}

      <Tabs
        value={source}
        onValueChange={(v) => setSource(v as Source)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        {/* Pinned above the scroll region, not inside it. A switcher that
            scrolls away stops being a switcher, and a 3px focus ring drawn
            4px below the top edge of an `overflow-y-auto` ancestor is clipped
            -- which is the defect the focus-ring suite exists to catch. */}
        <TabsList aria-label="Zone source" className="mx-4 mb-3 w-auto">
          {SOURCES.map((s) =>
            // Drawing is only offered when there is a map to draw on.
            s.value === "draw" && !onDraw ? null : (
              <TabsTrigger key={s.value} value={s.value} title={s.hint}>
                {s.icon}
                {s.label}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        {/* One panel whose value tracks the active tab, rather than one per
            source: the bodies are genuinely swapped, so the library's rows
            are not mounted while someone is importing. What has to survive
            the swap is held above this. The scroll region's padding is inside
            it, so a focus ring at the edge is never cut by the overflow. */}
        <TabsContent
          value={source}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-4"
        >
          {source === "zones" ? (
            <ZoneList
              zones={zones}
              excludeIds={excludeIds}
              selected={selected}
              onSelectedChange={setSelected}
              onPreviewChange={onPreviewChange}
            />
          ) : source === "draw" && onDraw ? (
            <DrawSource onDraw={onDraw} />
          ) : (
            <ImportSource
              state={imported}
              onStateChange={setImported}
              text={importText}
              onTextChange={setImportText}
              radius={importRadius}
              onRadiusChange={setImportRadius}
              parsed={parsed}
              urlSample={urlSample}
            />
          )}
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          "mt-auto flex flex-row justify-end gap-2 border-t p-4",
          chrome === "sheet" && "gap-2",
        )}
      >
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {/* Drawing has no Add: picking a tool is the whole action, and it
            happens on the card. A second button here, named after the source
            tile that is already selected, read as the step someone had just
            taken -- so it was never pressed, and the tools looked dead. */}
        {source === "draw" ? null : (
          <Button disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
            {chosen.length
              ? `Add ${plural(chosen.length, "zone", "zones")}`
              : "Add zones"}
          </Button>
        )}
      </div>
    </>
  );
}

function ZoneList({
  zones,
  excludeIds,
  selected,
  onSelectedChange,
  onPreviewChange,
}: {
  zones: PickerZone[];
  excludeIds?: string[];
  selected: ReadonlySet<string>;
  onSelectedChange: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
  onPreviewChange?: (zone: PickerZone | null) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<View>("cards");
  // Filtering thousands of zones on every keystroke would make typing lag;
  // deferring lets the input stay live while the list catches up.
  const deferredQuery = React.useDeferredValue(query);

  const excluded = React.useMemo(() => new Set(excludeIds), [excludeIds]);
  const byId = React.useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const filtered = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [zones, deferredQuery]);

  // Select all acts on what the search shows, not on the whole library:
  // "search for parking, select all" is the main way to pick hundreds at once.
  const selectable = React.useMemo(
    () => filtered.filter((z) => !excluded.has(z.id)),
    [filtered, excluded],
  );
  const selectedHere = selectable.reduce(
    (n, z) => n + (selected.has(z.id) ? 1 : 0),
    0,
  );
  const allSelected =
    selectable.length > 0 && selectedHere === selectable.length;
  const someSelected = selectedHere > 0 && !allSelected;

  const toggleAll = () => {
    const next = new Set(selected);
    for (const z of selectable) {
      if (allSelected) next.delete(z.id);
      else next.add(z.id);
    }
    onSelectedChange(next);
  };

  // A functional update keeps `toggle` stable across selections, which is
  // what lets the memoised rows skip re-rendering.
  const toggle = React.useCallback(
    (id: string, on: boolean) =>
      onSelectedChange((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [onSelectedChange],
  );

  // Read through a ref so the rows get one callback for the panel's lifetime.
  // A new arrow per render would defeat ZoneRow's memo and re-render all
  // hundred rows on every pointer move across the list.
  const previewRef = React.useRef(onPreviewChange);
  previewRef.current = onPreviewChange;
  const preview = React.useCallback((zone: PickerZone | null) => {
    previewRef.current?.(zone);
  }, []);

  const shown = filtered.slice(0, ROW_LIMIT);
  const selectAllId = React.useId();

  return (
    <div data-slot="zone-picker-list" className="flex flex-col gap-3">
      {/* Sticky, so the chips -- what is selected -- stay in view while the
          list scrolls under them. -mx/px keep its background edge to edge. */}
      <div className="bg-popover sticky top-0 z-10 -mx-4 flex items-center gap-2 px-4 py-2">
        {/*
          The search and the selection in one field, as a mail client's To:
          line is: chips for the zones picked, then the text that filters the
          list. Removing a chip unticks the zone; Enter picks the top match, so
          a zone can be found and chosen without leaving the keyboard.
        */}
        <TagInput
          className="min-w-0 flex-1"
          startAddon={<Search />}
          inputLabel="Search zones"
          placeholder="Type a tag, zone or regulation name"
          value={[...selected]}
          onValueChange={(ids) => onSelectedChange(new Set(ids))}
          getTagLabel={(id) => byId.get(id)?.name ?? id}
          maxVisible={5}
          draft={query}
          onDraftChange={setQuery}
          onDraftCommit={() => {
            const top = selectable.find((z) => !selected.has(z.id));
            if (!top) return;
            toggle(top.id, true);
            setQuery("");
          }}
        />
        <ToggleGroup
          variant="outline"
          value={[view]}
          // A group lets its last item be switched off; a list has to be one or the other.
          onValueChange={(next) => next[0] && setView(next[0] as View)}
          aria-label="View"
        >
          <ToggleGroupItem value="cards" aria-label="Cards">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <ListIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <label
          htmlFor={selectAllId}
          className="flex items-center gap-2 font-medium"
        >
          <Checkbox
            id={selectAllId}
            checked={allSelected}
            indeterminate={someSelected}
            disabled={selectable.length === 0}
            onCheckedChange={toggleAll}
            // The stock indicator only has a tick. A partial selection needs a
            // dash, or it reads as "all" when it is not.
            className="data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-indeterminate:before:h-0.5 data-indeterminate:before:w-2 data-indeterminate:before:rounded-full data-indeterminate:before:bg-current data-indeterminate:[&_svg]:hidden"
          />
          Select all {count.format(selectable.length)}
        </label>
        <span aria-live="polite" className="text-muted-foreground tabular-nums">
          {plural(filtered.length, "zone", "zones")} ·{" "}
          {count.format(selected.size)} selected
        </span>
      </div>

      {shown.length ? (
        <ul
          role="list"
          aria-label="Zones"
          className={cn(
            "flex flex-col",
            view === "cards"
              ? "gap-2"
              : "divide-y divide-border rounded-lg border",
          )}
        >
          {shown.map((zone) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              view={view}
              added={excluded.has(zone.id)}
              checked={selected.has(zone.id)}
              onToggle={toggle}
              onPreview={preview}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {zones.length
            ? "No zones match this search."
            : "You have no zones yet."}
        </p>
      )}

      {filtered.length > ROW_LIMIT ? (
        <p className="text-center text-sm text-muted-foreground">
          Showing {ROW_LIMIT} of {count.format(filtered.length)}. Refine the
          search to see more.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One zone, as a labelled checkbox.
 *
 * The checkbox is named by the zone name alone; tags and date are its
 * description. Letting the wrapping label supply the name would read every
 * tag and the date as part of it, a long name to sit through per row.
 *
 * Memoised so that ticking one row re-renders that row, not all hundred.
 */
const ZoneRow = React.memo(function ZoneRow({
  zone,
  view,
  added,
  checked,
  onToggle,
  onPreview,
}: {
  zone: PickerZone;
  view: View;
  added: boolean;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
  /** Says which row is being read, for a map beside the list. */
  onPreview?: (zone: PickerZone | null) => void;
}) {
  const id = React.useId();
  const nameId = `${id}-name`;
  const metaId = `${id}-meta`;
  const date = dateFormat.format(new Date(zone.createdAt));

  const checkbox = (
    <Checkbox
      id={id}
      checked={added || checked}
      disabled={added}
      aria-labelledby={nameId}
      aria-describedby={metaId}
      onCheckedChange={(on) => onToggle(zone.id, on)}
    />
  );

  const addedBadge = added ? <Badge variant="secondary">Added</Badge> : null;

  /*
   * Pointer and focus both, so the map follows the arrow keys as well as the
   * mouse: a reader tabbing through a hundred zones gets the same answer to
   * "which one is this" as a reader hovering them.
   *
   * onFocus, not onFocusCapture, is enough -- focus events bubble in React,
   * so the checkbox inside the label reports through it.
   */
  const previewing = onPreview
    ? {
        onPointerEnter: () => onPreview(zone),
        onPointerLeave: () => onPreview(null),
        onFocus: () => onPreview(zone),
        onBlur: () => onPreview(null),
      }
    : undefined;

  if (view === "list") {
    return (
      <li>
        <label
          htmlFor={id}
          {...previewing}
          className={cn(
            "flex min-h-10 items-center gap-2.5 px-3 py-1.5 text-sm",
            added
              ? "cursor-not-allowed text-muted-foreground"
              : "cursor-pointer hover:bg-muted/50",
          )}
        >
          {checkbox}
          <ZoneThumbnail ring={zone.ring} size={20} />
          <span id={nameId} className="min-w-0 flex-1 truncate font-medium">
            {zone.name}
          </span>
          {addedBadge}
          <span
            id={metaId}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            <span className="sr-only">{zone.tags.join(", ")}. Created </span>
            {date}
          </span>
        </label>
      </li>
    );
  }

  return (
    <li>
      <label
        htmlFor={id}
        {...previewing}
        className={cn(
          "flex items-start gap-3 rounded-lg border border-border p-3 text-sm transition-colors",
          added
            ? "cursor-not-allowed bg-muted/30"
            : "cursor-pointer hover:bg-muted/50",
          checked && !added && "border-primary bg-primary/5 dark:bg-primary/10",
        )}
      >
        <span className="pt-0.5">{checkbox}</span>
        <ZoneThumbnail ring={zone.ring} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span id={nameId} className="min-w-0 flex-1 truncate font-medium">
              {zone.name}
            </span>
            {addedBadge}
          </span>
          <span id={metaId} className="flex flex-col gap-1.5">
            {zone.tags.length ? (
              <span className="flex flex-wrap gap-1">
                {zone.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Created {date}
            </span>
          </span>
        </span>
      </label>
    </li>
  );
});

/**
 * The drawing tools, chosen here rather than on the map.
 *
 * The map's own toolbar stays -- it is how someone already looking at the map
 * switches tools mid-shape. This is the other way in: from the rule that needs
 * an area, without having to know the toolbar is there. Both arm the same
 * session, so there is one behaviour and not two.
 */
function DrawSource({
  onDraw,
}: {
  /** Arms the tool and hands the map over; nothing is held here. */
  onDraw: (tool: ZoneDrawTool) => void;
}) {
  return (
    <div data-slot="zone-picker-draw" className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Pick a tool and the map takes over. Shapes you finish are listed there
        until you add them.
      </p>
      {/*
       * Buttons, not a radio group. Each one does something the moment it is
       * pressed: held as a selection it needed a second press to arm, and the
       * tools read as dead until that was found -- which it was not, because
       * the confirming button repeated the name of the tile above it.
       *
       * It also keeps the keyboard honest. In a radio group the arrow keys
       * move the selection, so browsing the tools would arm one and throw the
       * reader onto the map. Buttons are each their own tab stop and do
       * nothing until pressed.
       *
       * The sentence each tool used to carry is a `title` now. On a button
       * that already has visible text a title describes rather than names, so
       * the accessible name stays the word on the button -- which is what
       * keeps "Line" findable and keeps axe quiet about a name that does not
       * contain its own label.
       */}
      {/* Two by two rather than one welded row: four tools at their natural
          width overrun a 390px phone, and a grid that always holds its shape
          beats a row that reflows into something else below a breakpoint. */}
      <div
        role="group"
        aria-label="Drawing tool"
        className="grid grid-cols-2 gap-2"
      >
        {DRAW_TOOLS.map((t) => (
          <Button
            key={t.value}
            variant="outline"
            size="sm"
            title={t.description}
            className="justify-start"
            onClick={() => onDraw(t.value)}
          >
            <t.Icon data-icon="inline-start" />
            {t.title}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * What is about to be added, drawn rather than counted.
 *
 * "14 zones found" is not an answer to the question anyone actually has,
 * which is whether these are the right shapes -- a file with the wrong layer
 * selected, or coordinates the wrong way round, counts exactly the same as a
 * correct one. The outlines are what tell the two apart, so they are shown
 * before the Add button is reached, not after.
 */
function ZonePreview({
  zones,
  source,
}: {
  zones: PickerZone[];
  /**
   * What they came from, named. One tab now takes a file, a paste and a link,
   * so "2 zones found" on its own no longer says which of the three is on
   * screen -- and that is exactly the question when a dropped file and a
   * pasted blob disagree.
   */
  source?: string;
}) {
  const shown = zones.slice(0, ROW_LIMIT);
  return (
    <div data-slot="zone-picker-preview" className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {plural(zones.length, "zone", "zones")} found
        {source ? ` in ${source}` : null}
      </p>
      <ul
        role="list"
        className="divide-border flex flex-col divide-y rounded-lg border"
      >
        {shown.map((zone) => (
          <li
            key={zone.id}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <ZoneThumbnail ring={zone.ring} size={32} />
            <span className="min-w-0 flex-1 truncate">{zone.name}</span>
          </li>
        ))}
      </ul>
      {zones.length > shown.length ? (
        <p className="text-muted-foreground text-xs">
          Showing the first {count.format(shown.length)}. All{" "}
          {count.format(zones.length)} are added.
        </p>
      ) : null}
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What the chosen input turned out to hold, kept so a radius change re-reads
 * it rather than asking for the file or the link again.
 */
type ImportedFile =
  | { kind: "geojson"; text: string }
  | { kind: "shapefile"; shp: ArrayBuffer; dbf?: ArrayBuffer; prj?: string };

/**
 * `via` says which of the three ways in produced this, because the chrome
 * differs: a dropped file names itself on the dropzone, a fetched link names
 * itself under the preview, and pasted text is already on screen and needs
 * neither.
 */
type ImportState =
  | { status: "empty" }
  | { status: "reading"; what: "file" | "link" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      via: "file" | "paste" | "link";
      label: string;
      note?: string;
      file: ImportedFile;
    };

const isExtension = (name: string, ...extensions: string[]) =>
  extensions.some((e) => name.toLowerCase().endsWith(e));

/** A view onto a buffer, copied out so it can be kept past its container. */
const own = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

/**
 * Said rather than assumed. Without a .prj the numbers could be metres in any
 * of a hundred national grids, and read as degrees those land in the Atlantic
 * -- silently, because they are still perfectly good numbers.
 */
const NO_PRJ =
  "No .prj came with this file, so its numbers are read as longitude and latitude. Check the shapes below are where you expect.";

/**
 * Shapes, whatever shape they arrived in.
 *
 * One function for all three ways in, because past this point there is no
 * difference between them: a file, a paste and a link all end as bytes to be
 * parsed, grown by the radius, previewed and added.
 */
function parseImport(state: ImportState, radiusMeters: number) {
  if (state.status !== "ready") return null;
  if (state.file.kind === "geojson") {
    return parseGeoJsonZones(state.file.text, {
      radiusMeters,
      namePrefix: "Imported zone",
    });
  }
  const read = readShapefile(state.file, { radiusMeters });
  if ("error" in read) return read;
  const createdAt = new Date().toISOString();
  return {
    zones: read.zones.map((zone, i) => ({
      id: `imported-${i + 1}`,
      name: zone.name,
      tags: ["imported"],
      ring: zone.ring,
      createdAt,
    })),
  };
}

/**
 * What the reader has typed, judged by looking at it.
 *
 * GeoJSON and a web address cannot be mistaken for each other -- one opens
 * with a brace or a bracket, the other with a scheme -- so one field takes
 * both and nobody has to say which they meant. `unknown` is everything else,
 * and it is reported as a hint rather than an error, because the first letter
 * of "https" is `unknown` too.
 */
type Typed = "empty" | "json" | "link" | "unknown";

function sniff(value: string): Typed {
  const v = value.trim();
  if (!v) return "empty";
  if (v.startsWith("{") || v.startsWith("[")) return "json";
  if (/^https?:\/\//i.test(v)) return "link";
  return "unknown";
}

/** The last path segment of a link, for naming what came back. */
function linkLabel(url: string): string {
  try {
    // Resolved against the page, so a same-origin link -- "/data/bays.geojson",
    // which is the one kind guaranteed to be fetchable -- is named by its file
    // like any other. Bare, `new URL` throws on it and the preview ends up
    // headed "found in /data/bays.geojson".
    const base =
      typeof window === "undefined" ? "http://localhost/" : window.location.href;
    const { pathname, hostname } = new URL(url, base);
    const last = pathname.split("/").filter(Boolean).pop();
    return last || hostname;
  } catch {
    return url;
  }
}

const HINTS: Record<Typed, string> = {
  empty:
    "A Feature, FeatureCollection or geometry — or a link to one. Each polygon becomes a zone.",
  json: "A Feature, FeatureCollection or geometry. Each polygon becomes a zone.",
  link: "Press Fetch to read it.",
  unknown:
    "That is neither GeoJSON nor a link. GeoJSON starts with {, and a link starts with https://.",
};

/**
 * One tab for every shape someone already has.
 *
 * Pasting, uploading and fetching a link were three tiles in the chooser, and
 * they are not three features: all three end as bytes, parsed, grown by the
 * radius, previewed and added. Only the arrival differs, so only the arrival
 * is on screen -- a dropzone for files, and one field that takes pasted
 * GeoJSON or a link and tells them apart itself.
 *
 * Using one clears the other, so there is never a question which of them the
 * preview below is showing.
 *
 * The link is fetched from the browser, which is a real limit worth knowing
 * before someone reports it as a bug: this page is a static export with no
 * server, so a host that does not allow other sites to read it cannot be
 * fetched here at all, and the browser reports every such failure -- along
 * with being offline, a bad name and a bad certificate -- as one opaque
 * error with nothing readable behind it. Hence one sentence covering all of
 * them, pointing at the dropzone, which always works. Behind an API of your
 * own this is a server-side fetch and the limit goes away.
 */
function ImportSource({
  state,
  onStateChange,
  text,
  onTextChange,
  radius,
  onRadiusChange,
  parsed,
  urlSample,
}: {
  state: ImportState;
  onStateChange: (state: ImportState) => void;
  text: string;
  onTextChange: (text: string) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  parsed: ReturnType<typeof parseImport>;
  /**
   * A GeoJSON URL that is known to answer, offered as "Try a sample".
   *
   * Without one the link path cannot be shown working: a browser can only
   * fetch a host that allows requests from other sites, and most of the
   * portals a city would reach for do not. A file served beside the page is
   * same-origin, so it always answers -- which is why this is the consumer's
   * to supply rather than a URL hard-coded here.
   */
  urlSample?: string;
}) {
  const id = React.useId();
  const errorId = `${id}-error`;
  const kind = sniff(text);

  // Held in a ref and aborted before each new fetch, so a slow first link
  // cannot land after a second one and quietly replace it.
  const inFlight = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => inFlight.current?.abort(), []);

  const accept = async (files: File[]) => {
    // A file wins over whatever is in the field, and says so by emptying it.
    onTextChange("");
    onStateChange({ status: "reading", what: "file" });
    try {
      const zip = files.find((f) => isExtension(f.name, ".zip"));
      if (zip) {
        const entries = await unzip(await zip.arrayBuffer());
        const parts = collectShapefileParts(entries);
        if (parts.shp) {
          onStateChange({
            status: "ready",
            via: "file",
            label: zip.name,
            note:
              parts.shpCount > 1
                ? `This zip holds ${parts.shpCount} shapefiles; the first was read.`
                : parts.prj
                  ? undefined
                  : NO_PRJ,
            file: {
              kind: "shapefile",
              shp: own(parts.shp),
              dbf: parts.dbf && own(parts.dbf),
              prj: parts.prj,
            },
          });
          return;
        }
        const geo = entries.find((e) =>
          isExtension(e.name, ".geojson", ".json"),
        );
        if (!geo) {
          onStateChange({
            status: "error",
            message: "This zip holds no .shp or GeoJSON file.",
          });
          return;
        }
        onStateChange({
          status: "ready",
          via: "file",
          label: zip.name,
          file: {
            kind: "geojson",
            text: new TextDecoder().decode(geo.bytes),
          },
        });
        return;
      }

      const shp = files.find((f) => isExtension(f.name, ".shp"));
      if (shp) {
        const dbf = files.find((f) => isExtension(f.name, ".dbf"));
        const prj = files.find((f) => isExtension(f.name, ".prj"));
        onStateChange({
          status: "ready",
          via: "file",
          label: shp.name,
          note: prj ? undefined : NO_PRJ,
          file: {
            kind: "shapefile",
            shp: await shp.arrayBuffer(),
            dbf: dbf && (await dbf.arrayBuffer()),
            prj: prj && (await prj.text()),
          },
        });
        return;
      }

      const geo = files.find((f) => isExtension(f.name, ".geojson", ".json"));
      if (geo) {
        onStateChange({
          status: "ready",
          via: "file",
          label: geo.name,
          file: { kind: "geojson", text: await geo.text() },
        });
        return;
      }
      onStateChange({
        status: "error",
        message: "Choose a zipped shapefile, a .shp, or a GeoJSON file.",
      });
    } catch (e) {
      onStateChange({
        status: "error",
        message:
          e instanceof ShapefileError
            ? e.message
            : "That file could not be read.",
      });
    }
  };

  const change = (value: string) => {
    onTextChange(value);
    const typed = sniff(value);
    // GeoJSON parses as it is typed, the way the paste box always did. A link
    // cannot -- fetching on every keystroke would be absurd -- so it waits
    // for Fetch, and anything else clears what was there rather than shouting
    // at someone who is still typing.
    onStateChange(
      typed === "json"
        ? {
            status: "ready",
            via: "paste",
            label: "pasted GeoJSON",
            file: { kind: "geojson", text: value },
          }
        : { status: "empty" },
    );
  };

  const fetchLink = async (from?: string) => {
    const url = (from ?? text).trim();
    if (/\.zip(\?|#|$)/i.test(url)) {
      onStateChange({
        status: "error",
        message: "That link is a zipped shapefile. Drop the file above instead.",
      });
      return;
    }
    if (
      /^http:\/\//i.test(url) &&
      typeof window !== "undefined" &&
      window.location.protocol === "https:"
    ) {
      onStateChange({
        status: "error",
        message:
          "This page is served over https, so it can only fetch https links.",
      });
      return;
    }

    inFlight.current?.abort();
    const call = new AbortController();
    inFlight.current = call;
    onStateChange({ status: "reading", what: "link" });

    try {
      const res = await fetch(url, { signal: call.signal });
      if (call.signal.aborted) return;
      if (!res.ok) {
        onStateChange({
          status: "error",
          message: `That link answered ${res.status}. Check it is public and still there.`,
        });
        return;
      }
      const body = await res.text();
      if (call.signal.aborted) return;
      if (body.trimStart().startsWith("<")) {
        onStateChange({
          status: "error",
          message:
            "That link returned a web page, not GeoJSON. Link straight to the .geojson file.",
        });
        return;
      }
      onStateChange({
        status: "ready",
        via: "link",
        label: linkLabel(url),
        file: { kind: "geojson", text: body },
      });
    } catch {
      if (call.signal.aborted) return;
      onStateChange({
        status: "error",
        message:
          "That link could not be fetched. The server has to allow requests from other sites, and many file hosts do not — drop the file above instead.",
      });
    }
  };

  /*
   * Fills the field and fetches in one press.
   *
   * The URL is passed through rather than read back off `text`, which has not
   * been committed yet when this runs. The field then visibly holds a link
   * and the Fetch button appears already spinning, so one press shows the
   * whole path rather than hiding it.
   */
  const sample = async () => {
    if (!urlSample) return;
    onTextChange(urlSample);
    await fetchLink(urlSample);
  };

  const error =
    state.status === "error"
      ? state.message
      : parsed && "error" in parsed
        ? parsed.error
        : null;
  const fetching = state.status === "reading" && state.what === "link";
  const droppedName =
    state.status === "ready" && state.via === "file" ? state.label : null;
  const previewSource =
    state.status === "ready" && state.via !== "paste" ? state.label : undefined;

  return (
    <div data-slot="zone-picker-import" className="flex flex-col gap-5">
      <FileDropzone
        multiple
        accept=".zip,.shp,.dbf,.prj,.shx,.cpg,.geojson,.json"
        onFiles={accept}
        label={droppedName ?? "Drop a shapefile or GeoJSON"}
        hint={
          state.status === "reading" && state.what === "file"
            ? "Reading…"
            : "A zipped .shp, its separate parts, or a .geojson file"
        }
      />

      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Or paste GeoJSON or a link</FieldLabel>
        <Textarea
          id={id}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && kind === "link" && !e.shiftKey) {
              e.preventDefault();
              void fetchLink();
            }
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder={'{ "type": "Feature", … }   or   https://…'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="max-h-60 min-h-20 font-mono text-xs md:text-xs"
        />
        <FieldDescription>{HINTS[kind]}</FieldDescription>
        {/* Fetch appears only for a link, so the field teaches what it accepts
            by what it offers: pasted GeoJSON has already been read by the time
            a button could be pressed. The sample appears only while the field
            is empty, so it can never overwrite something half-typed -- and it
            gives way to Fetch the moment it fills the field, which is how the
            two presses it saves are still visible. */}
        {kind === "link" || (urlSample && kind === "empty") ? (
          <div className="flex justify-end gap-2">
            {urlSample && kind === "empty" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={fetching}
                onClick={() => void sample()}
              >
                Try a sample
              </Button>
            ) : null}
            {kind === "link" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fetching}
                onClick={() => void fetchLink()}
              >
                {fetching ? <Spinner data-icon="inline-start" /> : null}
                {fetching ? "Fetching…" : "Fetch"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Field>

      {error ? (
        <p role="alert" id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {state.status === "ready" && state.note ? (
        <p className="text-muted-foreground text-sm">{state.note}</p>
      ) : null}

      <SliderField
        label="Increase zone radius"
        description="Grows points and lines into zones. Polygons are added as drawn."
        value={radius}
        onValueChange={onRadiusChange}
        min={0}
        max={100}
        unit="m"
        marks={[0, 50, 100]}
      />

      {parsed && "zones" in parsed ? (
        <ZonePreview zones={parsed.zones} source={previewSource} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawing session                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A zone's name, renamed in place.
 *
 * A real bordered input, not text that becomes one on click: production
 * renames from this list, and a borderless field reads as a label nobody
 * thinks to type into -- which was the report this answers.
 *
 * The draft is local so each keystroke is cheap. The rename is published on
 * blur or Enter, and Escape puts the old name back.
 */
export function ZoneNameField({
  name,
  onRename,
  autoFocus,
  className,
}: {
  name: string;
  onRename: (name: string) => void;
  /** Takes focus with the text selected, for a name just made up for you. */
  autoFocus?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const field = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const el = field.current;
    // Two copies of the drawing panel are mounted -- a column above lg, a
    // tray below it -- and only one is displayed. Focusing the hidden one
    // would swallow the focus rather than move it, and `offsetParent` is null
    // exactly when an ancestor is `display: none`.
    if (!autoFocus || !el || el.offsetParent === null) return;
    el.focus();
    el.select();
  }, [autoFocus]);

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    // An emptied field is a slip, not a request for a nameless zone.
    if (next && next !== name) onRename(next);
  };

  return (
    <Input
      ref={field}
      aria-label={`Rename ${name}`}
      className={cn("h-8", className)}
      value={draft ?? name}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}

/** What the map is waiting for, per tool. */
const DRAW_PROMPTS: Record<ZoneDrawTool, string> = {
  polygon: "Click to place the first corner.",
  circle: "Press and drag from the centre.",
  freehand: "Press and drag to trace an outline.",
  line: "Click along the route.",
};

/**
 * Drawing, as a place rather than an instant.
 *
 * Drawing used to end the moment a shape closed: it was named from a counter,
 * committed to the rule and to everyone's zone library in the same tick, and
 * the tool disarmed. Drawing two zones meant going back through the picker
 * twice, and a name could only be fixed afterwards -- in a table where the
 * rename is global, because zones are shared by id.
 *
 * So the shapes land here first. The tool stays armed, each finished shape
 * arrives with a name you can type over, and nothing reaches the rule until
 * Add. Cancel leaves no trace, which is the part the old path could not
 * offer at all.
 */
export function ZoneDraftPanel({
  chrome,
  tool,
  drafts,
  ruleName,
  focusId,
  onRename,
  onRemove,
  onPreviewChange,
  onCancel,
  onAdd,
  className,
}: {
  /** A column beside the map, or a tray docked over it on a phone. */
  chrome: "panel" | "tray";
  /** The armed tool, or null when drawing has stopped but drafts remain. */
  tool: ZoneDrawTool | null;
  drafts: PickerZone[];
  /** Named on the way back, as the picker's back row names it. */
  ruleName?: string;
  /** The draft whose name field should take focus, with its text selected. */
  focusId?: string | null;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onPreviewChange?: (zone: PickerZone | null) => void;
  onCancel: () => void;
  onAdd: () => void;
  className?: string;
}) {
  const rows = (
    <ul role="list" className="flex flex-col gap-2">
      {drafts.map((zone) => (
        <li
          key={zone.id}
          className="bg-card flex items-center gap-2 rounded-lg border p-2"
          onPointerEnter={() => onPreviewChange?.(zone)}
          onPointerLeave={() => onPreviewChange?.(null)}
          onFocus={() => onPreviewChange?.(zone)}
          onBlur={() => onPreviewChange?.(null)}
        >
          <ZoneThumbnail ring={zone.ring} size={24} />
          <ZoneNameField
            name={zone.name}
            autoFocus={zone.id === focusId}
            onRename={(next) => onRename(zone.id, next)}
            className="min-w-0 flex-1"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${zone.name}`}
            onClick={() => onRemove(zone.id)}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );

  const empty = (
    <p className="text-muted-foreground text-sm">
      {tool
        ? `${DRAW_PROMPTS[tool]} Shapes you finish are listed here.`
        : "Pick a tool on the map to carry on."}
    </p>
  );

  const footer = (
    <div className="mt-auto flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={drafts.length === 0} onClick={onAdd}>
        {drafts.length
          ? `Add ${plural(drafts.length, "zone", "zones")}`
          : "Add zones"}
      </Button>
    </div>
  );

  if (chrome === "tray") {
    return (
      <FloatingPanel
        data-slot="zone-draft-panel"
        data-chrome="tray"
        // The tray owns the geometry and this fills it. pt-2 clears the
        // grabber laid over the top edge; the bottom corners go because the
        // tray is docked to one.
        className={cn("h-full w-full rounded-b-none pt-2", className)}
      >
        <FloatingPanelHeader>
          <FloatingPanelTitle>Drawn zones</FloatingPanelTitle>
          <span className="text-muted-foreground ml-auto text-sm">
            {drafts.length}
          </span>
        </FloatingPanelHeader>
        <FloatingPanelBody className="flex flex-col gap-3">
          {drafts.length ? rows : empty}
        </FloatingPanelBody>
        {footer}
      </FloatingPanel>
    );
  }

  return (
    <div
      data-slot="zone-draft-panel"
      data-chrome="panel"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      {/* The same back row the picker uses: the arrow names where it returns
          to, the heading names where you are. */}
      <header className="space-y-2 border-b px-4 pt-3 pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 max-w-full"
          onClick={onCancel}
        >
          <ArrowLeft data-icon="inline-start" />
          <span className="truncate">{ruleName ?? "Back"}</span>
        </Button>
        <div className="space-y-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Draw zones</h2>
          <p className="text-muted-foreground text-sm">
            Each shape you finish is listed here. Rename it, or keep drawing.
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-4">
        {drafts.length ? rows : empty}
      </div>
      {footer}
    </div>
  );
}
