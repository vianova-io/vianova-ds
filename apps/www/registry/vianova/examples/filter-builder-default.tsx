"use client";

import * as React from "react";

import { FilterBuilder } from "@/registry/vianova/product/filter-builder";
import {
  newCondition,
  newGroup,
  serializeFilter,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";

const fields: FilterField[] = [
  { name: "mode", label: "Mode", type: "enum", options: [
    { value: "car", label: "Car" },
    { value: "bike", label: "Bike" },
    { value: "scooter", label: "Scooter" },
    { value: "walk", label: "Walk" },
  ] },
  { name: "duration", label: "Duration", type: "number", unit: "min" },
  { name: "distance", label: "Distance", type: "number", unit: "km" },
  { name: "district", label: "District", type: "string" },
  { name: "weekday", label: "Weekday", type: "boolean" },
  { name: "date", label: "Date", type: "date" },
];

// Built once at module scope so the ids are identical on the server and the
// client. See nextFilterId in lib/filter-ast.
const initial = newGroup("and", [
  { ...newCondition("mode", "in"), value: ["car", "bike"] },
  { ...newCondition("duration", "between"), value: [5, 45] },
]) as FilterGroup;

export default function FilterBuilderDefault() {
  const [filter, setFilter] = React.useState<FilterGroup>(initial);
  const [valid, setValid] = React.useState(true);

  return (
    <div className="w-full max-w-3xl space-y-4">
      <FilterBuilder
        fields={fields}
        value={filter}
        onValueChange={setFilter}
        onValidityChange={setValid}
      />
      <pre className="bg-muted/50 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
        {JSON.stringify(JSON.parse(serializeFilter(filter)), null, 2)}
      </pre>
      <p className="text-muted-foreground text-xs">
        {valid ? "Ready to apply." : "Some conditions are incomplete."}
      </p>
    </div>
  );
}
