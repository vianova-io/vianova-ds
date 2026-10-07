"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Columns3,
  Database,
  Hash,
  ImageOff,
  ImagePlus,
  Link2,
  MapPin,
  Scale,
  Search,
  Shapes,
  Sparkles,
  Table2,
  Tag,
  Trash2,
  TriangleAlert,
  Type,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/registry/vianova/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/registry/vianova/ui/avatar";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import { Textarea } from "@/registry/vianova/ui/textarea";
import { ConfirmDialog } from "@/registry/vianova/patterns/confirm-dialog";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import { inferColumns, parseCsv, type ColumnType } from "@/registry/vianova/lib/csv";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

type Section = "data" | "zones" | "regulations";


/** A category value's identity on a map: a colour, and optionally a logo. */
type CategoryStyle = { color: string; logo?: string };

type Column = {
  name: string;
  description: string;
  type: ColumnType;
  unit: string;
  /** Category columns only: the distinct values, in display order. */
  values?: string[];
  /** Keyed by value. A value with no entry falls back to the palette. */
  styles?: Record<string, CategoryStyle>;
};

type Dataset = {
  id: string;
  section: Section;
  title: string;
  description: string;
  aiGenerated?: boolean;
  /** Platform-provided stream rather than something the team uploaded. */
  vip?: boolean;
  /** Regulations only. */
  status?: "active" | "inactive";
  rowRepresents?: string;
  owner: string;
  domain: string;
  uploadedAt: string;
  dateRange?: [string, string];
  rows: number;
  columns: Column[];
  /** Real rows, when the dataset came from a file. Otherwise a preview is generated. */
  preview?: string[][];
  seed: number;
};

const COLUMN_TYPES: ColumnType[] = [
  "id",
  "category",
  "geometry",
  "timestamp",
  "number",
  "text",
];

const TYPE_ICON: Record<ColumnType, React.ComponentType<{ className?: string }>> = {
  id: Hash,
  category: Tag,
  geometry: MapPin,
  timestamp: Calendar,
  number: Hash,
  text: Type,
};

/**
 * Identity colours for category values, chosen to stay distinct from one
 * another rather than to follow the theme.
 *
 * Raw hex on purpose: a category's colour is data the author assigns and the
 * map then paints with, not UI chrome, so it must not shift when the theme
 * does. The chart ramp is no substitute -- it is a single hue running light to
 * dark, which is exactly wrong for telling five values apart. The first stop
 * is the product primary.
 */
const SWATCHES = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#65a30d",
  "#dc2626",
  "#0891b2",
];

const col = (
  name: string,
  type: ColumnType,
  description: string,
  extra: Partial<Column> = {},
): Column => ({ name, type, description, unit: "N/A", ...extra });

const TRAFFIC_COLUMNS: Column[] = [
  col("ROAD_ID", "id", "Unique identifier for the road segment"),
  col("TRIP_ID", "id", "Unique identifier for each vehicle trip"),
  col("ZONE_ID", "id", "Identifier for the geographic zone"),
  col("INDUSTRY", "category", "Industry classification of the vehicle", {
    values: ["Logistics", "Construction", "Retail", "Passenger"],
  }),
  col("geometry", "geometry", "Geographic route or path taken by the vehicle"),
  col("ROAD_NAME", "category", "Name of the road or street where the trip was recorded", {
    values: ["Rue Maréchal Galliani", "Quai de Southampton", "Boulevard Clemenceau"],
  }),
  col("TIMESTAMP", "timestamp", "When the trip or route segment was recorded"),
  col("ORIGIN_NAME", "category", "Starting location or city of the trip", {
    values: ["Le Havre", "Rouen", "Caen", "Paris"],
  }),
  col("OD_ROUTE_KEY", "id", "Unique key identifying the origin-destination route"),
  col("VEHICLE_TYPE", "category", "Type or category of vehicle", {
    values: ["Car", "Van", "Truck", "Bus"],
  }),
  col("DESTINATION_NAME", "category", "Ending location or city of the trip", {
    values: ["Le Havre", "Rouen", "Caen", "Paris"],
  }),
];

