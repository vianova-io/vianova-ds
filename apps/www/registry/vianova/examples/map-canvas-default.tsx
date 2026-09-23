import { MapCanvas } from "@/registry/vianova/product/map-canvas";

export default function MapCanvasDefault() {
  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
      {/* workerUrl is needed under Next's webpack dev server — see MapCanvas.
          Pass mapboxToken to swap in the genuine Mapbox Dark style. */}
      <MapCanvas
        workerUrl="/maplibre/maplibre-gl-worker.mjs"
        center={[-1.6778, 48.1173]}
        zoom={11}
      />
    </div>
  );
}
