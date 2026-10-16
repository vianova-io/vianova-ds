"use client";

import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  Globe,
  Info,
  Lock,
  LocateFixed,
  MoreHorizontal,
  Plus,
  Power,
  Scale,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/registry/vianova/ui/accordion";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/registry/vianova/ui/alert-dialog";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import {
  ChoiceCard,
  ChoiceCardGroup,
} from "@/registry/vianova/ui/choice-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/vianova/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
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
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import { SaveBar } from "@/registry/vianova/patterns/save-bar";
import { ScheduleEditor } from "@/registry/vianova/patterns/schedule-editor";
import { SliderField } from "@/registry/vianova/patterns/slider-field";
import {
  StatusBadge,
  type StatusTone,
} from "@/registry/vianova/patterns/status-badge";
import { BasemapSwitcher } from "@/registry/vianova/product/basemap-switcher";
import { LegendCategorical } from "@/registry/vianova/product/legend-categorical";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { MapControls } from "@/registry/vianova/product/map-controls";
import {
  MapDrawBanner,
  MapDrawControl,
  useMapDraw,
  type DrawMode,
} from "@/registry/vianova/product/map-draw-control";
import {
  RULE_RAIL_GLOBAL,
  RuleRail,
} from "@/registry/vianova/product/rule-rail";
import {
  RULE_TYPES,
  RULE_TYPE_ORDER,
  RuleTypeIcon,
  ruleTypeColor,
  type RuleType,
} from "@/registry/vianova/product/rule-type-icon";
import {
  ZonePicker,
  type PickerZone,
} from "@/registry/vianova/product/zone-picker";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import {
  useCategoryShapeLayer,
  type CategoryShape,
} from "@/registry/vianova/hooks/use-category-shape-layer";
import { DEFAULT_BASEMAP_ID, type BasemapId } from "@/registry/vianova/lib/basemaps";
import {
  DEFAULT_BUFFER,
  OPERATORS,
  REFERENCE_DATE,
  RULE_VALUE,
  SAMPLE_REGULATIONS,
  STATUS_LABELS,
  VEHICLES,
  loadZoneLibrary,
  newRule,
  regulationStatus,
  type Regulation,
  type RegulationStatus,
  type Rule,
  type Vehicle,
} from "@/registry/vianova/lib/sample-regulations";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node. The
 * expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM, because
 * Next substitutes that exact text at build time.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WORKER_URL = `${BASE_PATH}/maplibre/maplibre-gl-worker.mjs`;

/** Lisbon, where every sample zone is. */
const LISBON: [number, number] = [-9.142, 38.722];

/**
 * Types that can share a regulation with others. Production only ever adds
 * parking and no parking to a multi-parking regulation, so offering the whole
 * catalogue there would invent a product decision.
 */
const MULTI_PARKING_TYPES: RuleType[] = ["parking", "no_parking"];

const STATUS_TONE: Record<RegulationStatus, StatusTone> = {
  active: "success",
  scheduled: "info",
  ending: "warning",
  inactive: "neutral",
};

type StatusFilter = "all" | RegulationStatus;

const STATUS_FILTERS: Record<StatusFilter, string> = {
  all: "All statuses",
  ...STATUS_LABELS,
};

type SortDir = "desc" | "asc";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (iso: string) => dateFmt.format(new Date(iso));

let seq = 0;
/** Ids for things made in this session. Prefixed so they never collide with a sample's. */
const uid = (prefix: string) => `${prefix}-new-${++seq}`;

/** Deep enough for a regulation: its rules and their arrays are the only nested values. */
const cloneRegulation = (reg: Regulation): Regulation => ({
  ...reg,
  global: { ...reg.global },
  rules: reg.rules.map((r) => ({
    ...r,
    zoneIds: [...r.zoneIds],
    vehicles: [...r.vehicles],
    operators: [...r.operators],
    schedule: { ...r.schedule, days: [...r.schedule.days] },
  })),
});

/** Rule types in a regulation, once each, in the order the rules are listed. */
const typesOf = (reg: Regulation) => [...new Set(reg.rules.map((r) => r.type))];

const zoneTotal = (reg: Regulation) =>
  new Set(reg.rules.flatMap((r) => r.zoneIds)).size;

