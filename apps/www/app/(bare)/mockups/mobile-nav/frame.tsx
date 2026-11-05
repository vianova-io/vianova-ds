"use client";

import * as React from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Clock,
  Database,
  Download,
  Hash,
  Layers,
  ListFilter,
  Map as MapIcon,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Table2,
} from "lucide-react";

import { BASEMAP_PREVIEWS } from "@/registry/vianova/lib/basemap-previews";
import { cn } from "@/registry/vianova/lib/utils";
import { BottomTray, type TraySnap } from "@/registry/vianova/patterns/bottom-tray";
import {
  ChartCard,
  ChartCardHeader,
  ChartCardMetric,
} from "@/registry/vianova/product/chart-card";
import { DataLayerCard } from "@/registry/vianova/product/data-layer-card";
import {
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapThumbnail, thumbnailSeed } from "@/registry/vianova/product/map-thumbnail";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Input } from "@/registry/vianova/ui/input";

/**
 * Compositions for the mobile-navigation mockups. TEMPORARY -- see frames.ts.
 *
 * Built from the registry's own components rather than drawn, because the
 * question these frames have to answer is whether a navigation pattern works
 * with THESE controls at THIS type scale: a hand-drawn rectangle labelled
 * "layer card" cannot tell you that three of them plus a 56px bar plus a 56px
 * tab bar leaves 140px of map.
 */

