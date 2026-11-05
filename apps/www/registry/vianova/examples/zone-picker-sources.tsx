"use client";

import * as React from "react";

import {
  type PickerZone,
  type ZoneDrawTool,
  ZonePickerPanel,
} from "@/registry/vianova/product/zone-picker";

/**
 * A ring with `corners` corners, around a point nudged by `seed`.
 *
 * Worked out rather than drawn at random: this example is photographed by the
 * visual suite on every change, so a shape that differed between runs would
 * report a diff on every commit and mean nothing by it.
 */
function ring(seed: number, corners = 7): [number, number][] {
  const out: [number, number][] = [];
  const cx = -9.142 + (seed % 3) * 0.01;
  const cy = 38.71 + Math.floor(seed / 3) * 0.008;
  for (let i = 0; i < corners; i += 1) {
    const angle = (i / corners) * Math.PI * 2;
    const radius = 0.0032 + ((seed * 7 + i * 13) % 5) * 0.0004;
    out.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  // Closed, so it is a polygon and not a path.
  out.push(out[0]!);
  return out;
}

const NAMES = [
  ["Alfama", "historic"],
  ["Baixa", "retail"],
  ["Belém", "waterfront"],
  ["Chiado", "retail"],
  ["Parque das Nações", "riverside"],
  ["Cais do Sodré", "nightlife"],
] as const;

const ZONES: PickerZone[] = NAMES.map(([name, tag], i) => ({
  id: `zone-${i + 1}`,
  name,
  tags: [tag],
  ring: ring(i + 1),
  createdAt: new Date(Date.UTC(2026, 6, 14 + i * 9)).toISOString(),
}));

/**
 * Where the zones come from: Library, Draw or Import.
 *
 * The default example opens on the rule it adds to, so the chooser is a press
 * away and never reaches a screenshot. This one opens on the chooser itself,
 * which is what gives the tab row, the sticky search bar and the rows beneath
 * it a baseline of their own -- three pieces of chrome whose spacing and
 * surface have been wrong before, in dark, where `bg-popover` on a
 * `bg-background` panel reads as a lighter slab and in light reads as
 * nothing at all.
 */
export default function ZonePickerSources() {
  const [added, setAdded] = React.useState<PickerZone[]>([]);
  const [tool, setTool] = React.useState<ZoneDrawTool | null>(null);
  const [drafts, setDrafts] = React.useState<PickerZone[]>([]);

  return (
    <div className="flex h-[30rem] w-full max-w-md flex-col overflow-hidden rounded-lg border">
      <ZonePickerPanel
        zones={ZONES}
        excludeIds={added.map((z) => z.id)}
        backLabel="Parking · Baixa and Chiado"
        onBack={() => {
          setAdded([]);
          setTool(null);
          setDrafts([]);
        }}
        onAdd={(zones) => setAdded((prev) => [...prev, ...zones])}
        /*
         * Picking a tool arms it and stays put, exactly as it does in the
         * product: the tab row, the search and the import field are all still
         * there, and the shapes collect under the tools that made them.
         *
         * There is no map here to draw on, so the list stays empty and shows
         * what the armed tool is waiting for. That is the half worth seeing
         * anyway -- the panel used to be replaced wholesale at this point,
         * which took the other two sources away with it.
         */
        onDraw={setTool}
        session={{
          tool,
          drafts,
          focusId: null,
          onRename: (id, name) =>
            setDrafts((prev) =>
              prev.map((z) => (z.id === id ? { ...z, name } : z)),
            ),
          onRemove: (id) =>
            setDrafts((prev) => prev.filter((z) => z.id !== id)),
        }}
      />
    </div>
  );
}
