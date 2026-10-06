"use client";

import * as React from "react";

import {
  ColorizePanel,
  type ColorizeField,
} from "@/registry/vianova/product/colorize-panel";

const FIELDS: ColorizeField[] = [
  { name: "origin_name", type: "string" },
  { name: "vehicle_type", type: "string" },
  { name: "vehicle-count", label: "Vehicle count", type: "number" },
];

/** Eight named values plus Other, drawn from 45 in the data. */
const CATEGORIES = [
  { value: "Gonneville-la-Mallet", color: "#3b82f6" },
  { value: "La Cerlangue", color: "#ef4444" },
  { value: "Épretot", color: "#22c55e" },
  { value: "Vergetot", color: "#f59e0b" },
  { value: "La Remuée", color: "#a855f7" },
  { value: "Étretat", color: "#06b6d4" },
  { value: "Saint-Vigor-d'Ymonville", color: "#ec4899" },
  { value: "Étainhus", color: "#84cc16" },
];

/**
 * Colouring by a string field. Switching `Color by` to the numeric metric
 * swaps the body for the classification ramp — the branch is the point.
 */
export default function ColorizePanelCategorical() {
  return (
    <ColorizePanel
      layerName="Logistics OD Routes"
      fields={FIELDS}
      field="origin_name"
      categories={CATEGORIES}
      totalCategories={45}
      presetName="Spectrum"
    />
  );
}
