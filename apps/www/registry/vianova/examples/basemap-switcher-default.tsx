"use client";

import * as React from "react";

import { BasemapSwitcher } from "@/registry/vianova/product/basemap-switcher";
import { DEFAULT_BASEMAP_ID, type BasemapId } from "@/registry/vianova/lib/basemaps";

export default function BasemapSwitcherDefault() {
  const [basemap, setBasemap] = React.useState<BasemapId>(DEFAULT_BASEMAP_ID);
  return (
    <div className="flex h-40 items-end justify-end rounded-lg bg-surface-sunken p-4">
      <BasemapSwitcher value={basemap} onValueChange={setBasemap} />
    </div>
  );
}
