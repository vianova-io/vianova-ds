import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * The frosted panel that floats over a map canvas.
 *
 * Deliberately not a Card: it needs a translucent, blurred surface so the map
 * stays legible behind it, and a body that scrolls independently of the page.
 */
function FloatingPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

function FloatingPanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-header"
      className={cn("flex items-center justify-between gap-2 p-2", className)}
      {...props}
    />
  );
}

function FloatingPanelTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="floating-panel-title"
      className={cn("px-1 text-sm font-medium", className)}
      {...props}
    />
  );
}

function FloatingPanelActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-actions"
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      {...props}
    />
  );
}

/** min-h-0 is load-bearing: without it a flex child refuses to shrink and the
 *  panel grows past its max height instead of scrolling. */
function FloatingPanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-body"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
}

export {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
};
