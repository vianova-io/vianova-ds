"use client";

import * as React from "react";
import { ListFilter } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { Button } from "@/registry/vianova/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import {
  ColorizePanel,
  type ColorizeField,
} from "@/registry/vianova/product/colorize-panel";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import { FilterBuilder } from "@/registry/vianova/product/filter-builder";
import { FilterFacets } from "@/registry/vianova/product/filter-facets";
import { LegendCategorical } from "@/registry/vianova/product/legend-categorical";
import { LegendRamp } from "@/registry/vianova/product/legend-ramp";
import {
  PanelStep,
  PanelStepBody,
} from "@/registry/vianova/product/panel-stepper";
import { PresetPicker } from "@/registry/vianova/product/preset-picker";
import type { VisualizationTypeId } from "@/registry/vianova/product/visualization-picker";
import { useCategoryPointLayer } from "@/registry/vianova/hooks/use-category-point-layer";
import { useCategoryShapeLayer } from "@/registry/vianova/hooks/use-category-shape-layer";
import {
  useRampLayer,
  type RampFeature,
} from "@/registry/vianova/hooks/use-ramp-layer";
import {
  DEFAULT_LOGO_ZOOM,
  STYLE_STORAGE_KEY,
  readStyleSet,
  resolveStyles,
  type CategoryStyleSet,
} from "@/registry/vianova/lib/category-style";
import {
  CATEGORICAL_PALETTES,
  SEQUENTIAL_PALETTES,
  quantileEdges,
  rampFromStops,
  stopsFromRamp,
  type Stop,
} from "@/registry/vianova/lib/color-ramp";
import {
  MAX_MAP_POINTS,
  columnLabel,
  defaultCategoryColumn,
  firstPosition,
  parseSample,
  pointsBy,
  ringOf,
  shapesBy,
  type ParsedSample,
  type SampleFeed,
} from "@/registry/vianova/lib/sample-datasets";
import {
  countConditions,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";
import { compileFilter } from "@/registry/vianova/lib/filter-eval";

/** Matches the colorize panel's own default, so the two agree about the tail. */
const MAX_CATEGORIES = 8;

/** Everything past the top N, on the map and in the panel alike. */
const OTHER_COLOR = "#a1a1aa";

/** Bands in a numeric ramp. Eleven is what the ramp legend draws. */
const BANDS = 11;

const compact = new Intl.NumberFormat("en", { notation: "compact" });
const plain = new Intl.NumberFormat("en");

/**
 * What a layer of this geometry can be drawn as.
 *
 * Only what is actually painted is offered. A picker that lists seven
 * visualisations and silently does nothing for five of them is worse than one
 * that says which two apply and why.
 */
const UNAVAILABLE: Record<"point" | "area", readonly VisualizationTypeId[]> = {
  point: ["clusters", "grid", "heatmap", "lines", "zones", "trips"],
  area: ["points", "clusters", "grid", "heatmap", "lines", "trips"],
};

const REASON: Record<"point" | "area", string> = {
  point: "this layer draws one point per row",
  area: "this layer draws the outline of each row",
};

/**
 * One sample dataset as a map layer: a card that configures it, and the layers
 * that paint it.
 *
 * The card is the whole kit — visualisation, legend, filters and a colorize
 * chain — because every one of them is driven by the file's own columns. The
 * CSV is inferred, not configured: `inferColumns` already types each column, so
 * a feed added to the catalogue gets a working layer with no code to write, and
 * so does a file nobody has seen yet.
 *
 * Fetched the first time the layer is switched on. Ten of these on one page is
 * about 1.7MB of CSV and 8,000 rows of WKT, and most visitors turn on none.
 */
export function SampleMapLayer({
  feed,
  map,
  dataUrl,
  visible,
  onVisibleChange,
  onSampleChange,
}: {
  feed: SampleFeed;
  map: MapLibreMap | null;
  /** Directory the CSVs are served from, without a trailing slash. */
  dataUrl: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /**
   * Reports the parsed file and the rows a filter leaves, so the page around
   * this can chart what the map is showing.
   */
  onSampleChange?: (
    id: string,
    state: { sample: ParsedSample; rows: Record<string, string>[] } | null,
  ) => void;
}) {
  const [sample, setSample] = React.useState<ParsedSample | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterGroup>(() =>
    newGroup("and"),
  );
  const [colorField, setColorField] = React.useState<string>();
  const [viz, setViz] = React.useState<VisualizationTypeId>("points");
  const [preset, setPreset] = React.useState(CATEGORICAL_PALETTES[0]!.name);
  const [rampPreset, setRampPreset] = React.useState(
    SEQUENTIAL_PALETTES[0]!.name,
  );
  const [stops, setStops] = React.useState<Stop[] | null>(null);
  const [rampCustom, setRampCustom] = React.useState(false);
  const [opacity, setOpacity] = React.useState(100);
  const [colorizeOpen, setColorizeOpen] = React.useState(false);
  const [presetOpen, setPresetOpen] = React.useState(false);
  const [savedStyles, setSavedStyles] = React.useState<CategoryStyleSet>();

  const uid = React.useId();
  const colorizeTriggerId = `${uid}-colorize`;
  const browsePresetsId = `${uid}-preset`;

  /* ------------------------------- loading ------------------------------- */

  React.useEffect(() => {
    if (!visible || sample || failed) return;
    const controller = new AbortController();
    fetch(`${dataUrl}/${feed.file}`, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
      )
      .then((text) => {
        const parsed = parseSample(text);
        if (parsed) {
          setSample(parsed);
          setColorField((current) => current ?? defaultCategoryColumn(parsed));
          setViz(parsed.geometry === "area" ? "zones" : "points");
        } else setFailed(true);
      })
      .catch(() => {
        // An abort is this component tidying up, not the fetch failing.
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [dataUrl, failed, feed.file, sample, visible]);

  /* ---------------------------- category styles --------------------------- */

  // Colours and logos set in the data hub, keyed by this feed's id and the
  // column in play. Read after mount, never in the initial state: the server
  // has no storage.
  React.useEffect(() => {
    if (!colorField) return;
    const read = () => setSavedStyles(readStyleSet(feed.id, colorField));
    read();
    // Fires in this tab when ANOTHER tab writes, which is how a logo set in the
    // hub shows up here without a reload.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STYLE_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [colorField, feed.id]);

  /* -------------------------------- fields -------------------------------- */

  const colorFields = React.useMemo<ColorizeField[]>(() => {
    if (!sample) return [];
    return sample.columns
      .filter((c) => c.type === "category" || c.type === "number")
      .map((c) => ({
        name: c.name,
        label: columnLabel(c.name),
        type: c.type === "number" ? ("number" as const) : ("string" as const),
      }));
  }, [sample]);

  const filterFields = React.useMemo<FilterField[]>(() => {
    if (!sample) return [];
    return sample.columns
      .filter((c) => c.type !== "geometry" && c.type !== "id")
      .map((c) => ({
        name: c.name,
        label: columnLabel(c.name),
        type:
          c.type === "number"
            ? ("number" as const)
            : c.type === "timestamp"
              ? ("date" as const)
              : c.type === "category"
                ? ("enum" as const)
                : ("string" as const),
        options: c.values?.map((v) => ({ value: v, label: v })),
        unit: feed.units?.[c.name],
      }));
  }, [feed.units, sample]);

  const fieldType =
    colorFields.find((f) => f.name === colorField)?.type ?? "string";
  const categorical = fieldType === "string";

  /* --------------------------------- rows --------------------------------- */

  const predicate = React.useMemo(
    () => compileFilter(filter, filterFields),
    [filter, filterFields],
  );

  /** The rows a filter leaves, as records, which is what everything else reads. */
  const rows = React.useMemo(() => {
    if (!sample) return [];
    const all = sample.rows.map((row) =>
      Object.fromEntries(sample.header.map((h, i) => [h, row[i] ?? ""])),
    );
    return all.filter((row) => predicate(row));
  }, [predicate, sample]);

  const keep = React.useCallback(
    (row: Record<string, string>) => predicate(row),
    [predicate],
  );

  React.useEffect(() => {
    onSampleChange?.(feed.id, sample && visible ? { sample, rows } : null);
  }, [feed.id, onSampleChange, rows, sample, visible]);

  /* ------------------------------- colouring ------------------------------ */

  const paletteColors = React.useMemo(() => {
    const found = CATEGORICAL_PALETTES.find((p) => p.name === preset);
    return (found ?? CATEGORICAL_PALETTES[0]!).colors;
  }, [preset]);

  /**
   * The values present, commonest first, with a colour each.
   *
   * Counted from the FILTERED rows, so narrowing a filter narrows the legend --
   * "showing top 8 of 14" is a fact about what is on the map, not about the
   * file. A colour set in the data hub wins over the palette: someone chose it
   * deliberately, and it is the same colour the hub's own preview draws.
   */
  const categories = React.useMemo(() => {
    if (!colorField || !categorical) return { shown: [], total: 0 };
    const counts = new Map<string, number>();
    for (const row of rows) {
      const value = row[colorField] ?? "";
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const shown = ranked.slice(0, MAX_CATEGORIES).map(([value], i) => ({
      value,
      color:
        savedStyles?.values?.[value]?.color ??
        paletteColors[i % paletteColors.length]!,
    }));
    return { shown, total: ranked.length };
  }, [categorical, colorField, paletteColors, rows, savedStyles]);

  const rampStops = React.useMemo(() => {
    if (stops) return stops;
    const found = SEQUENTIAL_PALETTES.find((p) => p.name === rampPreset);
    return stopsFromRamp((found ?? SEQUENTIAL_PALETTES[0]!).colors);
  }, [rampPreset, stops]);

  const rampColors = React.useMemo(
    () => rampFromStops(rampStops, BANDS),
    [rampStops],
  );

  const edges = React.useMemo(() => {
    if (!sample || !colorField || categorical) return [];
    const values = rows
      .map((row) => Number(row[colorField]))
      .filter((n) => Number.isFinite(n));
    return quantileEdges(values, BANDS);
  }, [categorical, colorField, rows, sample]);

  /* -------------------------------- layers -------------------------------- */

  // resolveStyles wants every value, not just the top N: a category pushed into
  // "Other" here is still drawn, and should keep the colour the hub gave it.
  const styleValues = React.useMemo(
    () => categories.shown.map((c) => c.value),
    [categories],
  );
  const logoZoom = savedStyles?.logoZoom ?? DEFAULT_LOGO_ZOOM;
  const styles = React.useMemo(() => {
    const resolved = resolveStyles(styleValues, {
      logoZoom,
      values: savedStyles?.values,
    });
    // The palette, not resolveStyles' own sequence: the legend and the panel
    // both show these colours, and three sources of truth is two too many.
    for (const { value, color } of categories.shown) {
      const existing = resolved[value];
      if (existing) resolved[value] = { ...existing, color };
    }
    return resolved;
  }, [categories.shown, logoZoom, savedStyles, styleValues]);

  const points = React.useMemo(
    () =>
      sample && sample.geometry === "point" && categorical
        ? pointsBy(sample, colorField, keep)
        : [],
    [categorical, colorField, keep, sample],
  );

  const shapes = React.useMemo(
    () =>
      sample && sample.geometry === "area" && categorical
        ? shapesBy(sample, colorField, keep)
        : [],
    [categorical, colorField, keep, sample],
  );

  /**
   * Points or rings carrying the measure, for the numeric branch.
   *
   * Built in ONE pass over the filtered rows, reading each row's geometry as it
   * goes. Zipping two lists by index would be wrong: the geometry readers skip
   * a row whose cell is blank or unreadable, so the lists fall out of step at
   * the first bad cell and every value after it lands on the wrong feature.
   */
  const rampFeatures = React.useMemo<RampFeature[]>(() => {
    if (!sample || categorical || !colorField || sample.geometryAt < 0)
      return [];
    const geometryColumn = sample.header[sample.geometryAt];
    if (!geometryColumn) return [];
    const area = sample.geometry === "area";
    const out: RampFeature[] = [];

    for (const row of rows) {
      const cell = row[geometryColumn] ?? "";
      if (!cell.trim()) continue;
      const geometry = area ? ringOf(cell) : firstPosition(cell);
      if (!geometry) continue;
      out.push({ geometry, value: Number(row[colorField]) });
      if (!area && out.length >= MAX_MAP_POINTS) break;
    }
    return out;
  }, [categorical, colorField, rows, sample]);

  const alpha = opacity / 100;

  useCategoryPointLayer({
    map,
    enabled: visible && categorical && points.length > 0,
    points,
    styles,
    logoZoom,
    id: `${feed.id}-points`,
  });

  useCategoryShapeLayer({
    map,
    enabled: visible && categorical && shapes.length > 0,
    shapes,
    styles,
    id: `${feed.id}-shapes`,
  });

  useRampLayer({
    map,
    enabled: visible && !categorical && rampFeatures.length > 0,
    features: rampFeatures,
    colors: rampColors,
    edges,
    opacity: alpha,
    id: `${feed.id}-ramp`,
  });

  /* --------------------------------- card --------------------------------- */

  const loading = visible && !sample && !failed;
  const geometry = sample?.geometry === "area" ? "area" : "point";
  const conditions = countConditions(filter);

  const ticks = React.useMemo(() => {
    if (edges.length < 2) return undefined;
    return [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) =>
      compact.format(edges[Math.round((edges.length - 1) * f)]!),
    );
  }, [edges]);

  const meta = failed
    ? `Data unavailable — ${feed.file} did not load`
    : sample
      ? `${plain.format(rows.length)} of ${plain.format(sample.rows.length)} · ${feed.rowRepresents}`
      : visible
        ? "Loading…"
        : feed.rowRepresents;

  const legend = loading ? (
    <Skeleton className="h-2.5 w-full" />
  ) : !sample ? null : categorical ? (
    categories.shown.length ? (
      <LegendCategorical
        items={categories.shown.map((c) => ({
          label: c.value,
          color: c.color,
        }))}
      />
    ) : null
  ) : (
    <LegendRamp
      colors={rampColors.length ? rampColors : undefined}
      ticks={ticks}
      showTicks={Boolean(ticks)}
    />
  );

  return (
    <>
      <DataLayerCard
        name={feed.title}
        meta={meta}
        // Expanded follows visibility: a layer that is off is a name and an
        // eye, and turning it on is what asks for its controls. Ten expanded
        // cards would be 2,000px of panel for layers nobody switched on.
        expanded={visible}
        visible={visible}
        onVisibilityChange={onVisibleChange}
        visualizationType={viz}
        onVisualizationTypeChange={setViz}
        unavailableVisualizations={UNAVAILABLE[geometry]}
        unavailableVisualizationReason={REASON[geometry]}
        legend={legend}
        onColorize={sample ? () => setColorizeOpen((open) => !open) : undefined}
        colorizeOpen={colorizeOpen}
        colorizeTriggerId={colorizeTriggerId}
        filters={Boolean(sample)}
        filterCount={conditions || undefined}
        filtersAction={
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${feed.title} filters`}
                >
                  <ListFilter />
                </Button>
              }
            />
            {/* 440px is wider than a phone, and Base UI's collision handling
                shifts a popup but never shrinks it, so the value inputs would
                hang off-screen. --available-width comes off the positioner and
                already accounts for the anchor and the collision padding. */}
            <PopoverContent
              align="end"
              className="w-[440px] max-w-[var(--available-width)] p-3"
            >
              <FilterBuilder
                fields={filterFields}
                value={filter}
                onValueChange={setFilter}
              />
            </PopoverContent>
          </Popover>
        }
        filtersContent={
          sample ? (
            <FilterFacets
              fields={filterFields.filter((f) => f.type === "enum")}
              value={filter}
              onValueChange={setFilter}
            />
          ) : null
        }
      />

      {/* Declared beside the card rather than inside it: a step is a panel of
          its own, and nesting it in the card would put it inside the scrolling
          body it is meant to cascade out of. */}
      {sample ? (
        <PanelStep
          id={feed.id}
          title={`Colorize · ${feed.title}`}
          width={360}
          open={colorizeOpen}
          onOpenChange={setColorizeOpen}
          triggerId={colorizeTriggerId}
        >
          <ColorizePanel
            showHeader={false}
            className="w-auto rounded-none border-0 bg-transparent shadow-none"
            layerName={feed.title}
            fields={colorFields}
            field={colorField}
            onFieldChange={setColorField}
            categories={categories.shown}
            totalCategories={categories.total}
            maxCategories={MAX_CATEGORIES}
            otherColor={OTHER_COLOR}
            opacity={opacity}
            onOpacityChange={setOpacity}
            presetName={categorical ? preset : rampPreset}
            presetCustom={!categorical && rampCustom}
            presetColors={categorical ? paletteColors : undefined}
            stops={!categorical && rampStops.length ? rampStops : undefined}
            onStopsChange={(next) => {
              setStops(next);
              setRampCustom(true);
            }}
            onBrowsePresets={() => setPresetOpen((open) => !open)}
            browsePresetsId={browsePresetsId}
            presetsOpen={presetOpen}
          />

          <PanelStep
            id="preset"
            title="Preset"
            width={420}
            open={presetOpen}
            onOpenChange={setPresetOpen}
            triggerId={browsePresetsId}
          >
            <PanelStepBody className="max-h-80 p-0">
              <PresetPicker
                palettes={
                  categorical ? CATEGORICAL_PALETTES : SEQUENTIAL_PALETTES
                }
                value={categorical ? preset : rampPreset}
                onValueChange={(name) => {
                  if (categorical) {
                    setPreset(name);
                    return;
                  }
                  setRampPreset(name);
                  setRampCustom(false);
                  // Cleared rather than rewritten: rampStops falls back to the
                  // named palette, so one place decides what the ramp is.
                  setStops(null);
                }}
              />
            </PanelStepBody>
          </PanelStep>
        </PanelStep>
      ) : null}
    </>
  );
}
