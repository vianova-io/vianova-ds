"use client";

import * as React from "react";
import { Minus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Input } from "@/registry/vianova/ui/input";
import type { ColorStop } from "@/registry/vianova/product/color-stop-slider";
import { cn } from "@/registry/vianova/lib/utils";

/** Normalises "#D9D9D9" / "d9d9d9" to the bare uppercase hex the design shows. */
const toHexLabel = (color: string) => color.replace(/^#/, "").toUpperCase();

/**
 * Editable list of gradient stops: position, colour, opacity, remove.
 *
 * Rows are selectable and stay in sync with ColorStopSlider — clicking a row
 * highlights its handle and vice versa, which is what makes a long ramp
 * workable.
 */
export function ColorStopList({
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
  const update = (index: number, patch: Partial<ColorStop>) =>
    onChange?.(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const remove = (index: number) => onChange?.(stops.filter((_, i) => i !== index));

  return (
    <div data-slot="color-stop-list" className={cn("space-y-2", className)} {...props}>
      {stops.map((stop, i) => (
        <div
          key={i}
          data-state={selectedIndex === i ? "selected" : "default"}
          onPointerDown={() => onSelect?.(i)}
          className={cn(
            "flex items-center gap-2 rounded-md p-1",
            selectedIndex === i && "bg-accent ring-1 ring-primary",
          )}
        >
          <Input
            size="sm"
            aria-label={`Stop ${i + 1} position`}
            value={`${stop.position}%`}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
              if (!Number.isNaN(n)) update(i, { position: Math.min(100, Math.max(0, n)) });
            }}
            className="w-16 shrink-0 text-center"
          />

          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input px-2">
            {/* A native colour input keeps the OS picker and keyboard access
                that a swatch-shaped div would throw away. */}
            <input
              type="color"
              aria-label={`Stop ${i + 1} colour`}
              value={stop.color}
              onChange={(e) => update(i, { color: e.target.value })}
              className="size-5 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
            />
            <span className="truncate font-mono text-sm">{toHexLabel(stop.color)}</span>
          </div>

          <Input
            size="sm"
            aria-label={`Stop ${i + 1} opacity`}
            value={`${stop.opacity ?? 100} %`}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
              if (!Number.isNaN(n)) update(i, { opacity: Math.min(100, Math.max(0, n)) });
            }}
            className="w-20 shrink-0 text-center"
          />

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove stop ${i + 1}`}
            onClick={() => remove(i)}
            // One stop still describes a colour; zero describes nothing.
            disabled={stops.length <= 1}
          >
            <Minus />
          </Button>
        </div>
      ))}
    </div>
  );
}
