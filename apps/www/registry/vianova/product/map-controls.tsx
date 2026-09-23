import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Separator } from "@/registry/vianova/ui/separator";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Zoom stepper plus a basemap switcher tile, as they sit in the corner of the
 * map canvas.
 */
export function MapControls({
  basemapLabel = "Plan",
  onZoomIn,
  onZoomOut,
  onBasemapClick,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  basemapLabel?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onBasemapClick?: () => void;
}) {
  return (
    <div
      data-slot="map-controls"
      className={cn("flex items-end gap-2", className)}
      {...props}
    >
      <button
        type="button"
        onClick={onBasemapClick}
        className="flex size-14 items-center justify-center rounded-lg border border-border bg-card/95 text-[10px] text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {basemapLabel}
      </button>
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card/95 backdrop-blur">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus />
        </Button>
        <Separator />
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus />
        </Button>
      </div>
    </div>
  );
}
