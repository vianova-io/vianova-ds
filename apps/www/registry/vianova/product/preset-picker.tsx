"use client";

import * as React from "react";
import { ArrowLeftRight, Eye } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Toggle } from "@/registry/vianova/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/vianova/ui/tooltip";
import { cn } from "@/registry/vianova/lib/utils";

export type ColorPalette = {
  name: string;
  /** Groups palettes in the family selector, e.g. "Categorical". */
  family: string;
  colors: string[];
  /** Survives the common forms of colour vision deficiency. */
  colorBlindSafe?: boolean;
};

/**
 * A palette as one bar of equal segments.
 *
 * The bar is a fixed width and the segments divide it, rather than each swatch
 * being a fixed size: palettes have different lengths, and a row of 5 swatches
 * beside a row of 8 reads as "shorter palette" rather than "different palette".
 * Equal bars make them comparable at a glance.
 */
export function PaletteStrip({
  colors,
  reversed = false,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  colors: string[];
  reversed?: boolean;
}) {
  const ordered = reversed ? [...colors].reverse() : colors;
  return (
    <span
      aria-hidden
      data-slot="palette-strip"
      className={cn(
        "flex h-5 overflow-hidden rounded-sm border border-border",
        className,
      )}
      {...props}
    >
      {ordered.map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

/**
 * Browses the colour palettes a categorical layer can use.
 *
 * A listbox rather than a menu: the palettes are a set of values one of which
 * is selected, and the selection stays visible while you compare the others.
 *
 * Every palette carries its name as text. A row that distinguished itself only
 * by colour would be unusable by exactly the people the colour-blind-safe
 * filter exists for.
 */
export function PresetPicker({
  palettes,
  families,
  family: controlledFamily,
  onFamilyChange,
  value: controlledValue,
  onValueChange,
  colorBlindSafeOnly: controlledSafeOnly,
  onColorBlindSafeOnlyChange,
  reversed: controlledReversed,
  onReversedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  palettes: ColorPalette[];
  /** Defaults to the families present in `palettes`, in first-seen order. */
  families?: string[];
  family?: string;
  onFamilyChange?: (family: string) => void;
  /** Selected palette name. */
  value?: string;
  onValueChange?: (name: string) => void;
  colorBlindSafeOnly?: boolean;
  onColorBlindSafeOnlyChange?: (only: boolean) => void;
  reversed?: boolean;
  onReversedChange?: (reversed: boolean) => void;
}) {
  const allFamilies = React.useMemo(() => {
    if (families) return families;
    const seen: string[] = [];
    for (const p of palettes) if (!seen.includes(p.family)) seen.push(p.family);
    return seen;
  }, [families, palettes]);

  const [internalFamily, setInternalFamily] = React.useState(
    allFamilies[0] ?? "",
  );
  const family = controlledFamily ?? internalFamily;

  const [internalValue, setInternalValue] = React.useState(
    palettes[0]?.name ?? "",
  );
  const value = controlledValue ?? internalValue;

  const [internalSafeOnly, setInternalSafeOnly] = React.useState(false);
  const safeOnly = controlledSafeOnly ?? internalSafeOnly;

  const [internalReversed, setInternalReversed] = React.useState(false);
  const reversed = controlledReversed ?? internalReversed;

  const setFamily = (next: string) => {
    if (controlledFamily === undefined) setInternalFamily(next);
    onFamilyChange?.(next);
  };
  const setValue = (next: string) => {
    if (controlledValue === undefined) setInternalValue(next);
    onValueChange?.(next);
  };
  const setSafeOnly = (next: boolean) => {
    if (controlledSafeOnly === undefined) setInternalSafeOnly(next);
    onColorBlindSafeOnlyChange?.(next);
  };
  const setReversed = (next: boolean) => {
    if (controlledReversed === undefined) setInternalReversed(next);
    onReversedChange?.(next);
  };

  const visible = palettes.filter(
    (p) => p.family === family && (!safeOnly || p.colorBlindSafe),
  );

  const familyLabels = Object.fromEntries(allFamilies.map((f) => [f, f]));

  return (
    <div
      data-slot="preset-picker"
      className={cn("flex min-h-0 flex-col gap-2 p-2", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Select
          value={family}
          onValueChange={(next) => next !== null && setFamily(next)}
        >
          <SelectTrigger aria-label="Family" className="min-w-0 flex-1">
            <SelectValue>{(v: string) => familyLabels[v] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allFamilies.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                aria-label="Color-blind-safe only"
                pressed={safeOnly}
                onPressedChange={setSafeOnly}
                className="size-8 shrink-0"
              >
                <Eye />
              </Toggle>
            }
          />
          <TooltipContent>Color-blind-safe only</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                aria-label="Reverse"
                pressed={reversed}
                onPressedChange={setReversed}
                className="size-8 shrink-0"
              >
                <ArrowLeftRight />
              </Toggle>
            }
          />
          <TooltipContent>Reverse</TooltipContent>
        </Tooltip>
      </div>

      <div
        role="listbox"
        aria-label="Preset"
        // p-1, not p-0: the rows carry a 3px focus ring and this is the
        // scrollport, so without the padding the ring is cut off on all four
        // sides -- left and right by the content box, top and bottom by the
        // scroll edge on the first and last row.
        // scroll-p-1 on top of that: focusing a row scrolls it into view, and
        // the browser stops with it flush against the scrollport, which clips
        // the ring again on whichever edge it arrived at.
        className="min-h-0 flex-1 scroll-p-1 space-y-1 overflow-y-auto p-1"
      >
        {visible.map((p) => (
          <button
            key={p.name}
            type="button"
            role="option"
            aria-selected={p.name === value}
            onClick={() => setValue(p.name)}
            className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm transition-colors hover:bg-accent aria-selected:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="w-24 shrink-0 truncate text-left">{p.name}</span>
            <PaletteStrip colors={p.colors} reversed={reversed} className="flex-1" />
          </button>
        ))}
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No palettes in this family are color-blind-safe.
          </p>
        ) : null}
      </div>
    </div>
  );
}
