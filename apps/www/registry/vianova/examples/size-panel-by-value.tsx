"use client";

import * as React from "react";

import { SizePanel } from "@/registry/vianova/product/size-panel";

const FIELDS = [
  { name: "daily_traffic", label: "Daily traffic" },
  { name: "hgv_share", label: "HGV share" },
  { name: "avg_speed", label: "Average speed" },
];

/**
 * Size driven by a value: bigger number, bigger point.
 *
 * The sliders give way to the two ends of a scale, because a graduated size
 * is a range rather than a value, and the preview underneath draws what that
 * range actually looks like on the map. Standard QGIS symbology, which is
 * where the people who asked for it arrive from.
 *
 * Only numbers appear in "Size by" -- a size is a quantity, so a string
 * column has nothing to scale. A layer with no numeric column at all loses
 * the mode switch entirely rather than offering a dead end.
 */
export default function SizePanelByValue() {
  // Held here rather than passed as a fixed prop: a controlled `mode` with no
  // handler would leave the switch in the panel dead, and the switch is half
  // of what this example is showing.
  const [mode, setMode] = React.useState<"single" | "by-value">("by-value");
  return (
    <SizePanel
      geometry="both"
      fields={FIELDS}
      mode={mode}
      onModeChange={setMode}
    />
  );
}
