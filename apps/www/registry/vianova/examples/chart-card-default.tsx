import { Hash } from "lucide-react";

import {
  ChartCard,
  ChartCardHeader,
  ChartCardMetric,
} from "@/registry/vianova/product/chart-card";

export default function ChartCardDefault() {
  return (
    <ChartCard className="w-full max-w-xs">
      <ChartCardHeader title="Nombre de trajets uniques" icon={<Hash />} />
      <ChartCardMetric value="32 908" unit="Vehicles" />
    </ChartCard>
  );
}
