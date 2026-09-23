"use client";

import * as React from "react";

import { ColorStopList } from "@/registry/vianova/product/color-stop-list";
import type { ColorStop } from "@/registry/vianova/product/color-stop-slider";

export default function ColorStopListDefault() {
  const [stops, setStops] = React.useState<ColorStop[]>([
    { position: 0, color: "#d9d9d9", opacity: 100 },
    { position: 50, color: "#a6a6a6", opacity: 100 },
    { position: 100, color: "#737373", opacity: 100 },
  ]);
  const [selected, setSelected] = React.useState(1);

  return (
    <div className="w-full max-w-sm">
      <ColorStopList
        stops={stops}
        selectedIndex={selected}
        onSelect={setSelected}
        onChange={setStops}
      />
    </div>
  );
}
