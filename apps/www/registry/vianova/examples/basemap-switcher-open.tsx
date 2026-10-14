"use client";

import * as React from "react";

import { BasemapSwitcher } from "@/registry/vianova/product/basemap-switcher";
import { type BasemapId } from "@/registry/vianova/lib/basemaps";

/** Open on mount: a closed popover renders nothing for axe to audit. */
export default function BasemapSwitcherOpen() {
  const [basemap, setBasemap] = React.useState<BasemapId>("satellite");
  return (
    <div className="flex h-[22rem] items-end justify-center rounded-lg bg-surface-sunken p-4">
      <BasemapSwitcher defaultOpen value={basemap} onValueChange={setBasemap} side="top" align="center" />
    </div>
  );
}
