import * as React from "react";
import { Layers, Minus, Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Separator } from "@/registry/vianova/ui/separator";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Zoom stepper plus a basemap switcher tile, as they sit in the corner of the
 * map canvas.
 */
export function MapControls({
  basemapLabel = "Plan",
  basemap,
  onZoomIn,
  onZoomOut,
  onBasemapClick,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  /**
   * Replaces the built-in tile, e.g. with a <BasemapSwitcher />.
   *
   * A slot rather than more props on this component: a real switcher owns a
   * popover, a selected value and five previews, none of which this zoom
   * stepper should know about. Given one, `basemapLabel` and `onBasemapClick`
   * are ignored.
   */
  basemap?: React.ReactNode;
  basemapLabel?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** @deprecated Pass a `basemap` slot instead; a lone click cannot express five options. */
  onBasemapClick?: () => void;
}) {
  return (
    <div
      data-slot="map-controls"
      className={cn("flex items-end gap-2", className)}
      {...props}
    >
      {basemap ?? (
        <button
          type="button"
          onClick={onBasemapClick}
          // The accessible name this never had: without it the button is
          // announced as whatever its label happens to say, which in the map
          // workspace was "Satellite" over a map that was not one.
          aria-label={`Basemap: ${basemapLabel}`}
          title={`Basemap: ${basemapLabel}`}
          // Kept in step with BasemapSwitcher's own trigger: a 32px square on
          // the zoom stack's size, rather than the 56px tile with the name set
          // inside it that this was. Two shapes for one control in one corner
          // was the loud part.
          //
          // An icon and not the name, because 32px does not hold "Satellite".
          // The real switcher shows the basemap's own thumbnail here; this
          // fallback has no thumbnail to show, only a string, so it shows what
          // the control is instead and leaves the name to the accessible name
          // and the tooltip.
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-card/95 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Layers className="size-4" aria-hidden />
        </button>
      )}
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
