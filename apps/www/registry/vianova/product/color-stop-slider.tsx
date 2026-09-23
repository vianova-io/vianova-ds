"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

export type ColorStop = {
  /** 0-100 along the ramp. */
  position: number;
  /** Any CSS colour. */
  color: string;
  /** 0-100. Multiplies into the rendered gradient. */
  opacity?: number;
};

/** Sorted copy — a gradient with out-of-order stops renders unpredictably. */
export const sortStops = (stops: ColorStop[]) =>
  [...stops].sort((a, b) => a.position - b.position);

export function stopsToGradient(stops: ColorStop[], angle = "to right") {
  const parts = sortStops(stops).map(
    (s) =>
      `color-mix(in srgb, ${s.color} ${s.opacity ?? 100}%, transparent) ${s.position}%`,
  );
  // A single stop is not a gradient; repeat it so the track is a flat colour
  // rather than collapsing to nothing.
  if (parts.length === 1) parts.push(parts[0]!.replace(/ \d+%$/, " 100%"));
  return `linear-gradient(${angle}, ${parts.join(", ")})`;
}

/**
 * Gradient track with draggable stop handles.
 *
 * Each handle is a real slider: dragging and arrow keys both work, and the
 * value is announced. A div with a pointer listener would look identical and
 * be unusable without a mouse.
 */
export function ColorStopSlider({
  stops,
  selectedIndex,
  onSelect,
  onChange,
  className,
  ...props
  // `onSelect` and `onChange` are native div handlers; ours take different
  // arguments, so they must be omitted rather than merged.
}: Omit<React.ComponentProps<"div">, "onChange" | "onSelect"> & {
  stops: ColorStop[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onChange?: (stops: ColorStop[]) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef<number | null>(null);

  const moveTo = React.useCallback(
    (index: number, clientX: number) => {
      const track = trackRef.current;
      if (!track || !onChange) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.round(((clientX - rect.left) / rect.width) * 100);
      const next = stops.map((s, i) =>
        i === index ? { ...s, position: Math.min(100, Math.max(0, pct)) } : s,
      );
      onChange(next);
    },
    [onChange, stops],
  );

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current === null) return;
      e.preventDefault();
      moveTo(draggingRef.current, e.clientX);
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [moveTo]);

  const nudge = (index: number, delta: number) => {
    if (!onChange) return;
    onChange(
      stops.map((s, i) =>
        i === index
          ? { ...s, position: Math.min(100, Math.max(0, s.position + delta)) }
          : s,
      ),
    );
  };

  return (
    <div data-slot="color-stop-slider" className={cn("space-y-1", className)} {...props}>
      <div className="relative h-4">
        {stops.map((stop, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`Stop ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stop.position}
            aria-valuetext={`${stop.position}%`}
            data-state={selectedIndex === i ? "selected" : "default"}
            onPointerDown={(e) => {
              e.preventDefault();
              draggingRef.current = i;
              onSelect?.(i);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") nudge(i, -1);
              else if (e.key === "ArrowRight") nudge(i, 1);
              else if (e.key === "Home") nudge(i, -stop.position);
              else if (e.key === "End") nudge(i, 100 - stop.position);
              else return;
              e.preventDefault();
              onSelect?.(i);
            }}
            style={{ left: `${stop.position}%`, background: stop.color }}
            className={cn(
              "absolute top-0 size-3.5 -translate-x-1/2 cursor-grab rounded-[3px] border border-border shadow-sm",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              "active:cursor-grabbing",
              selectedIndex === i && "ring-2 ring-primary",
            )}
          />
        ))}
      </div>
      <div
        ref={trackRef}
        className="h-4 rounded-sm border border-border"
        style={{ background: stopsToGradient(stops) }}
      />
    </div>
  );
}
