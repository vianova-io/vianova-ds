"use client";

import * as React from "react";
import {
  Braces,
  FileUp,
  LayoutGrid,
  Link2,
  List as ListIcon,
  Search,
  Shapes,
} from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { SliderField } from "@/registry/vianova/patterns/slider-field";
import { TagInput } from "@/registry/vianova/patterns/tag-input";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import { ChoiceCard, ChoiceCardGroup } from "@/registry/vianova/ui/choice-card";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/registry/vianova/ui/sheet";
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

const METERS_PER_DEGREE = 111_320;
const CIRCLE_STEPS = 32;

type Position = [number, number];
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

/** A regular polygon around a point, close enough to a circle at map scale. */
function circle([lng, lat]: Position, radius: number): Position[] {
  const dLat = radius / METERS_PER_DEGREE;
  const dLng = radius / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const ring: Position[] = [];
  for (let i = 0; i < CIRCLE_STEPS; i++) {
    const a = (i / CIRCLE_STEPS) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]!);
  return ring;
}

/**
 * A corridor of `radius` metres either side of a line, with round ends.
 *
 * Worked in local metres around the first vertex, then converted back: an
 * offset in degrees would be narrower east-west than north-south. Joins are
 * the average of the two segment normals, which is good enough for street
 * corridors; it is not a general-purpose buffer and does not resolve the
 * self-overlap a hairpin produces.
 */
function corridor(line: Position[], radius: number): Position[] {
  const [lng0, lat0] = line[0]!;
  const kx = METERS_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
  const ky = METERS_PER_DEGREE;
  const pts = line.map(
    ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky] as const,
  );
  const back = ([x, y]: readonly [number, number]): Position => [
    lng0 + x / kx,
    lat0 + y / ky,
  ];

  const normals = pts.slice(1).map(([x, y], i) => {
    const [px, py] = pts[i]!;
    const len = Math.hypot(x - px, y - py) || 1;
    return [-(y - py) / len, (x - px) / len] as const;
  });
  const vertexNormal = (i: number) => {
    const a = normals[Math.max(0, i - 1)]!;
    const b = normals[Math.min(normals.length - 1, i)]!;
    const nx = a[0] + b[0];
    const ny = a[1] + b[1];
    const len = Math.hypot(nx, ny) || 1;
    return [nx / len, ny / len] as const;
  };

  const left: Position[] = [];
  const right: Position[] = [];
  pts.forEach(([x, y], i) => {
    const [nx, ny] = vertexNormal(i);
    left.push(back([x + nx * radius, y + ny * radius]));
    right.push(back([x - nx * radius, y - ny * radius]));
  });

  const cap = (i: number, from: readonly [number, number]) => {
    const [cx, cy] = pts[i]!;
    const start = Math.atan2(from[1], from[0]);
    const out: Position[] = [];
    for (let s = 1; s < CIRCLE_STEPS / 2; s++) {
      const a = start - (s / (CIRCLE_STEPS / 2)) * Math.PI;
      out.push(back([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]));
    }
    return out;
  };

  const last = pts.length - 1;
  const [sx, sy] = vertexNormal(0);
  // Each cap sweeps clockwise from one side to the other, round the line's end.
  const ring = [
    ...left,
    ...cap(last, vertexNormal(last)),
    ...right.reverse(),
    ...cap(0, [-sx, -sy]),
  ];
  ring.push(ring[0]!);
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
            points.forEach((p) => rings.push(circle(toPosition(p), radius)));
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
                rings.push(corridor(positions, radius));
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

