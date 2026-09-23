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
import { ColorStopList } from "@/registry/vianova/product/color-stop-list";
import {
  ColorStopSlider,
  sortStops,
  stopsToGradient,
  type ColorStop,
} from "@/registry/vianova/product/color-stop-slider";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
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

/**
 * Colour configuration for a map layer: which metric drives colour, discrete
 * vs continuous, the preset ramp, the classification method, and the stops.
 *
 * Stops are held in one place and shared by the slider and the list, so
 * dragging a handle and typing a percentage are the same edit. Selection is
 * shared too — that is what makes a ramp with many stops workable.
 */
export function ColorizePanel({
  layerName = "Micromobility",
  metric,
  stops: controlledStops,
  onStopsChange,
  onApply,
  onCancel,
  onBack,
  onClose,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  layerName?: string;
  metric?: string;
  stops?: ColorStop[];
  onStopsChange?: (stops: ColorStop[]) => void;
  onApply?: (stops: ColorStop[]) => void;
  onCancel?: () => void;
  onBack?: () => void;
  onClose?: () => void;
}) {
  const [internalStops, setInternalStops] = React.useState(DEFAULT_STOPS);
  const stops = controlledStops ?? internalStops;
  const [selected, setSelected] = React.useState(2);

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

  return (
    <div
      data-slot="colorize-panel"
      className={cn(
        "flex w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
        className,
      )}
      {...props}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <Button variant="ghost" size="icon-xs" aria-label="Back" onClick={onBack}>
          <ChevronLeft />
        </Button>
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold">Colorize</span>
          <span className="text-muted-foreground"> · {layerName}</span>
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

      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="color-by">Color by</Label>
          <Select defaultValue={metric ?? "vehicle-count"}>
            <SelectTrigger id="color-by" className="w-full">
              {/* Base UI renders the raw value unless given a mapping. */}
              <SelectValue>{(v: string) => COLOR_BY_METRICS[v] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(COLOR_BY_METRICS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Mode</Label>
          <SegmentedControl
            aria-label="Colour mode"
            defaultValue="continuous"
            items={[
              { value: "discrete", label: "Discrete" },
              { value: "continuous", label: "Continuous" },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Preset</Label>
            <Badge variant="secondary">Custom</Badge>
          </div>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-3 rounded-md border border-input px-2 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="h-5 w-16 shrink-0 rounded-sm border border-border"
              style={{ background: stopsToGradient(stops) }}
            />
            <span className="truncate">Greys</span>
            <span className="ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground">
              Browse
              <ChevronRight className="size-3.5" />
            </span>
          </button>
        </div>
      </div>
      <Separator />

      <div className="space-y-3 p-3">
        <Label>Classification</Label>
        <div className="flex items-center gap-2">
          <Select defaultValue="equal-intervals">
            <SelectTrigger className="min-w-0 flex-1" aria-label="Classification method">
              <SelectValue>{(v: string) => CLASSIFICATION_LABELS[v] ?? v}</SelectValue>
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
            defaultValue="4 classes"
            className="w-28 shrink-0 text-center"
          />
        </div>
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
          <Button variant="ghost" size="xs" className="gap-1" onClick={addStop}>
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
      <Separator />

      <footer className="flex items-center justify-end gap-2 p-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onApply?.(stops)}>Apply</Button>
      </footer>
    </div>
  );
}
