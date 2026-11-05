"use client";

import * as React from "react";

import { asset } from "@/lib/asset";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The harness for the two layer-size controls: pick a width, pick a control,
 * use it.
 *
 * One iframe at a time rather than two side by side. Each frame is a whole
 * map workspace -- MapLibre, a style, 1.4k flows and two panels -- and the
 * question is whether one number is enough to size a layer with, which is a
 * question you answer by dragging something, not by looking at two
 * screenshots.
 *
 * An iframe and not a div, because the panel these rows live in is a docked
 * column from lg up and a bottom tray below it, and that resolves against the
 * VIEWPORT. A 340px div on this page would render the docked branch at every
 * width and never show the tray, which is where the row is tightest.
 *
 * TEMPORARY. Deleted with app/(bare)/mockups/map-size/ when a control is
 * chosen.
 */

const WIDTHS = [
  { id: 390, label: "Phone", note: "390 — the panel is a bottom tray" },
  { id: 900, label: "md", note: "900 — still a tray, with room beside it" },
  { id: 1024, label: "lg", note: "1024 — docked, and at its narrowest" },
  { id: 1500, label: "xl", note: "1500 — docked, with both panels open" },
] as const;

const VARIANTS = [
  {
    id: "shipped",
    label: "Prod",
    note: "One row in the card, under Visualization. It multiplies whatever the layer already draws, so 1 is the map as it ships and the Zürich flows stay graduated by volume at every setting. Absent on a grid or a heatmap, which paint nothing it can set.",
  },
  {
    id: "panel",
    label: "UX ideation",
    note: "Size as its own step beside Colorize: Single and By value, a field to size by, a classification, and a preview of the scale drawn at the size it will draw.",
  },
] as const;

type Variant = (typeof VARIANTS)[number]["id"];

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="border-border bg-card flex items-center gap-1 rounded-lg border p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              value === option.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MapSizeHarness() {
  const [width, setWidth] = React.useState<number>(1500);
  const [variant, setVariant] = React.useState<Variant>("shipped");

  const height = width < 768 ? 844 : 780;
  const src = asset(`/mockups/map-size/${variant}/`);
  const active = VARIANTS.find((v) => v.id === variant)!;
  const activeWidth = WIDTHS.find((w) => w.id === width)!;

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-semibold">Map workspace: layer size</h1>
        <p className="text-muted-foreground text-sm">
          The same block, twice. Neither has shipped:{" "}
          <strong>UX ideation</strong> is what was built for Katell&rsquo;s
          request — one size for the layer, or a size graduated by a value —
          and <strong>Prod</strong> is the downgrade under consideration, a
          single slider and nothing else. The question is whether one number is
          enough. Everything is live: switch the visualisation, open a feed,
          drag the slider and watch the map.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Segmented
          label="Control"
          options={VARIANTS}
          value={variant}
          onChange={setVariant}
        />
        <Segmented
          label="Width"
          options={WIDTHS}
          value={width}
          onChange={setWidth}
        />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-sm underline underline-offset-4"
        >
          Open at this window&rsquo;s own width
        </a>
      </div>

      <p className="text-muted-foreground max-w-3xl text-sm">
        <span className="text-foreground font-medium">{active.label}:</span>{" "}
        {active.note}
      </p>

      {/* Not scaled, for the reason the top-bar harness gives: a 28px row
          judged at 0.8 is a 22px row, and the whole question is whether this
          control is comfortable to use. A width wider than this page scrolls
          sideways instead of shrinking. */}
      <div className="overflow-x-auto pb-4">
        <figure className="w-fit space-y-2">
          <iframe
            // Remount on either change: a reused frame keeps the previous
            // control's slider position and the map camera, which reads as
            // the new control having inherited them.
            key={`${variant}-${width}`}
            src={src}
            title={`${active.label} at ${width}px`}
            width={width}
            height={height}
            className="border-border bg-background block rounded-xl border shadow-sm"
          />
          <figcaption className="text-muted-foreground font-mono text-xs">
            {activeWidth.note}
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