// `basePath` does not rewrite a raw string, and a worker that fails to load
// makes the map render nothing and report no error -- see map-canvas-default.
const WORKER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`;

const ZURICH: [number, number] = [8.5417, 47.3769];

/* ------------------------------------------------------------------ chrome */

/**
 * The 56px top bar, in the two forms these directions need.
 *
 * `scrim` is the map's treatment: a gradient, so the row does not read as a
 * second piece of chrome above the map. `solid` is for a region that is a list
 * rather than a map, where a translucent bar over scrolling text is just hard
 * to read.
 */
function Bar({
  left,
  title,
  sub,
  right,
  variant = "scrim",
}: {
  left?: React.ReactNode;
  title: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
  variant?: "scrim" | "solid";
}) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-2 px-2",
        variant === "scrim"
          ? "bg-linear-to-b from-background/85 via-background/55 to-transparent"
          : "bg-card/95 border-border border-b backdrop-blur",
      )}
    >
      {left}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium">{title}</h2>
        {sub ? (
          <p className="text-muted-foreground truncate text-xs">{sub}</p>
        ) : null}
      </div>
      {right ? (
        <div className="flex shrink-0 items-center gap-2">{right}</div>
      ) : null}
    </div>
  );
}

/** 36px box, 52px thumb target -- the ladder's icon button, as shipped. */
function IconBtn({
  label,
  active,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "secondary"}
      size="icon"
      aria-label={label}
      aria-expanded={active}
      onClick={onClick}
      className="relative after:absolute after:-inset-2 after:content-['']"
    >
      {children}
    </Button>
  );
}

/**
 * The back affordance, at 44px.
 *
 * The number is the proposal. Every way out of a detail view in the four
 * non-map blocks is 32px today (datahub:899, feeds:548, reports:4492,
 * regulations:1049) -- legal under WCAG 2.2 AA's 24px, and short of the 44px
 * responsive.spec.ts:318 already demands of the map's switcher. One of those
 * two numbers is wrong, and it is not the one with a test behind it.
 */
function Back({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Back"
      onClick={onClick}
      className="size-11 shrink-0"
    >
      <ArrowLeft className="size-5" />
    </Button>
  );
}

/**
 * The frame itself: a block, not a page.
 *
 * `h-full`, not `h-dvh` -- everything inside positions against this box, and
 * the clickable walkthrough puts one inside a fixed 844px div rather than a
 * viewport. The per-frame route supplies the viewport height instead.
 */
function Block({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-background text-foreground relative h-full w-full overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MapBackdrop({ basemap = "plan" }: { basemap?: "plan" | "satellite" | "terrain" }) {
  return (
    <div className="absolute inset-0">
      <MapCanvas
        workerUrl={WORKER_URL}
        center={ZURICH}
        zoom={11.2}
        basemap={basemap}
        interactive={false}
      />
    </div>
  );
}

/** A surface for a tray or a pushed region, so the content is never on bare map. */
function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card/95 border-border flex h-full w-full flex-col overflow-hidden border backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- regions */

/** The map's data panel, as it is today. */
/**
 * `header` is false when the region is PUSHED rather than opened in place.
 *
 * The c-map still showed the title twice -- "Data layers" in the bar and
 * "Data layers" again in the panel header, with the + button duplicated under
 * it. In direction C the bar names the level, so the region must not.
 */
function LayersRegion({
  compact = false,
  header = true,
}: {
  compact?: boolean;
  header?: boolean;
}) {
  return (
    <>
      {header ? (
      <FloatingPanelHeader>
        <FloatingPanelTitle>Data layers</FloatingPanelTitle>
        <FloatingPanelActions>
          <Button variant="ghost" size="icon" aria-label="Add data layer">
            <Plus />
          </Button>
        </FloatingPanelActions>
      </FloatingPanelHeader>
      ) : null}
      <FloatingPanelBody className="space-y-2 px-2 pb-2">
        <DataLayerCard
          name="Vehicle Flows"
          meta="Jan 1 – Dec 31, 2024 · Count distinct trip id"
          visualization="Lines"
          filterCount={3}
          expanded={!compact}
        />
        <DataLayerCard name="Parking infringements" expanded={false} />
        <DataLayerCard name="Vehicle snapshot" expanded={false} />
      </FloatingPanelBody>
    </>
  );
}

function ChartsRegion() {
  return (
    <>
      <FloatingPanelHeader>
        <FloatingPanelTitle>Charts</FloatingPanelTitle>
        <FloatingPanelActions>
          <Button variant="ghost" size="icon" aria-label="Export">
            <Download />
          </Button>
        </FloatingPanelActions>
      </FloatingPanelHeader>
      <FloatingPanelBody className="space-y-2 px-2 pb-2">
        <ChartCard>
          <ChartCardHeader title="Unique trips" icon={<Hash />} />
          <ChartCardMetric value="32 908" unit="Vehicles" />
        </ChartCard>
        <ChartCard>
          <ChartCardHeader title="Average duration" icon={<Clock />} />
          <ChartCardMetric value="14:20" unit="Minutes" />
        </ChartCard>
      </FloatingPanelBody>
    </>
  );
}

const RULES = [
  { name: "Low emission zone", zone: "Zürich Kreis 1", state: "Active" },
  { name: "Night delivery ban", zone: "Langstrasse", state: "Active" },
  { name: "Loading bay, 15 min", zone: "Bahnhofstrasse", state: "Draft" },
  { name: "Weight limit 7.5t", zone: "Limmatquai", state: "Active" },
];

function RulesRegion({ onOpen }: { onOpen?: (name: string) => void }) {
  return (
    <>
      <FloatingPanelHeader>
        <FloatingPanelTitle>Rules</FloatingPanelTitle>
        <FloatingPanelActions>
          <Button variant="ghost" size="icon" aria-label="Add rule">
            <Plus />
          </Button>
        </FloatingPanelActions>
      </FloatingPanelHeader>
      <FloatingPanelBody className="px-2 pb-2">
        <ul className="space-y-1">
          {RULES.map((rule) => (
            <li key={rule.name}>
              <button
                type="button"
                onClick={() => onOpen?.(rule.name)}
                className="hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{rule.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {rule.zone}
                  </span>
                </span>
                <Badge variant={rule.state === "Draft" ? "outline" : "secondary"}>
                  {rule.state}
                </Badge>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </FloatingPanelBody>
    </>
  );
}

function RuleSettingsRegion({
  name = "Low emission zone",
  header = true,
}: {
  name?: string;
  header?: boolean;
}) {
  return (
    <>
      {header ? (
      <FloatingPanelHeader>
        <FloatingPanelTitle>{name}</FloatingPanelTitle>
      </FloatingPanelHeader>
      ) : null}
      <FloatingPanelBody className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Applies to</p>
          <SegmentedControl
            items={[
              { value: "all", label: "All" },
              { value: "freight", label: "Freight" },
              { value: "taxi", label: "Taxi" },
            ]}
            defaultValue="freight"
            size="sm"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Zone</p>
          <Input defaultValue="Zürich Kreis 1" readOnly />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Hours</p>
          <div className="flex items-center gap-2">
            <Input defaultValue="22:00" readOnly />
            <span className="text-muted-foreground text-xs">to</span>
            <Input defaultValue="06:00" readOnly />
          </div>
        </div>
      </FloatingPanelBody>
    </>
  );
}

const WIDGETS = [
  { title: "Trips by hour", value: "32 908", unit: "Trips", rows: 4 },
  { title: "Infringements", value: "1 204", unit: "Events", rows: 2 },
  { title: "Average dwell", value: "6:41", unit: "Minutes", rows: 2 },
];

/**
 * A report's widgets at phone width.
 *
 * Heights derived from the width here, NOT from `w.layout.h * ROW_PX`, which
 * is what reports-workspace.tsx:3266 does -- a four-row widget is 540px tall
 * on a 390px-wide phone, so a near-square chart becomes a tall narrow box and
 * a six-widget report is about 3,000px of scroll inside a 633px block.
 */
function ReportRegion({ onOpen }: { onOpen?: (title: string) => void }) {
  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="space-y-2">
        {WIDGETS.map((w) => (
          <ChartCard key={w.title}>
            <ChartCardHeader
              title={w.title}
              icon={<Hash />}
              action={
                onOpen ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Open ${w.title}`}
                    onClick={() => onOpen(w.title)}
                  >
                    <ChevronRight />
                  </Button>
                ) : undefined
              }
            />
            <ChartCardMetric value={w.value} unit={w.unit} />
            {/* ChartCard already pads; this is the plot area inside it. */}
            <div
              className="bg-muted/60 flex items-end gap-1 rounded-md p-2"
              style={{ height: w.rows === 4 ? 128 : 72 }}
              aria-hidden
            >
              {Array.from({ length: 16 }, (_, i) => (
                <span
                  key={i}
                  className="bg-primary/70 flex-1 rounded-t-[2px]"
                  style={{ height: `${20 + ((i * 37) % 80)}%` }}
                />
              ))}
            </div>
          </ChartCard>
        ))}
      </div>
    </div>
  );
}