type Source = "zones" | "paste" | "upload" | "url";
type View = "cards" | "list";

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
          zones={zones}
          excludeIds={excludeIds}
          title={title}
          onCancel={() => onOpenChange(false)}
          onAdd={(chosen) => {
            onAdd(chosen);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function ZonePickerBody({
  zones,
  excludeIds,
  title,
  onCancel,
  onAdd,
}: {
  zones: PickerZone[];
  excludeIds?: string[];
  title: string;
  onCancel: () => void;
  onAdd: (zones: PickerZone[]) => void;
}) {
  const [source, setSource] = React.useState<Source>("zones");
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [paste, setPaste] = React.useState<{ text: string; radius: number }>({
    text: "",
    radius: 0,
  });

  const parsed = React.useMemo(
    () =>
      paste.text.trim()
        ? parseGeoJsonZones(paste.text, { radiusMeters: paste.radius })
        : null,
    [paste],
  );
  const pastedZones = parsed && "zones" in parsed ? parsed.zones : [];

  const chosen = React.useMemo(
    () =>
      source === "zones"
        ? zones.filter((z) => selected.has(z.id))
        : source === "paste"
          ? pastedZones
          : [],
    [source, zones, selected, pastedZones],
  );

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>Choose where the zones come from.</SheetDescription>
      </SheetHeader>

      {/* One scroll region for the whole body, with the padding inside it so a
          focus ring at the edge is never cut by the overflow. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-4">
        <ChoiceCardGroup
          aria-label="Zone source"
          columns={2}
          value={source}
          onValueChange={(v) => setSource(v as Source)}
        >
          <ChoiceCard
            value="zones"
            icon={<Shapes />}
            title="Select from your zones"
          />
          <ChoiceCard
            value="paste"
            icon={<Braces />}
            title="Paste shape code"
          />
          <ChoiceCard
            value="upload"
            icon={<FileUp />}
            title="Upload shape file"
            badge="Soon"
            disabled
          />
          <ChoiceCard
            value="url"
            icon={<Link2 />}
            title="Pull from url"
            badge="Soon"
            disabled
          />
        </ChoiceCardGroup>

        {source === "zones" ? (
          <ZoneList
            zones={zones}
            excludeIds={excludeIds}
            selected={selected}
            onSelectedChange={setSelected}
          />
        ) : (
          <PasteSource
            text={paste.text}
            radius={paste.radius}
            onTextChange={(text) => setPaste((p) => ({ ...p, text }))}
            onRadiusChange={(radius) => setPaste((p) => ({ ...p, radius }))}
            parsed={parsed}
          />
        )}
      </div>

      <SheetFooter className="flex-row justify-end border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
          {chosen.length
            ? `Add ${plural(chosen.length, "zone", "zones")}`
            : "Add zones"}
        </Button>
      </SheetFooter>
    </>
  );
}

function ZoneList({
  zones,
  excludeIds,
  selected,
  onSelectedChange,
}: {
  zones: PickerZone[];
  excludeIds?: string[];
  selected: ReadonlySet<string>;
  onSelectedChange: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
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
}: {
  zone: PickerZone;
  view: View;
  added: boolean;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
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

  if (view === "list") {
    return (
      <li>
        <label
          htmlFor={id}
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

function PasteSource({
  text,
  radius,
  onTextChange,
  onRadiusChange,
  parsed,
}: {
  text: string;
  radius: number;
  onTextChange: (text: string) => void;
  onRadiusChange: (radius: number) => void;
  parsed: ReturnType<typeof parseGeoJsonZones> | null;
}) {
  const id = React.useId();
  const error = parsed && "error" in parsed ? parsed.error : null;
  const errorId = `${id}-error`;

  return (
    <div data-slot="zone-picker-paste" className="flex flex-col gap-5">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Paste GeoJSON</FieldLabel>
        <Textarea
          id={id}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder='{ "type": "Feature", "geometry": { "type": "Polygon", … } }'
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="max-h-60 min-h-32 font-mono text-xs md:text-xs"
        />
        {error ? (
          <FieldError id={errorId}>{error}</FieldError>
        ) : (
          <FieldDescription>
            A Feature, FeatureCollection or geometry. Each polygon becomes a
            zone.
          </FieldDescription>
        )}
      </Field>

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
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {plural(parsed.zones.length, "zone", "zones")} found
          </p>
          <ul
            role="list"
            className="flex flex-col divide-y divide-border rounded-lg border"
          >
            {parsed.zones.slice(0, ROW_LIMIT).map((zone) => (
              <li
                key={zone.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm"
              >
                <ZoneThumbnail ring={zone.ring} size={24} />
                <span className="min-w-0 flex-1 truncate">{zone.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
