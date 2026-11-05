"use client";

import * as React from "react";

import {
  type PickerZone,
  ZoneDraftPanel,
  type ZoneDrawTool,
} from "@/registry/vianova/product/zone-picker";

/** A closed ring of `corners` corners. Worked out, so the picture never moves. */
function ring(seed: number, corners: number): [number, number][] {
  const out: [number, number][] = [];
  const cx = -9.142 + seed * 0.009;
  const cy = 38.711;
  for (let i = 0; i < corners; i += 1) {
    const angle = (i / corners) * Math.PI * 2;
    const radius = 0.0034 + ((seed * 5 + i * 11) % 4) * 0.0005;
    out.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  out.push(out[0]!);
  return out;
}

const DRAWN: PickerZone[] = [
  { id: "draft-1", name: "Zone 3", corners: 6 },
  { id: "draft-2", name: "Zone 4", corners: 24 },
].map(({ id, name, corners }, i) => ({
  id,
  name,
  tags: ["drawn"],
  ring: ring(i + 1, corners),
  createdAt: new Date(Date.UTC(2026, 10, 4)).toISOString(),
}));

/**
 * A drawing session, mid-run, as a phone gets it.
 *
 * Above `lg` the session lives inside Add zones: its Draw tab holds the tools
 * and, underneath, the shapes they have made. Below `lg` the settings and the
 * map take turns, so there is no column to keep open beside the map -- and a
 * session with the map off screen is nothing at all. This is the same tools
 * and the same list again, as a tray docked over the map.
 *
 * The tools sit above the shapes they have produced for as long as the session
 * lasts. They used to float on the map instead -- the one surface that is also
 * the drawing surface -- which left the list with no way to change tool at all.
 *
 * Pressing the armed tool again stops drawing without discarding anything:
 * the list and its Add button still have work to do, and with the map's
 * Select button gone there is nothing else left to stop with.
 *
 * Shown without the tray's own geometry around it, and already running, so
 * that the panel is what the visual suite photographs.
 */
export default function ZonePickerDrawing() {
  const [tool, setTool] = React.useState<ZoneDrawTool | null>("polygon");
  const [drafts, setDrafts] = React.useState<PickerZone[]>(DRAWN);
  const [added, setAdded] = React.useState<PickerZone[] | null>(null);

  if (added) {
    return (
      <div className="flex h-[30rem] w-full max-w-md items-center justify-center rounded-lg border p-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {added.length} zone{added.length === 1 ? "" : "s"} added to the rule
          </p>
          <p className="text-muted-foreground text-sm">
            {added.map((z) => z.name).join(", ")}
          </p>
          <button
            type="button"
            className="text-primary text-sm underline underline-offset-4"
            onClick={() => {
              setAdded(null);
              setDrafts(DRAWN);
              setTool("polygon");
            }}
          >
            Draw again
          </button>
        </div>
      </div>
    );
  }

  return (
    /* The map the tray is docked over, and the slot it takes on it: inset
       from the sides, as `inset-x-2` insets it in the regulation editor, and
       docked to the bottom edge -- which is what the panel's square bottom
       corners are for.

       No `overflow-hidden` on the frame. A `FloatingPanel` carries a drop
       shadow, and a frame cut to its exact size sliced 14.5px off the bottom
       of it and 4.5px off each side. A tray floats; the box standing in for
       the map it floats over should not be the thing that clips it. */
    <div className="bg-muted/40 flex h-[30rem] w-full max-w-md flex-col justify-end rounded-lg border">
      <div className="mx-2 flex h-[22rem] flex-col">
        <ZoneDraftPanel
          tool={tool}
          onToolChange={setTool}
          drafts={drafts}
          focusId={null}
          onRename={(id, name) =>
            setDrafts((prev) =>
              prev.map((z) => (z.id === id ? { ...z, name } : z)),
            )
          }
          onRemove={(id) =>
            setDrafts((prev) => prev.filter((z) => z.id !== id))
          }
          onCancel={() => setAdded([])}
          onAdd={() => setAdded(drafts)}
        />
      </div>
    </div>
  );
}
