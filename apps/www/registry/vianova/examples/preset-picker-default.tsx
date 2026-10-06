"use client";

import * as React from "react";

import {
  PresetPicker,
  type ColorPalette,
} from "@/registry/vianova/product/preset-picker";

/**
 * Families are data, not a fixed list: which ones a layer offers depends on
 * what it is colouring by. A categorical field has no use for a sequential
 * ramp, and a measure has no use for an unordered set.
 */
const PALETTES: ColorPalette[] = [
  { name: "Spectrum", family: "Categorical", colors: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"] },
  { name: "Pastel", family: "Categorical", colors: ["#93c5fd", "#fca5a5", "#86efac", "#fcd34d", "#d8b4fe", "#67e8f9", "#f9a8d4", "#bef264"] },
  { name: "Accessible", family: "Categorical", colorBlindSafe: true, colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442"] },
  { name: "Vibrant 500", family: "Categorical", colors: ["#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"] },
  { name: "Soft 300", family: "Categorical", colors: ["#93c5fd", "#86efac", "#fdba74", "#f9a8d4", "#c4b5fd", "#67e8f9", "#fca5a5", "#bef264"] },
  { name: "Deep 700", family: "Categorical", colors: ["#1d4ed8", "#15803d", "#c2410c", "#be185d", "#6d28d9", "#0e7490", "#b91c1c", "#4d7c0f"] },
  { name: "Neutrals", family: "Categorical", colors: ["#e4e4e7", "#a1a1aa", "#71717a", "#52525b", "#3f3f46"] },
  { name: "Tableau", family: "Categorical", colorBlindSafe: true, colors: ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#76b7b2", "#edc948"] },
  { name: "Safe Bright", family: "Categorical", colorBlindSafe: true, colors: ["#4477aa", "#ee6677", "#228833", "#ccbb44", "#66ccee", "#aa3377", "#bbbbbb"] },

  { name: "Blues", family: "Sequential", colors: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"] },
  { name: "Viridis", family: "Sequential", colorBlindSafe: true, colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] },
  { name: "Heat", family: "Sequential", colors: ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"] },

  { name: "Red–Blue", family: "Diverging", colorBlindSafe: true, colors: ["#b2182b", "#ef8a62", "#f7f7f7", "#67a9cf", "#2166ac"] },
  { name: "Brown–Teal", family: "Diverging", colorBlindSafe: true, colors: ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"] },
];

export default function PresetPickerDefault() {
  const [value, setValue] = React.useState("Spectrum");

  return (
    <div className="flex h-[420px] w-[420px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border p-2">
        <span className="px-1 text-sm font-medium">Preset</span>
      </div>
      <PresetPicker
        palettes={PALETTES}
        value={value}
        onValueChange={setValue}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
