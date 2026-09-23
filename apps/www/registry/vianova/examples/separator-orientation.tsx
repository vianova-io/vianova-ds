import { Separator } from "@/registry/vianova/ui/separator";

export default function SeparatorOrientation() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div>
        <p className="text-sm font-medium">Le Havre</p>
        <p className="text-sm text-muted-foreground">54 districts</p>
      </div>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm">
        <span>Trips</span>
        <Separator orientation="vertical" />
        <span>Duration</span>
        <Separator orientation="vertical" />
        <span>Distance</span>
      </div>
    </div>
  );
}
