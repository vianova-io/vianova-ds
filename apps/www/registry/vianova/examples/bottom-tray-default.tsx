"use client";

import * as React from "react";

import { BottomTray, type TraySnap } from "@/registry/vianova/patterns/bottom-tray";
import { Button } from "@/registry/vianova/ui/button";

export default function BottomTrayDefault() {
  const [open, setOpen] = React.useState(true);
  const [snap, setSnap] = React.useState<TraySnap>("half");

  return (
    // The tray positions against its nearest positioned ancestor, so the
    // example supplies one: on a map that is the block, here a framed box.
    <div className="bg-muted/40 relative h-80 w-full max-w-sm overflow-hidden rounded-xl border">
      <div className="flex items-start justify-between p-3">
        <p className="text-muted-foreground text-sm">
          Whatever the tray covers.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Open"}
        </Button>
      </div>

      <BottomTray
        open={open}
        onOpenChange={setOpen}
        snap={snap}
        onSnapChange={setSnap}
        label="Details"
        // The tray draws no surface of its own: the child brings one, so a
        // panel does not end up inside a second box.
        className="lg:static"
      >
        <div className="bg-card/95 flex h-full w-full flex-col overflow-hidden rounded-t-xl border border-b-0 pt-4 shadow-lg backdrop-blur">
          <p className="px-3 pb-2 text-sm font-medium">Details</p>
          <p className="text-muted-foreground px-3 pb-3 text-xs">
            Drag the handle, or focus it and use the arrow keys: {snap}.
          </p>
        </div>
      </BottomTray>
    </div>
  );
}
