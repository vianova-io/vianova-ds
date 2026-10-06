"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Label } from "@/registry/vianova/ui/label";
import {
  PanelStep,
  PanelStepBody,
  PanelStepper,
} from "@/registry/vianova/product/panel-stepper";

const PRESETS = [
  { name: "Spectrum", colors: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"] },
  { name: "Pastel", colors: ["#93c5fd", "#fca5a5", "#86efac", "#fcd34d", "#d8b4fe", "#67e8f9", "#f9a8d4", "#bef264"] },
  { name: "Accessible", colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442"] },
  { name: "Deep 700", colors: ["#1d4ed8", "#b91c1c", "#15803d", "#b45309", "#7e22ce", "#0e7490", "#be185d", "#4d7c0f"] },
  { name: "Neutrals", colors: ["#e4e4e7", "#a1a1aa", "#71717a", "#52525b", "#3f3f46"] },
];

const CATEGORIES = [
  { value: "Gonneville-la-Mallet", color: "#3b82f6" },
  { value: "La Cerlangue", color: "#ef4444" },
  { value: "Épretot", color: "#22c55e" },
  { value: "Vergetot", color: "#f59e0b" },
  { value: "Other", color: "#a1a1aa" },
];

/**
 * The cascade as the map tool uses it: a layer control opens Colorize, Colorize
 * opens Preset beside it, and a category swatch opens its own picker below.
 *
 * Opening the swatch closes Preset -- one child per panel.
 */
export default function PanelStepperDefault() {
  const [preset, setPreset] = React.useState("Spectrum");

  return (
    // relative + a height: the dock below lg is absolutely positioned, so the
    // stepper needs a positioned box to dock inside -- the map block, in the
    // product. overflow-hidden keeps the docked panel inside it.
    <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-border p-4">
      <PanelStepper>
        <PanelStep
          id="colorize"
          title="Colorize"
          width={360}
          trigger={<Button variant="outline">Colorize</Button>}
        >
          <PanelStepBody className="space-y-3 p-3">
            <div className="space-y-1.5">
              <Label>Preset</Label>
              <PanelStep
                id="preset"
                title="Preset"
                width={420}
                trigger={
                  <button
                    type="button"
                    className="flex h-9 w-full items-center gap-3 rounded-md border border-input px-2 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span aria-hidden className="flex h-5 w-20 shrink-0 overflow-hidden rounded-sm">
                      {(PRESETS.find((p) => p.name === preset) ?? PRESETS[0]!).colors.map((c) => (
                        <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="truncate">{preset}</span>
                    <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                }
              >
                <PanelStepBody className="max-h-70 space-y-1 p-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      aria-pressed={p.name === preset}
                      onClick={() => setPreset(p.name)}
                      className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm transition-colors hover:bg-accent aria-pressed:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="w-24 shrink-0 truncate text-left">{p.name}</span>
                      <span aria-hidden className="flex h-5 flex-1 overflow-hidden rounded-sm">
                        {p.colors.map((c) => (
                          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </PanelStepBody>
              </PanelStep>
            </div>

            <div className="space-y-1.5">
              <Label>Categories</Label>
              {CATEGORIES.map((c) => (
                <div key={c.value} className="flex h-9 items-center gap-3">
                  <PanelStep
                    id={`swatch-${c.value}`}
                    title={`Color for ${c.value}`}
                    width={220}
                    side="bottom"
                    anchorTo="trigger"
                    trigger={
                      <button
                        type="button"
                        aria-label={`Choose color for ${c.value}`}
                        className="size-5 shrink-0 rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        style={{ backgroundColor: c.color }}
                      />
                    }
                  >
                    <PanelStepBody className="grid grid-cols-6 gap-1 p-2">
                      {PRESETS[0]!.colors.concat(PRESETS[1]!.colors).map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          aria-label={swatch}
                          className="size-6 rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </PanelStepBody>
                  </PanelStep>
                  <span className="truncate text-sm">{c.value}</span>
                </div>
              ))}
            </div>
          </PanelStepBody>
        </PanelStep>
      </PanelStepper>
    </div>
  );
}
