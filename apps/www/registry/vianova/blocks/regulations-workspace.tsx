"use client";

import * as React from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  ScrollText,
  Globe,
  Info,
  Lock,
  LocateFixed,
  MapPin,
  Map as MapIcon,
  Minus,
  MoreHorizontal,
  Plus,
  Power,
  Scale,
  Search,
  SlidersHorizontal,
  SquarePen,
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
  InputGroupButton,
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
  DEFAULT_LINE_WIDTH_M,
  MapDrawBanner,
  useMapDraw,
  useMapDrawShortcuts,
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
  ZoneDraftPanel,
  ZoneNameField,
  ZonePickerPanel,
  type PickerZone,
  type ZoneDrawTool,
} from "@/registry/vianova/product/zone-picker";
import { BottomTray, type TraySnap } from "@/registry/vianova/patterns/bottom-tray";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import {
  useCategoryShapeLayer,
  type CategoryShape,
} from "@/registry/vianova/hooks/use-category-shape-layer";
import { DEFAULT_BASEMAP_ID, type BasemapId } from "@/registry/vianova/lib/basemaps";
import { CATEGORY_PALETTE } from "@/registry/vianova/lib/category-style";
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
/*
 * Six real Lisbon parking bays, served beside this page.
 *
 * Import's link field cannot be demonstrated against anything else: a browser
 * only fetches a host that allows requests from other sites, and most city
 * open-data portals, ArcGIS and every Drive or Dropbox share link do not.
 * Behind an API this is a server-side fetch and all of them work, so the
 * limit is the demo's and not the product's -- and this file is what lets
 * someone see the path work at all. Same-origin, so it always answers.
 */
const SAMPLE_GEOJSON = `${BASE_PATH}/data/parking-bays-lisbon.geojson`;

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

/**
 * A run of drawing, from the first tool press to Add or Cancel.
 *
 * `drafts` are finished shapes that have not reached the rule or anyone's
 * zone library yet, which is what makes Cancel leave no trace. `ruleId` is
 * carried so the session cannot outlive the rule it was started from -- a
 * rule deleted mid-draw must not have its shapes land on whichever rule is
 * selected next.
 */
type DrawSession = {
  tool: DrawMode | null;
  drafts: PickerZone[];
  focusId: string | null;
  ruleId: string;
};

/** One empty array, so no-session renders do not rebuild the drafts layer. */
const NO_DRAFTS: PickerZone[] = [];

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

/**
 * The regulation's logs, as a CSV.
 *
 * Production fetches these from the logs endpoint, which returns one row per
 * enforcement event. The sample has no event stream to draw on, so what comes
 * out here is the regulation as it currently stands -- a row per rule and
 * zone. A host wiring this block to a real API should replace the body of
 * this function, not the menu item: the affordance, its name and the case it
 * is disabled in are what the design system is fixing.
 */
