"use client";

import * as React from "react";

import { Button } from "@/registry/vianova/ui/button";
import { DirectionProvider } from "@/registry/vianova/ui/direction";
import { Input } from "@/registry/vianova/ui/input";

/**
 * Direction has no visual of its own -- it sets the reading direction for
 * every Base UI component beneath it, so the demo shows a small form flipping
 * between LTR and RTL.
 */
export default function DirectionDefault() {
  const [rtl, setRtl] = React.useState(false);
  return (
    <div className="w-full max-w-sm space-y-3">
      <Button variant="outline" size="sm" onClick={() => setRtl((v) => !v)}>
        {rtl ? "Switch to LTR" : "Switch to RTL"}
      </Button>
      <DirectionProvider direction={rtl ? "rtl" : "ltr"}>
        <div dir={rtl ? "rtl" : "ltr"} className="flex items-center gap-2">
          <Input placeholder="Search districts" />
          <Button size="sm">Go</Button>
        </div>
      </DirectionProvider>
    </div>
  );
}
