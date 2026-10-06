"use client";

import * as React from "react";

import {
  ColorizePanel,
  type ColorizeField,
} from "@/registry/vianova/product/colorize-panel";
import {
  PanelStep,
  PanelStepBody,
  PanelStepper,
} from "@/registry/vianova/product/panel-stepper";
import {
  PresetPicker,
  type ColorPalette,
} from "@/registry/vianova/product/preset-picker";

const FIELDS: ColorizeField[] = [
  { name: "origin_name", type: "string" },
  { name: "vehicle-count", label: "Vehicle count", type: "number" },
];

const PALETTES: ColorPalette[] = [
  { name: "Spectrum", family: "Categorical", colors: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"] },
  { name: "Pastel", family: "Categorical", colors: ["#93c5fd", "#fca5a5", "#86efac", "#fcd34d", "#d8b4fe", "#67e8f9", "#f9a8d4", "#bef264"] },
  { name: "Accessible", family: "Categorical", colorBlindSafe: true, colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442"] },
  { name: "Deep 700", family: "Categorical", colors: ["#1d4ed8", "#15803d", "#c2410c", "#be185d", "#6d28d9", "#0e7490", "#b91c1c", "#4d7c0f"] },
  { name: "Tableau", family: "Categorical", colorBlindSafe: true, colors: ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#76b7b2", "#edc948"] },
  { name: "Viridis", family: "Sequential", colorBlindSafe: true, colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] },
  { name: "Blues", family: "Sequential", colors: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"] },
];

const VALUES = [
  "Gonneville-la-Mallet",
  "La Cerlangue",
  "Épretot",
  "Vergetot",
  "La Remuée",
  "Étretat",
  "Saint-Vigor-d'Ymonville",
  "Étainhus",
];

/**
 * The shape the product uses: the Colorize panel with Preset cascading beside
 * it, anchored to the panel rather than to the row that opened it.
 *
 * The Preset step has no trigger of its own — its trigger is a control inside
 * ColorizePanel, which reports it through `onBrowsePresets` — so the step is
 * driven by `open` instead.
 */
export default function ColorizePanelStepper() {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [presetOpen, setPresetOpen] = React.useState(false);
  const [preset, setPreset] = React.useState("Spectrum");

  const colors =
    PALETTES.find((p) => p.name === preset)?.colors ?? PALETTES[0]!.colors;
  const categories = VALUES.map((value, i) => ({
    value,
    color: colors[i % colors.length]!,
  }));

  return (
    <div className="relative flex min-h-[560px] w-full items-start justify-start p-4">
      <PanelStepper anchor={anchor}>
        {/* The ref lives on a wrapper rather than on ColorizePanel: forwarding
            a ref is not part of that component's API, and the anchor only
            needs the same box. */}
        <div ref={setAnchor} className="w-fit">
          <ColorizePanel
            layerName="Logistics OD Routes"
            fields={FIELDS}
            field="origin_name"
            categories={categories}
            totalCategories={45}
            presetName={preset}
            presetColors={colors}
            onBrowsePresets={() => setPresetOpen((open) => !open)}
          />
        </div>
        <PanelStep
          id="preset"
          title="Preset"
          width={420}
          open={presetOpen}
          onOpenChange={setPresetOpen}
        >
          <PanelStepBody className="max-h-80 p-0">
            <PresetPicker
              palettes={PALETTES}
              value={preset}
              onValueChange={setPreset}
            />
          </PanelStepBody>
        </PanelStep>
      </PanelStepper>
    </div>
  );
}
