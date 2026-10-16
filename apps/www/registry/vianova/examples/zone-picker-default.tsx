"use client";

import * as React from "react";

import {
  type PickerZone,
  ZonePicker,
} from "@/registry/vianova/product/zone-picker";
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
  const [open, setOpen] = React.useState(false);
  const [added, setAdded] = React.useState<PickerZone[]>(() =>
    ZONES.slice(0, 2),
  );

  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => setOpen(true)}>Add zones</Button>
      <p className="text-sm text-muted-foreground">
        {added.length
          ? `In this rule: ${added.map((z) => z.name).join(", ")}`
          : "No zones in this rule yet."}
      </p>
      <ZonePicker
        open={open}
        onOpenChange={setOpen}
        zones={ZONES}
        excludeIds={added.map((z) => z.id)}
        onAdd={(zones) => setAdded((prev) => [...prev, ...zones])}
      />
    </div>
  );
}
