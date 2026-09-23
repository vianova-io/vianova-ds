import { Badge } from "@/registry/vianova/ui/badge";
import { Card, CardContent } from "@/registry/vianova/ui/card";

const stats = [
  { label: "Total trips", value: "48,921", delta: "+12.4%" },
  { label: "Avg. duration", value: "14.2 min", delta: "-3.1%" },
];

export default function CardStat() {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
              <Badge variant="secondary">{s.delta}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
