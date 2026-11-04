"use client";

import * as React from "react";

import {
  type PickerZone,
  ZoneDraftPanel,
  type ZoneDrawTool,
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

/*
 * A GeoJSON file served beside this page, so Import's link field can be shown
 * working. Any other host would have to allow requests from other sites, and
 * most do not -- which is the caveat the component documents.
 */
declare const process: { env: Record<string, string | undefined> };
const SAMPLE_GEOJSON = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/parking-bays-lisbon.geojson`;

const ZONES = makeZones(300);
/** Shapes for the drawing session to "finish", so the example needs no map. */
const DRAWN = makeZones(306).slice(300);

export default function ZonePickerDefault() {
  const [picking, setPicking] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [added, setAdded] = React.useState<PickerZone[]>(() =>
    ZONES.slice(0, 2),
  );
  const [preview, setPreview] = React.useState<PickerZone | null>(null);
  /*
   * The drawing session, which in the product is held by the block around
   * this: a tool that stays armed, the shapes finished so far, and the one
   * whose name should take the focus. Nothing reaches `added` until Add.
   */
  const [tool, setTool] = React.useState<ZoneDrawTool | null>(null);
  const [drafts, setDrafts] = React.useState<PickerZone[]>([]);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const drawing = tool !== null || drafts.length > 0;

  const add = (zones: PickerZone[]) =>
    setAdded((prev) => [...prev, ...zones]);

  const endSession = () => {
    setTool(null);
    setDrafts([]);
    setFocusId(null);
    setPreview(null);
  };

  /** Stands in for a shape closing on the map. */
  const finish = () => {
    const shape = DRAWN[drafts.length % DRAWN.length]!;
    const draft = {
      ...shape,
      id: `draft-${drafts.length + 1}`,
      name: `Zone ${added.length + drafts.length + 1}`,
      tags: ["drawn"],
    };
    setDrafts((prev) => [...prev, draft]);
    setFocusId(draft.id);
  };

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
          {drawing ? (
            /*
             * Drawing is a place, not an instant. The shapes collect here
             * with names you can type over, the tool stays armed, and Cancel
             * leaves no trace -- which is the part that committing each shape
             * as it closed could not offer.
             */
            <ZoneDraftPanel
              chrome="panel"
              tool={tool}
              drafts={drafts}
              ruleName="Fleet cap · Parking"
              focusId={focusId}
              onRename={(id, name) =>
                setDrafts((prev) =>
                  prev.map((z) => (z.id === id ? { ...z, name } : z)),
                )
              }
              onRemove={(id) =>
                setDrafts((prev) => prev.filter((z) => z.id !== id))
              }
              onPreviewChange={setPreview}
              onCancel={endSession}
              onAdd={() => {
                add(drafts);
                endSession();
              }}
            />
          ) : picking ? (
            <ZonePickerPanel
              zones={ZONES}
              excludeIds={added.map((z) => z.id)}
              backLabel="Fleet cap · Parking"
              urlSample={SAMPLE_GEOJSON}
              onBack={() => setPicking(false)}
              onPreviewChange={setPreview}
              onDraw={(picked) => {
                // One press arms it and hands the map over; the picker steps
                // aside rather than waiting for a second, confirming press.
                setPicking(false);
                setTool(picked);
              }}
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
          {drawing ? (
            <>
              {preview ? <ZoneThumbnail ring={preview.ring} size={96} /> : null}
              <p className="text-muted-foreground text-sm">
                {tool
                  ? `The map is armed for ${tool === "freehand" ? "free hand" : tool}.`
                  : "Drawing stopped. The shapes are still listed."}
              </p>
              {/* There is no map in an example, so this is the shape closing. */}
              <Button variant="outline" size="sm" disabled={!tool} onClick={finish}>
                Finish a shape
              </Button>
            </>
          ) : preview ? (
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
        urlSample={SAMPLE_GEOJSON}
        onAdd={add}
      />
    </div>
  );
}
