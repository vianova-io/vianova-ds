import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";

export default function DataLayerCardDefault() {
  return (
    <div className="w-full max-w-xs space-y-2">
      <DataLayerCard
        name="Routes OD Logistiques"
        meta="Jan 1 – Dec 31, 2024 · Count distinct trip id"
        visualization="Lines"
        filterCount={3}
        defaultVisualization="lines"
      />
      <DataLayerCard name="Arrêts logistiques" expanded={false} visible={false} />
    </div>
  );
}
