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
      {/*
        No overflow-hidden here, deliberately.

        Clipping the stack to its own rounded corners also clips the two
        buttons' focus rings: each sits 1px inside this box and the ring reaches
        3px beyond, so a keyboard user saw roughly a third of the only indicator
        telling them where they were. It survived this long because it is
        invisible unless you tab all the way to the map controls.

        The children are rounded to match the border instead, which is what
        ButtonGroup does for the same shape, and it costs nothing at rest: a
        ghost button paints no background, so the stack looks identical until
        something is hovered or focused -- at which point the ring is now whole.
      */}
      <div className="flex flex-col rounded-lg border border-border bg-card/95 backdrop-blur *:focus-visible:relative *:focus-visible:z-10 [&>button:first-of-type]:rounded-b-none [&>button:last-of-type]:rounded-t-none">
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
