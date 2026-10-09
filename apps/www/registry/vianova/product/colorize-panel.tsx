"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Input } from "@/registry/vianova/ui/input";
import { Label } from "@/registry/vianova/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Separator } from "@/registry/vianova/ui/separator";
import { Slider } from "@/registry/vianova/ui/slider";
import { ColorStopList } from "@/registry/vianova/product/color-stop-list";
import {
  ColorStopSlider,
  sortStops,
  stopsToGradient,
  type ColorStop,
} from "@/registry/vianova/product/color-stop-slider";
import { PaletteStrip } from "@/registry/vianova/product/preset-picker";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { CategoryStylePicker } from "@/registry/vianova/product/category-style-picker";
import {
  DEFAULT_LOGO_ZOOM,
  type CategoryStyle,
} from "@/registry/vianova/lib/category-style";
import { cn } from "@/registry/vianova/lib/utils";

export const CLASSIFICATION_METHODS = [
  { value: "equal-intervals", label: "Equal intervals" },
  { value: "equal-count", label: "Equal count (quantile)" },
  { value: "natural-breaks", label: "Natural breaks (Jenks)" },
  { value: "standard-deviation", label: "Standard deviation" },
] as const;

const COLOR_BY_METRICS: Record<string, string> = {
  "vehicle-count": "Vehicle count",
  "trip-count": "Trip count",
  "avg-duration": "Average duration",
};

const CLASSIFICATION_LABELS: Record<string, string> = Object.fromEntries(
  CLASSIFICATION_METHODS.map((m) => [m.value, m.label]),
);

const DEFAULT_STOPS: ColorStop[] = [
  { position: 0, color: "#d9d9d9", opacity: 100 },
  { position: 50, color: "#a6a6a6", opacity: 100 },
  { position: 75, color: "#8c8c8c", opacity: 100 },
  { position: 100, color: "#737373", opacity: 100 },
];

/** A field the layer can be coloured by. Its `type` picks the panel's body. */
export type ColorizeField = {
  name: string;
  /** Shown instead of `name`, which is usually a raw column name. */
  label?: string;
  type: "string" | "number";
};

export type ColorizeCategory = {
  value: string;
  /** Shown instead of `value`. Category values are raw cell contents --
   *  `motorway_link`, `HGV_3` -- and the panel names fields by their label for
   *  the same reason. The map still matches on `value`. */
  label?: string;
  color: string;
};

/** The bucket every value past `maxCategories` falls into. */
const OTHER = "Other";

/** Matches the product: eight named values, then Other. */
const DEFAULT_MAX_CATEGORIES = 8;

const DEFAULT_FIELDS: ColorizeField[] = Object.keys(COLOR_BY_METRICS).map(
  (name) => ({ name, type: "number" }),
);

/**
 * Colour configuration for a map layer.
 *
 * The body depends on what you colour by, because the two cases have nothing
 * in common. A **numeric** field is a range, so it gets a classification method
 * and a ramp of stops. A **string** field is a set of values, so it gets a
 * palette and one swatch per value. Showing either control for the other kind
 * of field would be meaningless, so the panel branches on `ColorizeField.type`.
 *
 * Stops are held in one place and shared by the slider and the list, so
 * dragging a handle and typing a percentage are the same edit. Selection is
 * shared too — that is what makes a ramp with many stops workable.
 */
/**
 * One setting: its name on the left, its control on the right.
 *
 * Two columns rather than a label stacked above its control. The panel sits
 * beside a map, often with two more panels cascading off it, so every row it
 * saves is a row of map you can still see -- and these controls are all short
 * enough that a full-width field was only ever padding.
 */
function Row({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-8 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-2",
        className,
      )}
    >
      {label}
      <div className="flex min-w-0 items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

