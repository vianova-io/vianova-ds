"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { CLASSIFICATION_METHODS } from "@/registry/vianova/product/colorize-panel";
import { cn } from "@/registry/vianova/lib/utils";

const CLASSIFICATION_LABELS: Record<string, string> = Object.fromEntries(
  CLASSIFICATION_METHODS.map((m) => [m.value, m.label]),
);

/**
 * What a layer can be sized by. Only numbers: a size is a quantity, so a
 * string column has nothing to scale.
 */
export type SizeField = {
  name: string;
  /** Shown instead of `name`, which is usually a raw column name. */
  label?: string;
};

/** The geometry on the layer, which decides which controls mean anything. */
export type SizeGeometry = "point" | "line" | "both";

/*
 * The bounds the sliders move between.
 *
 * Not the product's own limits, which are whatever MapLibre accepts -- these
 * are the range a slider can be dragged across and still land somewhere
 * useful. A point radius past ~24px is one blob covering its neighbours, and
 * a 0 would hide the layer while looking like a setting rather than a
 * disappearance, so the floor is the smallest dot that still reads as one.
 */
const RADIUS_RANGE = { min: 1, max: 24, step: 0.5 };
const WIDTH_RANGE = { min: 0.5, max: 12, step: 0.5 };

/*
 * What the map already drew, before any of this was adjustable.
 *
 * Not a fresh opinion about a good size: these ARE the hardcoded values the
 * layers carried, so mounting the panel changes nothing until someone moves a
 * slider. A default of 5 here would have quietly shrunk every categorical
 * layer by nearly half the first time this shipped, which is the opposite of
 * the complaint it was built for.
 */
export const SIZE_DEFAULTS = {
  radius: 9,
  width: 1.5,
  /** Where a graduated scale starts and ends, in the same px as above. */
  radiusRange: [3, 14] as [number, number],
  widthRange: [1, 8] as [number, number],
};

/**
 * One setting: its name on the left, its control on the right.
 *
 * The same two-column grammar ColorizePanel uses, and deliberately the same
 * `5.25rem` first column: the two panels sit in one cascade, often one above
 * the other, and a label column that disagreed by a few pixels would read as
 * a misalignment rather than as two panels.
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

/**
 * A slider and the number it is showing, as one row.
 *
 * The number is an Input rather than text because typing 7.5 is the only way
 * to hit a half-pixel on a track 150px wide, and because someone matching two
 * layers needs to enter the value they read off the other one.
 */
function SizeSlider({
  label,
  value,
  onValueChange,
  range,
}: {
  label: string;
  value: number;
  onValueChange: (next: number) => void;
  range: { min: number; max: number; step: number };
}) {
  // Base UI puts the real <input> inside Slider.Thumb, so neither htmlFor nor
  // aria-label on the root reaches it. Only aria-labelledby at the visible
  // label does -- the same reason ColorizePanel labels Opacity this way.
  const labelId = React.useId();
  return (
    <Row label={<Label id={labelId}>{label}</Label>}>
      <Slider
        aria-labelledby={labelId}
        value={[value]}
        onValueChange={(v) =>
          onValueChange(Array.isArray(v) ? (v[0] ?? range.min) : v)
        }
        min={range.min}
        max={range.max}
        step={range.step}
        className="min-w-0 flex-1"
      />
      <Input
        aria-label={`${label} in pixels`}
        value={`${value}px`}
        readOnly
        className="h-7 w-14 shrink-0 px-1 text-center text-xs"
      />
    </Row>
  );
}

/**
 * The scale, drawn at the size it will draw.
 *
 * A range of 3 to 14 is two numbers; five circles stepping between them is
 * the answer to "will that be big enough", which is the question that brought
 * this panel into being. Points grow as discs, lines thicken as bars, because
 * a line previewed as a circle tells you nothing about a road.
 */
function SizePreview({
  kind,
  from,
  to,
}: {
  kind: "point" | "line";
  from: number;
  to: number;
}) {
  const steps = 5;
  const sizes = Array.from({ length: steps }, (_, i) =>
    Number((from + ((to - from) * i) / (steps - 1)).toFixed(1)),
  );
  return (
    <div
      aria-hidden
      className="flex h-10 items-center justify-between gap-1 rounded-md border border-border bg-muted/30 px-3"
    >
      {sizes.map((size, i) =>
        kind === "point" ? (
          <span
            key={i}
            className="shrink-0 rounded-full bg-primary"
            style={{ width: size * 2, height: size * 2 }}
          />
        ) : (
          <span
            key={i}
            className="flex-1 rounded-full bg-primary"
            style={{ height: size }}
          />
        ),
      )}
    </div>
  );
}

