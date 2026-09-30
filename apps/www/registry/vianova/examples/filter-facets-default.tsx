"use client";

import * as React from "react";

import {
  newCondition,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";
import { FilterFacets } from "@/registry/vianova/product/filter-facets";

const fields: FilterField[] = [
  {
    name: "mode",
    label: "Mode",
    type: "enum",
    options: [
      { value: "car", label: "Car" },
      { value: "bike", label: "Bike" },
      { value: "foot", label: "On foot" },
    ],
  },
  { name: "duration", label: "Duration", type: "number", unit: "min" },
  { name: "distance", label: "Distance", type: "number", unit: "km" },
  { name: "commercial", label: "Commercial vehicle", type: "boolean" },
];

/**
 * Bounds come from the data in real use. Hard-coded here so the example is
 * deterministic -- a slider whose limits move between renders would make this
 * page's screenshot a coin toss.
 */
const bounds = {
  duration: { min: 0, max: 90 },
  distance: { min: 0, max: 40 },
};

const initial = newGroup("and", [
  { ...newCondition("duration", "between"), value: [10, 45] },
]) as FilterGroup;

export default function FilterFacetsDefault() {
  const [filter, setFilter] = React.useState<FilterGroup>(initial);

  return (
    <div className="w-full max-w-xs">
      <FilterFacets
        fields={fields}
        value={filter}
        onValueChange={setFilter}
        bounds={bounds}
      />
    </div>
  );
}
