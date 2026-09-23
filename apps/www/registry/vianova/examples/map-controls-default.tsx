import { MapControls } from "@/registry/vianova/product/map-controls";

export default function MapControlsDefault() {
  return (
    <div className="flex h-40 w-full items-end justify-end rounded-lg bg-surface-sunken p-3">
      <MapControls basemapLabel="Plan" />
    </div>
  );
}