/** Next free "<Type> N" name, so a second parking rule is "Parking 2", not another "Parking 1". */
function nextRuleName(type: RuleType, rules: Rule[]) {
  const base = RULE_TYPES[type].label;
  let n = rules.filter((r) => r.type === type).length + 1;
  while (rules.some((r) => r.name === `${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function downloadGeoJson(reg: Regulation, zones: Map<string, PickerZone>) {
  const features = reg.rules.flatMap((rule) =>
    rule.zoneIds.flatMap((id) => {
      const zone = zones.get(id);
      if (!zone) return [];
      return [
        {
          type: "Feature",
          properties: { regulation: reg.name, rule: rule.name, rule_type: rule.type, zone: zone.name },
          geometry: { type: "Polygon", coordinates: [zone.ring] },
        },
      ];
    }),
  );
  const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features }, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reg.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

type View =
  | { kind: "list" }
  | { kind: "edit"; id: string; isNew: boolean };

/**
 * The regulations workspace: every regulation a city has, and the editor that
 * makes one -- its rules, the zones each rule covers, when it applies and to
 * whom -- next to a map of the result.
 *
 * Rebuilt from production's regulations page on Vianova DS components. What
 * changed on the way, deliberately: one theme throughout rather than a dark
 * list and a light editor; a rule type is chosen and then confirmed, rather
 * than created by the first click on a card; visibility is a status with its
 * action in the menu, not a pill that looks like a toggle; and saving is one
 * bar that says what is unsaved, rather than a button that changes its own
 * label.
 */
export function RegulationsWorkspace({
  className,
  regulations: initial = SAMPLE_REGULATIONS,
  status = "ready",
  onRetry,
  onSave,
}: {
  className?: string;
  regulations?: Regulation[];
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  /** Called with the saved regulation, after the workspace has kept it. */
  onSave?: (regulation: Regulation) => void;
}) {
  const [regulations, setRegulations] = React.useState(initial);
  const [view, setView] = React.useState<View>({ kind: "list" });
  const [drafts, setDrafts] = React.useState<Record<string, Regulation>>({});
  const [creating, setCreating] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [zones, setZones] = React.useState<PickerZone[]>([]);
  const [zonesLoading, setZonesLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    loadZoneLibrary(BASE_PATH, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return;
      setZones(loaded);
      setZonesLoading(false);
    });
    return () => controller.abort();
  }, []);

  const zoneIndex = React.useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const create = (type: RuleType) => {
    const id = uid("reg");
    // Multi-parking is a container, not a rule: production starts one with a
    // parking rule, and no-parking rules are added beside it from the rail.
    const first: RuleType = type === "multi_parking" ? "parking" : type;
    const rule = newRule(first, uid("rule"), `${RULE_TYPES[first].label} 1`);
    const draft: Regulation = {
      id,
      name: `${RULE_TYPES[type].label} ${regulations.filter((r) => r.kind === type).length + 1}`,
      kind: type,
      rules: [rule],
      global: { start: REFERENCE_DATE },
      visibility: "private",
      deactivated: false,
      createdAt: new Date().toISOString(),
    };
    setDrafts((d) => ({ ...d, [id]: draft }));
    setCreating(false);
    setNotice(null);
    setView({ kind: "edit", id, isNew: true });
  };

  const saved = view.kind === "edit" ? regulations.find((r) => r.id === view.id) : undefined;

  return (
    <div
      data-slot="regulations-workspace"
      className={cn(
        // Same envelope as the other workspaces, so the docs page does not
        // jump when one block replaces another.
        "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
        className,
      )}
    >
      {view.kind === "edit" ? (
        <RegulationEditor
          // A different regulation is a different form: nothing typed into one
          // may leak into the next.
          key={view.id}
          saved={saved}
          initialDraft={drafts[view.id] ?? (saved ? cloneRegulation(saved) : undefined)}
          isNew={view.isNew}
          zones={zones}
          zoneIndex={zoneIndex}
          zonesLoading={zonesLoading}
          onZonesCreated={(made) => setZones((all) => [...made, ...all])}
          onSave={(reg) => {
            setRegulations((all) =>
              all.some((r) => r.id === reg.id)
                ? all.map((r) => (r.id === reg.id ? reg : r))
                : [reg, ...all],
            );
            setDrafts(({ [reg.id]: _, ...rest }) => rest);
            setView({ kind: "edit", id: reg.id, isNew: false });
            onSave?.(reg);
          }}
          onDuplicate={(reg) => {
            const copy = cloneRegulation(reg);
            copy.id = uid("reg");
            copy.name = `${reg.name} (copy)`;
            copy.visibility = "private";
            copy.createdAt = new Date().toISOString();
            setDrafts((d) => ({ ...d, [copy.id]: copy }));
            setView({ kind: "edit", id: copy.id, isNew: true });
          }}
          onClose={(message) => {
            if (view.isNew) setDrafts(({ [view.id]: _, ...rest }) => rest);
            setNotice(message ?? null);
            setView({ kind: "list" });
          }}
        />
      ) : (
        <RegulationList
          regulations={regulations}
          status={status}
          onRetry={onRetry}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onCreate={() => setCreating(true)}
          onOpen={(id) => {
            setNotice(null);
            setView({ kind: "edit", id, isNew: false });
          }}
          onDownload={(reg) => downloadGeoJson(reg, zoneIndex)}
        />
      )}

      <NewRegulationDialog open={creating} onOpenChange={setCreating} onCreate={create} />
    </div>
  );
}

export default RegulationsWorkspace;

/* -------------------------------------------------------------------------- */
/* List                                                                        */
/* -------------------------------------------------------------------------- */

type Filters = {
  types: RuleType[];
  visibility: "all" | "private" | "public";
  operators: string[];
  vehicles: Vehicle[];
};

const NO_FILTERS: Filters = { types: [], visibility: "all", operators: [], vehicles: [] };

const filterCount = (f: Filters) =>
  (f.types.length ? 1 : 0) +
  (f.visibility !== "all" ? 1 : 0) +
  (f.operators.length ? 1 : 0) +
  (f.vehicles.length ? 1 : 0);

/** A rule that names no operators, or no vehicles, applies to all of them. */
const appliesTo = <T,>(chosen: T[], ruleList: T[]) =>
  chosen.length === 0 || ruleList.length === 0 || chosen.some((c) => ruleList.includes(c));

function RegulationList({
  regulations,
  status,
  onRetry,
  notice,
  onDismissNotice,
  onCreate,
  onOpen,
  onDownload,
}: {
  regulations: Regulation[];
  status: "ready" | "loading" | "error";
  onRetry?: () => void;
  notice: string | null;
  onDismissNotice: () => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDownload: (reg: Regulation) => void;
}) {
  const [query, setQuery] = React.useState("");
  // Production opens on active regulations. Kept: it is what a city checks
  // first, and the count on the status select says the rest exist.
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("active");
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  const [sort, setSort] = React.useState<SortDir>("desc");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return regulations
      .filter((r) => statusFilter === "all" || regulationStatus(r) === statusFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .filter((r) => !filters.types.length || typesOf(r).some((t) => filters.types.includes(t)))
      .filter((r) => filters.visibility === "all" || r.visibility === filters.visibility)
      .filter((r) => r.rules.some((rule) => appliesTo(filters.operators, rule.operators)))
      .filter((r) => r.rules.some((rule) => appliesTo(filters.vehicles, rule.vehicles)))
      .sort((a, b) =>
        sort === "desc" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
      );
  }, [regulations, query, statusFilter, filters, sort]);

  const active = filterCount(filters);
  const narrowed = Boolean(query) || statusFilter !== "all" || active > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Regulations</h2>
          <p className="text-muted-foreground text-sm">
            Where and when operators&apos; vehicles may ride, park and be deployed.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus data-icon="inline-start" />
          New regulation
        </Button>
      </header>

      {notice ? (
        <Alert>
          <Info />
          <AlertTitle>{notice}</AlertTitle>
          <AlertAction>
            <Button variant="ghost" size="xs" onClick={onDismissNotice}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regulations"
            aria-label="Search regulations"
          />
        </InputGroup>
        <Select
          value={statusFilter}
          items={STATUS_FILTERS}
          onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)}
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((k) => (
              <SelectItem key={k} value={k}>
                {STATUS_FILTERS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FiltersPopover value={filters} onChange={setFilters} count={active} />
      </div>

      {status === "loading" ? (
        <div role="status" aria-label="Loading regulations" className="space-y-2 rounded-lg border p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>Couldn&apos;t load your regulations</EmptyTitle>
            <EmptyDescription>Something went wrong on our side. Nothing was changed.</EmptyDescription>
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
            <EmptyMedia variant="icon">{narrowed ? <Search /> : <Scale />}</EmptyMedia>
            <EmptyTitle>{narrowed ? "No regulations match" : "No regulations yet"}</EmptyTitle>
            <EmptyDescription>
              {narrowed
                ? "Try another status, or clear the search and filters."
                : "A regulation tells operators where their vehicles may ride, park or be deployed."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {narrowed ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setFilters(NO_FILTERS);
                }}
              >
                Show all regulations
              </Button>
            ) : (
              <Button onClick={onCreate}>
                <Plus data-icon="inline-start" />
                New regulation
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Rules</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Zones</TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    type="button"
                    onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
                    className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
                    aria-label={`Created, sorted ${sort === "desc" ? "newest first" : "oldest first"}`}
                  >
                    Created
                    {sort === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                  </button>
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((reg) => (
                <RegulationRow
                  key={reg.id}
                  reg={reg}
                  onOpen={() => onOpen(reg.id)}
                  onDownload={() => onDownload(reg)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RegulationRow({
  reg,
  onOpen,
  onDownload,
}: {
  reg: Regulation;
  onOpen: () => void;
  onDownload: () => void;
}) {
  const types = typesOf(reg);
  const status = regulationStatus(reg);
  return (
    <TableRow>
      <TableCell>
        {/* Production stacked one icon per rule, so four cap rules read as
            four identical glyphs. One per TYPE says the same thing in less
            room, and the count lives in the editor. 24px, as production's
            list is: at 16px the glyph is the only thing that tells cap from
            floor, and it was too small to. */}
        <span className="flex items-center gap-1">
          {types.slice(0, 3).map((t) => (
            <RuleTypeIcon key={t} type={t} size="md" label={RULE_TYPES[t].label} />
          ))}
          {types.length > 3 ? (
            <span className="text-muted-foreground text-xs">+{types.length - 3}</span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="max-w-0 min-w-40">
        <button
          type="button"
          data-slot="regulation-link"
          onClick={onOpen}
          className="hover:text-primary focus-visible:ring-ring/50 block w-full truncate rounded-sm text-left font-medium focus-visible:ring-[3px] focus-visible:outline-none"
        >
          {reg.name}
        </button>
        <span className="text-muted-foreground block truncate text-xs">
          {RULE_TYPES[reg.kind].label}
          {reg.rules.length > 1 ? ` · ${reg.rules.length} rules` : ""}
          <span className="sm:hidden"> · {STATUS_LABELS[status]}</span>
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <RegulationStatusBadge status={status} />
      </TableCell>
      <TableCell className="text-muted-foreground hidden tabular-nums md:table-cell">
        {zoneTotal(reg)}
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
        {formatDate(reg.createdAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Options for ${reg.name}`}>
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download />
              Download GeoJSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function RegulationStatusBadge({ status }: { status: RegulationStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</StatusBadge>;
}

function VisibilityBadge({ visibility }: { visibility: Regulation["visibility"] }) {
  return (
    <Badge variant="outline">
      {visibility === "public" ? <Globe /> : <Lock />}
      {visibility === "public" ? "Public" : "Private"}
    </Badge>
  );
}

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function FiltersPopover({
  value,
  onChange,
  count,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  count: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" aria-label={count ? `Filters, ${count} applied` : "Filters"}>
            <SlidersHorizontal data-icon="inline-start" />
            Filters
            {count ? (
              <Badge className="ml-0.5 h-4 min-w-4 px-1 tabular-nums">{count}</Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="max-h-[min(32rem,70svh)] w-80 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          <Button variant="ghost" size="xs" disabled={!count} onClick={() => onChange(NO_FILTERS)}>
            Clear all
          </Button>
        </div>
        <FieldGroup className="gap-5">
          <FieldSet>
            <FieldLegend variant="label">Rule type</FieldLegend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {RULE_TYPE_ORDER.map((t) => (
                <Field key={t} orientation="horizontal" className="gap-2">
                  <Checkbox
                    id={`filter-type-${t}`}
                    checked={value.types.includes(t)}
                    onCheckedChange={(on) => onChange({ ...value, types: toggle(value.types, t, on) })}
                  />
                  <FieldLabel htmlFor={`filter-type-${t}`} className="min-w-0 font-normal">
                    <RuleTypeIcon type={t} size="sm" />
                    <span className="truncate">{RULE_TYPES[t].label}</span>
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="filter-visibility">Visibility</FieldLabel>
            <Select
              value={value.visibility}
              items={{ all: "Public and private", public: "Public", private: "Private" }}
              onValueChange={(v) =>
                onChange({ ...value, visibility: (v ?? "all") as Filters["visibility"] })
              }
            >
              <SelectTrigger id="filter-visibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Public and private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <CheckList
            legend="Operators"
            idPrefix="filter-operator"
            options={OPERATORS.map((o) => ({ value: o, label: o }))}
            value={value.operators}
            onChange={(operators) => onChange({ ...value, operators })}
          />
          <CheckList
            legend="Vehicles"
            idPrefix="filter-vehicle"
            options={VEHICLES}
            value={value.vehicles}
            onChange={(vehicles) => onChange({ ...value, vehicles: vehicles as Vehicle[] })}
          />
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

function CheckList({
  legend,
  idPrefix,
  options,
  value,
  onChange,
}: {
  legend: string;
  idPrefix: string;
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {options.map((o) => (
          <Field key={o.value} orientation="horizontal" className="gap-2">
            <Checkbox
              id={`${idPrefix}-${o.value}`}
              checked={value.includes(o.value)}
              onCheckedChange={(on) => onChange(toggle(value, o.value, on))}
            />
            <FieldLabel htmlFor={`${idPrefix}-${o.value}`} className="font-normal">
              {o.label}
            </FieldLabel>
          </Field>
        ))}
      </div>
    </FieldSet>
  );
}

/* -------------------------------------------------------------------------- */
/* New regulation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The type picker. Production creates on the first click; here a card is a
 * choice and the button is the decision. Arrow keys move through a radio
 * group, and a group that navigated on every arrow press would throw a
 * keyboard user into an editor for the second option they passed.
 */
function NewRegulationDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (type: RuleType) => void;
}) {
  const [type, setType] = React.useState<RuleType | null>(null);

  React.useEffect(() => {
    if (!open) setType(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New regulation</DialogTitle>
          <DialogDescription>
            Choose the kind of rule it starts with. You can add zones, times and vehicles next.
          </DialogDescription>
        </DialogHeader>
        <ChoiceCardGroup
          aria-label="Rule type"
          columns={3}
          value={type ?? ""}
          onValueChange={(v) => setType(v as RuleType)}
        >
          {RULE_TYPE_ORDER.map((t) => (
            <ChoiceCard
              key={t}
              value={t}
              icon={<RuleTypeIcon type={t} />}
              title={RULE_TYPES[t].label}
              description={RULE_TYPES[t].description}
            />
          ))}
        </ChoiceCardGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!type} onClick={() => type && onCreate(type)}>
            Create regulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

function RegulationEditor({
  saved,
  initialDraft,
  isNew,
  zones,
  zoneIndex,
  zonesLoading,
  onZonesCreated,
  onSave,
  onDuplicate,
  onClose,
}: {
  saved?: Regulation;
  initialDraft?: Regulation;
  isNew: boolean;
  zones: PickerZone[];
  zoneIndex: Map<string, PickerZone>;
  zonesLoading: boolean;
  onZonesCreated: (zones: PickerZone[]) => void;
  onSave: (reg: Regulation) => void;
  onDuplicate: (reg: Regulation) => void;
  onClose: (notice?: string) => void;
}) {
  const [draft, setDraft] = React.useState<Regulation | undefined>(initialDraft);
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(saved ?? null));
  const [selected, setSelected] = React.useState(() => initialDraft?.rules[0]?.id ?? RULE_RAIL_GLOBAL);
  const [saving, setSaving] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [focusZone, setFocusZone] = React.useState<{ id: string; at: number } | null>(null);

  if (!draft) {
    return (
      <div className="p-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>This regulation no longer exists</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => onClose()}>
              Back to regulations
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  // A new regulation is unsaved from the start: there is nothing behind it to
  // fall back to, and the bar should say so.
  const dirty = isNew || JSON.stringify(draft) !== baseline;
  const multi = draft.kind === "multi_parking" || draft.rules.length > 1;
  const rule = draft.rules.find((r) => r.id === selected);
  const status = regulationStatus(draft);

  const update = (next: Partial<Regulation>) => setDraft({ ...draft, ...next });
  const updateRule = (id: string, next: Partial<Rule>) =>
    update({ rules: draft.rules.map((r) => (r.id === id ? { ...r, ...next } : r)) });

  const save = () => {
    setSaving(true);
    // Stands in for a request: long enough to see the pending state, short
    // enough not to be annoying in a demo.
    window.setTimeout(() => {
      onSave(draft);
      setBaseline(JSON.stringify(draft));
      setSaving(false);
    }, 500);
  };

  const discard = () => {
    if (isNew) return onClose();
    const original = JSON.parse(baseline) as Regulation;
    setDraft(original);
    if (!original.rules.some((r) => r.id === selected)) setSelected(original.rules[0]?.id ?? RULE_RAIL_GLOBAL);
  };

  const back = () => (dirty ? setConfirmLeave(true) : onClose());

  const addZones = (made: PickerZone[], into: string) => {
    const target = draft.rules.find((r) => r.id === into);
    if (!target) return;
    updateRule(into, { zoneIds: [...new Set([...target.zoneIds, ...made.map((z) => z.id)])] });
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      {/* Panel */}
      <section
        aria-label="Regulation settings"
        className="bg-background flex min-w-0 flex-col lg:h-full lg:w-[460px] lg:shrink-0 lg:border-r"
      >
        <header className="space-y-2 border-b px-4 pt-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={back}>
              <ArrowLeft data-icon="inline-start" />
              Regulations
            </Button>
            <RegulationMenu
              draft={draft}
              isNew={isNew}
              onToggleVisibility={() =>
                update({ visibility: draft.visibility === "public" ? "private" : "public" })
              }
              onDuplicate={() => onDuplicate(draft)}
              onDownload={() => downloadGeoJson(draft, zoneIndex)}
              onDeactivate={() => setConfirmDeactivate(true)}
              onReactivate={() => update({ deactivated: false })}
            />
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <RuleTypeIcon type={draft.kind} size="sm" />
            {RULE_TYPES[draft.kind].label}
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            <InlineEdit
              variant="title"
              label="Regulation name"
              value={draft.name}
              onValueChange={(name) => update({ name })}
              validate={(v) => (v.trim() ? null : "Give the regulation a name.")}
            />
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {isNew ? <Badge variant="secondary">Draft</Badge> : <RegulationStatusBadge status={status} />}
            <VisibilityBadge visibility={draft.visibility} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {multi ? (
            <RuleRail
              className="border-r py-3"
              items={draft.rules.map((r) => ({ id: r.id, type: r.type, label: r.name }))}
              value={selected}
              onValueChange={setSelected}
              addableTypes={draft.kind === "multi_parking" ? MULTI_PARKING_TYPES : [draft.kind]}
              onAdd={(type) => {
                const made = newRule(type, uid("rule"), nextRuleName(type, draft.rules));
                update({ rules: [...draft.rules, made] });
                setSelected(made.id);
              }}
              onDuplicate={(id) => {
                const src = draft.rules.find((r) => r.id === id);
                if (!src) return;
                const copy = { ...src, id: uid("rule"), name: `${src.name} (copy)`, zoneIds: [...src.zoneIds] };
                update({ rules: [...draft.rules, copy] });
                setSelected(copy.id);
              }}
              onDelete={(id) => {
                const rest = draft.rules.filter((r) => r.id !== id);
                update({ rules: rest });
                if (selected === id) setSelected(rest[0]?.id ?? RULE_RAIL_GLOBAL);
              }}
              getPanelId={() => "regulation-rule-panel"}
            />
          ) : null}

          <div
            id="regulation-rule-panel"
            role={multi ? "tabpanel" : undefined}
            className="min-w-0 flex-1 overflow-y-auto"
          >
            {rule ? (
              <RuleEditor
                key={rule.id}
                rule={rule}
                showName={multi}
                zoneIndex={zoneIndex}
                zonesLoading={zonesLoading}
                onChange={(next) => updateRule(rule.id, next)}
                onAddZones={() => setPickerOpen(true)}
                onLocate={(id) => setFocusZone({ id, at: Date.now() })}
              />
            ) : (
              <GlobalSettings
                value={draft.global}
                onChange={(global) => update({ global })}
              />
            )}
          </div>
        </div>

        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onDiscard={discard}
          message={isNew ? "Not saved yet" : undefined}
          saveLabel={isNew ? "Create regulation" : "Save"}
        />
      </section>

      {/* Map */}
      <RegulationMap
        regulation={draft}
        selectedRule={rule?.id}
        zoneIndex={zoneIndex}
        focusZone={focusZone}
        canDraw={Boolean(rule)}
        onDrawn={(ring) => {
          if (!rule) return;
          const zone: PickerZone = {
            id: uid("zone"),
            name: `Drawn zone ${seq}`,
            tags: ["drawn"],
            ring,
            createdAt: new Date().toISOString(),
          };
          onZonesCreated([zone]);
          addZones([zone], rule.id);
        }}
      />

      {rule ? (
        <ZonePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          zones={zones}
          excludeIds={rule.zoneIds}
          onAdd={(picked) => {
            // Pasted GeoJSON arrives as zones the library has never seen.
            const fresh = picked.filter((z) => !zoneIndex.has(z.id));
            if (fresh.length) onZonesCreated(fresh);
            addZones(picked, rule.id);
          }}
          side="left"
        />
      ) : null}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isNew ? "Discard this regulation?" : "Leave without saving?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isNew
                ? "It hasn't been created yet, so everything set up here will be lost."
                : "Your changes to this regulation will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onClose()}>
              {isNew ? "Discard" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {draft.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Operators stop receiving it once you save, whatever its dates say. You can turn it back on later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                update({ deactivated: true });
                setConfirmDeactivate(false);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RegulationMenu({
  draft,
  isNew,
  onToggleVisibility,
  onDuplicate,
  onDownload,
  onDeactivate,
  onReactivate,
}: {
  draft: Regulation;
  isNew: boolean;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Regulation options">
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onToggleVisibility}>
          {draft.visibility === "public" ? <Lock /> : <Globe />}
          {draft.visibility === "public" ? "Make private" : "Make public"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isNew} onClick={onDuplicate}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <Download />
          Download GeoJSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {draft.deactivated ? (
          <DropdownMenuItem onClick={onReactivate}>
            <Power />
            Reactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" disabled={isNew} onClick={onDeactivate}>
            <Power />
            Deactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSettings({
  value,
  onChange,
}: {
  value: Regulation["global"];
  onChange: (next: Regulation["global"]) => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Global</h3>
        <p className="text-muted-foreground text-sm">
          These dates bound every rule in the regulation. A rule&apos;s own schedule applies inside them.
        </p>
      </div>
      <ScheduleEditor
        showTimes={false}
        value={{ start: value.start, end: value.end, allDay: true, days: [] }}
        onChange={(s) => onChange({ start: s.start, end: s.end })}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rule                                                                        */
/* -------------------------------------------------------------------------- */

const SECTIONS = ["buffer", "zones", "schedule", "vehicles", "operators"] as const;

function RuleEditor({
  rule,
  showName,
  zoneIndex,
  zonesLoading,
  onChange,
  onAddZones,
  onLocate,
}: {
  rule: Rule;
  /** A rule in a multi-rule regulation has a name of its own; a single rule is the regulation. */
  showName: boolean;
  zoneIndex: Map<string, PickerZone>;
  zonesLoading: boolean;
  onChange: (next: Partial<Rule>) => void;
  onAddZones: () => void;
  onLocate: (zoneId: string) => void;
}) {
  const meta = RULE_TYPES[rule.type];
  const valueSpec = RULE_VALUE[rule.type];
  // Zones open by default: an empty rule's next step is always to add some.
  const [open, setOpen] = React.useState<string[]>(["zones"]);

  return (
    <div className="space-y-4 p-4">
      {showName ? (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <RuleTypeIcon type={rule.type} size="sm" />
            <span className="text-muted-foreground">{meta.label}</span>
          </p>
          <h3 className="text-base font-semibold">
            <InlineEdit
              variant="title"
              label="Rule name"
              value={rule.name}
              onValueChange={(name) => onChange({ name })}
              validate={(v) => (v.trim() ? null : "Give the rule a name.")}
            />
          </h3>
        </div>
      ) : null}

      <Alert>
        <Info />
        <AlertDescription>{meta.description}</AlertDescription>
      </Alert>

      {rule.type === "parking" ? (
        <Field>
          <FieldLabel id={`${rule.id}-mode`}>Enforcement</FieldLabel>
          <SegmentedControl
            aria-labelledby={`${rule.id}-mode`}
            value={rule.mode ?? "recommended"}
            onValueChange={(mode) => onChange({ mode: mode as Rule["mode"] })}
            items={[
              { value: "recommended", label: "Recommended" },
              { value: "enforced", label: "Enforced" },
            ]}
          />
          <FieldDescription>
            {rule.mode === "enforced"
              ? "Leaving a vehicle outside these areas is an infringement."
              : "Parking outside these areas has no consequence; it is counted, so you can see how well the areas work."}
          </FieldDescription>
        </Field>
      ) : null}

      {valueSpec ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rule.type === "cap_and_floor" ? (
            <NumberField
              id={`${rule.id}-min`}
              label="Minimum fleet size"
              unit="vehicles"
              min={0}
              value={rule.min}
              onChange={(min) => onChange({ min })}
            />
          ) : null}
          <NumberField
            id={`${rule.id}-value`}
            label={valueSpec.label}
            unit={valueSpec.unit}
            min={valueSpec.min}
            max={valueSpec.max}
            step={valueSpec.step}
            value={rule.value}
            onChange={(value) => onChange({ value })}
          />
        </div>
      ) : null}

      <Accordion multiple value={open} onValueChange={(v) => setOpen(v as string[])} className="rounded-lg border">
        <RuleSection value="buffer" title="Buffer" summary={`${formatSigned(rule.buffer)} m`}>
          <SliderField
            label="Buffer around each zone"
            description="Widens or narrows every zone by this much when vehicles are counted, to allow for GPS error. The zones themselves don't change."
            min={-20}
            max={20}
            step={1}
            unit="m"
            marks={[-20, 0, 10, 20]}
            recommended={DEFAULT_BUFFER}
            value={rule.buffer}
            onValueChange={(buffer) => onChange({ buffer })}
          />
        </RuleSection>

        <RuleSection
          value="zones"
          title="Zones"
          summary={`${rule.zoneIds.length} ${rule.zoneIds.length === 1 ? "zone" : "zones"}`}
        >
          <ZoneList
            ids={rule.zoneIds}
            zoneIndex={zoneIndex}
            loading={zonesLoading}
            onRemove={(remove) => onChange({ zoneIds: rule.zoneIds.filter((id) => !remove.includes(id)) })}
            onAdd={onAddZones}
            onLocate={onLocate}
          />
        </RuleSection>

        <RuleSection value="schedule" title="Schedule" summary={rule.schedule.allDay ? "All day" : "Set times"}>
          <ScheduleEditor value={rule.schedule} onChange={(schedule) => onChange({ schedule })} />
        </RuleSection>

        <RuleSection
          value="vehicles"
          title="Vehicles"
          summary={rule.vehicles.length ? `${rule.vehicles.length} of ${VEHICLES.length}` : "All"}
        >
          <AllOrSome
            idPrefix={`${rule.id}-vehicle`}
            allLabel="All vehicles"
            options={VEHICLES}
            value={rule.vehicles}
            onChange={(vehicles) => onChange({ vehicles: vehicles as Vehicle[] })}
          />
        </RuleSection>

        <RuleSection
          value="operators"
          title="Operators"
          summary={rule.operators.length ? `${rule.operators.length} of ${OPERATORS.length}` : "All"}
        >
          <AllOrSome
            idPrefix={`${rule.id}-operator`}
            allLabel="All operators"
            options={OPERATORS.map((o) => ({ value: o, label: o }))}
            value={rule.operators}
            onChange={(operators) => onChange({ operators })}
          />
        </RuleSection>
      </Accordion>
    </div>
  );
}

const formatSigned = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

function RuleSection({
  value,
  title,
  summary,
  children,
}: {
  value: (typeof SECTIONS)[number];
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="px-3">
      <AccordionTrigger>
        <span className="flex flex-1 items-center justify-between gap-3 pr-2">
          <span>{title}</span>
          <span className="text-muted-foreground text-xs font-normal tabular-nums">{summary}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function NumberField({
  id,
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder="Not set"
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="tabular-nums"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

/**
 * "All" plus the individual options, as production has it -- with the
 * difference that "all" is stored as an empty list rather than every value
 * ticked, so an operator added to the city later is covered without anyone
 * editing the rule.
 */
function AllOrSome({
  idPrefix,
  allLabel,
  options,
  value,
  onChange,
}: {
  idPrefix: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const all = value.length === 0;
  return (
    <FieldSet>
      <FieldLegend className="sr-only">{allLabel}</FieldLegend>
      <Field orientation="horizontal" className="gap-2">
        <Checkbox
          id={`${idPrefix}-all`}
          checked={all}
          onCheckedChange={(on) => onChange(on ? [] : [options[0]!.value])}
        />
        <FieldLabel htmlFor={`${idPrefix}-all`} className="font-normal">
          {allLabel}
        </FieldLabel>
      </Field>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-6">
        {options.map((o) => (
          <Field key={o.value} orientation="horizontal" className="gap-2">
            <Checkbox
              id={`${idPrefix}-${o.value}`}
              checked={all || value.includes(o.value)}
              disabled={all}
              onCheckedChange={(on) => {
                const next = toggle(value, o.value, on);
                // Ticking the last one is the same as "all"; say so.
                onChange(next.length === options.length ? [] : next);
              }}
            />
            <FieldLabel htmlFor={`${idPrefix}-${o.value}`} className="font-normal">
              {o.label}
            </FieldLabel>
          </Field>
        ))}
      </div>
    </FieldSet>
  );
}

const ZONE_PAGE = 8;

function ZoneList({
  ids,
  zoneIndex,
  loading,
  onRemove,
  onAdd,
  onLocate,
}: {
  ids: string[];
  zoneIndex: Map<string, PickerZone>;
  loading: boolean;
  onRemove: (ids: string[]) => void;
  onAdd: () => void;
  onLocate: (id: string) => void;
}) {
  const [checked, setChecked] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(ids.length / ZONE_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = ids.slice(current * ZONE_PAGE, current * ZONE_PAGE + ZONE_PAGE);
  // Ticks for zones that have since been removed must not count.
  const live = checked.filter((id) => ids.includes(id));
  const allOnPage = shown.length > 0 && shown.every((id) => live.includes(id));
  const someOnPage = shown.some((id) => live.includes(id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {live.length ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onRemove(live);
              setChecked([]);
            }}
          >
            <Trash2 data-icon="inline-start" />
            Remove {live.length}
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">
            {ids.length ? `${ids.length} ${ids.length === 1 ? "zone" : "zones"}` : "No zones yet"}
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onAdd} disabled={loading}>
          <Plus data-icon="inline-start" />
          Add zones
        </Button>
      </div>

      {ids.length === 0 ? (
        <Empty className="border border-dashed py-6">
          <EmptyHeader>
            <EmptyTitle className="text-sm">This rule covers no area yet</EmptyTitle>
            <EmptyDescription className="text-xs">
              Add zones from your library, paste GeoJSON, or draw one on the map.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label="Select zones on this page"
                    checked={allOnPage}
                    indeterminate={someOnPage && !allOnPage}
                    onCheckedChange={(on) =>
                      setChecked((c) => (on ? [...new Set([...c, ...shown])] : c.filter((id) => !shown.includes(id))))
                    }
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-20">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((id) => {
                const zone = zoneIndex.get(id);
                const name = zone?.name ?? (loading ? "Loading…" : "Missing zone");
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${name}`}
                        checked={live.includes(id)}
                        onCheckedChange={(on) => setChecked((c) => toggle(c, id, on))}
                      />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="block truncate">{name}</span>
                      {zone?.tags[0] ? (
                        <span className="text-muted-foreground block truncate text-xs">{zone.tags[0]}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Show ${name} on the map`}
                        disabled={!zone}
                        onClick={() => onLocate(id)}
                      >
                        <LocateFixed />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${name}`}
                        onClick={() => onRemove([id])}
                      >
                        <X />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Zone pages" className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {current * ZONE_PAGE + 1}–{Math.min(ids.length, (current + 1) * ZONE_PAGE)} of {ids.length}
          </span>
          <span className="flex gap-1">
            <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Map                                                                         */
/* -------------------------------------------------------------------------- */

type Bounds = [[number, number], [number, number]];

function boundsOf(rings: [number, number][][]): Bounds | null {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings)
    for (const [x, y] of ring) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

function RegulationMap({
  regulation,
  selectedRule,
  zoneIndex,
  focusZone,
  canDraw,
  onDrawn,
}: {
  regulation: Regulation;
  selectedRule?: string;
  zoneIndex: Map<string, PickerZone>;
  focusZone: { id: string; at: number } | null;
  canDraw: boolean;
  onDrawn: (ring: [number, number][]) => void;
}) {
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const [basemapId, setBasemapId] = React.useState<BasemapId>(DEFAULT_BASEMAP_ID);
  const [drawMode, setDrawMode] = React.useState<DrawMode | null>(null);

  // The selected rule draws on top and the others sit underneath, so in a
  // multi-rule regulation you can see where a parking bay falls inside a
  // no-parking area without losing which rule you are editing.
  const [focused, others] = React.useMemo(() => {
    const draw = (rules: Rule[]): CategoryShape[] =>
      rules.flatMap((r) =>
        r.zoneIds.flatMap((id) => {
          const z = zoneIndex.get(id);
          return z ? [{ ring: z.ring, category: r.type }] : [];
        }),
      );
    return [
      draw(regulation.rules.filter((r) => r.id === selectedRule)),
      draw(regulation.rules.filter((r) => r.id !== selectedRule)),
    ];
  }, [regulation.rules, selectedRule, zoneIndex]);

  const types = typesOf(regulation);
  const styles = React.useMemo(
    () => Object.fromEntries(types.map((t) => [t, { color: ruleTypeColor(t) }])),
    // Joined so a new array with the same types does not rebuild the layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [types.join()],
  );
  useCategoryShapeLayer({ map, enabled: others.length > 0, shapes: others, styles, id: "regulation-others" });
  useCategoryShapeLayer({ map, enabled: focused.length > 0, shapes: focused, styles, id: "regulation-focused" });

  const draw = useMapDraw({
    map,
    mode: drawMode,
    onComplete: (ring) => {
      onDrawn(ring);
      setDrawMode(null);
    },
    onCancel: () => setDrawMode(null),
  });

  // Frame the regulation once its zones are known, and again when a different
  // regulation opens -- not on every edit, which would yank the map away from
  // wherever someone had panned to check a zone.
  const framed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!map || framed.current === regulation.id) return;
    const rings = [...focused, ...others].map((s) => s.ring);
    const b = boundsOf(rings);
    if (!b) return;
    framed.current = regulation.id;
    map.fitBounds(b, { padding: 48, duration: 0, maxZoom: 15 });
  }, [map, regulation.id, focused, others]);

  React.useEffect(() => {
    if (!map || !focusZone) return;
    const z = zoneIndex.get(focusZone.id);
    const b = z && boundsOf([z.ring]);
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 17 });
  }, [map, focusZone, zoneIndex]);

  React.useEffect(() => {
    if (!canDraw) setDrawMode(null);
  }, [canDraw]);

  return (
    <section
      aria-label="Map of the regulation's zones"
      className="relative isolate h-[420px] min-w-0 flex-1 overflow-hidden border-t lg:h-full lg:border-t-0"
    >
      <MapCanvas
        className="absolute inset-0"
        basemap={basemapId}
        workerUrl={WORKER_URL}
        center={LISBON}
        zoom={12.5}
        cooperativeGesturesBelow={1024}
        onStyleReady={setMap}
        fallback={
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
            The map can&apos;t be shown here because WebGL is unavailable.
          </div>
        }
      />

      <MapDrawControl
        className="absolute top-3 right-3"
        mode={drawMode}
        onModeChange={setDrawMode}
        disabled={!canDraw}
      />

      {drawMode ? (
        <MapDrawBanner
          className="absolute top-3 left-1/2 w-[min(22rem,calc(100%-6rem))] -translate-x-1/2"
          mode={drawMode}
          points={draw.points}
          onDone={draw.finish}
          onCancel={draw.cancel}
        />
      ) : null}

      {types.length ? (
        <div className="bg-card/95 absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-lg border p-2.5 backdrop-blur">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Rule types</p>
          <LegendCategorical
            columns={1}
            items={types.map((t) => ({ label: RULE_TYPES[t].label, color: ruleTypeColor(t) }))}
          />
        </div>
      ) : null}

      <MapControls
        className="absolute right-3 bottom-10"
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        basemap={<BasemapSwitcher value={basemapId} onValueChange={setBasemapId} side="left" align="end" />}
      />
    </section>
  );
}
