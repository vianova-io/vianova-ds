import { Badge } from "@/registry/vianova/ui/badge";

export default function BadgeVariants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Failed</Badge>
    </div>
  );
}
