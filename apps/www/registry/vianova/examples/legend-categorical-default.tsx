import { LegendCategorical } from "@/registry/vianova/product/legend-categorical";

const SEVERITY = [
  { label: "Accident with fatalities", color: "#8b5cf6" },
  { label: "Accident with severe injuries", color: "#e11d48" },
  { label: "Accident with light injuries", color: "#0d9488" },
  { label: "Accident with property damage", color: "#d97706" },
];

export default function LegendCategoricalDefault() {
  return (
    <div className="w-full max-w-xs space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Accident severity</p>
        <LegendCategorical items={SEVERITY} />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">One column</p>
        <LegendCategorical items={SEVERITY.slice(0, 2)} columns={1} />
      </div>
    </div>
  );
}
