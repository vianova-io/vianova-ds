import { RankedBars } from "@/registry/vianova/product/ranked-bars";

export default function RankedBarsDefault() {
  return (
    <RankedBars
      className="w-full max-w-sm"
      items={[
        // Long enough to truncate in a panel, which is the case the hover
        // tooltip exists for: every other label here fits, and hovering those
        // shows nothing.
        {
          label: "Boulevard Saint-Germain (eastbound, 07:00-10:00)",
          percent: 80,
          count: "8721",
        },
        { label: "City centre", percent: 70, count: "1777" },
        { label: "Sainte-Adresse", percent: 60, count: "188" },
        { label: "Graville", percent: 40, count: "102" },
      ]}
    />
  );
}
