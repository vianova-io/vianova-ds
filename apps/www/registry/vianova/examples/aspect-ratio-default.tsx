import { AspectRatio } from "@/registry/vianova/ui/aspect-ratio";

export default function AspectRatioDefault() {
  return (
    <div className="w-full max-w-sm">
      <AspectRatio ratio={16 / 9}>
        <div className="flex size-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          Map viewport 16:9
        </div>
      </AspectRatio>
    </div>
  );
}
