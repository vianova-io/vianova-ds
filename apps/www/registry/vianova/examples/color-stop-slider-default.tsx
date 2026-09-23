"use client";

import * as React from "react";

import {
  ColorStopSlider,
  type ColorStop,
} from "@/registry/vianova/product/color-stop-slider";

export default function ColorStopSliderDefault() {
  const [stops, setStops] = React.useState<ColorStop[]>([
    { position: 0, color: "#ccfbf1" },
    { position: 45, color: "#2dd4bf" },
    { position: 100, color: "#0f766e" },
  ]);
  const [selected, setSelected] = React.useState(1);

  return (
    <div className="w-full max-w-sm">
      <ColorStopSlider
        stops={stops}
        selectedIndex={selected}
        onSelect={setSelected}
        onChange={setStops}
      />
      <p className="pt-2 text-xs text-muted-foreground">
        Drag a handle, or focus one and use the arrow keys.
      </p>
    </div>
  );
}
