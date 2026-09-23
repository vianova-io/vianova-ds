import { RankedBars } from "@/registry/vianova/product/ranked-bars";

export default function RankedBarsDefault() {
  return (
    <RankedBars
      className="w-full max-w-sm"
      items={[
        { label: "Port district", percent: 80, count: "8721" },
        { label: "City centre", percent: 70, count: "1777" },
        { label: "Sainte-Adresse", percent: 60, count: "188" },
        { label: "Graville", percent: 40, count: "102" },
      ]}
    />
  );
}
