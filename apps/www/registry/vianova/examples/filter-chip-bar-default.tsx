"use client";

import * as React from "react";

import { FilterChipBar } from "@/registry/vianova/product/filter-chip-bar";
import {
  newCondition,
  newGroup,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";

const fields: FilterField[] = [
  { name: "mode", label: "Mode", type: "enum", options: [
    { value: "car", label: "Car" },
    { value: "bike", label: "Bike" },
  ] },
  { name: "duration", label: "Duration", type: "number", unit: "min" },
  { name: "district", label: "District", type: "string" },
];

const initial = newGroup("and", [
  { ...newCondition("mode", "in"), value: ["car", "bike"] },
  { ...newCondition("duration", "gte"), value: 10 },
  // A nested group collapses to a single chip: it cannot be taken apart in a
  // flat row without misrepresenting the grouping.
  newGroup("or", [
    { ...newCondition("district", "eq"), value: "Port district" },
    { ...newCondition("district", "eq"), value: "Graville" },
  ]),
]) as FilterGroup;

export default function FilterChipBarDefault() {
  const [filter, setFilter] = React.useState<FilterGroup>(initial);

  return (
    <div className="w-full max-w-2xl space-y-3">
      <FilterChipBar
        value={filter}
        fields={fields}
        onValueChange={setFilter}
        onClear={() => setFilter({ ...filter, children: [] })}
      />
      <button
        type="button"
        className="text-muted-foreground text-xs underline"
        onClick={() => setFilter(initial)}
      >
        Reset
      </button>
    </div>
  );
}