const VESSEL_COLUMNS: Column[] = [
  col("MMSI", "id", "Maritime Mobile Service Identity of the vessel"),
  col("VESSEL_NAME", "text", "Name broadcast by the vessel"),
  col("SHIP_TYPE", "category", "Vessel classification", {
    values: ["Cargo", "Tanker", "Tug", "Passenger", "Fishing"],
  }),
  col("NAV_STATUS", "category", "Reported navigation status", {
    values: ["Under way", "At anchor", "Moored"],
  }),
  col("SPEED", "number", "Speed over ground", { unit: "kn" }),
  col("geometry", "geometry", "Reported position"),
  col("TIMESTAMP", "timestamp", "Time of the position report"),
];

const ZONE_COLUMNS: Column[] = [
  col("ZONE_ID", "id", "Unique identifier for the zone"),
  col("NAME", "text", "Display name of the zone"),
  col("geometry", "geometry", "Zone boundary"),
  col("AREA", "number", "Surface area of the zone", { unit: "km²" }),
];

const REGULATION_COLUMNS: Column[] = [
  col("REGULATION_ID", "id", "Unique identifier for the regulation"),
  col("RULE", "text", "Short statement of the rule"),
  col("VEHICLE_CLASS", "category", "Vehicle class the rule applies to", {
    values: ["All vehicles", "Trucks", "Vans"],
  }),
  col("geometry", "geometry", "Where the rule applies"),
  col("VALID_FROM", "timestamp", "Start of validity"),
];

/**
 * Sample catalogue. The titles and descriptions follow what a Vianova platform
 * team actually sees, so the block looks right; the owner is fictional.
 */
