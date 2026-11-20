"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { PERIODS, fmtDelta } from "./data";

/**
 * The shared half of "best fit per chart type".
 *
 * Eight chart types get eight different mechanics, which is the right call --
 * a ghost line and a wipe-reveal are not interchangeable -- but it is only
 * coherent if the things that CAN be constant are. These are those things:
 * one colour rule, one legend, one delta, one set of words.
 *
 * ## Why "previous" is not a second colour
 *
 * The tempting move is to give the previous period the next categorical hue.
 * It is wrong: a second hue says "a different thing", and the previous period
 * is the SAME measure at a different time. Read as a category, a comparison
 * chart with three operators and two periods becomes six colours and no
 * hierarchy.
 *
 * So previous is the same hue, made recessive -- lower opacity, and dashed
 * wherever a stroke exists. That reads as "this one, earlier", and it keeps
 * the categorical palette free to mean what it means everywhere else.
 */
export const CURRENT = "var(--chart-categorical-1)";
export const PREVIOUS_OPACITY = 0.38;
export const PREVIOUS_DASH = "4 3";

/**
 * Delta is deliberately NOT green-up / red-down.
 *
 * More trips is good; more collisions is not, and this component cannot know
 * which it is looking at. The status palette is reserved for things that
 * genuinely have a good and a bad state, and spending it on an arithmetic
 * sign would both mislead here and devalue it where it means something. So:
 * a neutral chip, an arrow for direction, and the number does the talking.
 */
export function DeltaChip({
  value,
  className,
}: {
  /** Fractional change, or null when there is no previous value. */
  value: number | null;
  className?: string;
}) {
  if (value === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <Minus className="size-3" aria-hidden />
        No previous
      </span>
    );
  }

  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {fmtDelta(value)}
    </span>
  );
}

/** One legend for every treatment, so the two periods are named the same way. */
export function CompareLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0.5 w-4 rounded-full"
          style={{ background: CURRENT }}
        />
        {PERIODS.current.label}
        <span className="opacity-70">{PERIODS.current.range}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: CURRENT, opacity: PREVIOUS_OPACITY + 0.3 }}
        />
        {PERIODS.previous.label}
        <span className="opacity-70">{PERIODS.previous.range}</span>
      </span>
    </div>
  );
}

/**
 * The card every treatment sits in.
 *
 * Not `ChartCard` from the registry: that one is sized for a slot inside a
 * floating panel and sits on `background/40`, which disappears on this page.
 * The mockup needs a plain, legible box with room for a note underneath --
 * the note being half the deliverable, since the argument about each
 * treatment is what you are meant to be reading.
 */
export function TreatmentCard({
  title,
  kind,
  note,
  control,
  children,
}: {
  title: string;
  kind: string;
  note: string;
  control?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="font-mono text-[11px] text-muted-foreground">{kind}</p>
        </div>
        {control}
      </header>

      <div className="min-h-0">{children}</div>

      <p className="border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
        {note}
      </p>
    </section>
  );
}

/**
 * The side-by-side / wipe switch, for the two charts that cannot overlay.
 *
 * Only heatmap and sankey get one. Everywhere else the chart draws its
 * comparison and there is nothing to choose, which is the decision recorded
 * here rather than a shortcut: a control on every card would imply the
 * treatments are interchangeable, and they are not.
 */
export function ViewSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="Comparison view"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            value === o.id && "bg-accent text-accent-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Two layers, one clipped, with a draggable seam -- the wipe-reveal.
 *
 * The handle is a real `input[type=range]` laid over the seam rather than a
 * div with pointer handlers. It is keyboard-operable for free, it announces
 * itself, and it drags on touch without any of the pointer-capture code a
 * bespoke handle needs. The visible seam is drawn separately and is
 * `pointer-events-none`; the input is transparent and owns the interaction.
 */
export function WipeReveal({
  before,
  after,
  height,
}: {
  /** Shown on the LEFT of the seam. */
  before: React.ReactNode;
  /** Shown on the right. */
  after: React.ReactNode;
  height: number;
}) {
  const [pct, setPct] = React.useState(50);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md" style={{ height }}>
        <div className="absolute inset-0">{after}</div>
        {/*
          `inset()` from the RIGHT, so the left-hand layer is the one revealed
          as the seam moves right. Clipping the wrapper rather than the chart
          means the chart inside never relayouts while dragging -- it is drawn
          once at full width and simply hidden, which is what keeps the two
          sides pixel-aligned and the drag smooth.
        */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        >
          {before}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label="Reveal more of the previous or current period"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{PERIODS.previous.label}</span>
        <span>{PERIODS.current.label}</span>
      </div>
    </div>
  );
}
