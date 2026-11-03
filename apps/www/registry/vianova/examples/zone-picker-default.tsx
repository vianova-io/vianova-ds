"use client";

import * as React from "react";

import {
  type PickerZone,
  ZonePicker,
  ZonePickerPanel,
  ZoneThumbnail,
} from "@/registry/vianova/product/zone-picker";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";

/** Mulberry32: a few lines, and the same zones on every render and every machine. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = [
  "Alfama",
  "Baixa",
  "Chiado",
  "Belém",
  "Graça",
  "Estrela",
  "Lapa",
  "Campo de Ourique",
  "Alcântara",
  "Areeiro",
  "Arroios",
  "Avenidas Novas",
  "Benfica",
  "Carnide",
  "Lumiar",
  "Marvila",
  "Olivais",
  "Parque das Nações",
  "Penha de França",
  "Santa Clara",
];
const KINDS = [
  { tag: "district", label: "District" },
  { tag: "parking", label: "Parking" },
  { tag: "school", label: "School zone" },
  { tag: "riverfront", label: "Riverfront" },
  { tag: "slow-zone", label: "Slow zone" },
];

/** Districts-like blobs scattered around central Lisbon. */
function makeZones(n: number): PickerZone[] {
  const rand = seeded(38_72);
  const zones: PickerZone[] = [];
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < n; i++) {
    const place = PLACES[i % PLACES.length]!;
    const kind = KINDS[Math.floor(rand() * KINDS.length)]!;
    const lat = 38.72 + (rand() - 0.5) * 0.08;
    const lng = -9.14 + (rand() - 0.5) * 0.14;
    const r = kind.tag === "district" ? 0.008 : 0.002 + rand() * 0.003;
    // A circle with a few low-frequency wobbles reads as a drawn boundary.
    const phase = rand() * Math.PI * 2;
    const wobble = 0.15 + rand() * 0.25;
    const steps = 18;
    const ring: [number, number][] = [];
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const k =
        1 +
        wobble * Math.sin(3 * a + phase) +
        0.1 * Math.cos(5 * a) +
        (rand() - 0.5) * 0.15;
      ring.push([
        lng + (r * k * Math.cos(a)) / Math.cos((lat * Math.PI) / 180),
        lat + r * k * Math.sin(a),
      ]);
    }
    ring.push(ring[0]!);
    const tags = [
      kind.tag,
      ...(rand() > 0.7 ? [KINDS[Math.floor(rand() * KINDS.length)]!.tag] : []),
    ];
    zones.push({
      id: `zone-${i + 1}`,
      name: `${place} ${kind.label.toLowerCase()} ${Math.floor(i / PLACES.length) + 1}`,
      tags: [...new Set(tags)],
      ring,
      createdAt: new Date(
        start + Math.floor(rand() * 600) * 86_400_000,
      ).toISOString(),
    });
  }
  return zones;
}

const ZONES = makeZones(300);

export default function ZonePickerDefault() {
  const [picking, setPicking] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [added, setAdded] = React.useState<PickerZone[]>(() =>
    ZONES.slice(0, 2),
  );
  const [preview, setPreview] = React.useState<PickerZone | null>(null);

  const add = (zones: PickerZone[]) =>
    setAdded((prev) => [...prev, ...zones]);

  return (
    <div className="flex flex-col gap-4">
      {/*
       * The in-depth screen: the column that held the rule gives way to the
       * picker, and whatever sits beside it -- a map, in the product -- stays
       * put. This is the default; the sheet below is for surfaces with no
       * column to spare.
       */}
      <div className="flex h-[42rem] overflow-hidden rounded-lg border">
        {/* As wide as the settings column it stands in for. */}
        <div className="flex w-[26rem] shrink-0 flex-col border-r">
          {picking ? (
            <ZonePickerPanel
              zones={ZONES}
              excludeIds={added.map((z) => z.id)}
              backLabel="Fleet cap · Parking"
              onBack={() => setPicking(false)}
              onPreviewChange={setPreview}
              onAdd={(zones) => {
                add(zones);
                setPicking(false);
              }}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <header className="space-y-0.5 border-b px-4 pt-3 pb-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  Parking
                </h2>
                <p className="text-muted-foreground text-sm">
                  {added.length} zone{added.length === 1 ? "" : "s"} in this
                  rule.
                </p>
              </header>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {added.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <ZoneThumbnail ring={zone.ring} size={24} />
                    <span className="truncate">{zone.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto border-t p-4">
                <Button className="w-full" onClick={() => setPicking(true)}>
                  Add zones
                </Button>
              </div>
            </div>
          )}
        </div>
        {/*
         * Standing in for the map. The point of the example is that this side
         * never goes away, and that it hears about the row under the pointer.
         */}
        <div className="bg-muted/40 flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          {preview ? (
            <>
              <ZoneThumbnail ring={preview.ring} size={96} />
              <Badge variant="secondary">{preview.name}</Badge>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              The map stays here. Point at a zone in the list to preview it.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Add zones in a sheet
        </Button>
        <p className="text-muted-foreground text-sm">
          The same picker, for surfaces with no column to give up.
        </p>
      </div>
      <ZonePicker
        open={open}
        onOpenChange={setOpen}
        zones={ZONES}
        excludeIds={added.map((z) => z.id)}
        onAdd={add}
      />
    </div>
  );
}
