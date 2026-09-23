"use client";

import * as React from "react";

import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import {
  VisClustersIcon,
  VisGridIcon,
  VisHeatmapIcon,
  VisLinesIcon,
  VisPointsIcon,
  VisTripsIcon,
  VisZonesIcon,
} from "@/registry/vianova/product/visualization-icons";

/**
 * How a data layer is drawn on the map.
 *
 * Order and ids come from the Figma library `visualization` component set
 * — points, clusters, grid, heatmap, lines, zones, trips — so the
 * design file and the code refer to the same things.
 */
export const VISUALIZATION_TYPES = [
  { value: "points", label: "Points", Icon: VisPointsIcon },
  { value: "clusters", label: "Clusters", Icon: VisClustersIcon },
  { value: "grid", label: "Grid", Icon: VisGridIcon },
  { value: "heatmap", label: "Heatmap", Icon: VisHeatmapIcon },
  { value: "lines", label: "Lines", Icon: VisLinesIcon },
  { value: "zones", label: "Zones", Icon: VisZonesIcon },
  { value: "trips", label: "Trips", Icon: VisTripsIcon },
] as const;

export type VisualizationTypeId = (typeof VISUALIZATION_TYPES)[number]["value"];

/** Segmented control over the seven visualisation glyphs. */
export function VisualizationPicker({
  value,
  defaultValue = "lines",
  onValueChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SegmentedControl>,
  "items" | "value" | "defaultValue" | "onValueChange"
> & {
  value?: VisualizationTypeId;
  defaultValue?: VisualizationTypeId;
  onValueChange?: (value: VisualizationTypeId) => void;
}) {
  const items = React.useMemo(
    () =>
      VISUALIZATION_TYPES.map(({ value: v, label, Icon }) => ({
        value: v,
        label,
        icon: <Icon className="h-[18px] w-auto" aria-hidden />,
      })),
    [],
  );

  return (
    <SegmentedControl
      data-slot="visualization-picker"
      aria-label="Visualization type"
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as VisualizationTypeId)}
      {...props}
    />
  );
}
