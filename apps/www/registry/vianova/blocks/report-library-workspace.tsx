"use client";

/**
 * The Reports page.
 *
 * Reports created from the Dashboard feature: the automatic monthly ones, made
 * on the night of the 1st from the template dashboards, and the ad-hoc exports
 * users make from a dashboard or a saved map. Both land in one list, and both
 * open the same download choice.
 *
 * The file is named `report-library-workspace` because "Report library" was the
 * working name while this was designed. The page is called **Reports**: the
 * word was taken in VIP by the section now renamed Dashboard, and that rename
 * freed it. The generator's BLOCK_TITLES carries the real title, exactly as it
 * does for `reports-workspace`, which is the Dashboard. Renaming either file
 * would change a published `shadcn add` name, so the names are tidied in their
 * own pass, not in a feature.
 *
 * Deliberately NOT here:
 *
 * - **No in-app view of a past report.** Clicking a name opens the download
 *   choice. The product decision is download-only; a frozen-report view can be
 *   added later on the same numbers if Munich asks for it.
 * - **No branding form.** A commune's logo and colours are added by CS on
 *   request. Munich's branding is the default and lives in the backend.
 * - **Nothing that only the backend can be the truth about:** freezing the
 *   numbers, building each file on first download, scope access, the download
 *   log. The page shows the *consequences* of those - a file that has not been
 *   built yet takes a moment on its first download - and invents none of them.
 */

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pin,
  PinOff,
  Presentation,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/vianova/ui/dialog";