function downloadLogs(reg: Regulation, zones: Map<string, PickerZone>) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ["regulation", "rule", "rule_type", "zone", "starts", "ends", "status"],
    ...reg.rules.flatMap((rule) =>
      rule.zoneIds.map((id) => [
        reg.name,
        rule.name,
        RULE_TYPES[rule.type].label,
        zones.get(id)?.name ?? id,
        rule.schedule.start ?? reg.global.start ?? "",
        rule.schedule.end ?? reg.global.end ?? "",
        STATUS_LABELS[regulationStatus(reg)],
      ]),
    ),
  ];
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reg.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-logs.csv`;
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
 * list and a light editor; visibility is a status with its action in the
 * menu, not a pill that looks like a toggle; and saving is one bar that says
 * what is unsaved, rather than a button that changes its own label.
 */
export function RegulationsWorkspace({
  className,
  regulations: initial = SAMPLE_REGULATIONS,
  status = "ready",
  geocode,
  onRetry,
  onSave,
}: {
  className?: string;
  regulations?: Regulation[];
  status?: "ready" | "loading" | "error";
  /** Looks up places for the map's search field. Omitted, there is none. */
  geocode?: Geocode;
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
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
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
          geocode={geocode}
          onZonesCreated={(made) => setZones((all) => [...made, ...all])}
          onZoneRename={(id, name) =>
            setZones((all) => all.map((z) => (z.id === id ? { ...z, name } : z)))
          }
          onSave={(reg) => {
            // The list's "Last update" is what a save moves, so it is stamped
            // here, where every save passes, rather than in the editor's own
            // state where a draft could carry a time it never saved at.
            const stamped = { ...reg, updatedAt: new Date().toISOString() };
            setRegulations((all) =>
              all.some((r) => r.id === stamped.id)
                ? all.map((r) => (r.id === stamped.id ? stamped : r))
                : [stamped, ...all],
            );
            setDrafts(({ [stamped.id]: _, ...rest }) => rest);
            setView({ kind: "edit", id: stamped.id, isNew: false });
            onSave?.(stamped);
          }}
          onDuplicate={(reg) => {
            const copy = cloneRegulation(reg);
            copy.id = uid("reg");
            copy.name = `${reg.name} (copy)`;
            copy.visibility = "private";
            copy.createdAt = new Date().toISOString();
            copy.updatedAt = copy.createdAt;
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
          Create regulation
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
                Create regulation
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
                <TableHead className="hidden md:table-cell">Last update</TableHead>
                <TableHead className="w-20">
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
          <span className="sm:hidden">
            {" · "}
            {STATUS_LABELS[status]}
            {reg.visibility === "public" ? " · Public" : ""}
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="flex flex-wrap items-center gap-1">
          <RegulationStatusBadge status={status} />
          {reg.visibility === "public" ? <VisibilityBadge visibility="public" /> : null}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
        {formatDate(reg.createdAt)}
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
        {formatDate(reg.updatedAt)}
      </TableCell>
      <TableCell>
        {/* Download alone. The ⋯ menu held Open and Download GeoJSON and
            nothing else: the name opens the regulation and this icon downloads
            it, so the menu was a second click to what was already one click
            away. Anything a row gains later goes in the editor, not back
            behind a ⋯. */}
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${reg.name} as GeoJSON`}
            onClick={onDownload}
          >
            <Download />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RegulationStatusBadge({ status }: { status: RegulationStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</StatusBadge>;
}

function VisibilityBadge({ visibility }: { visibility: Regulation["visibility"] }) {
  // Only Public is tinted: it is the state with consequences outside the
  // product -- the zones are served to anyone -- so it is the one that must
  // not be missed. Private is the default and stays quiet. --info passes AA as
  // text in both themes, which --warning would not.
  return visibility === "public" ? (
    <Badge variant="outline" data-visibility="public" className="border-info/30 bg-info/10 text-info">
      <Globe />
      Public
    </Badge>
  ) : (
    <Badge variant="outline" data-visibility="private">
      <Lock />
      Private
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
 * The type picker. One click on a card creates the regulation and opens the
 * editor, as production does.
 *
 * It used to be a radio group with a Create button below it, because arrow
 * keys move a radio group's selection and acting on every change would throw
 * a keyboard user into the editor for an option they were only passing. The
 * confirm step was paying off that problem for everyone, including the people
 * using a mouse who never had it. `action` cards are buttons instead: Tab
 * reaches each one and only a click, Enter or Space commits, so the step buys
 * nothing and is gone.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create regulation</DialogTitle>
          <DialogDescription>
            Choose the kind of rule it starts with. You can add zones, times and vehicles next.
          </DialogDescription>
        </DialogHeader>
        <ChoiceCardGroup
          aria-label="Rule type"
          columns={3}
          mode="action"
          onChoose={(value) => onCreate(value as RuleType)}
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
  geocode,
  onZonesCreated,
  onZoneRename,
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
  geocode?: Geocode;
  onZonesCreated: (zones: PickerZone[]) => void;
  onZoneRename: (id: string, name: string) => void;
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
  /*
   * Adding zones is a screen, not an overlay.
   *
   * It was a sheet, which covered the map -- the one thing worth looking at
   * while choosing an area. In its place the settings column goes one level
   * deeper, the way it already does from the list into a regulation, and the
   * map keeps its half of the screen and lights up what is being picked.
   */
  const [picking, setPicking] = React.useState(false);
  /** The zone under the pointer in the panel, drawn on the map as you read. */
  const [preview, setPreview] = React.useState<PickerZone | null>(null);
  /** Everything ticked so far, drawn and framed before it is committed. */
  const [candidates, setCandidates] = React.useState<PickerZone[]>([]);
  /*
   * Drawing, held here rather than inside the map, because two things start
   * it: the map's own toolbar, and the Draw tab in Add zones. That tab is in
   * the settings column, a sibling of the map, so the state they share has to
   * sit above both.
   *
   * Two bits, not one. `session` is open from the first tool press until Add
   * or Cancel; `session.tool` is what is armed right now, and it can be null
   * inside an open session. Without the split, Escape would have to choose
   * between leaving a list on screen that nothing can add to, and throwing
   * away shapes someone just drew.
   */
  const [session, setSession] = React.useState<DrawSession | null>(null);
  const drawMode = session?.tool ?? null;
  const [traySnap, setTraySnap] = React.useState<TraySnap>("peek");
  const [focusZone, setFocusZone] = React.useState<{ id: string; at: number } | null>(null);
  /*
   * Below lg the settings and the map take turns rather than stacking: stacked,
   * the map sat under every setting, so Locate and Draw acted on something
   * off-screen. Switched by CSS, as the map workspace's panes are -- both stay
   * mounted, nothing flashes on a statically exported first paint, and from lg
   * up CSS shows both and this state is ignored.
   */
  const [pane, setPane] = React.useState<"settings" | "map">("settings");

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
    // Unadded shapes are not part of `draft`, so a revert would leave them
    // drawn on a regulation that no longer expects them.
    setSession(null);
    if (isNew) return onClose();
    const original = JSON.parse(baseline) as Regulation;
    setDraft(original);
    if (!original.rules.some((r) => r.id === selected)) setSelected(original.rules[0]?.id ?? RULE_RAIL_GLOBAL);
  };

  const back = () => {
    setSession(null);
    if (dirty) return setConfirmLeave(true);
    onClose();
  };

  /** Leaves Add zones without adding, and takes its drawing off the map. */
  const stopPicking = () => {
    setPicking(false);
    setPreview(null);
    setCandidates([]);
  };

  const duplicateRule = (id: string) => {
    const src = draft.rules.find((r) => r.id === id);
    if (!src) return;
    const copy = { ...src, id: uid("rule"), name: `${src.name} (copy)`, zoneIds: [...src.zoneIds] };
    update({ rules: [...draft.rules, copy] });
    setSelected(copy.id);
  };
  const deleteRule = (id: string) => {
    const rest = draft.rules.filter((r) => r.id !== id);
    update({ rules: rest });
    if (selected === id) setSelected(rest[0]?.id ?? RULE_RAIL_GLOBAL);
  };
  const zoneCount = draft.rules.reduce((n, r) => n + r.zoneIds.length, 0);

  const addZones = (made: PickerZone[], into: string) => {
    const target = draft.rules.find((r) => r.id === into);
    if (!target) return;
    updateRule(into, { zoneIds: [...new Set([...target.zoneIds, ...made.map((z) => z.id)])] });
  };

  /**
   * Arms a tool, opening a session if one is not already running.
   *
   * The single entry point, so the Draw tab and the map's keyboard shortcuts
   * cannot disagree about what drawing is. Disarming with nothing drawn
   * closes the session; with drafts in hand it only stops drawing, because
   * the list and its Add button still have work to do.
   */
  const armTool = (tool: DrawMode | null) => {
    if (!rule) return;
    const ruleId = rule.id;
    setSession((s) => {
      if (tool === null) {
        return !s || s.drafts.length === 0 ? null : { ...s, tool: null };
      }
      return s && s.ruleId === ruleId
        ? { ...s, tool }
        : { tool, drafts: [], focusId: null, ruleId };
    });
  };

  /**
   * The same, for the tool row inside the session panel.
   *
   * It differs in one case, and only because the tools moved off the map: an
   * Escape with nothing drawn closes the session, which was free when the
   * toolbar stayed on screen behind it. Now the session IS the panel, so
   * closing it takes the tools away too -- press Polygon twice before drawing
   * anything and you would be back in settings, having asked for neither.
   * Stopping from in here keeps the panel open with nothing armed.
   */
  const setSessionTool = (tool: DrawMode | null) => {
    if (tool !== null) {
      armTool(tool);
      return;
    }
    setSession((s) => (s ? { ...s, tool: null } : s));
  };

  /** Leaves the session, taking every unadded shape with it. */
  const cancelSession = () => {
    setSession(null);
    setPreview(null);
    setPane("settings");
  };

  /**
   * The shapes reach the rule here, and only here.
   *
   * `onZonesCreated` is called once with the whole batch rather than per
   * shape: until this point a draft is a label on something that does not
   * exist yet, so renaming one is local. A second later the same edit renames
   * a library zone everywhere it is used, because rules reference zones by id.
   */
  const commitSession = () => {
    if (!session || !rule) return;
    onZonesCreated(session.drafts);
    addZones(session.drafts, rule.id);
    setSession(null);
    setPreview(null);
    setPane("settings");
  };

  const renameDraft = (id: string, name: string) =>
    setSession((s) =>
      s
        ? {
            ...s,
            drafts: s.drafts.map((z) => (z.id === id ? { ...z, name } : z)),
            focusId: null,
          }
        : s,
    );

  const removeDraft = (id: string) =>
    setSession((s) =>
      s ? { ...s, drafts: s.drafts.filter((z) => z.id !== id) } : s,
    );

  /*
   * A session cannot outlive its rule.
   *
   * Switching rules mid-draw, or deleting the one being drawn on, would
   * otherwise leave shapes queued against a rule that is no longer on screen
   * -- and Add would put them on whichever rule got selected instead.
   */
  const sessionRuleId = session?.ruleId;
  React.useEffect(() => {
    if (sessionRuleId && sessionRuleId !== rule?.id) {
      setSession(null);
      setPreview(null);
    }
  }, [sessionRuleId, rule?.id]);

  const draftPanel =
    session && rule ? (
      <ZoneDraftPanel
        chrome="panel"
        tool={session.tool as ZoneDrawTool | null}
        drafts={session.drafts}
        focusId={session.focusId}
        onToolChange={setSessionTool}
        ruleName={multi ? `${draft.name} · ${rule.name}` : draft.name}
        onRename={renameDraft}
        onRemove={removeDraft}
        onPreviewChange={setPreview}
        onCancel={cancelSession}
        onAdd={commitSession}
      />
    ) : null;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Panel */}
      <section
        aria-label={
          session ? "Draw zones" : picking ? "Add zones" : "Regulation settings"
        }
        className={cn(
          "bg-background flex min-w-0 flex-col lg:h-full lg:shrink-0 lg:flex-none lg:border-r",
          // Narrower during a session: it holds a list of names, not a form,
          // and the map is where the work is happening.
          session ? "lg:w-[340px]" : "lg:w-[460px]",
          pane === "settings" ? "min-h-0 flex-1" : "shrink-0",
        )}
      >
        {session && rule ? (
          // Below lg the map pane owns the screen and the tray carries this
          // instead, so the column keeps out of the way rather than mounting
          // a second copy of the same list.
          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            {draftPanel}
          </div>
        ) : picking && rule ? (
          <ZonePickerPanel
            zones={zones}
            excludeIds={rule.zoneIds}
            // Where the arrow returns to, named: the rule in a multi-rule
            // regulation, the regulation itself when there is only one.
            backLabel={multi ? `${draft.name} · ${rule.name}` : draft.name}
            onBack={stopPicking}
            urlSample={SAMPLE_GEOJSON}
            onPreviewChange={setPreview}
            onSelectionChange={setCandidates}
            onAdd={(picked) => {
              // Pasted and uploaded zones are ones the library has never seen.
              const fresh = picked.filter((z) => !zoneIndex.has(z.id));
              if (fresh.length) onZonesCreated(fresh);
              addZones(picked, rule.id);
              stopPicking();
            }}
            onDraw={(tool) => {
              // Drawing happens on the map, so the panel steps back out to the
              // rule first -- below lg that is also what puts the map on
              // screen, and arming a tool on a hidden pane would strand the
              // reader on the settings with nothing to draw on.
              stopPicking();
              setPane("map");
              armTool(tool);
            }}
          />
        ) : (
          <>
        <header className="space-y-2 border-b px-4 pt-3 pb-3 lg:pb-4">
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
              onDownloadLogs={() => downloadLogs(draft, zoneIndex)}
              onDeactivate={() => setConfirmDeactivate(true)}
              onReactivate={() => update({ deactivated: false })}
            />
          </div>
          {/* The kicker is a row of its own only where height is cheap; on a
              phone the type joins the status badges below. */}
          <p className="text-muted-foreground hidden items-center gap-1.5 text-xs font-medium tracking-wide uppercase lg:flex">
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
            <Badge variant="outline" className="lg:hidden">
              <RuleTypeIcon type={draft.kind} size="sm" />
              {RULE_TYPES[draft.kind].label}
            </Badge>
            {isNew ? <Badge variant="secondary">Draft</Badge> : <RegulationStatusBadge status={status} />}
            <VisibilityBadge visibility={draft.visibility} />
          </div>

          <SegmentedControl
            data-slot="regulation-pane-switcher"
            aria-label="Show"
            className="mt-1 w-full lg:hidden"
            value={pane}
            onValueChange={(v) => setPane(v as "settings" | "map")}
            items={[
              {
                value: "settings",
                // Not "unsaved changes": that is the save bar's own wording, and
                // two of it on screen would make neither findable by text.
                label: dirty ? "Settings, edited" : "Settings",
                // The unsaved state lives on the save bar, which the map pane
                // hides, so the tab carries a dot for it while you are away.
                icon: (
                  <span aria-hidden className="flex items-center gap-1.5">
                    <SquarePen className="size-4" />
                    Settings
                    {dirty ? <span className="bg-warning size-1.5 rounded-full" /> : null}
                  </span>
                ),
              },
              {
                value: "map",
                label: `Map (${zoneCount})`,
                icon: (
                  <span aria-hidden className="flex items-center gap-1.5">
                    <MapIcon className="size-4" />
                    Map
                    <span className="text-muted-foreground tabular-nums">{zoneCount}</span>
                  </span>
                ),
              },
            ]}
          />
        </header>

        <div className={cn("flex min-h-0 flex-1 flex-col lg:flex-row", pane === "map" && "max-lg:hidden")}>
          {multi ? (
            <RuleRail
              orientation="responsive"
              className="max-lg:rounded-none max-lg:border-0 max-lg:border-b max-lg:py-1 lg:border-r lg:py-3"
              items={draft.rules.map((r) => ({ id: r.id, type: r.type, label: r.name }))}
              value={selected}
              onValueChange={setSelected}
              addableTypes={draft.kind === "multi_parking" ? MULTI_PARKING_TYPES : [draft.kind]}
              onAdd={(type) => {
                const made = newRule(type, uid("rule"), nextRuleName(type, draft.rules));
                update({ rules: [...draft.rules, made] });
                setSelected(made.id);
              }}
              onDuplicate={duplicateRule}
              onDelete={deleteRule}
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
                onAddZones={() => {
                  // On a phone the panes take turns, and Add zones is the
                  // settings pane's own next screen.
                  setPane("settings");
                  setPicking(true);
                }}
                onZoneRename={onZoneRename}
                onLocate={(id) => {
                  setPane("map");
                  setFocusZone({ id, at: Date.now() });
                }}
                onDuplicate={multi ? () => duplicateRule(rule.id) : undefined}
                onDelete={multi && draft.rules.length > 1 ? () => deleteRule(rule.id) : undefined}
              />
            ) : (
              <GlobalSettings
                value={draft.global}
                isPublic={draft.visibility === "public"}
                onChange={(global) => update({ global })}
                onDownload={() => downloadGeoJson(draft, zoneIndex)}
              />
            )}
          </div>
        </div>

        <SaveBar
          className={cn(pane === "map" && "max-lg:hidden")}
          dirty={dirty}
          saving={saving}
          onSave={save}
          onDiscard={discard}
          message={isNew ? "Not saved yet" : undefined}
          saveLabel={isNew ? "Create regulation" : "Save"}
        />
          </>
        )}
      </section>

      {/* Map */}
      <RegulationMap
        className={cn(pane === "settings" && "max-lg:hidden")}
        regulation={draft}
        selectedRule={rule?.id}
        zoneIndex={zoneIndex}
        focusZone={focusZone}
        canDraw={Boolean(rule)}
        drawMode={drawMode}
        drawing={session !== null}
        geocode={geocode}
        onDrawModeChange={armTool}
        candidates={candidates}
        drafts={session?.drafts ?? NO_DRAFTS}
        preview={preview}
        onDrawn={(ring) => {
          if (!rule) return;
          const id = uid("zone");
          setSession((s) => {
            if (!s) return s;
            return {
              ...s,
              // Numbered from the rule's own count rather than a counter
              // shared with rules and regulations, so the first zone drawn
              // on an empty rule is Zone 1 and not Zone 7.
              drafts: [
                ...s.drafts,
                {
                  id,
                  name: `Zone ${rule.zoneIds.length + s.drafts.length + 1}`,
                  tags: ["drawn"],
                  ring,
                  createdAt: new Date().toISOString(),
                },
              ],
              focusId: id,
            };
          });
          // Raised once, on the first shape, so the auto-focused name field is
          // reachable without overruling anyone who then drags the tray back
          // down to see the map.
          if (!session?.drafts.length) setTraySnap("half");
        }}
        tray={
          // Two mounts of one list, exactly one of them visible: above lg this
          // wrapper is hidden and the column holds it, below lg the column is.
          // The hidden one is display:none, so it is out of the accessibility
          // tree and cannot take the focus the name field asks for.
          <div className="contents lg:hidden">
            <BottomTray
              open={session !== null}
              onOpenChange={(open) => {
                if (!open) cancelSession();
              }}
              snap={traySnap}
              onSnapChange={setTraySnap}
              label="Drawn zones"
              // Clear of MapLibre's attribution, which paints over anything
              // docked to the bottom edge.
              className="inset-x-2 bottom-10"
            >
              {session && rule ? (
                <ZoneDraftPanel
                  chrome="tray"
                  tool={session.tool as ZoneDrawTool | null}
                  drafts={session.drafts}
                  focusId={session.focusId}
                  onToolChange={setSessionTool}
                  onRename={renameDraft}
                  onRemove={removeDraft}
                  onPreviewChange={setPreview}
                  onCancel={cancelSession}
                  onAdd={commitSession}
                />
              ) : null}
            </BottomTray>
          </div>
        }
      />

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
  onDownloadLogs,
  onDeactivate,
  onReactivate,
}: {
  draft: Regulation;
  isNew: boolean;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onDownloadLogs: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  /*
   * A Multi-parking group of more than one rule has no logs to give: the API
   * reports against a single rule, and Cityscope greys the action out for the
   * same reason. Shown and disabled rather than hidden, so the answer to
   * "where did Download logs go" is on screen.
   */
  const noLogs = draft.kind === "multi_parking" && draft.rules.length > 1;

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
        <DropdownMenuItem disabled={isNew || noLogs} onClick={onDownloadLogs}>
          <ScrollText />
          Download logs
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
  isPublic,
  onChange,
  onDownload,
}: {
  value: Regulation["global"];
  isPublic: boolean;
  onChange: (next: Regulation["global"]) => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
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

      {/* Production calls this section "Public endpoint" and prints the URL the
          GeoJSON is served from. The URL belongs to the API, not to a block
          that has never spoken to one, so what is here is the half the design
          system can own: the section, its place on the page, and the export
          itself. A host with a real endpoint should print it above the button
          and keep the heading production uses. */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-base font-semibold">Export</h3>
        <p className="text-muted-foreground text-sm">
          Every zone of every rule, as one GeoJSON file.
          {isPublic
            ? " The same file is served from this regulation's public endpoint."
            : " This regulation is private, so only people with access to it can fetch the file."}
        </p>
        <Button variant="outline" onClick={onDownload}>
          <Download data-icon="inline-start" />
          Export as GeoJSON
        </Button>
      </div>
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
  onZoneRename,
  onDuplicate,
  onDelete,
}: {
  rule: Rule;
  /** A rule in a multi-rule regulation has a name of its own; a single rule is the regulation. */
  showName: boolean;
  zoneIndex: Map<string, PickerZone>;
  zonesLoading: boolean;
  onChange: (next: Partial<Rule>) => void;
  onAddZones: () => void;
  onLocate: (zoneId: string) => void;
  onZoneRename: (id: string, name: string) => void;
  /**
   * The rule's own actions, shown below lg only: there the rail is a strip of
   * chips with no ⋯ of their own. From lg up the rail's tiles carry them.
   */
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const meta = RULE_TYPES[rule.type];
  const valueSpec = RULE_VALUE[rule.type];
  // Zones open by default: an empty rule's next step is always to add some.
  const [open, setOpen] = React.useState<string[]>(["zones"]);

  return (
    <div className="space-y-4 p-4">
      {showName ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <RuleTypeIcon type={rule.type} size="sm" />
              <span className="text-muted-foreground">{meta.label}</span>
            </p>
            {onDuplicate || onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${rule.name}`}
                      className="-my-1 lg:hidden"
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {onDuplicate ? (
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" disabled={!onDelete} onClick={onDelete}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
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
            hint="Widens or narrows every zone by this much when vehicles are counted, to allow for GPS error. The zones themselves don't change."
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
            onRename={onZoneRename}
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
  /**
   * Stepping from whatever is there now. An empty field starts at `min` when
   * there is one, so the first click lands on a legal value rather than on 0
   * for a field whose floor is 5.
   */
  const nudge = (by: number) => {
    const from = value ?? min ?? 0;
    const next = round(from + by * step);
    onChange(clamp(next, min, max));
  };

  const atMin = value !== undefined && min !== undefined && value <= min;
  const atMax = value !== undefined && max !== undefined && value >= max;

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
          {/* The browser's own arrows are suppressed in Input: they render at
              about 10px, well under the target size everything else here
              meets. These are the 24px replacements. */}
          <InputGroupButton
            size="icon-xs"
            aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={atMin}
            onClick={() => nudge(-1)}
          >
            <Minus />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label={`Increase ${label.toLowerCase()}`}
            disabled={atMax}
            onClick={() => nudge(1)}
          >
            <Plus />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

/**
 * Keeps a stepped value inside the spec's bounds, either of which may be
 * absent -- a fleet cap has a floor and no ceiling.
 */
function clamp(n: number, min?: number, max?: number) {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * Binary floating point, rounded off. A subsidy steps by 0.05, and 0.1 + 0.05
 * is 0.15000000000000002 -- which a currency field must never show.
 */
function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
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
  onRename,
}: {
  ids: string[];
  zoneIndex: Map<string, PickerZone>;
  loading: boolean;
  onRemove: (ids: string[]) => void;
  onAdd: () => void;
  onLocate: (id: string) => void;
  onRename: (id: string, name: string) => void;
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
                      {zone ? (
                        <ZoneNameField name={zone.name} onRename={(next) => onRename(id, next)} />
                      ) : (
                        <span className="block truncate">{name}</span>
                      )}
                      {zone?.tags[0] ? (
                        <span className="text-muted-foreground mt-1 block truncate text-xs">{zone.tags[0]}</span>
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

/**
 * The look of a zone that is chosen but not yet added. Module scope, because
 * useCategoryShapeLayer asks for a styles object that does not change
 * identity between renders.
 */
const CANDIDATE_STYLES = { candidate: { color: CATEGORY_PALETTE[1] } };

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

/** One place the map can be sent to. */
export type GeocodeResult = {
  /** The headline, e.g. "Alfama". */
  name: string;
  /** The line beneath it, e.g. "Santa Maria Maior, Lisboa, Portugal". */
  context?: string;
  /** [lon, lat]. */
  center: [number, number];
  /** [west, south, east, north], flown to in preference to the centre. */
  bbox?: [number, number, number, number];
};

/**
 * Looks places up by name. Held as a prop because a deployment has its own
 * places -- depots, operator areas, the zones already in the library -- and a
 * public geocoder knows none of them. Omit it and the map carries no search
 * field at all, so a block that does not want one is unchanged.
 *
 * The `signal` is aborted when another keystroke overtakes this lookup, so a
 * slow first answer cannot land after a later one and overwrite it.
 *
 * `near` is what the map is looking at, and a lookup that ignores it is worse
 * than useless here: searching "Belem" over Lisbon lands on Belém in Brazil,
 * 7,000km away, because that is the bigger place. Bias by it rather than
 * restrict to it -- somebody searching a second city still has to find it.
 */
export type Geocode = (
  query: string,
  signal: AbortSignal,
  near?: {
    center: [number, number];
    /** [west, south, east, north] of the current view. */
    bbox: [number, number, number, number];
  },
) => Promise<GeocodeResult[]>;

/**
 * Search over the map, top centre.
 *
 * A combobox rather than a field with a list under it: the results are
 * reached with the arrow keys from the input, which is how a reader who never
 * touches the mouse gets to the second result, and `aria-activedescendant`
 * is what names it to a screen reader while focus stays in the field.
 */
function MapSearch({
  geocode,
  onPick,
  className,
}: {
  geocode: Geocode;
  onPick: (place: GeocodeResult) => void;
  className?: string;
}) {
  const id = React.useId();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeocodeResult[]>([]);
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "failed">(
    "idle",
  );
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);

  // Debounced, because Nominatim -- the default the docs site runs on -- asks
  // for about one request a second, and a lookup per keystroke is four.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setState("idle");
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setState("busy");
      setOpen(true);
      geocode(q, ac.signal).then(
        (found) => {
          if (ac.signal.aborted) return;
          setResults(found);
          setActive(0);
          setState("done");
        },
        () => {
          if (ac.signal.aborted) return;
          setResults([]);
          setState("failed");
        },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [query, geocode]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const choose = (place: GeocodeResult | undefined) => {
    if (!place) return;
    onPick(place);
    setQuery(place.name);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  };

  const listId = `${id}-places`;
  const optionId = (i: number) => `${id}-place-${i}`;

  return (
    <div data-slot="map-search" className={className}>
      <InputGroup className="bg-card/95 shadow-lg backdrop-blur">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          role="combobox"
          aria-label="Search the map"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open && results.length ? optionId(active) : undefined
          }
          aria-autocomplete="list"
          placeholder="Search for a place"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Clear search"
              size="icon-xs"
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {open ? (
        <div className="bg-card/95 mt-1.5 overflow-hidden rounded-lg border shadow-lg backdrop-blur">
          {state === "busy" ? (
            <p className="text-muted-foreground p-3 text-sm">Searching…</p>
          ) : state === "failed" ? (
            <p role="alert" className="p-3 text-sm">
              That search could not be run. Many hosts refuse requests from
              other sites — try again, or draw the zone instead.
            </p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">
              Nothing found for “{query.trim()}”.
            </p>
          ) : (
            <ul role="listbox" id={listId} aria-label="Places" className="py-1">
              {results.map((place, i) => (
                <li
                  key={`${place.name}-${place.center.join()}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm",
                    i === active && "bg-muted",
                  )}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(place)}
                >
                  <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {place.name}
                    </span>
                    {place.context ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {place.context}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RegulationMap({
  regulation,
  selectedRule,
  zoneIndex,
  focusZone,
  canDraw,
  drawMode,
  drawing,
  geocode,
  onDrawModeChange,
  candidates,
  drafts,
  preview,
  onDrawn,
  tray,
  className,
}: {
  regulation: Regulation;
  selectedRule?: string;
  zoneIndex: Map<string, PickerZone>;
  focusZone: { id: string; at: number } | null;
  canDraw: boolean;
  /** Zones chosen in the Add zones panel but not yet added to the rule. */
  candidates: PickerZone[];
  /** Shapes finished in this drawing session, not yet added to the rule. */
  drafts: PickerZone[];
  /** The one being read in that panel, drawn over the rest. */
  preview: PickerZone | null;
  /** Owned above, because the Add zones screen arms it too. */
  drawMode: DrawMode | null;
  /**
   * A drawing session is open, armed or not. The search field stands down for
   * it: both want the top centre, and while a session is running the banner
   * there is the thing that has to be read.
   */
  drawing: boolean;
  /** Omitted, no search field is drawn. */
  geocode?: Geocode;
  onDrawModeChange: (mode: DrawMode | null) => void;
  onDrawn: (ring: [number, number][]) => void;
  /** The draft list as a tray, for the widths with no room for a column. */
  tray?: React.ReactNode;
  className?: string;
}) {
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const sectionRef = React.useRef<HTMLElement>(null);
  /*
   * Below lg the map is a pane that is display:none until asked for, and
   * MapLibre only listens to the WINDOW resizing: shown, it would keep the 0x0
   * canvas it was created with. Watching the section fixes that and anything
   * else that resizes it, and `visible` lets the framing wait for a real size
   * -- fitBounds on a 0x0 map lands on the wrong zoom.
   */
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const shown = (entry?.contentRect.width ?? 0) > 0;
      setVisible(shown);
      if (shown) map?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  const [basemapId, setBasemapId] = React.useState<BasemapId>(DEFAULT_BASEMAP_ID);
  // Kept across drawings rather than reset with the tool: someone marking up
  // a street network sets the corridor once and then draws a dozen streets at
  // that width.
  const [lineWidth, setLineWidth] = React.useState(DEFAULT_LINE_WIDTH_M);

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

  /*
   * What Add zones is about to add, over the top of what the rule already has.
   *
   * Blue, and not the rule's own colour, because these are not in the rule
   * yet: beside purple caps, green parking, amber, red and teal, blue is the
   * one slot the rule types leave free, so a candidate can never be mistaken
   * for something already saved. It is the design system's own categorical
   * blue rather than a colour invented here.
   */
  const candidateShapes = React.useMemo(
    () => candidates.map((z) => ({ ring: z.ring, category: "candidate" })),
    [candidates],
  );
  /*
   * What has just been drawn, in the same blue as a candidate: both are
   * shapes on their way into the rule, and the only difference is where they
   * came from.
   *
   * Deliberately NOT routed through `candidates`: the fit-to-selection effect
   * below is keyed on how many there are, so a finished shape would fly the
   * camera -- the map arguing with someone mid-draw. Drafts never move it.
   */
  const draftShapes = React.useMemo(
    () => drafts.map((z) => ({ ring: z.ring, category: "candidate" })),
    [drafts],
  );
  const previewShapes = React.useMemo(
    () => (preview ? [{ ring: preview.ring, category: "candidate" }] : []),
    [preview],
  );
  useCategoryShapeLayer({
    map,
    enabled: candidateShapes.length > 0,
    shapes: candidateShapes,
    styles: CANDIDATE_STYLES,
    width: 2,
    id: "regulation-candidates",
  });
  useCategoryShapeLayer({
    map,
    enabled: draftShapes.length > 0,
    shapes: draftShapes,
    styles: CANDIDATE_STYLES,
    width: 2,
    id: "regulation-drafts",
  });
  // The row being read, drawn again on top with a heavier outline. A second
  // layer rather than a second colour: the zone is the same zone, and what
  // the reader needs is to find it, not to be told it is a different kind.
  useCategoryShapeLayer({
    map,
    enabled: previewShapes.length > 0,
    shapes: previewShapes,
    styles: CANDIDATE_STYLES,
    width: 4,
    id: "regulation-preview",
  });

  const draw = useMapDraw({
    map,
    mode: drawMode,
    lineWidthMeters: lineWidth,
    /*
     * The tool stays armed, so a run of zones is a run of drags rather than a
     * trip back through the picker for each one. `useMapDraw`'s effect is
     * keyed on the mode, so leaving it alone means no teardown: the pointer
     * handlers, the held `dragPan` and the banner's corridor width all stay
     * live. Escape or Select is how you stop.
     */
    onComplete: (ring) => onDrawn(ring),
    onCancel: () => onDrawModeChange(null),
  });

  /*
   * p / c / f / l arm a tool and s stops, which used to come with the toolbar
   * that stood on the map. The toolbar has gone to the panel; the shortcuts
   * belong to the map either way, so they are held here now. The hook ignores
   * keys typed into a field, which is what keeps naming a draft "Circle" from
   * arming one.
   */
  useMapDrawShortcuts({
    mode: drawMode,
    onModeChange: onDrawModeChange,
    enabled: canDraw,
  });

  /*
   * The lookup is handed what the map is looking at, so a search reads as a
   * search of this city rather than of the whole world. Read at call time
   * from the map itself, not from state: panning does not re-render this, and
   * a bias taken from where the map was two pans ago is the bug it fixes.
   */
  const geocodeNear = React.useCallback<Geocode>(
    (query, signal) => {
      if (!geocode) return Promise.resolve([]);
      if (!map) return geocode(query, signal);
      const c = map.getCenter();
      const b = map.getBounds();
      return geocode(query, signal, {
        center: [c.lng, c.lat],
        bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      });
    },
    [geocode, map],
  );

  // Frame the regulation once its zones are known, and again when a different
  // regulation opens -- not on every edit, which would yank the map away from
  // wherever someone had panned to check a zone.
  const framed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!map || !visible || framed.current === regulation.id) return;
    map.resize();
    const rings = [...focused, ...others].map((s) => s.ring);
    const b = boundsOf(rings);
    if (!b) return;
    framed.current = regulation.id;
    map.fitBounds(b, { padding: 48, duration: 0, maxZoom: 15 });
  }, [map, visible, regulation.id, focused, others]);

  React.useEffect(() => {
    if (!map || !visible || !focusZone) return;
    map.resize();
    const z = zoneIndex.get(focusZone.id);
    const b = z && boundsOf([z.ring]);
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 17 });
  }, [map, visible, focusZone, zoneIndex]);

  /*
   * Frame what is being picked, as it is picked.
   *
   * Keyed on how many are chosen rather than on the zones themselves, so the
   * camera moves when the selection grows or shrinks and stays put while
   * someone scrolls the list or hovers a row -- which the preview layer
   * answers instead. Clearing the selection leaves the camera where it is:
   * flying back on an untick would be the map arguing with the reader.
   */
  const candidateCount = candidates.length;
  React.useEffect(() => {
    if (!map || !visible || candidateCount === 0) return;
    const b = boundsOf(candidates.map((z) => z.ring));
    if (b) map.fitBounds(b, { padding: 64, maxZoom: 16 });
    // candidates is read for its rings but deliberately not depended on; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visible, candidateCount]);

  React.useEffect(() => {
    if (!canDraw) onDrawModeChange(null);
  }, [canDraw]);

  return (
    <section
      ref={sectionRef}
      aria-label="Map of the regulation's zones"
      className={cn(
        "relative isolate min-h-0 min-w-0 flex-1 overflow-hidden border-t lg:h-full lg:border-t-0",
        className,
      )}
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

      {/* Top centre, and only when nothing is being drawn: the banner below
          takes the same place during a session, and a field that shuffles out
          of its way mid-draw moves under the cursor that is using it. The
          tools are not here at all any more -- they are in the panel, which
          is the one place that stays on screen for the whole session. */}
      {geocode && !drawing ? (
        <MapSearch
          className="absolute top-3 left-1/2 z-10 w-[min(22rem,calc(100%-6rem))] -translate-x-1/2"
          geocode={geocodeNear}
          onPick={(place) => {
            if (!map) return;
            if (place.bbox) {
              map.fitBounds(
                [
                  [place.bbox[0], place.bbox[1]],
                  [place.bbox[2], place.bbox[3]],
                ],
                { padding: 48, duration: 900 },
              );
            } else {
              map.flyTo({ center: place.center, zoom: 14, duration: 900 });
            }
          }}
        />
      ) : null}

      {drawMode ? (
        <MapDrawBanner
          className="absolute top-3 left-1/2 w-[min(30rem,calc(100%-6rem))] -translate-x-1/2"
          mode={drawMode}
          points={draw.points}
          lineWidthMeters={lineWidth}
          onLineWidthChange={setLineWidth}
          onDone={draw.finish}
          onCancel={draw.cancel}
        />
      ) : null}

      {/* The legend is lifted clear of the attribution on a phone, where
          MapLibre's compact attribution opens across the whole bottom edge. */}
      {types.length ? (
        <div className="bg-card/95 absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-lg border p-2.5 backdrop-blur max-lg:bottom-10">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Rule types</p>
          <LegendCategorical
            columns={1}
            items={types.map((t) => ({ label: RULE_TYPES[t].label, color: ruleTypeColor(t) }))}
          />
        </div>
      ) : null}

      {tray}

      <MapControls
        className="absolute right-3 bottom-10"
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        basemap={<BasemapSwitcher value={basemapId} onValueChange={setBasemapId} side="left" align="end" />}
      />
    </section>
  );
}
