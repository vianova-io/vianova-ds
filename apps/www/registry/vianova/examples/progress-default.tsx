import { Progress } from "@/registry/vianova/ui/progress";

export default function ProgressDefault() {
  return (
    <div className="w-full space-y-4">
      <Progress value={72} aria-label="Trips ingested" />
      <Progress value={28} aria-label="Zones matched" />
    </div>
  );
}