/**
 * Size configuration for a map layer.
 *
 * The gap this fills: a layer's radius and width were fixed in the layer
 * hooks, so a dataset of traffic counts drew the same 3px dot for a street
 * with forty vehicles and one with four thousand. Colour has carried the data
 * on its own, and colour alone cannot say "more" to someone scanning a map at
 * a glance.
 *
 * Two modes, and the split is the same one ColorizePanel makes:
 *
 * - **Single** is one size for the whole layer. The fix for a layer that is
 *   merely too small to see, which is most of them.
 * - **By value** scales each feature by a number on it, the way colour already
 *   graduates. Standard GIS symbology -- the people asking for this arrive
 *   from QGIS, where it is where they look first.
 *
 * `geometry` decides which controls exist at all. Showing a line width on a
 * layer of points is the sort of row that makes a panel feel like a form
 * rather than a tool.
 */
export function SizePanel({
  geometry = "point",
  fields = [],
  mode: controlledMode,
  onModeChange,
  field: controlledField,
  onFieldChange,
  radius: controlledRadius,
  onRadiusChange,
  width: controlledWidth,
  onWidthChange,
  radiusRange: controlledRadiusRange,
  onRadiusRangeChange,
  widthRange: controlledWidthRange,
  onWidthRangeChange,
  onBack,
  onClose,
  showHeader = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  geometry?: SizeGeometry;
  /** Numeric fields the layer can be sized by. */
  fields?: SizeField[];
  mode?: "single" | "by-value";
  onModeChange?: (mode: "single" | "by-value") => void;
  field?: string;
  onFieldChange?: (field: string) => void;
  /** One radius for the whole layer, in px. */
  radius?: number;
  onRadiusChange?: (radius: number) => void;
  /** One line width for the whole layer, in px. */
  width?: number;
  onWidthChange?: (width: number) => void;
  /** Smallest and largest radius a graduated scale reaches. */
  radiusRange?: [number, number];
  onRadiusRangeChange?: (range: [number, number]) => void;
  widthRange?: [number, number];
  onWidthRangeChange?: (range: [number, number]) => void;
  onBack?: () => void;
  onClose?: () => void;
  /** Set false when something else already titles the panel -- a PanelStep,
   *  or a section inside another panel. */
  showHeader?: boolean;
}) {
  const [internalMode, setInternalMode] = React.useState<"single" | "by-value">(
    "single",
  );
  /*
   * No field to size by means no choice to offer.
   *
   * A layer coloured by a category carries a category per feature and no
   * measure, so "by value" would be a mode with an empty field list behind
   * it. The panel drops the switch instead of presenting a dead end -- and
   * forces `mode`, so a caller holding "by-value" in its own state cannot
   * leave the body in a mode the data cannot support.
   */
  const canGraduate = fields.length > 0;
  const mode = canGraduate ? (controlledMode ?? internalMode) : "single";

  const [internalField, setInternalField] = React.useState(
    fields[0]?.name ?? "",
  );
  const field = controlledField ?? internalField;

  const [internalRadius, setInternalRadius] = React.useState(
    SIZE_DEFAULTS.radius,
  );
  const radius = controlledRadius ?? internalRadius;

  const [internalWidth, setInternalWidth] = React.useState(SIZE_DEFAULTS.width);
  const width = controlledWidth ?? internalWidth;

  const [internalRadiusRange, setInternalRadiusRange] = React.useState(
    SIZE_DEFAULTS.radiusRange,
  );
  const radiusRange = controlledRadiusRange ?? internalRadiusRange;

  const [internalWidthRange, setInternalWidthRange] = React.useState(
    SIZE_DEFAULTS.widthRange,
  );
  const widthRange = controlledWidthRange ?? internalWidthRange;

  const hasPoints = geometry === "point" || geometry === "both";
  const hasLines = geometry === "line" || geometry === "both";

  const set = <T,>(
    controlled: T | undefined,
    setInternal: (next: T) => void,
    onChange: ((next: T) => void) | undefined,
  ) => {
    return (next: T) => {
      if (controlled === undefined) setInternal(next);
      onChange?.(next);
    };
  };

  const setMode = set(controlledMode, setInternalMode, onModeChange);
  const setField = set(controlledField, setInternalField, onFieldChange);
  const setRadius = set(controlledRadius, setInternalRadius, onRadiusChange);
  const setWidth = set(controlledWidth, setInternalWidth, onWidthChange);
  const setRadiusRange = set(
    controlledRadiusRange,
    setInternalRadiusRange,
    onRadiusRangeChange,
  );
  const setWidthRange = set(
    controlledWidthRange,
    setInternalWidthRange,
    onWidthRangeChange,
  );

  const fieldLabels = Object.fromEntries(
    fields.map((f) => [f.name, f.label ?? f.name]),
  );

  /** The two ends of a graduated scale, as a pair of numbers on one row. */
  const rangeRow = (
    label: string,
    range: [number, number],
    bounds: { min: number; max: number; step: number },
    onChange: (next: [number, number]) => void,
  ) => (
    <Row label={<Label>{label}</Label>}>
      <Input
        aria-label={`Smallest ${label.toLowerCase()} in pixels`}
        type="number"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={range[0]}
        onChange={(e) => onChange([Number(e.target.value), range[1]])}
        className="h-7 w-16 shrink-0 px-1 text-center text-xs"
      />
      {/* An en dash, not "to": the row is read as a range at a glance and the
          word would be the widest thing on it. */}
      <span aria-hidden className="text-xs text-muted-foreground">
        –
      </span>
      <Input
        aria-label={`Largest ${label.toLowerCase()} in pixels`}
        type="number"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={range[1]}
        onChange={(e) => onChange([range[0], Number(e.target.value)])}
        className="h-7 w-16 shrink-0 px-1 text-center text-xs"
      />
    </Row>
  );

  return (
    <div
      data-slot="size-panel"
      data-mode={mode}
      data-geometry={geometry}
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
            <span className="min-w-0 truncate text-sm font-semibold">Size</span>
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

      {canGraduate ? (
        <>
          <div className="space-y-2 p-3">
            <Row label={<Label>Mode</Label>}>
              <SegmentedControl
                aria-label="Size mode"
                size="sm"
                value={mode}
                onValueChange={(next) => setMode(next as "single" | "by-value")}
                items={[
                  { value: "single", label: "Single" },
                  { value: "by-value", label: "By value" },
                ]}
              />
            </Row>

            {mode === "by-value" ? (
              <Row label={<Label htmlFor="size-by">Size by</Label>}>
                <Select
                  value={field}
                  onValueChange={(next) => next !== null && setField(next)}
                >
                  <SelectTrigger
                    id="size-by"
                    className="h-7 w-auto min-w-0 justify-end gap-1 border-0 bg-transparent px-1 shadow-none hover:underline"
                  >
                    <SelectValue>
                      {(v: string) => fieldLabels[v] ?? v}
                    </SelectValue>
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
            ) : null}
          </div>

          <Separator />
        </>
      ) : null}

      {mode === "single" ? (
        <div className="space-y-2 p-3">
          {hasPoints ? (
            <SizeSlider
              label="Point radius"
              value={radius}
              onValueChange={setRadius}
              range={RADIUS_RANGE}
            />
          ) : null}
          {hasLines ? (
            <SizeSlider
              label="Line width"
              value={width}
              onValueChange={setWidth}
              range={WIDTH_RANGE}
            />
          ) : null}
        </div>
      ) : (
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
              defaultValue="5"
              className="h-7 w-10 shrink-0 px-1 text-center text-xs"
            />
          </Row>

          {hasPoints ? (
            <>
              {rangeRow(
                "Point radius",
                radiusRange,
                RADIUS_RANGE,
                setRadiusRange,
              )}
              <SizePreview
                kind="point"
                from={radiusRange[0]}
                to={radiusRange[1]}
              />
            </>
          ) : null}

          {hasLines ? (
            <>
              {rangeRow("Line width", widthRange, WIDTH_RANGE, setWidthRange)}
              <SizePreview
                kind="line"
                from={widthRange[0]}
                to={widthRange[1]}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * The row inside a layer card's Visualization section that opens the panel.
 *
 * Lives here rather than in `DataLayerCard` because the card already has a
 * `children` slot for "extra controls for the active visualisation", and size
 * is exactly that -- so every caller passes this through and the card itself
 * needs no new prop, and no new visual baseline.
 *
 * Full width rather than the panel's label grid: it sits under
 * VisualizationPicker, where the two-column grammar of a settings panel has
 * nothing to align to.
 */
export function SizeTriggerRow({
  summary,
  id,
  open,
  onClick,
  layerName,
  className,
}: {
  /** What the size is set to now -- see `sizeSummary`. */
  summary: string;
  id?: string;
  open?: boolean;
  onClick?: () => void;
  /** Disambiguates the control when several cards are on screen. */
  layerName?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      data-slot="size-trigger"
      aria-label={layerName ? `Size ${layerName}` : "Size"}
      aria-haspopup="dialog"
      aria-expanded={Boolean(open)}
      onClick={onClick}
      className={cn(
        // scroll-my-1 is not decoration: the ring paints 3px OUTSIDE the
        // border box, and this row lives in a panel that scrolls inside an
        // overflow-hidden shell. Focusing it scrolls it flush to an edge and
        // the shell slices the ring off -- which e2e/focus-ring.spec.ts calls
        // a real defect, since the ring is the keyboard user's only cue.
        "flex h-8 w-full scroll-my-1 items-center gap-2 rounded-md px-1 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <span className="shrink-0 text-muted-foreground">Size</span>
      <span className="ml-auto truncate">{summary}</span>
      {/* The chevron alone: the row IS the control, and its accessible name
          already says what it opens -- the same reasoning as Colorize's
          Preset row. */}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
