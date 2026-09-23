import { LegendRamp } from "@/registry/vianova/product/legend-ramp";

export default function LegendRampDefault() {
  return (
    <div className="w-full max-w-xs space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Trips per district</p>
        <LegendRamp />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Without ticks</p>
        <LegendRamp showTicks={false} />
      </div>
    </div>
  );
}
