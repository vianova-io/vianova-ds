import { ActivityHeatmap } from "@/registry/vianova/product/activity-heatmap";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${h}:00`);

// Fixed values, not random: an example must render identically on the server
// and the client.
const VALUES = DAYS.map((_, d) =>
  HOURS.map((_, h) => {
    const peak = Math.exp(-((h - 8) ** 2) / 8) + Math.exp(-((h - 18) ** 2) / 10);
    const weekend = d >= 5 ? 0.45 : 1;
    return Math.min(1, peak * 0.8 * weekend + 0.1);
  }),
);

export default function ActivityHeatmapDefault() {
  return (
    <ActivityHeatmap
      className="w-full max-w-sm"
      rows={DAYS}
      columns={HOURS}
      values={VALUES}
    />
  );
}