export function ColorizePanel({
  layerName = "Micromobility",
  metric,
  fields = DEFAULT_FIELDS,
  field: controlledField,
  onFieldChange,
  mode: controlledMode,
  onModeChange,
  categories = [],
  totalCategories,
  maxCategories = DEFAULT_MAX_CATEGORIES,
  otherColor = "#a1a1aa",
  singleColor = "#3b82f6",
  onCategorySelect,
  opacity: controlledOpacity,
  onOpacityChange,
  presetName = "Spectrum",
  presetCustom = false,
  presetColors,
  categoryStyles,
  logoZoom = DEFAULT_LOGO_ZOOM,
  onCategoryStyleChange,
  onBrowsePresets,
  browsePresetsId,
  presetsOpen,
  stops: controlledStops,
  onStopsChange,
  onApply,
  onCancel,
  onBack,
  onClose,
  showHeader = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  layerName?: string;
  metric?: string;
  /** Defaults to the three numeric metrics, which keeps the ramp body. */
  fields?: ColorizeField[];
  field?: string;
  onFieldChange?: (field: string) => void;
  /** "discrete"/"continuous" for a numeric field; "single"/"categories" for a
   *  string one. Left uncontrolled it follows the field's type. */
  mode?: string;
  onModeChange?: (mode: string) => void;
  /** Already truncated to the top N by the caller, which knows the dataset. */
  categories?: ColorizeCategory[];
  /** Distinct values in the data, for the "showing top N of M" caption. */
  totalCategories?: number;
  maxCategories?: number;
  otherColor?: string;
  singleColor?: string;
  /** Fired by a category's swatch when no `onCategoryStyleChange` is given, so
   *  a caller can still supply a picker of its own. */
  onCategorySelect?: (value: string) => void;
  /**
   * Colours and logos per category value, keyed the way the map reads them.
   *
   * Supplying `onCategoryStyleChange` turns each swatch into the same picker
   * the data hub uses: the palette, a custom colour, a logo to upload and the
   * badge behind it, with the dot and the badge previewed as the map will draw
   * them. Without it the swatches stay flat and only report a click.
   */
  categoryStyles?: Record<string, CategoryStyle>;
  /** The zoom a map swaps dots for logo badges at, shown in the picker. */
  logoZoom?: number;
  onCategoryStyleChange?: (value: string, style: CategoryStyle) => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  presetName?: string;
  /**
   * Marks the ramp as edited away from the named preset.
   *
   * Only the caller can know: the panel is handed a list of stops and has no
   * idea whether they still match the preset whose name it is showing. It used
   * to hardcode both -- the name "Greys" and an unconditional Custom badge --
   * which meant the row described the component's own defaults rather than the
   * layer, and said so even when nothing had been touched.
   */
  presetCustom?: boolean;
  presetColors?: string[];
  onBrowsePresets?: () => void;
  /** Names the Preset control, so a stepper step driven by `onBrowsePresets`
   *  can return focus to it -- which it has to do docked, where closing the
   *  step unmounts the panel the focus came from. */
  browsePresetsId?: string;
  /** Whether the preset browser this opens is showing. Makes the control a
   *  disclosure rather than an unlabelled jump. */
  presetsOpen?: boolean;
  stops?: ColorStop[];
  onStopsChange?: (stops: ColorStop[]) => void;
  /** Supplying either one gives the numeric body a Cancel/Apply footer. Omit
   *  both -- the default -- for a panel wired live to the map. */
  onApply?: (stops: ColorStop[]) => void;
  onCancel?: () => void;
  /** @deprecated Back is the stepper's job. Beside its parent there is nothing
   *  to go back to, and docked the stepper draws its own. */
  onBack?: () => void;
  onClose?: () => void;
  /**
   * Set false when something else already titles the panel -- a PanelStep,
   * which draws a header with the step's name and its own Close, and docked
   * draws the Back control too. Two headers with two Close buttons is what
   * nesting this inside a step otherwise gives you.
   */
  showHeader?: boolean;
}) {
  const [internalStops, setInternalStops] = React.useState(DEFAULT_STOPS);
  const stops = controlledStops ?? internalStops;
  const [selected, setSelected] = React.useState(2);

  const firstField = fields[0]?.name ?? "";
  const [internalField, setInternalField] = React.useState(
    metric ?? firstField,
  );
  const field = controlledField ?? internalField;
  const fieldType = fields.find((f) => f.name === field)?.type ?? "number";
  const isCategorical = fieldType === "string";

  const [internalOpacity, setInternalOpacity] = React.useState(100);
  const opacity = controlledOpacity ?? internalOpacity;
  const opacityLabelId = React.useId();

  const defaultMode = isCategorical ? "categories" : "continuous";
  const [internalMode, setInternalMode] = React.useState(defaultMode);
  // A mode from the other field type cannot apply, so fall back rather than
  // render a segmented control with nothing selected.
  const modeCandidate = controlledMode ?? internalMode;
  const modeItems = isCategorical
    ? [
        { value: "single", label: "Single" },
        { value: "categories", label: "Categories" },
      ]
    : [
        { value: "discrete", label: "Discrete" },
        { value: "continuous", label: "Continuous" },
      ];
  const mode = modeItems.some((m) => m.value === modeCandidate)
    ? modeCandidate
    : defaultMode;

  const shown = categories.slice(0, maxCategories);
  const total = totalCategories ?? categories.length;
  const ramp = presetColors ?? shown.map((c) => c.color);

  const setField = (next: string) => {
    if (controlledField === undefined) setInternalField(next);
    onFieldChange?.(next);
  };

  const setMode = (next: string) => {
    if (controlledMode === undefined) setInternalMode(next);
    onModeChange?.(next);
  };

  const setOpacity = (next: number) => {
    if (controlledOpacity === undefined) setInternalOpacity(next);
    onOpacityChange?.(next);
  };

  const setStops = (next: ColorStop[]) => {
    if (controlledStops === undefined) setInternalStops(next);
    onStopsChange?.(next);
  };

  const addStop = () => {
    const sorted = sortStops(stops);
    // Drop the new stop into the widest gap rather than always at the end —
    // appending at 100% collides with the stop that is almost always there.
    let gapStart = 0;
    let gapSize = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const size = sorted[i + 1]!.position - sorted[i]!.position;
      if (size > gapSize) {
        gapSize = size;
        gapStart = sorted[i]!.position;
      }
    }
    const position = gapSize > 0 ? Math.round(gapStart + gapSize / 2) : 50;
    const next = [...stops, { position, color: "#a6a6a6", opacity: 100 }];
    setStops(next);
    setSelected(next.length - 1);
  };

  const fieldLabels = Object.fromEntries(
    fields.map((f) => [f.name, f.label ?? COLOR_BY_METRICS[f.name] ?? f.name]),
  );

  /**
   * A category's colour, as a control.
   *
   * With `onCategoryStyleChange` this is the data hub's own picker, so a colour
   * or logo set here is the one that page shows too -- one editor, not two that
   * drift. Without it the swatch is a plain button that reports a click, which
   * is what a caller supplying its own picker wants.
   */
  const swatch = (color: string, label: string, value?: string) => {
    if (value !== undefined && onCategoryStyleChange) {
      return (
        <CategoryStylePicker
          value={label}
          style={categoryStyles?.[value] ?? { color }}
          logoZoom={logoZoom}
          onChange={(next) => onCategoryStyleChange(value, next)}
        />
      );
    }
    return (
      <button
        type="button"
        // Named, not just "Choose color". Nine identically labelled buttons is
        // what the product ships, and it leaves a screen reader user unable to
        // tell which value they are about to recolour.
        aria-label={`Choose color for ${label}`}
        onClick={
          value === undefined ? undefined : () => onCategorySelect?.(value)
        }
        className="size-5 shrink-0 rounded-sm border border-border/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        style={{ backgroundColor: color }}
      />
    );
  };

  return (
    <div
      data-slot="colorize-panel"
      data-field-type={fieldType}
      className={cn(
        "flex w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
        className,
      )}
      {...props}
    >
      {showHeader ? (
        <>
          <header className="flex items-center gap-2 px-3 py-2.5">
            {onBack ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Back"
                onClick={onBack}
              >
                <ChevronLeft />
              </Button>
            ) : null}
            {/* The layer's name is not repeated here: this panel is opened
                from that layer's own card, and in a stepper the step's header
                already carries it. It stays as the panel's accessible name. */}
            <span className="min-w-0 truncate text-sm font-semibold">
              Colorize
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Close"
              className="ml-auto"
              onClick={onClose}
            >
              <X />
            </Button>
          </header>
          <Separator />
        </>
      ) : null}

      <div className="space-y-2 p-3">
        <Row label={<Label htmlFor="color-by">Color by</Label>}>
          <Select
            value={field}
            // Base UI allows clearing a Select, which this one never offers.
            onValueChange={(next) => next !== null && setField(next)}
          >
            {/* Borderless: a field box the width of the panel for a value of
                one word is most of what made the old layout tall. */}
            <SelectTrigger
              id="color-by"
              className="h-7 w-auto min-w-0 justify-end gap-1 border-0 bg-transparent px-1 shadow-none hover:underline"
            >
              {/* Base UI renders the raw value unless given a mapping. */}
              <SelectValue>{(v: string) => fieldLabels[v] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {fieldLabels[f.name]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label={<Label>Mode</Label>}>
          <SegmentedControl
            aria-label="Colour mode"
            size="sm"
            value={mode}
            onValueChange={setMode}
            items={modeItems}
          />
        </Row>

        <Row
          label={
            <div className="flex min-w-0 items-center gap-1.5">
              <Label>Preset</Label>
              {!isCategorical && presetCustom ? (
                <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                  Custom
                </Badge>
              ) : null}
            </div>
          }
        >
          <button
            type="button"
            id={browsePresetsId}
            aria-label="Preset"
            aria-haspopup={onBrowsePresets ? "dialog" : undefined}
            aria-expanded={onBrowsePresets ? Boolean(presetsOpen) : undefined}
            onClick={onBrowsePresets}
            className="flex h-7 min-w-0 items-center gap-2 rounded-md px-1 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {isCategorical ? (
              <PaletteStrip colors={ramp} className="w-16 shrink-0" />
            ) : (
              <span
                aria-hidden
                className="h-5 w-16 shrink-0 rounded-sm border border-border"
                style={{ background: stopsToGradient(stops) }}
              />
            )}
            <span className="truncate">{presetName}</span>
            {/* The chevron alone, with no "Browse" beside it: the row is the
                control, and its accessible name already says what it opens. */}
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </Row>

        {isCategorical ? (
          <Row
            label={
              /* Base UI puts the real <input> inside Slider.Thumb, so neither
                 htmlFor nor aria-label on the root reaches it. Only
                 aria-labelledby at the visible label does. */
              <Label id={opacityLabelId}>Opacity</Label>
            }
          >
            <Slider
              aria-labelledby={opacityLabelId}
              value={[opacity]}
              onValueChange={(v) =>
                setOpacity(Array.isArray(v) ? (v[0] ?? 0) : v)
              }
              max={100}
              step={1}
              className="min-w-0 flex-1"
            />
            <Input
              aria-label="Opacity percentage"
              value={`${opacity}%`}
              readOnly
              className="h-7 w-14 shrink-0 px-1 text-center text-xs"
            />
          </Row>
        ) : null}
      </div>

      {isCategorical ? (
        <>
          <Separator />
          <div className="space-y-2 p-3">
            {mode === "single" ? (
              <div className="flex h-8 items-center gap-2">
                {swatch(singleColor, "all features")}
                <span className="truncate text-sm">All features</span>
              </div>
            ) : (
              <>
                {total > shown.length ? (
                  <p className="text-xs text-muted-foreground">
                    showing top {shown.length} of {total} values
                  </p>
                ) : null}
                {shown.map((c) => (
                  <div key={c.value} className="flex h-8 items-center gap-2">
                    {swatch(c.color, c.label ?? c.value, c.value)}
                    <span
                      className="truncate text-sm"
                      title={c.label ?? c.value}
                    >
                      {c.label ?? c.value}
                    </span>
                  </div>
                ))}
                {total > shown.length ? (
                  <div className="flex h-8 items-center gap-2">
                    {swatch(otherColor, OTHER, OTHER)}
                    <span className="truncate text-sm">{OTHER}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <Separator />
          <div className="space-y-2 p-3">
            <Row label={<Label>Classification</Label>}>
              <Select defaultValue="equal-intervals">
                <SelectTrigger
                  className="h-7 w-auto min-w-0 justify-end gap-1 border-0 bg-transparent px-1 text-right shadow-none hover:underline"
                  aria-label="Classification method"
                >
                  <SelectValue>
                    {(v: string) => CLASSIFICATION_LABELS[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATION_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Number of classes"
                defaultValue="4"
                className="h-7 w-10 shrink-0 px-1 text-center text-xs"
              />
            </Row>
            <ColorStopSlider
              stops={stops}
              selectedIndex={selected}
              onSelect={setSelected}
              onChange={setStops}
            />
          </div>
          <Separator />

          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <Label>Stops</Label>
              <Button
                variant="ghost"
                size="xs"
                className="gap-1"
                onClick={addStop}
              >
                <Plus className="size-3.5" />
                Add stop
              </Button>
            </div>
            <ColorStopList
              stops={stops}
              selectedIndex={selected}
              onSelect={setSelected}
              onChange={setStops}
            />
          </div>
          {/* Only when the caller asked to gate the change. Wired live -- the
              map restyling as you drag a stop -- Apply has nothing to apply
              and Cancel nothing to revert, and the categorical branch has
              never had a footer, so rendering one here made the two bodies
              disagree about whether an edit was already in effect. */}
          {onApply || onCancel ? (
            <>
              <Separator />
              <footer className="flex items-center justify-end gap-2 p-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={() => onApply?.(stops)}>Apply</Button>
              </footer>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