const SAMPLE_DATASETS: Dataset[] = [
  {
    id: "d1",
    section: "data",
    title: "Étude Rue Maréchal Galliani",
    description:
      "Vehicle trip and route data from a traffic study on Rue Maréchal Galliani in Le Havre, France, tracking commercial and passenger vehicles across different industries and road segments.",
    aiGenerated: true,
    rowRepresents: "a vehicle trip or route segment with associated industry classification and geographic details",
    owner: "Alex Moreau",
    domain: "transportation",
    uploadedAt: "2025-10-28T18:29:08Z",
    dateRange: ["2025-04-01", "2025-09-30"],
    rows: 1998427,
    columns: TRAFFIC_COLUMNS,
    seed: 3,
  },
  {
    id: "d2",
    section: "data",
    title: "le_havre_vessel_data_1month_cityscope.csv",
    description:
      "Vessel tracking data from Le Havre port showing ship positions, movements, and navigation status over a one-month period.",
    aiGenerated: true,
    rowRepresents: "a position report from a vessel",
    owner: "Alex Moreau",
    domain: "maritime",
    uploadedAt: "2025-06-30T13:41:34Z",
    dateRange: ["2025-05-01", "2025-05-31"],
    rows: 842116,
    columns: VESSEL_COLUMNS,
    seed: 5,
  },
  {
    id: "d3",
    section: "data",
    title: "le_havre_vessel_data_cityscope.csv",
    description:
      "Real-time vessel tracking data from Le Havre port showing ship positions, navigation status, and movement patterns with timestamps.",
    aiGenerated: true,
    rowRepresents: "a position report from a vessel",
    owner: "Alex Moreau",
    domain: "maritime",
    uploadedAt: "2025-06-30T12:27:59Z",
    dateRange: ["2025-06-01", "2025-06-30"],
    rows: 311902,
    columns: VESSEL_COLUMNS,
    seed: 7,
  },
  {
    id: "d4",
    section: "data",
    title: "stop_dataset_20240701_20241231.csv",
    description:
      "This dataset contains vehicle stop events with timing, location, and vehicle characteristics for commercial vehicles from July to December 2024.",
    aiGenerated: true,
    rowRepresents: "a stop made by a commercial vehicle",
    owner: "Alex Moreau",
    domain: "logistics",
    uploadedAt: "2025-05-13T16:02:41Z",
    dateRange: ["2024-07-01", "2024-12-31"],
    rows: 4210775,
    columns: TRAFFIC_COLUMNS,
    seed: 11,
  },
  {
    id: "d5",
    section: "data",
    title: "flows_dataset_20240701_20241231.csv",
    description:
      "Vehicle trip dataset tracking movement patterns and stops across different locations in France, capturing detailed journey data.",
    aiGenerated: true,
    rowRepresents: "a vehicle trip",
    owner: "Alex Moreau",
    domain: "logistics",
    uploadedAt: "2025-05-13T16:00:52Z",
    dateRange: ["2024-07-01", "2024-12-31"],
    rows: 6730144,
    columns: TRAFFIC_COLUMNS,
    seed: 13,
  },
  {
    id: "d6",
    section: "data",
    title: "Realtime Waze Alerts Stream",
    description: "",
    vip: true,
    owner: "Vianova",
    domain: "traffic",
    uploadedAt: "2025-03-19T11:05:17Z",
    rows: 0,
    columns: TRAFFIC_COLUMNS,
    seed: 17,
  },
  {
    id: "d7",
    section: "data",
    title: "Logistics Stops stream",
    description:
      "This dataset contains records of commercial vehicle stops within a specific logistics zone, tracking delivery and service activity.",
    aiGenerated: true,
    vip: true,
    owner: "Vianova",
    domain: "logistics",
    uploadedAt: "2025-03-19T11:05:17Z",
    rows: 1204551,
    columns: TRAFFIC_COLUMNS,
    seed: 19,
  },
  ...["road", "district", "school_y", "subnetwork", "zone_limits", "current_city"].map(
    (name, i): Dataset => ({
      id: `z${i}`,
      section: "zones",
      title: name,
      description: "",
      owner: "Vianova",
      domain: "zones",
      uploadedAt: "2025-03-19T11:05:17Z",
      rows: 120 + i * 37,
      columns: ZONE_COLUMNS,
      seed: 23 + i,
    }),
  ),
  ...[
    ["Low emission zone", "active"],
    ["Truck delivery window", "active"],
    ["Speed limit 30", "active"],
    ["Pedestrian street, summer", "inactive"],
  ].map(
    ([name, status], i): Dataset => ({
      id: `r${i}`,
      section: "regulations",
      title: name ?? "",
      description: "",
      status: status as "active" | "inactive",
      owner: "Vianova",
      domain: "regulations",
      uploadedAt: "2025-04-02T09:00:00Z",
      rows: 12 + i * 5,
      columns: REGULATION_COLUMNS,
      seed: 41 + i,
    }),
  ),
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const SECTIONS: {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "data", label: "Data", icon: Database },
  { id: "zones", label: "Zones", icon: Shapes },
  { id: "regulations", label: "Regulations", icon: Scale },
];

/** Fixed locale and zone: the page is statically exported, so a server and a
 *  browser in different zones would otherwise render different dates. */
const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const count = new Intl.NumberFormat("en");

