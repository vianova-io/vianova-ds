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
import { CategoryBadge } from "@/registry/vianova/product/category-badge";
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
import {
  SIZE_DEFAULTS,
  SIZE_SCALE_DEFAULT,
  SizePanel,
  SizeSliderRow,
  SizeTriggerRow,
  type SizeField,
  type SizeGeometry,
} from "@/registry/vianova/product/size-panel";
import {
  sizeExpression,
  sizeSummary,
  type SizeMode,
} from "@/registry/vianova/lib/size-expression";
import { useCategoryPointLayer } from "@/registry/vianova/hooks/use-category-point-layer";
import { useCategoryShapeLayer } from "@/registry/vianova/hooks/use-category-shape-layer";
import {
  useRampLayer,
  type RampFeature,
} from "@/registry/vianova/hooks/use-ramp-layer";
import {
  DEFAULT_LOGO_ZOOM,
  STYLE_STORAGE_KEY,
  badgeColor,
  readStyleSet,
  resolveStyles,
  writeStyleSet,
  type CategoryStyle,
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
  operatorStyle,
  operatorStyles,
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

/**
 * An operator's badge at text size, or nothing when the value is not one.
 *
 * The filter shows it for the same reason the legend does: the row of names in
 * a Provider Name facet is the one place a reader picks an operator by hand,
 * and a badge beside each is what ties that choice to the dots on the map.
 */
function operatorBadge(value: string) {
  const style = operatorStyle(value);
  if (!style) return undefined;
  return (
    <CategoryBadge
      color={badgeColor(style)}
      logo={style.logo}
      logoKind={style.logoKind}
      size={18}
    />
  );
}

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
  onRemove,
  sizeControl = "shipped",
}: {
  feed: SampleFeed;
  map: MapLibreMap | null;
  /** Directory the CSVs are served from, without a trailing slash. */
  dataUrl: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** Takes the layer off the map. Omit it and the card offers no way to. */
  onRemove?: () => void;
  /**
   * Reports the parsed file and the rows a filter leaves, so the page around
   * this can chart what the map is showing.
   */
  onSampleChange?: (
    id: string,
    state: { sample: ParsedSample; rows: Record<string, string>[] } | null,
  ) => void;
  /**
   * Which size control the card carries -- see MapWorkspace, which owns this
   * decision and passes it down. "shipped" is one row in the card; "panel" is
   * the proposal with its own step beside Colorize.
   *
   * TEMPORARY, and deleted with the block's prop of the same name.
   */
  sizeControl?: "shipped" | "panel";
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
  /**
   * Which depth-1 step the chain is showing, as one value rather than a
   * boolean each.
   *
   * PanelStep given a controlled `open` reads that prop and never consults the
   * stepper's own openPath, so two controlled siblings both true would both
   * render at the same anchor, one on top of the other. One state makes
   * "never both" structural rather than something every handler remembers.
   */
  const [chain, setChain] = React.useState<"colorize" | "size" | null>(null);
  const colorizeOpen = chain === "colorize";
  const sizeOpen = chain === "size";
  const setColorizeOpen = React.useCallback(
    (open: boolean) => setChain(open ? "colorize" : null),
    [],
  );
  const setSizeOpen = React.useCallback(
    (open: boolean) => setChain(open ? "size" : null),
    [],
  );
  const [presetOpen, setPresetOpen] = React.useState(false);
  const [savedStyles, setSavedStyles] = React.useState<CategoryStyleSet>();

  const [sizeMode, setSizeMode] = React.useState<SizeMode>("single");
  const [sizeFieldChoice, setSizeFieldChoice] = React.useState<string>();
  const [sizeRadius, setSizeRadius] = React.useState(SIZE_DEFAULTS.radius);
  const [sizeWidth, setSizeWidth] = React.useState(SIZE_DEFAULTS.width);
  const [sizeRadiusRange, setSizeRadiusRange] = React.useState(
    SIZE_DEFAULTS.radiusRange,
  );
  /* The shipped control's one number: a multiple of how the layer already
     draws, so 1 is the map as designed. */
  const [sizeScale, setSizeScale] = React.useState(SIZE_SCALE_DEFAULT);
  const shippedSize = sizeControl === "shipped";
  const [sizeWidthRange, setSizeWidthRange] = React.useState(
    SIZE_DEFAULTS.widthRange,
  );

  const uid = React.useId();
  const colorizeTriggerId = `${uid}-colorize`;
  const sizeTriggerId = `${uid}-size`;
  const browsePresetsId = `${uid}-preset`;

  /**
   * Hiding the layer folds the chain away with its card.
   *
   * The card collapses to a name and an eye when the layer goes off, taking
   * the legend button and the Visualization section these steps hang from with
   * it -- so a docked Colorize or Size would be left configuring a layer
   * nobody can see, with no trigger for
   * PanelStep to return focus to on close. Keyed on the prop, not written into
   * the eye's handler: the library switches layers on and off too.
   */
  React.useEffect(() => {
    if (visible) return;
    setChain(null);
    setPresetOpen(false);
  }, [visible]);

  /* ------------------------------- loading ------------------------------- */

  React.useEffect(() => {
    if (!visible || sample || failed) return;
    const controller = new AbortController();
    // An absolute source is used as it stands. The catalogue's own feeds name
    // a file inside `dataUrl`, but a feed can also come from the reader's
    // machine -- the data library hands an uploaded CSV over as an object URL
    // -- and prefixing one of those with a directory would ask the server for
    // a path that was never on it.
    const src = /^(?:blob:|data:|https?:|\/)/.test(feed.file)
      ? feed.file
      : `${dataUrl}/${feed.file}`;
    fetch(src, { signal: controller.signal })
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

  /**
   * Saves a category's colour or logo where the data hub reads it.
   *
   * Through the same storage, under the same dataset id and column, so a
   * colour set on the map is the colour the hub's own preview draws, and a
   * logo uploaded in either place shows in both. The write also fires the
   * storage event other tabs listen on.
   */
  const setCategoryStyle = React.useCallback(
    (value: string, next: CategoryStyle) => {
      if (!colorField) return;
      setSavedStyles((current) => {
        const set: CategoryStyleSet = {
          logoZoom: current?.logoZoom ?? DEFAULT_LOGO_ZOOM,
          values: { ...current?.values, [value]: next },
        };
        writeStyleSet(feed.id, colorField, set);
        return set;
      });
    },
    [colorField, feed.id],
  );

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

  /**
   * What this layer can be sized by -- and nothing, when it is categorical.
   *
   * A categorical layer is coloured by a string, and its two hooks carry a
   * category per feature and no measure: there is no number on the layer to
   * graduate against. An empty list is the honest answer, and SizePanel reads
   * it as "single size only" and drops the mode switch rather than offering a
   * choice with an empty field list behind it.
   */
  const sizeFields = React.useMemo<SizeField[]>(() => {
    if (!sample || categorical) return [];
    return sample.columns
      .filter((c) => c.type === "number")
      .map((c) => ({ name: c.name, label: columnLabel(c.name) }));
  }, [categorical, sample]);

  /* The chosen field, kept valid by construction: a feed switched from
     categorical to numeric, or swapped underneath, would otherwise leave a
     column name that is no longer there. */
  const sizeField =
    sizeFieldChoice && sizeFields.some((f) => f.name === sizeFieldChoice)
      ? sizeFieldChoice
      : (sizeFields[0]?.name ?? "");

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
   * Whether a shipped style may still choose the colour.
   *
   * An operator ships with a disc colour as well as a badge, and that colour
   * has to give way the moment someone picks a palette -- otherwise the preset
   * picker appears to do nothing on the one layer most readers open first.
   * While the layer is on the palette it started with, nobody has chosen
   * anything, so the shipped colour stands. The badge is not part of this: a
   * palette says what colour a category is, not which operator it is.
   */
  const presetUntouched = preset === CATEGORICAL_PALETTES[0]!.name;

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
        (presetUntouched ? operatorStyle(value)?.color : undefined) ??
        paletteColors[i % paletteColors.length]!,
    }));
    return { shown, total: ranked.length };
  }, [
    categorical,
    colorField,
    paletteColors,
    presetUntouched,
    rows,
    savedStyles,
  ]);

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

  /**
   * The size domain, which is its own.
   *
   * Sizing by speed while colouring by volume is two encodings on one layer,
   * and borrowing the colour domain would scale every feature against numbers
   * it has nothing to do with. Same column, same edges -- the common case
   * costs nothing extra.
   */
  const sizeEdges = React.useMemo(() => {
    if (!sample || !sizeField) return [];
    if (sizeField === colorField) return edges;
    const values = rows
      .map((row) => Number(row[sizeField]))
      .filter((n) => Number.isFinite(n));
    return quantileEdges(values, BANDS);
  }, [colorField, edges, rows, sample, sizeField]);

  /* The size as MapLibre expressions, from the same builder the Zürich flows
     layer paints with. `size` rather than the raw column name: useRampLayer
     carries the sized number into every feature under that one key, so the
     expression does not have to know which column it came from. */
  const sizePaint = React.useMemo(
    () => ({
      radius: sizeExpression({
        // A feed never graduated before this panel existed, so the shipped
        // control has one size to scale rather than a range to stretch.
        mode: shippedSize ? "single" : sizeMode,
        size: shippedSize ? SIZE_DEFAULTS.radius * sizeScale : sizeRadius,
        property: "size",
        range: sizeRadiusRange,
        edges: sizeEdges,
      }),
      width: sizeExpression({
        mode: shippedSize ? "single" : sizeMode,
        size: shippedSize ? SIZE_DEFAULTS.width * sizeScale : sizeWidth,
        property: "size",
        range: sizeWidthRange,
        edges: sizeEdges,
      }),
    }),
    [
      shippedSize,
      sizeScale,
      sizeMode,
      sizeRadius,
      sizeWidth,
      sizeRadiusRange,
      sizeWidthRange,
      sizeEdges,
    ],
  );

  /* -------------------------------- layers -------------------------------- */

  // resolveStyles wants every value, not just the top N: a category pushed into
  // "Other" here is still drawn, and should keep the colour the hub gave it.
  const styleValues = React.useMemo(
    () => categories.shown.map((c) => c.value),
    [categories],
  );
  const logoZoom = savedStyles?.logoZoom ?? DEFAULT_LOGO_ZOOM;

  /*
   * Whether the legend draws badges or dots, which is whatever the MAP is
   * drawing right now.
   *
   * The card's legend could not show a logo at all before this: it passed
   * colours only, so a dataset with operator badges on the map had a legend
   * of plain dots beside it and no way to tell which badge was which. The
   * data hub's own legend has followed the zoom since it was written; this is
   * the same listener, in the block that needed it.
   *
   * Following the map rather than always showing logos, because the legend's
   * job is explaining what is on screen. Below logoZoom the map draws dots, so
   * a legend of badges would be labelling symbols that are not there.
   */
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
  const styles = React.useMemo(() => {
    const resolved = resolveStyles(
      styleValues,
      { logoZoom, values: savedStyles?.values },
      // The badges the operators ship with, under anything set in the picker.
      operatorStyles(styleValues),
    );
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
      out.push({
        geometry,
        value: Number(row[colorField]),
        // The sized column, carried alongside the coloured one so that
        // "size by speed, colour by volume" has both numbers on the feature.
        size: sizeField ? Number(row[sizeField]) : undefined,
      });
      if (!area && out.length >= MAX_MAP_POINTS) break;
    }
    return out;
  }, [categorical, colorField, rows, sample, sizeField]);

  const alpha = opacity / 100;

  useCategoryPointLayer({
    map,
    enabled: visible && categorical && points.length > 0,
    points,
    styles,
    logoZoom,
    // A number, not an expression: see the prop's own note -- the dots carry a
    // category and no measure, and icon-size has to be scaled to match.
    radius: shippedSize ? SIZE_DEFAULTS.radius * sizeScale : sizeRadius,
    id: `${feed.id}-points`,
  });

  useCategoryShapeLayer({
    map,
    enabled: visible && categorical && shapes.length > 0,
    shapes,
    styles,
    // A polygon's only size is its outline.
    width: shippedSize ? SIZE_DEFAULTS.width * sizeScale : sizeWidth,
    id: `${feed.id}-shapes`,
  });

  useRampLayer({
    map,
    enabled: visible && !categorical && rampFeatures.length > 0,
    features: rampFeatures,
    colors: rampColors,
    edges,
    opacity: alpha,
    radius: sizePaint.radius,
    width: sizePaint.width,
    id: `${feed.id}-ramp`,
  });

  /* --------------------------------- card --------------------------------- */

  const loading = visible && !sample && !failed;
  const geometry = sample?.geometry === "area" ? "area" : "point";
  /* An area has no radius -- its only size is the outline it is drawn with. */
  const sizeGeometry: SizeGeometry = geometry === "area" ? "line" : "point";
  const sizeSummaryText = sizeSummary({
    mode: sizeMode,
    size: sizeGeometry === "line" ? sizeWidth : sizeRadius,
    range: sizeGeometry === "line" ? sizeWidthRange : sizeRadiusRange,
    fieldLabel: sizeFields.find((f) => f.name === sizeField)?.label,
  });
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
        items={categories.shown.map((c) => {
          const style = styles[c.value];
          return {
            label: c.value,
            color: c.color,
            logo: style?.logo
              ? { src: style.logo, solid: style.logoKind === "solid" }
              : undefined,
          };
        })}
        showLogos={logosShown}
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
        onRemove={onRemove}
        meta={meta}
        // Expanded follows visibility: a layer that is off is a name and an
        // eye, and turning it on is what asks for its controls. Ten expanded
        // cards would be 2,000px of panel for layers nobody switched on. The
        // card enforces this as well; passed here so the rule reads locally.
        expanded={visible}
        visible={visible}
        onVisibilityChange={onVisibleChange}
        visualizationType={viz}
        onVisualizationTypeChange={setViz}
        unavailableVisualizations={UNAVAILABLE[geometry]}
        unavailableVisualizationReason={REASON[geometry]}
        legend={legend}
        onColorize={
          sample
            ? () => setChain((c) => (c === "colorize" ? null : "colorize"))
            : undefined
        }
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
              valueIcon={(_field, value) => operatorBadge(value)}
            />
          ) : null
        }
      >
        {/* Through the card's own `children` slot, which it already documents
            as extra controls for the active visualisation. Nothing in
            DataLayerCard changes, so no visual baseline moves. */}
        {sample ? (
          shippedSize ? (
            <SizeSliderRow
              id={sizeTriggerId}
              layerName={feed.title}
              value={sizeScale}
              onValueChange={setSizeScale}
            />
          ) : (
            <SizeTriggerRow
              id={sizeTriggerId}
              layerName={feed.title}
              open={sizeOpen}
              onClick={() => setChain((c) => (c === "size" ? null : "size"))}
              summary={sizeSummaryText}
            />
          )
        ) : null}
      </DataLayerCard>

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
            categoryStyles={styles}
            logoZoom={logoZoom}
            onCategoryStyleChange={setCategoryStyle}
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

      {/* A SIBLING of Colorize, not a child: a size is not a colour setting,
          and nesting it would make the chain claim it is. Both sit at depth 1,
          which is exactly why `chain` is one value -- see its declaration. */}
      {sample && !shippedSize ? (
        <PanelStep
          id={`${feed.id}-size`}
          title={`Size · ${feed.title}`}
          width={360}
          open={sizeOpen}
          onOpenChange={setSizeOpen}
          triggerId={sizeTriggerId}
        >
          <SizePanel
            showHeader={false}
            className="w-auto rounded-none border-0 bg-transparent shadow-none"
            geometry={sizeGeometry}
            fields={sizeFields}
            mode={sizeMode}
            onModeChange={setSizeMode}
            field={sizeField}
            onFieldChange={setSizeFieldChoice}
            radius={sizeRadius}
            onRadiusChange={setSizeRadius}
            width={sizeWidth}
            onWidthChange={setSizeWidth}
            radiusRange={sizeRadiusRange}
            onRadiusRangeChange={setSizeRadiusRange}
            widthRange={sizeWidthRange}
            onWidthRangeChange={setSizeWidthRange}
          />
        </PanelStep>
      ) : null}
    </>
  );
}
