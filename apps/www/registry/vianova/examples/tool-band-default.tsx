"use client";

import * as React from "react";
import { Menu, Plus } from "lucide-react";

import { ToolBand } from "@/registry/vianova/patterns/tool-band";
import { Button } from "@/registry/vianova/ui/button";

/**
 * The band is only interesting against a scroll container, because that is the
 * whole behaviour: nothing at rest, a surface once there is something under it.
 * So the demo brings its own scrolling box rather than relying on the page.
 */
export default function ToolBandDefault() {
  return (
    <div className="bg-background h-80 w-full overflow-auto rounded-xl border">
      <ToolBand
        nav={
          <Button variant="outline" size="icon-sm" aria-label="Hide navigation">
            <Menu />
          </Button>
        }
        title="Counting sites"
        actions={
          <Button size="sm">
            <Plus /> Add site
          </Button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pb-4 md:px-6 md:pb-6">
        <p className="text-muted-foreground text-sm">
          Scroll this box. The band takes a fill, a blur and its bottom rule the
          moment there is content behind it, and gives them back at the top.
        </p>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="bg-card text-muted-foreground rounded-lg border p-4 text-sm"
          >
            Row {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
