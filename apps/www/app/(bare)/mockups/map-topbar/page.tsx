"use client";

import * as React from "react";

import { asset } from "@/lib/asset";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The harness for the two top-bar arrangements: pick a width, pick an
 * arrangement, use it.
 *
 * One iframe at a time rather than a contact sheet of six. Each frame is a
 * whole map workspace -- MapLibre, a style, 1.4k flows and two panels -- and
 * six of those mounted at once makes a page nobody can judge a 36px button in.
 * Switching remounts, which is also the honest way to compare: the question is
 * where a control is at a given width, not how two of them animate side by
 * side.
 *
 * An iframe and not a div, because every `md:` and `lg:` in the bar resolves
 * against the viewport. A 390px div on this page would render the desktop
 * branch of every control inside it.
 *
 * TEMPORARY. Deleted with app/(bare)/mockups/map-topbar/ when an arrangement
 * is chosen.
 */

const WIDTHS = [
  { id: 390, label: "Phone", note: "390 — the bar's tightest case" },
  { id: 900, label: "md", note: "900 — field and tools appear" },
  { id: 1024, label: "lg", note: "1024 — both panels, least room for them" },
  { id: 1500, label: "xl", note: "1500 — the export label fits" },
] as const;

const VARIANTS = [
  {
    id: "shipped",
    label: "Now",
    note: "Layers beside the field at xl, far right below it. Basemap in three different places.",
  },
  {
    id: "edges",
    label: "Proposed",
    note: "Layers at the left edge and Charts at the right at every width. Basemap in the corner stack with zoom.",
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

export default function MapTopBarHarness() {
  const [width, setWidth] = React.useState<number>(1500);
  const [variant, setVariant] = React.useState<Variant>("edges");

  const height = width < 768 ? 844 : 780;
  const src = asset(`/mockups/map-topbar/${variant}/`);
  const active = VARIANTS.find((v) => v.id === variant)!;
  const activeWidth = WIDTHS.find((w) => w.id === width)!;

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="text-2xl font-semibold">Map workspace: top bar</h1>
        <p className="text-muted-foreground text-sm">
          The same block, twice. <strong>Now</strong> is what ships;{" "}
          <strong>Proposed</strong> pins the two panel disclosures to the edges
          their panels dock to, keeps the middle third for the controls that act
          on the map, and moves the basemap out of the bar into the corner stack
          with zoom. Everything is live — toggle the panels, draw a zone, change
          the basemap.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Segmented
          label="Arrangement"
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

      {/* Not scaled. A 36px control judged at 0.8 is a 29px control, and the
          whole question here is where the thumb goes -- so a width wider than
          this page scrolls sideways instead of shrinking. */}
      <div className="overflow-x-auto pb-4">
        <figure className="w-fit space-y-2">
          <iframe
            // Remount on either change: a reused frame keeps the previous
            // arrangement's open panels and its map camera, which reads as the
            // new arrangement having inherited them.
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