function ReportFiltersRegion() {
  return (
    <>
      <FloatingPanelHeader>
        <FloatingPanelTitle>Filters</FloatingPanelTitle>
        <FloatingPanelActions>
          <Button variant="ghost" size="sm">
            Clear
          </Button>
        </FloatingPanelActions>
      </FloatingPanelHeader>
      <FloatingPanelBody className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Period</p>
          <Input defaultValue="1 Jan – 31 Dec 2024" readOnly />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Vehicle type</p>
          <div className="flex flex-wrap gap-1.5">
            {["Car", "Van", "Truck", "Bus", "Moped"].map((t) => (
              <Badge key={t} variant={t === "Truck" ? "default" : "outline"}>
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Zones</p>
          <div className="flex flex-wrap gap-1.5">
            {["Kreis 1", "Kreis 4", "Langstrasse"].map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </FloatingPanelBody>
    </>
  );
}

const DATASETS = [
  { id: "sample-mds-vehicles-lisbon", name: "Vehicle snapshot", rows: "182 400 rows" },
  { id: "sample-infringements-lisbon", name: "Parking infringements", rows: "1 204 rows" },
  { id: "sample-trips-zurich", name: "Vehicle Flows", rows: "32 908 rows" },
  { id: "sample-counters-zurich", name: "Counting stations", rows: "96 rows" },
];

function DatasetListRegion({ onOpen }: { onOpen?: (name: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input placeholder="Search datasets" className="pl-8" readOnly />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-2">
          {DATASETS.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onOpen?.(d.name)}
                className="bg-card hover:bg-accent focus-visible:ring-ring/50 border-border flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-lg border p-2 text-left focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <MapThumbnail
                  seed={thumbnailSeed(d.id)}
                  className="size-12 shrink-0 rounded-md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{d.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {d.rows}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DatasetDetailRegion({ name }: { name?: string }) {
  // `name` is accepted and deliberately not printed: the bar above already
  // says it, and the duplicate was the first thing that looked wrong in the
  // c-datahub still. Kept in the signature because the walkthrough passes the
  // dataset it pushed, and a region that cannot be told what it is showing is
  // the wrong shape for the implementation.
  void name;
  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center gap-2 border-b p-2">
        <Badge variant="secondary">182 400 rows</Badge>
        <Badge variant="outline">12 columns</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0">
            <tr>
              {["vehicle_id", "type", "battery"].map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-medium">
                  <span className="flex items-center gap-1">
                    {c}
                    {/*
                      44px, not the 18x18 of datahub-workspace.tsx:681 -- a
                      `p-0.5` around a `size-3.5` icon, and the only way to see
                      a column's values. That one really does fail WCAG 2.2 AA,
                      and a11y.spec.ts cannot see it because the suite tags
                      only through wcag21aa while axe ships target-size under
                      wcag22aa.
                    */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Values in ${c}`}
                      className="size-11"
                    >
                      <SlidersHorizontal className="size-4" />
                    </Button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 14 }, (_, i) => (
              <tr key={i} className="border-border/60 border-b">
                <td className="text-muted-foreground px-2 py-1.5 font-mono">
                  {`VH-${(4821 + i * 7).toString()}`}
                </td>
                <td className="px-2 py-1.5">{i % 3 === 0 ? "Van" : "Car"}</td>
                <td className="px-2 py-1.5">{`${92 - i * 3}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The basemap picker, with the pictures it loses today.
 *
 * Below md the switcher is dropped (map-workspace.tsx:1899) and the basemaps
 * become three text radio items in the overflow menu -- while 12.3KB of real
 * WebP map renders already ship in the bundle and go unused there. The one
 * control whose entire job is showing you what you are choosing between shows
 * nothing on the screen where "Plan" versus "Terrain" is least guessable.
 *
 * The two-image `dark:` swap is BasemapPreview's, copied rather than imported
 * because that function is module-private in basemap-switcher.tsx. Exporting
 * it is step 4 of the implementation phase.
 */
function BasemapChoices({
  layout = "row",
  selected = "plan",
}: {
  layout?: "row" | "grid" | "list";
  selected?: string;
}) {
  const items = [
    { id: "plan" as const, label: "Plan", note: "Streets and labels" },
    { id: "satellite" as const, label: "Satellite", note: "Imagery with labels" },
    { id: "terrain" as const, label: "Terrain", note: "Relief and hillshade" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Basemap"
      className={cn(
        layout === "row" && "grid grid-cols-3 gap-2",
        layout === "grid" && "grid grid-cols-2 gap-3",
        layout === "list" && "space-y-2",
      )}
    >
      {items.map((item) => {
        const preview = BASEMAP_PREVIEWS[item.id];
        const active = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={cn(
              "focus-visible:ring-ring/50 group overflow-hidden rounded-lg border-2 text-left focus-visible:ring-[3px] focus-visible:outline-none",
              active ? "border-primary" : "border-border",
              layout === "list" && "flex w-full items-center gap-3",
            )}
          >
            <span
              className={cn(
                "bg-muted relative block overflow-hidden",
                layout === "row" && "aspect-4/3 w-full",
                layout === "grid" && "aspect-4/3 w-full",
                layout === "list" && "size-14 shrink-0",
              )}
            >
              <img
                src={preview.light}
                alt=""
                aria-hidden
                className="block size-full object-cover dark:hidden"
              />
              <img
                src={preview.dark}
                alt=""
                aria-hidden
                className="hidden size-full object-cover dark:block"
              />
            </span>
            <span
              className={cn(
                "block px-2 py-1.5",
                layout === "list" && "min-w-0 flex-1",
              )}
            >
              <span className="block truncate text-xs font-medium">
                {item.label}
              </span>
              {layout !== "row" ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {item.note}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- directions */

type Region = {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  /** The tray needs its own surface; a region that brings one says so. */
  bare?: boolean;
};

/**
 * Direction A -- tray everywhere.
 *
 * The map's shipped mechanism, generalised: the primary region fills the
 * block, the secondary ones arrive as a BottomTray over it at three heights,
 * and the lit disclosure closes so the primary can be seen whole. This uses
 * the real `patterns/bottom-tray`, so what the frame shows is what the
 * component does -- including the drag, if you try it in the iframe.
 */
function DirectionA({
  title,
  sub,
  primary,
  regions,
  initial,
  initialSnap = "half",
}: {
  title: string;
  sub?: string;
  primary: React.ReactNode;
  regions: Region[];
  initial: string;
  initialSnap?: TraySnap;
}) {
  const [open, setOpen] = React.useState<string | null>(initial);
  const [snap, setSnap] = React.useState<TraySnap>(initialSnap);
  const region = regions.find((r) => r.id === open);

  return (
    <Block>
      {primary}
      <Bar
        title={title}
        sub={sub}
        right={regions.map((r) => (
          <IconBtn
            key={r.id}
            label={r.label}
            active={open === r.id}
            onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
          >
            {r.icon}
          </IconBtn>
        ))}
      />
      <BottomTray
        open={open !== null}
        onOpenChange={(next) => setOpen(next ? initial : null)}
        snap={snap}
        onSnapChange={setSnap}
        label={region?.label ?? "Panel"}
        className="inset-x-2 bottom-10"
      >
        <Surface className="rounded-t-xl border-b-0 pt-4 shadow-lg">
          {region?.content}
        </Surface>
      </BottomTray>
    </Block>
  );
}

/**
 * Direction B -- a bottom segment bar.
 *
 * A persistent 56px bar naming the block's regions, switching full-screen
 * views. The convention people arrive with from every other app on the phone,
 * and the one direction where a region is never partly covered by another.
 * The price is in the frame itself: 56px at the top and 56px at the bottom of
 * an 844px screen leaves the map 732px, and it is gone for good rather than
 * dismissible.
 */
function DirectionB({
  title,
  sub,
  regions,
  initial,
}: {
  title: string;
  sub?: string;
  regions: Region[];
  initial: string;
}) {
  const [active, setActive] = React.useState(initial);
  const region = regions.find((r) => r.id === active) ?? regions[0]!;

  return (
    <Block>
      <Bar
        title={title}
        sub={sub}
        variant={region.bare ? "scrim" : "solid"}
        right={
          <Button variant="secondary" size="icon" aria-label="More map options">
            <MoreVertical />
          </Button>
        }
      />
      <div className="absolute inset-x-0 top-0 bottom-14">
        {region.bare ? (
          region.content
        ) : (
          <div className="flex h-full flex-col pt-14">{region.content}</div>
        )}
      </div>
      {/*
        role="tablist" is deliberately NOT used: these switch regions of the
        block, not panels of a tab set, and two of them scroll independently.
        A nav with aria-current is the honest description, and it is what the
        push direction's root list would need anyway.
      */}
      <nav
        aria-label={`${title} regions`}
        className="bg-card/95 border-border absolute inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t backdrop-blur"
      >
        {regions.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-current={active === r.id ? "page" : undefined}
            onClick={() => setActive(r.id)}
            className={cn(
              "focus-visible:ring-ring/50 flex flex-1 flex-col items-center justify-center gap-0.5 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:outline-none",
              active === r.id ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="[&_svg]:size-5">{r.icon}</span>
            <span className="text-[11px] leading-none">{r.label}</span>
          </button>
        ))}
      </nav>
    </Block>
  );
}

/**
 * Direction C -- list to detail, pushed.
 *
 * Not a new idea in this system: `product/panel-stepper.tsx` already does it.
 * Cascading popovers at lg, and below lg it docks
 * (`absolute inset-x-2 bottom-10 z-50 lg:hidden`) showing one panel at a time
 * with Back and Close. Three of the five blocks also push a detail over a list
 * already -- they just each do it differently, with a 32px way out and the
 * title in three different places.
 */
function DirectionC({
  root,
  rootTitle,
  rootSub,
  pushed,
  pushedTitle,
  action,
  rootBare,
}: {
  root: React.ReactNode;
  rootTitle: string;
  rootSub?: string;
  pushed?: React.ReactNode;
  pushedTitle?: string;
  action?: React.ReactNode;
  /** The root draws its own full-bleed surface -- a map, not a list. */
  rootBare?: boolean;
}) {
  const [depth, setDepth] = React.useState(pushed ? 1 : 0);
  const inner = depth === 1 && pushed;

  return (
    <Block>
      <Bar
        // A solid bar over a pushed region, the map's gradient over the map:
        // a translucent row over scrolling text is just hard to read, and a
        // solid one over tiles reads as a second piece of chrome.
        variant={inner || !rootBare ? "solid" : "scrim"}
        left={inner ? <Back onClick={() => setDepth(0)} /> : undefined}
        title={inner ? (pushedTitle ?? "Detail") : rootTitle}
        sub={inner ? rootTitle : rootSub}
        right={action}
      />
      {/*
        The root stays MOUNTED under the pushed level; the level is an opaque
        overlay, not a replacement.

        Found by clicking the walkthrough, which is the argument for building
        one. Swapping `inner ? pushed : root` unmounts the root -- and when
        the root is a map that means MapLibre is destroyed on push and rebuilt
        on back, so returning from the layer panel left the phone looking at a
        black rectangle for about three seconds while every tile refetched.
        Invisible in a still, fatal in the hand.

        So this is a constraint direction C imposes rather than a detail of
        the mockup: a push over a map has to overlay. Which in turn means the
        overlay must be fully opaque -- Surface is bg-card/95, and 5% of a
        live map showing through a settings list is worse than either.
      */}
      <div className="absolute inset-0 top-14">
        <div className="h-full">{root}</div>
        {inner ? (
          <Surface className="bg-card absolute inset-0 h-full border-0">
            {pushed}
          </Surface>
        ) : null}
      </div>
    </Block>
  );
}

/* ------------------------------------------------------------- the diagnostic */

/**
 * Not a proposal: the `useIsMobile` defect, shown rather than described.
 *
 * `hooks/use-mobile.ts` breaks at 768 and returns FALSE on first paint, and
 * `reports-workspace.tsx:2529-2595` renders a visible trigger in both
 * branches. So at 390 the exported HTML ships the desktop Popover and swaps a
 * frame later, and between 768 and 1023 the block is stacked by its own
 * container rule but gets the Popover anyway.
 *
 * `useDocked` (panel-stepper.tsx:86-103) is the compliant counterpart and
 * carries the reason in its own comment: false-on-first-paint is acceptable
 * there only because at first paint the chain is CLOSED, so there is no open
 * panel to put in the wrong place. That is the rule worth hoisting.
 */
function DefectFrame() {
  const rows = [
    {
      when: "First paint — what the static export ships",
      detail: "useIsMobile() === false, so the desktop Popover trigger renders",
      trigger: (
        <Button variant="outline" size="sm">
          <ListFilter />
          Filters
          <Badge variant="secondary">3</Badge>
        </Button>
      ),
      tone: "border-destructive/60",
    },
    {
      when: "One frame later — after the effect runs",
      detail: "useIsMobile() === true, so the Drawer trigger replaces it",
      trigger: (
        <Button variant="secondary" size="icon" aria-label="Filters">
          <SlidersHorizontal />
        </Button>
      ),
      tone: "border-border",
    },
  ];
  return (
    <Block className="overflow-y-auto">
      <div className="space-y-3 p-3">
        <div>
          <h2 className="text-sm font-medium">CardFilters at 390px</h2>
          <p className="text-muted-foreground text-xs">
            reports-workspace.tsx:2529–2595
          </p>
        </div>
        {rows.map((row) => (
          <div
            key={row.when}
            className={cn("space-y-2 rounded-lg border-2 p-3", row.tone)}
          >
            <p className="text-xs font-medium">{row.when}</p>
            <ChartCard>
              <ChartCardHeader
                title="Trips by hour"
                icon={<Hash />}
                action={row.trigger}
              />
              <ChartCardMetric value="32 908" unit="Trips" />
            </ChartCard>
            <p className="text-muted-foreground text-xs">{row.detail}</p>
          </div>
        ))}
        <p className="text-muted-foreground text-xs">
          Between 768 and 1023 the stacked block keeps the first row forever:
          the container rule stacks at 560px, the hook switches at 768.
        </p>
      </div>
    </Block>
  );
}

/* ------------------------------------------------------------------ frames */

const mapRegions = (): Region[] => [
  { id: "data", label: "Data layers", icon: <Layers />, content: <LayersRegion /> },
  { id: "charts", label: "Charts", icon: <BarChart3 />, content: <ChartsRegion /> },
];

const ruleRegions = (): Region[] => [
  { id: "rules", label: "Rules", icon: <ListFilter />, content: <RulesRegion /> },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings2 />,
    content: <RuleSettingsRegion />,
  },
];

function ExportRegion() {
  return (
    <>
      <FloatingPanelHeader>
        <FloatingPanelTitle>Export</FloatingPanelTitle>
      </FloatingPanelHeader>
      <FloatingPanelBody className="space-y-2 px-2 pb-2">
        {["PNG of the report", "CSV of every widget", "PDF, one widget a page"].map(
          (label) => (
            <button
              key={label}
              type="button"
              className="hover:bg-accent border-border focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 text-left text-sm focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <Download className="text-muted-foreground size-4 shrink-0" />
              {label}
            </button>
          ),
        )}
      </FloatingPanelBody>
    </>
  );
}

function BasemapRegion({ layout }: { layout: "row" | "grid" | "list" }) {
  return (
    <>
      <FloatingPanelHeader>
        <FloatingPanelTitle>Basemap</FloatingPanelTitle>
      </FloatingPanelHeader>
      <FloatingPanelBody className="px-2 pb-2">
        <BasemapChoices layout={layout} />
      </FloatingPanelBody>
    </>
  );
}

/** Wraps a region that is not a map so it clears the 56px bar. */
function UnderBar({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 top-14">{children}</div>;
}

export function Frame({ id }: { id: string }) {
  switch (id) {
    /* ---- A, tray everywhere ---- */
    case "a-map":
      return (
        <DirectionA
          title="Zürich freight flows"
          primary={<MapBackdrop />}
          regions={mapRegions()}
          initial="data"
        />
      );
    case "a-regulations":
      return (
        <DirectionA
          title="Zürich regulations"
          primary={<MapBackdrop />}
          regions={ruleRegions()}
          initial="rules"
        />
      );
    case "a-reports":
      return (
        <DirectionA
          title="Q4 freight report"
          primary={<UnderBar>{<ReportRegion />}</UnderBar>}
          regions={[
            {
              id: "filters",
              label: "Filters",
              icon: <ListFilter />,
              content: <ReportFiltersRegion />,
            },
          ]}
          initial="filters"
          initialSnap="peek"
        />
      );
    case "a-datahub":
      return (
        <DirectionA
          title="Datasets"
          primary={<UnderBar>{<DatasetListRegion />}</UnderBar>}
          regions={[
            {
              id: "detail",
              label: "Vehicle snapshot",
              icon: <Table2 />,
              content: <DatasetDetailRegion />,
            },
          ]}
          initial="detail"
          initialSnap="full"
        />
      );
    case "a-basemap":
      return (
        <DirectionA
          title="Zürich freight flows"
          primary={<MapBackdrop />}
          regions={[
            {
              id: "basemap",
              label: "Basemap",
              icon: <MapIcon />,
              content: <BasemapRegion layout="row" />,
            },
          ]}
          initial="basemap"
          // Half, not peek. Measured at 390x844: peek is 0.15 of the block,
          // 126px, and the row needs about 172 -- a 24px grabber, a 36px
          // header, an 88px picture at 4:3 across a third of the width, and a
          // 24px caption. At peek the captions are below the fold, which is
          // the one thing a picker of three near-identical pictures cannot
          // afford to lose. Either the tray wants a snap between peek and
          // half, or the basemap picker is a pushed level -- which is what
          // c-basemap shows.
          initialSnap="half"
        />
      );

    /* ---- B, bottom segment bar ---- */
    case "b-map":
      return (
        <DirectionB
          title="Zürich freight flows"
          initial="map"
          regions={[
            { id: "map", label: "Map", icon: <MapIcon />, content: <MapBackdrop />, bare: true },
            { id: "layers", label: "Layers", icon: <Layers />, content: <LayersRegion /> },
            { id: "charts", label: "Charts", icon: <BarChart3 />, content: <ChartsRegion /> },
          ]}
        />
      );
    case "b-regulations":
      return (
        <DirectionB
          title="Zürich regulations"
          initial="rules"
          regions={[
            { id: "map", label: "Map", icon: <MapIcon />, content: <MapBackdrop />, bare: true },
            { id: "rules", label: "Rules", icon: <ListFilter />, content: <RulesRegion /> },
            { id: "settings", label: "Settings", icon: <Settings2 />, content: <RuleSettingsRegion /> },
          ]}
        />
      );
    case "b-reports":
      return (
        <DirectionB
          title="Q4 freight report"
          initial="report"
          regions={[
            { id: "report", label: "Report", icon: <BarChart3 />, content: <ReportRegion /> },
            { id: "filters", label: "Filters", icon: <ListFilter />, content: <ReportFiltersRegion /> },
            { id: "export", label: "Export", icon: <Download />, content: <ExportRegion /> },
          ]}
        />
      );
    case "b-datahub":
      return (
        <DirectionB
          title="Vehicle snapshot"
          sub="Data hub"
          initial="columns"
          regions={[
            { id: "datasets", label: "Datasets", icon: <Database />, content: <DatasetListRegion /> },
            { id: "columns", label: "Columns", icon: <Table2 />, content: <DatasetDetailRegion /> },
            {
              id: "preview",
              label: "Preview",
              icon: <MapIcon />,
              content: (
                <div className="p-3">
                  <MapThumbnail
                    seed={thumbnailSeed("sample-mds-vehicles-lisbon")}
                    className="aspect-square w-full rounded-lg border"
                  />
                </div>
              ),
            },
          ]}
        />
      );
    case "b-basemap":
      return (
        <DirectionB
          title="Zürich freight flows"
          initial="basemap"
          regions={[
            { id: "map", label: "Map", icon: <MapIcon />, content: <MapBackdrop />, bare: true },
            {
              id: "basemap",
              label: "Basemap",
              icon: <Layers />,
              content: (
                <div className="overflow-y-auto p-3">
                  <BasemapChoices layout="grid" />
                </div>
              ),
            },
            { id: "charts", label: "Charts", icon: <BarChart3 />, content: <ChartsRegion /> },
          ]}
        />
      );

    /* ---- C, list to detail, pushed ---- */
    case "c-map":
      return (
        <DirectionC
          rootTitle="Zürich freight flows"
          rootBare
          root={<MapBackdrop />}
          pushedTitle="Data layers"
          pushed={<LayersRegion header={false} />}
          action={
            <Button variant="ghost" size="icon" aria-label="Add data layer">
              <Plus />
            </Button>
          }
        />
      );
    case "c-regulations":
      return (
        <DirectionC
          rootTitle="Zürich regulations"
          root={<Surface className="h-full border-0">{<RulesRegion />}</Surface>}
          pushedTitle="Low emission zone"
          pushed={<RuleSettingsRegion header={false} />}
        />
      );
    case "c-reports":
      return (
        <DirectionC
          rootTitle="Q4 freight report"
          root={<ReportRegion />}
          pushedTitle="Trips by hour"
          pushed={
            <div className="space-y-3 p-3">
              <ChartCard>
                <ChartCardHeader title="Trips by hour" icon={<Hash />} />
                <ChartCardMetric value="32 908" unit="Trips" />
                <div
                  className="bg-muted/60 flex items-end gap-1 rounded-md p-2"
                  style={{ height: 260 }}
                  aria-hidden
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <span
                      key={i}
                      className="bg-primary/70 flex-1 rounded-t-[2px]"
                      style={{ height: `${15 + ((i * 29) % 85)}%` }}
                    />
                  ))}
                </div>
              </ChartCard>
              <ReportFiltersRegion />
            </div>
          }
        />
      );
    case "c-datahub":
      return (
        <DirectionC
          rootTitle="Datasets"
          rootSub="Data hub"
          root={<DatasetListRegion />}
          pushedTitle="Vehicle snapshot"
          pushed={<DatasetDetailRegion />}
        />
      );
    case "c-basemap":
      return (
        <DirectionC
          rootTitle="Zürich freight flows"
          rootBare
          root={<MapBackdrop />}
          pushedTitle="Basemap"
          pushed={
            <div className="overflow-y-auto p-3">
              <BasemapChoices layout="list" />
            </div>
          }
        />
      );

    case "defect-cardfilters":
      return <DefectFrame />;

    default:
      return (
        <Block>
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-muted-foreground text-sm">
              No mockup frame called “{id}”.
            </p>
          </div>
        </Block>
      );
  }
}

/* ------------------------------------------------------- clickable: C, live */

type Level = {
  title: string;
  sub?: string;
  content: React.ReactNode;
  action?: React.ReactNode;
  /** Full-bleed, no surface: the map. */
  bare?: boolean;
};

/**
 * Direction C, clickable.
 *
 * A still cannot answer the only question this direction raises: whether a
 * push reads as going somewhere you can come back from. So this is a real
 * stack over all four blocks -- push a layer, a rule, a widget, a dataset, and
 * come back out.
 *
 * It renders in an ordinary div rather than needing a 390px viewport, which is
 * true of direction C specifically: its chrome is a bar, a back button and one
 * region at a time, and not one of them is behind a media query. That is an
 * argument for the direction as much as a convenience here -- B's bar is the
 * same, while A has to dissolve its tray at lg, which is the lifecycle problem
 * `ui/drawer` cannot solve and `BottomTray` exists for.
 */
export function Walkthrough() {
  const blocks = ["Map", "Regulations", "Report", "Data hub"] as const;
  type BlockName = (typeof blocks)[number];
  const [block, setBlock] = React.useState<BlockName>("Map");
  const [stack, setStack] = React.useState<Level[]>([]);

  const push = (level: Level) => setStack((s) => [...s, level]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const reset = (next: BlockName) => {
    setBlock(next);
    setStack([]);
  };

  const roots: Record<BlockName, Level> = {
    Map: {
      title: "Zürich freight flows",
      bare: true,
      content: <MapBackdrop />,
      action: (
        <>
          <IconBtn
            label="Data layers"
            onClick={() =>
              push({
                title: "Data layers",
                sub: "Zürich freight flows",
                content: <LayersRegion header={false} />,
                action: (
                  <Button variant="ghost" size="icon" aria-label="Add data layer">
                    <Plus />
                  </Button>
                ),
              })
            }
          >
            <Layers />
          </IconBtn>
          <IconBtn
            label="Basemap"
            onClick={() =>
              push({
                title: "Basemap",
                sub: "Zürich freight flows",
                content: (
                  <div className="overflow-y-auto p-3">
                    <BasemapChoices layout="list" />
                  </div>
                ),
              })
            }
          >
            <MapIcon />
          </IconBtn>
        </>
      ),
    },
    Regulations: {
      title: "Zürich regulations",
      content: (
        <RulesRegion
          onOpen={(name) =>
            push({
              title: name,
              sub: "Zürich regulations",
              content: <RuleSettingsRegion name={name} header={false} />,
            })
          }
        />
      ),
    },
    Report: {
      title: "Q4 freight report",
      content: (
        <ReportRegion
          onOpen={(title) =>
            push({
              title,
              sub: "Q4 freight report",
              content: (
                <div className="space-y-3 p-3">
                  <ChartCard>
                    <ChartCardHeader title={title} icon={<Hash />} />
                    <ChartCardMetric value="32 908" unit="Trips" />
                    <div
                      className="bg-muted/60 flex items-end gap-1 rounded-md p-2"
                      style={{ height: 240 }}
                      aria-hidden
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <span
                          key={i}
                          className="bg-primary/70 flex-1 rounded-t-[2px]"
                          style={{ height: `${15 + ((i * 29) % 85)}%` }}
                        />
                      ))}
                    </div>
                  </ChartCard>
                  <ReportFiltersRegion />
                </div>
              ),
            })
          }
        />
      ),
    },
    "Data hub": {
      title: "Datasets",
      sub: "Data hub",
      content: (
        <DatasetListRegion
          onOpen={(name) =>
            push({
              title: name,
              sub: "Datasets",
              content: <DatasetDetailRegion name={name} />,
            })
          }
        />
      ),
    },
  };

  const root = roots[block];
  const level = stack[stack.length - 1] ?? root;
  const inner = stack.length > 0;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <SegmentedControl
        items={blocks.map((b) => ({ value: b, label: b }))}
        value={block}
        onValueChange={(next) => reset(next as BlockName)}
        className="max-w-[390px]"
      />
      <div className="border-border relative h-[844px] w-[390px] overflow-hidden rounded-[28px] border-4 shadow-lg">
        <Block>
          <Bar
            variant={inner || !root.bare ? "solid" : "scrim"}
            left={inner ? <Back onClick={pop} /> : undefined}
            title={level.title}
            sub={level.sub}
            right={inner ? level.action : root.action}
          />
          {/* The root stays mounted underneath -- see DirectionC. */}
          <div className="absolute inset-0 top-14">
            <div className="h-full">{root.content}</div>
            {inner ? (
              <Surface
                // Keyed on depth so each push re-runs the entrance: without
                // it React reuses the node and the level changes with no
                // transition at all, which is the thing being judged.
                key={stack.length}
                className="animate-in slide-in-from-right-4 bg-card absolute inset-0 h-full border-0 duration-200"
              >
                {level.content}
              </Surface>
            ) : null}
          </div>
        </Block>
      </div>
      <p className="text-muted-foreground max-w-[390px] text-xs">
        {inner
          ? "Back returns to the root. The bar's second line names where you came from."
          : "Open a rule, a widget, a dataset or the layer panel. The map's root keeps the gradient bar; a pushed region gets a solid one."}
      </p>
    </div>
  );
}