import {
  Empty,
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
import { Toggle } from "@/registry/vianova/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/vianova/ui/tooltip";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   Model                                    */
/* -------------------------------------------------------------------------- */

/** Five formats, all built by our servers. Settled in the design doc, 29 Oct. */
export type ReportFormat = "pdf" | "pptx" | "docx" | "html" | "data";

export type ReportKind = "monthly" | "adhoc";

export type Report = {
  id: string;
  kind: ReportKind;
  name: string;
  /** One line under the name, saying what is in it. */
  summary: string;
  /** Monthly reports only. Part of the file name. */
  fleet?: "MyRadl" | "Other fleets";
  territory: string;
  /** `2026-10`, or `2026-Q3` for a quarter. Part of the file name. */
  period: string;
  /** "Vianova" for the automatic reports. */
  createdBy: string;
  /** Drives the "Created by: Me" filter. */
  mine?: boolean;
  createdAt: string;
  pinned?: boolean;
  /**
   * Formats the servers have already built and kept. Anything not in here
   * takes a moment on its first download, which is the only place the
   * build-on-first-download rule is visible to a user.
   */
  built?: ReportFormat[];
};

const FORMATS: Record<
  ReportFormat,
  { label: string; hint: string; ext: string; icon: React.ElementType }
> = {
  pdf: {
    label: "PDF",
    hint: "Fixed layout, for sharing and printing.",
    ext: "pdf",
    icon: FileText,
  },
  pptx: {
    label: "PowerPoint",
    hint: "Editable slides, one per analysis.",
    ext: "pptx",
    icon: Presentation,
  },
  docx: {
    label: "Word",
    hint: "Editable document, to paste into a council paper.",
    ext: "docx",
    icon: FileSpreadsheet,
  },
  html: {
    label: "Web page",
    hint: "A single page that opens in a browser.",
    ext: "html",
    icon: FileCode2,
  },
  data: {
    label: "Data",
    hint: "A zip with one image and one table per chart.",
    ext: "zip",
    icon: FileArchive,
  },
};

const FORMAT_ORDER: ReportFormat[] = ["pdf", "pptx", "docx", "html", "data"];

/** The demo's "today", so the relative dates below never drift. */
const REPORTS_NOW = "2026-11-05T09:00:00Z";
const NOW = Date.parse(REPORTS_NOW);

export const SAMPLE_REPORTS: Report[] = [
  {
    id: "m-2026-10-region",
    kind: "monthly",
    name: "Monthly report · Whole region · October 2026",
    summary: "Every commune and district, MyRadl only, Oct 1 to Oct 31, 2026.",
    fleet: "MyRadl",
    territory: "Whole region",
    period: "2026-10",
    createdBy: "Vianova",
    createdAt: "2026-11-01T02:14:00Z",
    pinned: true,
    built: ["pdf"],
  },
  {
    id: "m-2026-10-freising-district",
    kind: "monthly",
    name: "Monthly report · Freising district · October 2026",
    summary: "The district and its communes, MyRadl only, Oct 1 to Oct 31, 2026.",
    fleet: "MyRadl",
    territory: "Freising district",
    period: "2026-10",
    createdBy: "Vianova",
    createdAt: "2026-11-01T02:16:00Z",
  },
  {
    id: "m-2026-10-freising",
    kind: "monthly",
    name: "Monthly report · Freising · October 2026",
    summary: "MyRadl only, Oct 1 to Oct 31, 2026.",
    fleet: "MyRadl",
    territory: "Freising",
    period: "2026-10",
    createdBy: "Vianova",
    createdAt: "2026-11-01T02:17:00Z",
  },
  {
    id: "m-2026-10-garching",
    kind: "monthly",
    name: "Monthly report · Garching · October 2026",
    summary: "MyRadl only, Oct 1 to Oct 31, 2026.",
    fleet: "MyRadl",
    territory: "Garching",
    period: "2026-10",
    createdBy: "Vianova",
    createdAt: "2026-11-01T02:18:00Z",
  },
  {
    id: "m-2026-10-garching-fleets",
    kind: "monthly",
    name: "Monthly report · Garching · Other fleets · October 2026",
    summary: "Scooters and mopeds, Oct 1 to Oct 31, 2026.",
    fleet: "Other fleets",
    territory: "Garching",
    period: "2026-10",
    createdBy: "Vianova",
    createdAt: "2026-11-01T02:19:00Z",
  },
  {
    id: "a-freising-station",
    kind: "adhoc",
    name: "Freising station",
    summary: "Departures by station, pedelecs only, Sep 1 to Oct 27, 2026.",
    territory: "Freising",
    period: "2026-10",
    createdBy: "Anja Reiter",
    createdAt: "2026-10-27T15:42:00Z",
    pinned: true,
    built: ["pdf", "data"],
  },
  {
    id: "a-garching-weekly",
    kind: "adhoc",
    name: "Garching · weekly pattern",
    summary: "Trips per weekday and hour, all fleets, Oct 1 to Oct 31, 2026.",
    territory: "Garching",
    period: "2026-10",
    createdBy: "Thomas Brandl",
    createdAt: "2026-10-31T11:05:00Z",
    built: ["pptx"],
  },
  {
    id: "a-my-parking",
    kind: "adhoc",
    name: "Parking pressure · town centre",
    summary: "Idle time by zone, MyRadl only, Oct 6 to Oct 31, 2026.",
    territory: "Freising",
    period: "2026-10",
    createdBy: "You",
    mine: true,
    createdAt: "2026-11-03T08:20:00Z",
  },
  {
    id: "m-2026-09-region",
    kind: "monthly",
    name: "Monthly report · Whole region · September 2026",
    summary: "Every commune and district, MyRadl only, Sep 1 to Sep 30, 2026.",
    fleet: "MyRadl",
    territory: "Whole region",
    period: "2026-09",
    createdBy: "Vianova",
    createdAt: "2026-10-01T02:14:00Z",
    built: ["pdf", "pptx"],
  },
  {
    id: "m-2026-09-freising",
    kind: "monthly",
    name: "Monthly report · Freising · September 2026",
    summary: "MyRadl only, Sep 1 to Sep 30, 2026.",
    fleet: "MyRadl",
    territory: "Freising",
    period: "2026-09",
    createdBy: "Vianova",
    createdAt: "2026-10-01T02:17:00Z",
  },
  {
    id: "a-q3-review",
    kind: "adhoc",
    name: "Q3 review · all fleets",
    summary: "Trips, bikes in use and active rate, Jul 1 to Sep 30, 2026.",
    territory: "Whole region",
    period: "2026-Q3",
    createdBy: "Anja Reiter",
    createdAt: "2026-10-02T16:30:00Z",
    built: ["pdf"],
  },
];

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const PERIODS: Record<string, string> = {
  all: "All periods",
  "2026-10": "2026-10",
  "2026-09": "2026-09",
  "2026-Q3": "2026-Q3",
};

const TERRITORIES: Record<string, string> = {
  all: "All territories",
  Freising: "Freising",
  "Freising district": "Freising district",
  Garching: "Garching",
  "Whole region": "Whole region",
};

/**
 * Who made it. Not in the design doc: the product decision is that everyone in
 * a scope sees every export in it, so the column needs a way to get back to
 * your own. Narrowing this to author-only later removes a filter; adding it
 * afterwards would mean adding the column too.
 */
const AUTHORS: Record<string, string> = {
  all: "Anyone",
  vianova: "Vianova",
  me: "Me",
};

function formatCreated(iso: string, now = NOW) {
  const then = Date.parse(iso);
  const hours = Math.round((now - then) / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(then).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * File names follow Katell's rule. A monthly report names its fleet, territory
 * and month; an ad-hoc one says it is ad hoc, and its own name and date. The
 * ad-hoc shape is still to confirm with Munich, so it is written once, here.
 */
function fileName(report: Report, format: ReportFormat) {
  const { ext } = FORMATS[format];
  const safe = (s: string) => s.replace(/\s+/g, "-");
  if (report.kind === "monthly") {
    return `Monthly-report_${report.fleet ?? "MyRadl"}_${safe(report.territory)}_${report.period}.${ext}`;
  }
  return `Ad-hoc-report_${safe(report.name)}_${report.createdAt.slice(0, 10)}.${ext}`;
}

/* -------------------------------------------------------------------------- */
/*                               Download choice                              */
/* -------------------------------------------------------------------------- */

/**
 * One dialog for one report and for a batch, because the choice is the same
 * one. A batch says how many reports it covers and drops the file name, which
 * would otherwise have to list eleven of them.
 */
function DownloadDialog({
  reports,
  open,
  onOpenChange,
  onDownload,
  busy,
}: {
  reports: Report[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (format: ReportFormat) => void;
  busy: ReportFormat | null;
}) {
  const single = reports.length === 1 ? reports[0] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {single ? single.name : `Download ${reports.length} reports`}
          </DialogTitle>
          <DialogDescription>
            {single
              ? single.summary
              : "Every report comes in the format you pick, in one download."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {FORMAT_ORDER.map((format) => {
            const { label, hint, icon: Icon } = FORMATS[format];
            // "Kept" is the whole visible difference between a file the servers
            // have built and one they have not: the second takes a moment.
            const kept = reports.every((r) => r.built?.includes(format));
            const working = busy === format;
            return (
              <button
                key={format}
                type="button"
                disabled={busy !== null}
                onClick={() => onDownload(format)}
                // Without this the name is computed from the content, so a
                // screen reader announces the whole file name as the action.
                // The action is the format; the file name is detail under it.
                aria-label={
                  single
                    ? `Download as ${label}`
                    : `Download ${reports.length} reports as ${label}`
                }
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                  "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <span className="text-muted-foreground group-hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md border border-border">
                  {working ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    {kept ? null : (
                      <Badge variant="outline" className="text-[11px]">
                        First download
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {working
                      ? "Building the file…"
                      : single
                        ? fileName(single, format)
                        : hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {/* The one place the frozen rule shows on screen. */}
            Files carry the numbers from when the report was made.
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Row bits                                  */
/* -------------------------------------------------------------------------- */

function RowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-10">
        <Skeleton className="size-4 rounded-[4px]" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-2 h-3 w-80" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="w-28">
        <Skeleton className="ml-auto h-8 w-20" />
      </TableCell>
    </TableRow>
  );
}

function IconAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            // scroll-m-1 is not decoration. The ring paints 3px OUTSIDE the
            // border box, and Tab scrolls a control flush against the
            // scrollport edge, where there is nothing left for it to paint
            // on. The row checkbox already carries the vertical half of this;
            // these three did not, and CI caught all three -- pin, download
            // and delete -- clipped at the bottom by 0.9, 1.6 and 2.3px. The
            // three measurements are three different rows: the audit dedupes
            // on the amount as well as the control, and `describe()` renders
            // every IconAction identically.
            //
            // Both axes, like the name button two cells over, rather than the
            // checkbox's `scroll-my-1`: these sit in the LAST cell, and the
            // table scrolls sideways on a phone, so the right edge is the one
            // place a ring here is most likely to be cut next.
            //
            // Linux only. The same page passes on macOS, where the sub-pixel
            // row heights fall differently, so no local run can see it.
            className={cn("scroll-m-1", className)}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Workspace                                  */
/* -------------------------------------------------------------------------- */

/** How long a deleted report can be brought back, in seconds. */
const RESTORE_SECONDS = 10;

export function ReportLibraryWorkspace({
  className,
  reports: initial = SAMPLE_REPORTS,
  status = "ready",
  scope = "MVV region · MyRadl",
  /**
   * Only admins named by Munich and our CS may delete, never a commune. The
   * demo is an admin so the control is there to look at; pass "member" to see
   * the list as a commune sees it.
   */
  role = "admin",
  onRetry,
  onDownload,
}: {
  className?: string;
  reports?: Report[];
  status?: "ready" | "loading" | "error";
  scope?: string;
  role?: "admin" | "member";
  onRetry?: () => void;
  onDownload?: (reports: Report[], format: ReportFormat) => void;
}) {
  const [reports, setReports] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [period, setPeriod] = React.useState("all");
  const [territory, setTerritory] = React.useState("all");
  const [author, setAuthor] = React.useState("all");
  const [pinnedOnly, setPinnedOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [downloading, setDownloading] = React.useState<Report[] | null>(null);
  const [busy, setBusy] = React.useState<ReportFormat | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [bin, setBin] = React.useState<{ reports: Report[]; left: number } | null>(
    null,
  );

  const canDelete = role === "admin";

  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const tick = React.useRef<ReturnType<typeof setInterval> | null>(null);
  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (tick.current) clearInterval(tick.current);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => period === "all" || r.period === period)
      .filter((r) => territory === "all" || r.territory === territory)
      .filter((r) =>
        author === "all"
          ? true
          : author === "vianova"
            ? r.createdBy === "Vianova"
            : Boolean(r.mine),
      )
      .filter((r) => !pinnedOnly || r.pinned)
      .filter((r) => !q || `${r.name} ${r.summary}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          // Pinned stays on top. That is the whole point of the pin, so it
          // outranks the date rather than being a badge on a date sort.
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }, [reports, period, territory, author, pinnedOnly, query]);

  // A report filtered out from under a tick must not stay ticked, or the
  // toolbar would download something the user can no longer see.
  React.useEffect(() => {
    setSelected((cur) => cur.filter((id) => visible.some((r) => r.id === id)));
  }, [visible]);

  const filtering =
    query.trim() !== "" ||
    period !== "all" ||
    territory !== "all" ||
    author !== "all" ||
    pinnedOnly;

  const clearFilters = () => {
    setQuery("");
    setPeriod("all");
    setTerritory("all");
    setAuthor("all");
    setPinnedOnly(false);
  };

  const allTicked = visible.length > 0 && selected.length === visible.length;
  const someTicked = selected.length > 0 && !allTicked;

  const toggleAll = () =>
    setSelected(allTicked ? [] : visible.map((r) => r.id));

  const toggleOne = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const togglePin = (id: string) =>
    setReports((all) =>
      all.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)),
    );

  const startDownload = (format: ReportFormat) => {
    const batch = downloading;
    if (!batch) return;
    const unbuilt = batch.filter((r) => !r.built?.includes(format));
    const finish = () => {
      setBusy(null);
      setDownloading(null);
      setSelected([]);
      setReports((all) =>
        all.map((r) =>
          batch.some((b) => b.id === r.id)
            ? { ...r, built: [...new Set([...(r.built ?? []), format])] }
            : r,
        ),
      );
      setDone(
        batch.length === 1
          ? `${FORMATS[format].label} ready · ${fileName(batch[0]!, format)}`
          : `${FORMATS[format].label} ready for ${batch.length} reports`,
      );
      onDownload?.(batch, format);
    };
    // A file the servers already keep comes back at once. One they have not
    // built yet takes a moment, and the dialog says so rather than appearing
    // to hang.
    if (unbuilt.length === 0) finish();
    else {
      setBusy(format);
      later(finish, 900);
    }
  };

  const remove = (ids: string[]) => {
    const going = reports.filter((r) => ids.includes(r.id));
    if (going.length === 0) return;
    setReports((all) => all.filter((r) => !ids.includes(r.id)));
    setSelected((cur) => cur.filter((id) => !ids.includes(id)));
    setDone(null);
    setBin({ reports: going, left: RESTORE_SECONDS });
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => {
      setBin((cur) => {
        if (!cur) return cur;
        if (cur.left <= 1) {
          if (tick.current) clearInterval(tick.current);
          return null;
        }
        return { ...cur, left: cur.left - 1 };
      });
    }, 1000);
  };

  const restore = () => {
    if (!bin) return;
    const back = bin.reports;
    if (tick.current) clearInterval(tick.current);
    setBin(null);
    setReports((all) =>
      [...all, ...back].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    );
  };

  return (
    <TooltipProvider>
      <div
        data-slot="report-library-workspace"
        className={cn(
          // Same envelope as the other workspaces, so the docs page does not
          // jump when one block replaces another.
          "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
          className,
        )}
      >
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">
                All your reports
              </h2>
              <p className="text-muted-foreground text-sm">
                Monthly reports made on the 1st, and the exports you and your
                colleagues take from a dashboard or a saved map.
              </p>
            </div>
            {/* One page per scope. Saying which scope is the only reason a
                user can trust that the list is complete. */}
            <Badge variant="secondary" className="shrink-0">
              {scope}
            </Badge>
          </header>

          {/* Filters. Period and territory come from the design; "Created by"
              is here because every export in the scope is listed, so you need
              a way back to your own. */}
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search reports by name"
              />
            </InputGroup>

            <Select
              items={PERIODS}
              value={period}
              onValueChange={(v) => setPeriod((v ?? "all") as string)}
            >
              <SelectTrigger className="w-[150px]" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PERIODS).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIODS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={TERRITORIES}
              value={territory}
              onValueChange={(v) => setTerritory((v ?? "all") as string)}
            >
              <SelectTrigger className="w-[170px]" aria-label="Territory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(TERRITORIES).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TERRITORIES[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={AUTHORS}
              value={author}
              onValueChange={(v) => setAuthor((v ?? "all") as string)}
            >
              <SelectTrigger className="w-[130px]" aria-label="Created by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(AUTHORS).map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUTHORS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Toggle
              pressed={pinnedOnly}
              onPressedChange={setPinnedOnly}
              aria-label="Show pinned reports only"
              className="gap-1.5"
            >
              <Pin className="size-3.5" />
              Pinned
            </Toggle>

            {filtering ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>

          {/* The restore window. A deletion can be undone for a while, so the
              page has to say how long, not merely offer an undo that silently
              stops working. */}
          {bin ? (
            <Alert>
              <Trash2 />
              <AlertTitle>
                {bin.reports.length === 1
                  ? "1 report deleted"
                  : `${bin.reports.length} reports deleted`}
              </AlertTitle>
              <AlertDescription>
                You can bring {bin.reports.length === 1 ? "it" : "them"} back for{" "}
                {bin.left} more second{bin.left === 1 ? "" : "s"}.
              </AlertDescription>
              <AlertAction>
                <Button variant="outline" size="xs" onClick={restore}>
                  <RotateCcw className="size-3.5" />
                  Undo
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {done ? (
            <Alert>
              <Check />
              <AlertTitle>{done}</AlertTitle>
              <AlertAction>
                <Button variant="ghost" size="xs" onClick={() => setDone(null)}>
                  Dismiss
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {/* The multi-select toolbar replaces nothing: it appears above the
              table when something is ticked, so the table never shifts on a
              tick. */}
          {selected.length > 0 ? (
            <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <p aria-live="polite" className="text-sm">
                <span className="font-medium">{selected.length}</span> selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    setDownloading(
                      reports.filter((r) => selected.includes(r.id)),
                    )
                  }
                >
                  <Download className="size-4" />
                  Download
                </Button>
                {canDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(selected)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  <X className="size-4" />
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle />
                </EmptyMedia>
                <EmptyTitle>We could not load your reports</EmptyTitle>
                <EmptyDescription>
                  The reports themselves are safe. This is the list that failed
                  to load.
                </EmptyDescription>
              </EmptyHeader>
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RotateCcw className="size-4" />
                  Try again
                </Button>
              ) : null}
            </Empty>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <caption className="sr-only">
                  Reports in {scope}, newest first, pinned reports on top.
                </caption>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-10 pl-3">
                      <Checkbox
                        checked={allTicked}
                        indeterminate={someTicked}
                        onCheckedChange={toggleAll}
                        disabled={status === "loading" || visible.length === 0}
                        aria-label={
                          allTicked ? "Clear selection" : "Select every report"
                        }
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Created by</TableHead>
                    <TableHead className="w-28">Created</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === "loading" ? (
                    <>
                      <RowSkeleton />
                      <RowSkeleton />
                      <RowSkeleton />
                      <RowSkeleton />
                      <RowSkeleton />
                    </>
                  ) : visible.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        {/* Two different empties. "Nothing matches" is a
                            filter problem with a way out; "no reports yet" is
                            a new scope waiting for the 1st. Showing the wrong
                            one sends the user looking for a filter that is
                            not set. */}
                        <Empty className="border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              {filtering ? <Search /> : <FileText />}
                            </EmptyMedia>
                            <EmptyTitle>
                              {filtering
                                ? "No reports match these filters"
                                : "No reports yet"}
                            </EmptyTitle>
                            <EmptyDescription>
                              {filtering
                                ? "Try a wider period or territory, or clear the filters."
                                : "The first monthly reports arrive on the 1st. Exports you take from a dashboard or a saved map appear here straight away."}
                            </EmptyDescription>
                          </EmptyHeader>
                          {filtering ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              Clear filters
                            </Button>
                          ) : null}
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((report) => {
                      const ticked = selected.includes(report.id);
                      return (
                        <TableRow
                          key={report.id}
                          data-state={ticked ? "selected" : undefined}
                        >
                          <TableCell className="w-10 pl-3 align-top">
                            <Checkbox
                              checked={ticked}
                              onCheckedChange={() => toggleOne(report.id)}
                              aria-label={`Select ${report.name}`}
                              // Not decoration: Tab scrolls a focused row
                              // flush with the workspace's edge, and the ring
                              // paints outside the box, so it would be cut.
                              className="scroll-my-1"
                            />
                          </TableCell>
                          {/* Capped below lg, where the table is wider than
                              its scroll container: an uncapped name grows to
                              the cell's natural width, which is wider than the
                              visible port, leaving the focus ring nowhere to
                              paint. Above lg the table fits and the name can
                              have all the room it wants. */}
                          <TableCell className="max-w-64 py-3 lg:max-w-none">
                            <div className="flex items-start gap-2">
                              {report.pinned ? (
                                <Pin
                                  aria-hidden
                                  className="text-primary mt-0.5 size-3.5 shrink-0 fill-current"
                                />
                              ) : null}
                              <div className="min-w-0">
                                {/* Clicking the name opens the download
                                    choice, the same as the icon. There is no
                                    in-app view of a past report to open. */}
                                <button
                                  type="button"
                                  onClick={() => setDownloading([report])}
                                  data-slot="report-download-link"
                                  // Same shape as the other blocks' row links:
                                  // bounded and truncating, so the ring stays
                                  // inside the table's own scroll container
                                  // instead of being cut at its right edge.
                                  // scroll-m-1, not scroll-my-1: on a phone
                                  // the table scrolls sideways too, and Tab
                                  // would otherwise park the button flush
                                  // against that edge with its ring outside.
                                  className="hover:text-primary focus-visible:ring-ring block max-w-full scroll-m-1 truncate rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                                >
                                  {report.name}
                                </button>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                  {report.summary}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-36 align-top text-sm">
                            <span className="flex items-center gap-1.5">
                              {report.createdBy}
                              {report.kind === "monthly" ? (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] font-normal"
                                >
                                  Monthly
                                </Badge>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground w-28 align-top text-sm">
                            {formatCreated(report.createdAt)}
                          </TableCell>
                          <TableCell className="w-32 align-top">
                            {/* Download and delete side by side, with the pin
                                in the same group so a row has one set of
                                controls rather than two. */}
                            <div className="flex items-center justify-end gap-0.5">
                              <IconAction
                                label={report.pinned ? "Unpin" : "Pin to top"}
                                onClick={() => togglePin(report.id)}
                              >
                                {report.pinned ? (
                                  <PinOff className="size-4" />
                                ) : (
                                  <Pin className="size-4" />
                                )}
                              </IconAction>
                              <IconAction
                                label={`Download ${report.name}`}
                                onClick={() => setDownloading([report])}
                              >
                                <Download className="size-4" />
                              </IconAction>
                              {canDelete ? (
                                <IconAction
                                  label={`Delete ${report.name}`}
                                  onClick={() => remove([report.id])}
                                  className="hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </IconAction>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {status === "ready" && visible.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {visible.length} of {reports.length} report
              {reports.length === 1 ? "" : "s"}
              {canDelete
                ? " · kept for the length of the contract"
                : " · only an admin can delete a report"}
            </p>
          ) : null}
        </div>

        <DownloadDialog
          reports={downloading ?? []}
          open={downloading !== null}
          onOpenChange={(open) => {
            if (!open && busy === null) setDownloading(null);
          }}
          onDownload={startDownload}
          busy={busy}
        />
      </div>
    </TooltipProvider>
  );
}

export default ReportLibraryWorkspace;
