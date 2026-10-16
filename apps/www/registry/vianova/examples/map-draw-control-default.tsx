"use client";

import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useCategoryShapeLayer, type CategoryShape } from "@/registry/vianova/hooks/use-category-shape-layer";
import { useColorScheme } from "@/registry/vianova/hooks/use-color-scheme";
import { resolveCssColor } from "@/registry/vianova/lib/css-color";
import type { CategoryStyle } from "@/registry/vianova/lib/category-style";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import {
  MapDrawBanner,
  MapDrawControl,
  useMapDraw,
  type DrawMode,
} from "@/registry/vianova/product/map-draw-control";

/**
 * Declared locally so this file compiles in a project without @types/node.
 * The expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM,
 * because Next substitutes that exact text at build time -- see
 * map-canvas-default for the long version.
 */
declare const process: { env: Record<string, string | undefined> };

const WORKER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`;

export default function MapDrawControlDefault() {
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const [mode, setMode] = React.useState<DrawMode | null>(null);
  const [zones, setZones] = React.useState<CategoryShape[]>([]);

  // The zone colour is the theme's primary, resolved for MapLibre, which
  // cannot read a CSS variable. Re-resolved when the theme flips, and held in
  // state so the styles object stays the same between renders, as
  // useCategoryShapeLayer asks.
  const scheme = useColorScheme();
  const [styles, setStyles] = React.useState<Record<string, CategoryStyle>>({});
  React.useEffect(() => {
    if (!scheme) return;
    setStyles({ drawn: { color: resolveCssColor("--primary") ?? "#0f766e" } });
  }, [scheme]);

  useCategoryShapeLayer({ map, enabled: true, shapes: zones, styles, id: "drawn-zones" });

  const { points, finish, cancel } = useMapDraw({
    map,
    mode,
    onComplete: (ring) => {
      setZones((current) => [...current, { ring, category: "drawn" }]);
      setMode(null);
    },
    onCancel: () => setMode(null),
  });

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative h-80 w-full overflow-hidden rounded-lg border border-border">
        <MapCanvas
          workerUrl={WORKER_URL}
          center={[-9.14, 38.72]}
          zoom={12}
          onLoad={setMap}
        />
        <MapDrawControl
          mode={mode}
          onModeChange={setMode}
          disabled={!map}
          className="absolute top-3 right-3"
        />
        {mode ? (
          <MapDrawBanner
            mode={mode}
            points={points}
            onDone={finish}
            onCancel={cancel}
            className="absolute bottom-3 left-1/2 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2"
          />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {zones.length} {zones.length === 1 ? "zone" : "zones"} drawn
      </p>
    </div>
  );
}