/** Small deterministic PRNG, so a dataset's preview is the same every render. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function previewRows(dataset: Dataset, n = 40): string[][] {
  if (dataset.preview) return dataset.preview;
  const next = rng(dataset.seed * 97);
  return Array.from({ length: n }, (_, r) =>
    dataset.columns.map((c) => {
      switch (c.type) {
        case "id":
          return String(4302774000 + Math.floor(next() * 12000));
        case "category":
          return c.values?.[Math.floor(next() * c.values.length)] ?? "";
        case "timestamp": {
          const t = Date.UTC(2025, 3, 1 + Math.floor(next() * 28), 7 + Math.floor(next() * 12), Math.floor(next() * 60));
          return dateTimeFormat.format(t);
        }
        case "number":
          return (next() * 100).toFixed(1);
        case "geometry":
          return `LINESTRING (${(0.1 + next() * 0.05).toFixed(4)} ${(49.48 + next() * 0.03).toFixed(4)}, …)`;
        default:
          return `${c.name.toLowerCase()}_${r + 1}`;
      }
    }),
  );
}

function styleFor(column: Column, value: string, index: number): CategoryStyle {
  return column.styles?.[value] ?? { color: SWATCHES[index % SWATCHES.length] ?? "#0f766e" };
}

/** A stylised street grid, standing in for the map thumbnail the platform renders. */
function Thumbnail({ seed, className }: { seed: number; className?: string }) {
  const next = rng(seed);
  // Streets run roughly east-west and north-south with a little wobble, the way
  // a city grid reads from far away. One of them is the dataset's own route.
  const streets = [
    ...Array.from({ length: 4 }, (_, i) => {
      const y = 8 + i * 15 + (next() - 0.5) * 6;
      return `M-2 ${y.toFixed(1)} Q50 ${(y + (next() - 0.5) * 10).toFixed(1)} 102 ${(y + (next() - 0.5) * 8).toFixed(1)}`;
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const x = 8 + i * 17 + (next() - 0.5) * 6;
      return `M${x.toFixed(1)} -2 Q${(x + (next() - 0.5) * 10).toFixed(1)} 30 ${(x + (next() - 0.5) * 8).toFixed(1)} 62`;
    }),
  ];
  const route = `M${(next() * 20).toFixed(1)} ${(10 + next() * 40).toFixed(1)} C30 ${(next() * 60).toFixed(1)} 60 ${(next() * 60).toFixed(1)} ${(80 + next() * 20).toFixed(1)} ${(10 + next() * 40).toFixed(1)}`;
  return (
    <div className={cn("bg-muted relative overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {streets.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-border" strokeWidth="1.1" />
        ))}
        <path d={route} fill="none" className="stroke-primary" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dataset card                                                                */
/* -------------------------------------------------------------------------- */

function DatasetCard({
  dataset,
  onOpen,
}: {
  dataset: Dataset;
  onOpen: () => void;
}) {
  // A VIP stream with no rows yet has nothing to draw, which is the one case
  // the platform shows its broken-image placeholder for.
  const noPreview = dataset.rows === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group bg-card text-card-foreground focus-visible:ring-ring flex w-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="relative">
        {noPreview ? (
          <div className="bg-muted text-muted-foreground flex h-24 items-center justify-center">
            <ImageOff className="size-5" aria-hidden />
            <span className="sr-only">No preview available</span>
          </div>
        ) : (
          <Thumbnail seed={dataset.seed} className="h-24" />
        )}
        {dataset.vip ? (
          <Badge variant="secondary" className="absolute top-2 left-2">
            VIP
          </Badge>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate text-sm font-medium">{dataset.title}</h3>
        {dataset.description ? (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {dataset.description}
          </p>
        ) : null}
        {dataset.aiGenerated ? (
          <Badge variant="outline" className="mt-0.5">
            <Sparkles data-icon="inline-start" />
            AI-generated
          </Badge>
        ) : null}
        {dataset.status ? (
          <Badge
            variant={dataset.status === "active" ? "default" : "secondary"}
            className="mt-0.5 capitalize"
          >
            {dataset.status}
          </Badge>
        ) : null}
        <p className="text-muted-foreground mt-auto pt-2 text-xs">
          {dateTimeFormat.format(new Date(dataset.uploadedAt))}
        </p>
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border" aria-hidden>
      <Skeleton className="h-24 rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category picker                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One category value's colour and logo.
 *
 * The logo is read with an object URL rather than a data URL: the picker holds
 * the file only for the session, and an object URL costs nothing until it is
 * painted. The previous URL is revoked on replace so a long editing session
 * does not accumulate every logo it ever tried.
 */
function CategoryStylePicker({
  value,
  style,
  onChange,
}: {
  value: string;
  style: CategoryStyle;
  onChange: (next: CategoryStyle) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setLogo = (file: File | undefined) => {
    if (!file) return;
    if (style.logo?.startsWith("blob:")) URL.revokeObjectURL(style.logo);
    onChange({ ...style, logo: URL.createObjectURL(file) });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Colour and logo for ${value}`}
          />
        }
      >
        {style.logo ? (
          <Avatar className="size-5">
            <AvatarImage src={style.logo} alt="" />
            <AvatarFallback>{value.slice(0, 1)}</AvatarFallback>
          </Avatar>
        ) : (
          <span
            className="size-4 rounded-full border"
            style={{ backgroundColor: style.color }}
            aria-hidden
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Colour</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Use ${s}`}
                aria-pressed={style.color === s}
                onClick={() => onChange({ ...style, color: s })}
                className="focus-visible:ring-ring size-6 rounded-full border focus-visible:ring-2 focus-visible:outline-none aria-pressed:ring-2 aria-pressed:ring-offset-1 aria-pressed:ring-offset-background aria-pressed:ring-foreground"
                style={{ backgroundColor: s }}
              />
            ))}
            <label className="text-muted-foreground hover:text-foreground focus-within:ring-ring flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed text-[10px] focus-within:ring-2">
              <span aria-hidden>+</span>
              <span className="sr-only">Custom colour</span>
              <input
                type="color"
                className="sr-only"
                onChange={(e) => onChange({ ...style, color: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Logo</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus data-icon="inline-start" />
              {style.logo ? "Replace" : "Upload"}
            </Button>
            {style.logo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (style.logo?.startsWith("blob:")) URL.revokeObjectURL(style.logo);
                  onChange({ color: style.color });
                }}
              >
                <X data-icon="inline-start" />
                Remove
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                setLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

function ColumnRow({
  column,
  onChange,
}: {
  column: Column;
  onChange: (next: Column) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const Icon = TYPE_ICON[column.type];
  const expandable = column.type === "category" && !!column.values?.length;

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {expandable ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? "Hide" : "Show"} values of ${column.name}`}
                onClick={() => setOpen((o) => !o)}
                className="hover:bg-muted focus-visible:ring-ring -ml-1 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <ChevronRight
                  className={cn("size-3.5 transition-transform", open && "rotate-90")}
                />
              </button>
            ) : (
              <span className="w-3.5" aria-hidden />
            )}
            <Icon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{column.name}</span>
          </div>
        </TableCell>
        <TableCell className="max-w-44">
          <InlineEdit
            value={column.description}
            label={`description of ${column.name}`}
            placeholder="Add a description"
            onValueChange={(description) => onChange({ ...column, description })}
            className="max-w-full"
          />
        </TableCell>
        <TableCell>
          <Select
            value={column.type}
            onValueChange={(type) =>
              onChange({ ...column, type: (type ?? column.type) as ColumnType })
            }
          >
            <SelectTrigger size="sm" className="w-32" aria-label={`Type of ${column.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <InlineEdit
            value={column.unit === "N/A" ? "" : column.unit}
            label={`unit of ${column.name}`}
            placeholder="N/A"
            onValueChange={(unit) => onChange({ ...column, unit: unit || "N/A" })}
          />
        </TableCell>
      </TableRow>
      {open && expandable
        ? column.values!.map((value, i) => {
            const style = styleFor(column, value, i);
            return (
              <TableRow key={value} className="bg-muted/30">
                <TableCell colSpan={4} className="py-1 pl-10">
                  <div className="flex items-center gap-2">
                    <CategoryStylePicker
                      value={value}
                      style={style}
                      onChange={(next) =>
                        onChange({
                          ...column,
                          styles: { ...column.styles, [value]: next },
                        })
                      }
                    />
                    <span className="text-sm">{value}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        : null}
    </>
  );
}

function PreviewTable({ dataset }: { dataset: Dataset }) {
  const rows = React.useMemo(() => previewRows(dataset), [dataset]);
  const [sort, setSort] = React.useState<{ index: number; dir: "asc" | "desc" } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const sortType = dataset.columns[sort.index]?.type;
    const numeric = sortType === "number" || sortType === "id";
    return [...rows].sort((a, b) => {
      const x = a[sort.index] ?? "";
      const y = b[sort.index] ?? "";
      const cmp = numeric ? Number(x) - Number(y) : x.localeCompare(y);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, dataset.columns]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {dataset.columns.map((c, i) => {
            const Icon = TYPE_ICON[c.type];
            const active = sort?.index === i;
            const SortIcon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <TableHead
                key={c.name}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSort(
                      active && sort.dir === "desc"
                        ? null
                        : { index: i, dir: active ? "desc" : "asc" },
                    )
                  }
                  className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1.5 rounded px-1 whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Icon className="size-3.5" />
                  {c.name}
                  <SortIcon className={cn("size-3", !active && "opacity-40")} />
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row, r) => (
          <TableRow key={r}>
            {row.map((cell, c) => (
              <TableCell key={c} className="max-w-48 truncate whitespace-nowrap tabular-nums">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm">{children}</dd>
    </div>
  );
}

function DatasetDetail({
  dataset,
  onBack,
  onChange,
  onDelete,
}: {
  dataset: Dataset;
  onBack: () => void;
  onChange: (next: Dataset) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = React.useState<"columns" | "preview">("columns");
  // Edited in place and committed on blur, like the inline fields beside it.
  const [draft, setDraft] = React.useState(dataset.description);
  React.useEffect(() => setDraft(dataset.description), [dataset.description]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" onClick={onBack} aria-label="Back to data">
          <ArrowLeft />
        </Button>
        <h2 className="truncate text-lg font-semibold tracking-tight">{dataset.title}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <section className="bg-card h-fit rounded-xl border">
          <h3 className="border-b px-4 py-3 text-sm font-medium">Data information</h3>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <label htmlFor={`${dataset.id}-description`} className="text-muted-foreground flex items-center gap-1 text-xs">
                Description
                {dataset.aiGenerated ? <Sparkles className="size-3" aria-label="AI-generated" /> : null}
              </label>
              <Textarea
                id={`${dataset.id}-description`}
                value={draft}
                placeholder="Describe what this data contains"
                rows={3}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => draft !== dataset.description && onChange({ ...dataset, description: draft })}
              />
            </div>
            {dataset.rowRepresents ? (
              <p className="text-muted-foreground text-xs">
                Each row represents:{" "}
                <span className="text-foreground">{dataset.rowRepresents}</span>
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Owner">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[10px]">
                    {dataset.owner.split(" ").map((p) => p[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{dataset.owner}</span>
              </Fact>
              <Fact label="Uploaded at">{dateFormat.format(new Date(dataset.uploadedAt))}</Fact>
              <Fact label="Domain">
                <Badge variant="secondary">{dataset.domain}</Badge>
              </Fact>
              <Fact label="Date range">
                {dataset.dateRange
                  ? `${dateFormat.format(new Date(dataset.dateRange[0]))} – ${dateFormat.format(new Date(dataset.dateRange[1]))}`
                  : "—"}
              </Fact>
              <Fact label="Records">
                {count.format(dataset.rows)} {dataset.rows === 1 ? "row" : "rows"} / {dataset.columns.length}{" "}
                {dataset.columns.length === 1 ? "column" : "columns"}
              </Fact>
            </dl>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 data-icon="inline-start" />
                  Delete data
                </Button>
              }
              title={`Delete ${dataset.title}?`}
              description="This removes the dataset and everything built on it. It cannot be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={onDelete}
            />
          </div>
        </section>

        <section className="bg-card min-w-0 rounded-xl border">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h3 className="text-sm font-medium">Metadata preview</h3>
          </div>
          <div className="space-y-3 p-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="columns">
                  <Columns3 />
                  Column description
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Table2 />
                  Data preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* A fixed ceiling, so a 40-row preview scrolls inside its panel
                instead of pushing the delete button a screen away. */}
            <div className="max-h-[28rem] overflow-auto">
              {tab === "columns" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.columns.map((c, i) => (
                      <ColumnRow
                        key={c.name}
                        column={c}
                        onChange={(next) =>
                          onChange({
                            ...dataset,
                            columns: dataset.columns.map((x, j) => (j === i ? next : x)),
                          })
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <PreviewTable dataset={dataset} />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Past this a browser tab struggles to hold the text, never mind parse it. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const PREVIEW_ROWS = 200;
/** A geometry cell can be 100KB of hex; the table only needs to show it exists. */
const CELL_LIMIT = 120;

/**
 * Turns the text of a CSV into a dataset, or says why it cannot.
 *
 * Only the first PREVIEW_ROWS are kept: the dataset's row count comes from the
 * whole file, but holding every row of a multi-million-row export in React
 * state would cost more than the preview is worth.
 */
function datasetFromCsv(id: string, filename: string, text: string): Dataset | string {
  const parsed = parseCsv(text);
  if (parsed.header.length === 0) return "That file is empty.";
  if (parsed.rows.length === 0) return "That file has column names but no rows.";

  const columns: Column[] = inferColumns(parsed).map((c) => ({
    name: c.name,
    type: c.type,
    values: c.values,
    description: "",
    unit: "N/A",
  }));
  const clip = (v: string) => (v.length > CELL_LIMIT ? `${v.slice(0, CELL_LIMIT)}…` : v);

  return {
    id,
    section: "data",
    title: filename,
    description: "",
    owner: "You",
    domain: "uploaded",
    uploadedAt: new Date().toISOString(),
    rows: parsed.rows.length,
    columns,
    preview: parsed.rows
      .slice(0, PREVIEW_ROWS)
      .map((row) => parsed.header.map((_, i) => clip(row[i] ?? ""))),
    seed: filename.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

type SortKey = "recent" | "oldest" | "name";
const SORTS: Record<SortKey, string> = {
  recent: "Most recent",
  oldest: "Oldest",
  name: "Name",
};

/**
 * The data hub: browse what the workspace holds, then open a dataset to read
 * and correct its metadata.
 *
 * `status` is how the catalogue itself is doing -- "loading" shows skeletons in
 * place of cards, "error" shows a retry. It is a prop rather than internal
 * state because the host owns the fetch.
 */
export function DatahubWorkspace({
  className,
  datasets: initial = SAMPLE_DATASETS,
  status = "ready",
  onRetry,
  onUpload,
}: {
  className?: string;
  datasets?: Dataset[];
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  /** Called after a file has been read and added, with the dataset it became. */
  onUpload?: (file: File, dataset: Dataset) => void;
}) {
  const [datasets, setDatasets] = React.useState(initial);
  const [section, setSection] = React.useState<Section>("data");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("recent");
  const [regStatus, setRegStatus] = React.useState<"active" | "inactive" | "all">("active");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const uploads = React.useRef(0);

  const pickFile = () => fileRef.current?.click();

  /** Read in the browser: the file is never sent anywhere. */
  const upload = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`That file is ${Math.round(file.size / 1024 / 1024)} MB. The limit here is 50 MB.`);
      return;
    }
    setImporting(true);
    try {
      const result = datasetFromCsv(`upload-${++uploads.current}`, file.name, await file.text());
      if (typeof result === "string") {
        setUploadError(result);
        return;
      }
      setDatasets((all) => [result, ...all]);
      setSection("data");
      setQuery("");
      setOpenId(result.id);
      onUpload?.(file, result);
    } catch {
      setUploadError("Couldn't read that file.");
    } finally {
      setImporting(false);
    }
  };

  const open = datasets.find((d) => d.id === openId) ?? null;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return datasets
      .filter((d) => d.section === section)
      .filter((d) => section !== "regulations" || regStatus === "all" || d.status === regStatus)
      .filter((d) => !q || `${d.title} ${d.description}`.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "name"
          ? a.title.localeCompare(b.title)
          : sort === "oldest"
            ? a.uploadedAt.localeCompare(b.uploadedAt)
            : b.uploadedAt.localeCompare(a.uploadedAt),
      );
  }, [datasets, section, query, sort, regStatus]);

  return (
    <div
      className={cn(
        // Same envelope as map-workspace, so the docs page does not jump when
        // one block replaces the other.
        "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
        className,
      )}
    >
      {/* Outside both views so Upload works from the list and from its empty state. */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a CSV file to upload"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so choosing the same file again still fires onChange.
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {open ? (
        <DatasetDetail
          dataset={open}
          onBack={() => setOpenId(null)}
          onChange={(next) =>
            setDatasets((all) => all.map((d) => (d.id === next.id ? next : d)))
          }
          onDelete={() => {
            setDatasets((all) => all.filter((d) => d.id !== open.id));
            setOpenId(null);
          }}
        />
      ) : (
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Data</h2>
              <p className="text-muted-foreground text-sm">Here&apos;s a list of all your data</p>
            </div>
            <Button onClick={pickFile} disabled={importing}>
              <Upload data-icon="inline-start" />
              {importing ? "Importing…" : "Upload data"}
            </Button>
          </header>

          {uploadError ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Couldn&apos;t import that file</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
              <AlertAction>
                <Button variant="ghost" size="xs" onClick={() => setUploadError(null)}>
                  Dismiss
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          <Tabs
            value={section}
            onValueChange={(v) => {
              setSection(v as Section);
              setQuery("");
            }}
          >
            <TabsList>
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="min-w-48 flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for data"
                aria-label="Search for data"
              />
            </InputGroup>
            {section === "regulations" ? (
              <Select
                value={regStatus}
                onValueChange={(v) => setRegStatus((v ?? "active") as typeof regStatus)}
              >
                <SelectTrigger className="w-28" aria-label="Regulation status">
                  <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Select value={sort} onValueChange={(v) => setSort((v ?? "recent") as SortKey)}>
              <SelectTrigger className="w-36" aria-label="Sort">
                <SelectValue>{(v: string) => SORTS[v as SortKey]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORTS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === "loading" ? (
            <div
              role="status"
              aria-label="Loading data"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : status === "error" ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TriangleAlert />
                </EmptyMedia>
                <EmptyTitle>Couldn&apos;t load your data</EmptyTitle>
                <EmptyDescription>
                  Something went wrong reaching the data hub. Nothing was changed.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={onRetry}>
                  Try again
                </Button>
              </EmptyContent>
            </Empty>
          ) : visible.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {query ? <Search /> : <Link2 />}
                </EmptyMedia>
                <EmptyTitle>
                  {query ? "No results" : `No ${section} yet`}
                </EmptyTitle>
                <EmptyDescription>
                  {query
                    ? `Nothing in ${SECTIONS.find((s) => s.id === section)?.label} matches “${query}”.`
                    : "Upload a file to add it to your hub."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {query ? (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={pickFile} disabled={importing}>
                    <Upload data-icon="inline-start" />
                    Upload data
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((d) => (
                <li key={d.id} className="flex min-w-0">
                  <DatasetCard dataset={d} onOpen={() => setOpenId(d.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default DatahubWorkspace;
