"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  FileText,
  LifeBuoy,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  TriangleAlert,
  Unplug,
  X,
} from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import { Avatar, AvatarFallback } from "@/registry/vianova/ui/avatar";
import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/registry/vianova/ui/chart";
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
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import { Textarea } from "@/registry/vianova/ui/textarea";
import { ConfirmDialog } from "@/registry/vianova/patterns/confirm-dialog";
import { StatTile } from "@/registry/vianova/patterns/stat-tile";
import {
  StatusBadge,
  type StatusTone,
} from "@/registry/vianova/patterns/status-badge";
import { Timeline, TimelineItem } from "@/registry/vianova/patterns/timeline";
import { ExportMenu, downloadFile } from "@/registry/vianova/product/export-menu";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import {
  FEEDS_NOW,
  HEALTH_LABELS,
  ORGANIZATION,
  PURPOSES,
  SAMPLE_FEEDS,
  STANDARD_ENDPOINTS,
  STANDARD_VERSIONS,
  feedHealth,
  isOpen,
  openIncidents,
  type Feed,
  type FeedHealth,
  type FeedStandard,
  type Incident,
  type IncidentState,
  type Purpose,
} from "@/registry/vianova/lib/sample-feeds";
import { VEHICLES } from "@/registry/vianova/lib/sample-regulations";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

type Section = "yours" | "catalogue";

const HEALTH_TONE: Record<FeedHealth, StatusTone> = {
  healthy: "success",
  connected: "success",
  incident: "warning",
  pending: "info",
  rejected: "destructive",
  available: "neutral",
};

type HealthFilter = "all" | "healthy" | "incident" | "pending" | "rejected";

const HEALTH_FILTERS: Record<HealthFilter, string> = {
  all: "All statuses",
  healthy: "Connected",
  incident: "Incident open",
  pending: "Awaiting operator",
  rejected: "Rejected",
};

type StandardFilter = "all" | FeedStandard;

/** What needs someone first: a broken feed, then a refusal to answer, then a wait. */
const HEALTH_RANK: Record<FeedHealth, number> = {
  incident: 0,
  rejected: 1,
  pending: 2,
  healthy: 3,
  connected: 3,
  available: 4,
};

const STATE_LABELS: Record<IncidentState, string> = {
  investigating: "Investigating",
  identified: "Identified",
  resolved: "Resolved",
};

const STATE_TONE: Record<IncidentState, StatusTone> = {
  investigating: "warning",
  identified: "info",
  resolved: "success",
};

/** Fixed locale and zone: the page is statically exported, so a server and a
 *  browser in different zones would otherwise render different dates. */
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const count = new Intl.NumberFormat("en");

const NOW = Date.parse(FEEDS_NOW);

/** "4 min ago", against the sample's fixed now rather than the reader's clock. */
function ago(iso: string, now = NOW) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function duration(fromIso: string, toIso: string) {
  const hours = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

const vehicleLabel = (feed: Feed) =>
  feed.vehicles
    .map((v) => VEHICLES.find((x) => x.value === v)?.label ?? v)
    .join(", ");

const standardLabel = (feed: Pick<Feed, "standard" | "version">) =>
  feed.version ? `${feed.standard} ${feed.version}` : feed.standard;

const initials = (name: string) =>
  name
    .split(/(?=[A-Z0-9])|\s/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

/** One sentence under a feed's name: what it is, and what happened last. */
function feedSummary(feed: Feed) {
  switch (feed.status) {
    case "connected":
      return feed.lastRecordAt ? `Last record ${ago(feed.lastRecordAt)}` : "Connected";
    case "pending":
      return feed.requestedAt ? `Requested ${ago(feed.requestedAt)}` : "Requested";
    case "rejected":
      return feed.respondedAt
        ? `Rejected on ${dateFormat.format(new Date(feed.respondedAt))}`
        : "Rejected";
    default:
      return feed.version ? "Ready to request" : "Version not published by the operator";
  }
}

/* -------------------------------------------------------------------------- */
/* Small parts                                                                 */
/* -------------------------------------------------------------------------- */

function FeedStatusBadge({
  health,
  className,
}: {
  health: FeedHealth;
  className?: string;
}) {
  return (
    <StatusBadge tone={HEALTH_TONE[health]} className={className}>
      {HEALTH_LABELS[health]}
    </StatusBadge>
  );
}

/**
 * The operator's mark. No logos ship with the design system, so it is the
 * operator's initials on `muted` -- a neutral disc, because a brand colour
 * per row would make the list about the operators instead of their state.
 */
function OperatorMark({
  feed,
  size = "default",
}: {
  feed: Feed;
  size?: "default" | "lg";
}) {
  return (
    <Avatar size={size} className="rounded-md after:rounded-md">
      <AvatarFallback className="rounded-md text-xs font-medium">
        {initials(feed.operator)}
      </AvatarFallback>
    </Avatar>
  );
}

function Fact({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-sm">{children}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* List                                                                        */
/* -------------------------------------------------------------------------- */

/** A feed the organization has asked for: the whole row opens it. */
function FeedRow({ feed, onOpen }: { feed: Feed; onOpen: () => void }) {
  const health = feedHealth(feed);
  return (
    <button
      type="button"
      data-slot="feed-row"
      onClick={onOpen}
      className="group bg-card text-card-foreground focus-visible:ring-ring flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:outline-none"
    >
      <OperatorMark feed={feed} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{feed.name}</h3>
        <p className="text-muted-foreground truncate text-xs">
          {standardLabel(feed)} · {vehicleLabel(feed)}
        </p>
      </div>
      <span className="text-muted-foreground hidden text-xs whitespace-nowrap md:inline">
        {feedSummary(feed)}
      </span>
      <FeedStatusBadge health={health} className="shrink-0" />
      <ChevronRight
        aria-hidden
        className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

/**
 * A feed in the catalogue. Not a button itself: it holds one, and the only
 * thing to do with a feed nobody has asked for is ask.
 */
function CatalogueRow({
  feed,
  onRequest,
}: {
  feed: Feed;
  onRequest: () => void;
}) {
  return (
    <div
      data-slot="catalogue-row"
      className="bg-card text-card-foreground flex w-full min-w-0 items-center gap-3 rounded-xl border p-3"
    >
      <OperatorMark feed={feed} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{feed.name}</h3>
        <p className="text-muted-foreground truncate text-xs">
          {standardLabel(feed)} · {vehicleLabel(feed)}
          <span className="hidden md:inline"> · {feedSummary(feed)}</span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRequest}
        aria-label={`Request ${feed.name}`}
      >
        <Plus data-icon="inline-start" />
        Request
      </Button>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-3" aria-hidden>
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * An incident's updates, newest first: the state it is in now is the first
 * thing read, and the history sits under it.
 */
function IncidentTimeline({ incident }: { incident: Incident }) {
  return (
    <Timeline>
      {[...incident.updates].reverse().map((u) => (
        <TimelineItem
          key={`${u.state}-${u.at}`}
          tone={STATE_TONE[u.state]}
          title={STATE_LABELS[u.state]}
          time={<time dateTime={u.at}>{dateTimeFormat.format(new Date(u.at))}</time>}
        >
          {u.message}
        </TimelineItem>
      ))}
    </Timeline>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  const open = isOpen(incident);
  const first = incident.updates[0]!;
  const last = incident.updates.at(-1)!;
  return (
    <article className="bg-card rounded-xl border">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium">{incident.title}</h4>
          <p className="text-muted-foreground text-xs">
            {incident.metric} · opened {dateTimeFormat.format(new Date(first.at))}
          </p>
        </div>
        <StatusBadge tone={open ? "warning" : "success"}>
          {open
            ? `Open for ${duration(first.at, FEEDS_NOW)}`
            : `Resolved after ${duration(first.at, last.at)}`}
        </StatusBadge>
      </header>
      <div className="p-4">
        <IncidentTimeline incident={incident} />
      </div>
    </article>
  );
}

type DailyPoint = { day: string; records: number; incident: boolean };

/** The last 30 days, ending yesterday, with the days an incident was found in marked. */
function dailyPoints(feed: Feed): DailyPoint[] {
  const days = feed.daily ?? [];
  const end = Date.parse(FEEDS_NOW.slice(0, 10)) - 86_400_000;
  const incidentDays = new Set(
    feed.incidents.map((i) => i.updates[0]!.at.slice(0, 10)),
  );
  return days.map((records, i) => {
    const t = end - (days.length - 1 - i) * 86_400_000;
    // An incident is reported the morning after the day it measured, so the
    // bar to mark is the one before the report's date.
    const reportedOn = new Date(t + 86_400_000).toISOString().slice(0, 10);
    return {
      day: dayFormat.format(t),
      records,
      incident: incidentDays.has(reportedOn),
    };
  });
}

function RecordsChart({ feed }: { feed: Feed }) {
  const data = React.useMemo(() => dailyPoints(feed), [feed]);
  const total = data.reduce((s, d) => s + d.records, 0);
  return (
    <section className="bg-card min-w-0 rounded-xl border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-medium">Records per day</h3>
        <p className="text-muted-foreground text-xs">
          {count.format(total)} in the last 30 days
        </p>
      </div>
      <div className="space-y-3 p-4">
        <ChartContainer
          config={{ records: { label: "Records", color: "var(--chart-1)" } }}
          className="aspect-auto h-48 w-full"
        >
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              interval={6}
              tickMargin={8}
            />
            <YAxis hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="records" radius={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.day}
                  fill={d.incident ? "var(--warning)" : "var(--color-records)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span aria-hidden className="bg-warning size-2 rounded-xs" />
          Days an incident was found in
        </p>
      </div>
    </section>
  );
}

function FeedDetail({
  feed,
  onBack,
  onRequest,
  onCancelRequest,
}: {
  feed: Feed;
  onBack: () => void;
  onRequest: () => void;
  onCancelRequest: () => void;
}) {
  const [tab, setTab] = React.useState<"overview" | "incidents" | "agreements">(
    "overview",
  );
  const [incidentFilter, setIncidentFilter] = React.useState<"all" | "open" | "resolved">(
    "all",
  );
  const health = feedHealth(feed);
  const open = openIncidents(feed);
  const incidents = feed.incidents.filter((i) =>
    incidentFilter === "all" ? true : incidentFilter === "open" ? isOpen(i) : !isOpen(i),
  );
  const connected = feed.status === "connected";

  const incidentRows = incidents.flatMap((i) =>
    i.updates.map((u) => ({
      feed: feed.name,
      incident: i.title,
      metric: i.metric,
      state: STATE_LABELS[u.state],
      at: u.at,
      message: u.message,
    })),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to feeds"
        >
          <ArrowLeft />
        </Button>
        <OperatorMark feed={feed} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight">{feed.name}</h2>
          <p className="text-muted-foreground truncate text-xs">
            {standardLabel(feed)} · {vehicleLabel(feed)}
          </p>
        </div>
        <FeedStatusBadge health={health} />
        {feed.status === "pending" ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <X data-icon="inline-start" />
                Cancel request
              </Button>
            }
            title={`Cancel your request to ${feed.operator}?`}
            description="The operator will be told you no longer need this feed. You can request it again later."
            confirmLabel="Cancel request"
            cancelLabel="Keep request"
            destructive
            onConfirm={onCancelRequest}
          />
        ) : null}
        {feed.status === "rejected" ? (
          <Button size="sm" onClick={onRequest}>
            <RotateCcw data-icon="inline-start" />
            Resend request
          </Button>
        ) : null}
      </div>

      {feed.status === "rejected" && feed.rejectionReason ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>
            {feed.operator} declined this request
            {feed.respondedAt
              ? ` on ${dateFormat.format(new Date(feed.respondedAt))}`
              : ""}
          </AlertTitle>
          <AlertDescription>“{feed.rejectionReason}”</AlertDescription>
        </Alert>
      ) : null}

      {feed.status === "pending" ? (
        <Alert>
          <Clock />
          <AlertTitle>Waiting for {feed.operator}</AlertTitle>
          <AlertDescription>
            Sent {feed.requestedAt ? ago(feed.requestedAt) : "recently"}. Operators
            usually answer within 5 working days, and you&apos;ll get an email when
            they do.
          </AlertDescription>
        </Alert>
      ) : null}

      {open.length ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>
            {open.length === 1 ? "1 open incident" : `${open.length} open incidents`}
          </AlertTitle>
          <AlertDescription>
            {open[0]!.updates.at(-1)!.message}
          </AlertDescription>
          <AlertAction>
            <Button variant="outline" size="xs" onClick={() => setTab("incidents")}>
              View
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents
            {feed.incidents.length ? (
              <Badge variant="secondary" className="tabular-nums">
                {feed.incidents.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <section className="bg-card h-fit rounded-xl border">
            <h3 className="border-b px-4 py-3 text-sm font-medium">Feed information</h3>
            <dl className="grid grid-cols-2 gap-4 p-4">
              <Fact label="Operator">{feed.operator}</Fact>
              <Fact label="Data standard">
                {feed.standard} {feed.version ?? <span className="text-muted-foreground">· version unknown</span>}
              </Fact>
              <Fact label="Vehicles">{vehicleLabel(feed)}</Fact>
              <Fact label="Requested">
                {feed.requestedAt ? dateFormat.format(new Date(feed.requestedAt)) : "—"}
              </Fact>
              <Fact label={connected ? "Connected since" : "Answered"}>
                {feed.respondedAt ? dateFormat.format(new Date(feed.respondedAt)) : "—"}
              </Fact>
              <Fact label="Last record">
                {feed.lastRecordAt ? ago(feed.lastRecordAt) : "—"}
              </Fact>
              <Fact label="Endpoints" className="col-span-2">
                {feed.endpoints.map((e) => (
                  <Badge key={e} variant="secondary">
                    {e}
                  </Badge>
                ))}
              </Fact>
            </dl>
          </section>
          {connected && feed.daily ? (
            <RecordsChart feed={feed} />
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Unplug />
                </EmptyMedia>
                <EmptyTitle>No data yet</EmptyTitle>
                <EmptyDescription>
                  {feed.status === "rejected"
                    ? `Records will appear here if ${feed.operator} accepts a new request.`
                    : `Records will appear here once ${feed.operator} approves the request.`}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      ) : null}

      {tab === "incidents" ? (
        feed.incidents.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                size="sm"
                className="w-80"
                aria-label="Incidents to show"
                value={incidentFilter}
                onValueChange={(v) => setIncidentFilter(v as typeof incidentFilter)}
                items={[
                  { value: "all", label: `All (${feed.incidents.length})` },
                  { value: "open", label: `Open (${open.length})` },
                  {
                    value: "resolved",
                    label: `Resolved (${feed.incidents.length - open.length})`,
                  },
                ]}
              />
              <ExportMenu
                rows={incidentRows}
                columns={[
                  { id: "feed", label: "Feed" },
                  { id: "incident", label: "Incident" },
                  { id: "metric", label: "Metric" },
                  { id: "state", label: "State" },
                  { id: "at", label: "Time (UTC)" },
                  { id: "message", label: "Message" },
                ]}
                filename={`${feed.id}-incidents`}
              />
            </div>
            {incidents.length ? (
              incidents.map((i) => <IncidentCard key={i.id} incident={i} />)
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No {incidentFilter} incidents.
              </p>
            )}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 />
              </EmptyMedia>
              <EmptyTitle>No incidents</EmptyTitle>
              <EmptyDescription>
                {connected
                  ? "Vianova checks this feed every morning against the prior week. Nothing has looked wrong so far."
                  : "Incidents are tracked once the feed is connected."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : null}

      {tab === "agreements" ? (
        feed.agreements.length ? (
          <section className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Document</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Signed</TableHead>
                  <TableHead>Signed by</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2">
                        <FileText aria-hidden className="text-muted-foreground size-4" />
                        {a.title}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{a.version}</TableCell>
                    <TableCell>{dateFormat.format(new Date(a.signedAt))}</TableCell>
                    <TableCell>{a.signedBy}</TableCell>
                    <TableCell className="pr-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${a.title}`}
                        onClick={() =>
                          downloadFile(
                            `${a.title}\nVersion ${a.version}\nSigned ${a.signedAt} by ${a.signedBy}\n`,
                            `${a.id}.txt`,
                            "text/plain;charset=utf-8",
                          )
                        }
                      >
                        <Download />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No signed agreements</EmptyTitle>
              <EmptyDescription>
                The data sharing agreement is signed when {feed.operator} approves
                the request.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Request flow                                                                */
/* -------------------------------------------------------------------------- */

export type FeedRequest = {
  feedId: string;
  version: string;
  endpoints: string[];
  purpose: Purpose;
  message: string;
};

/**
 * Asking an operator for a feed, in two steps: what you need, then the terms
 * you accept for it. A resend opens on the same dialog with the operator's
 * reason above it, because the reason is usually what the second request has
 * to change.
 */
function RequestDialog({
  feed,
  onOpenChange,
  onSend,
}: {
  feed: Feed | null;
  onOpenChange: (open: boolean) => void;
  onSend: (request: FeedRequest) => void;
}) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [version, setVersion] = React.useState("");
  const [endpoints, setEndpoints] = React.useState<string[]>([]);
  const [purpose, setPurpose] = React.useState<Purpose>("compliance");
  const [message, setMessage] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);

  // A fresh form per feed: what was ticked for Hopp is not an answer for Emov.
  React.useEffect(() => {
    if (!feed) return;
    setStep(1);
    setVersion(feed.version ?? STANDARD_VERSIONS[feed.standard][0]!);
    setEndpoints(feed.endpoints);
    setPurpose("compliance");
    setMessage("");
    setAccepted(false);
  }, [feed]);

  if (!feed) return null;
  const resend = feed.status === "rejected";
  const versions = STANDARD_VERSIONS[feed.standard];
  const all = STANDARD_ENDPOINTS[feed.standard];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <p className="text-muted-foreground text-xs">Step {step} of 2</p>
          <DialogTitle>
            {resend ? `Resend request to ${feed.operator}` : `Request ${feed.name}`}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Choose what you need. Asking for less is approved faster."
              : `Review the terms ${ORGANIZATION} accepts by sending this request.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <FieldGroup>
            {resend && feed.rejectionReason ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Why {feed.operator} declined last time</AlertTitle>
                <AlertDescription>“{feed.rejectionReason}”</AlertDescription>
              </Alert>
            ) : null}

            <FieldSet>
              <FieldLegend variant="label">{feed.standard} version</FieldLegend>
              <ChoiceCardGroup
                aria-label={`${feed.standard} version`}
                columns={2}
                value={version}
                onValueChange={(v) => setVersion(v as string)}
              >
                {versions.map((v, i) => (
                  <ChoiceCard
                    key={v}
                    value={v}
                    title={`${feed.standard} ${v}`}
                    description={
                      v === feed.version
                        ? "What the operator publishes"
                        : i === 0
                          ? "Latest"
                          : "Older, widely supported"
                    }
                  />
                ))}
              </ChoiceCardGroup>
              {!feed.version ? (
                <FieldDescription>
                  {feed.operator} hasn&apos;t said which version it publishes. Pick the
                  one your tools read; the operator can propose another.
                </FieldDescription>
              ) : null}
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">Endpoints</FieldLegend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {all.map((e) => {
                  const id = `request-${feed.id}-${e.replace(/\s+/g, "-").toLowerCase()}`;
                  return (
                    <Field key={e} orientation="horizontal" className="gap-2">
                      <Checkbox
                        id={id}
                        checked={endpoints.includes(e)}
                        onCheckedChange={(on) =>
                          setEndpoints((cur) =>
                            on ? [...cur, e] : cur.filter((x) => x !== e),
                          )
                        }
                      />
                      <FieldLabel htmlFor={id} className="font-normal">
                        {e}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
              {endpoints.length === 0 ? (
                <FieldDescription className="text-destructive">
                  Choose at least one endpoint.
                </FieldDescription>
              ) : null}
            </FieldSet>

            <Field>
              <FieldLabel htmlFor={`request-${feed.id}-purpose`}>Purpose</FieldLabel>
              <Select
                items={PURPOSES}
                value={purpose}
                onValueChange={(v) => setPurpose((v ?? "compliance") as Purpose)}
              >
                <SelectTrigger id={`request-${feed.id}-purpose`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PURPOSES) as Purpose[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PURPOSES[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Shown to the operator with the request.</FieldDescription>
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup>
            <dl className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg border p-4">
              <Fact label="Feed">{feed.name}</Fact>
              <Fact label="Standard">
                {feed.standard} {version}
              </Fact>
              <Fact label="Purpose">{PURPOSES[purpose]}</Fact>
              <Fact label="Endpoints">{endpoints.length} of {all.length}</Fact>
            </dl>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Lisbon micromobility data sharing agreement, v3.1</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                <li>Raw records are kept for 12 months, then deleted.</li>
                <li>Only aggregated figures are published, never single trips or vehicles.</li>
                <li>Either side can end the agreement with 30 days&apos; notice.</li>
              </ul>
            </div>

            <Field>
              <FieldLabel htmlFor={`request-${feed.id}-message`}>
                Message to {feed.operator}{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </FieldLabel>
              <Textarea
                id={`request-${feed.id}-message`}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  resend
                    ? "Say what's changed since the last request"
                    : "Anything the operator should know"
                }
              />
            </Field>

            <Field orientation="horizontal" className="gap-2">
              <Checkbox
                id={`request-${feed.id}-accept`}
                checked={accepted}
                onCheckedChange={(on) => setAccepted(Boolean(on))}
              />
              <FieldLabel htmlFor={`request-${feed.id}-accept`} className="font-normal">
                I accept these terms on behalf of {ORGANIZATION}
              </FieldLabel>
            </Field>
          </FieldGroup>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={endpoints.length === 0} onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                disabled={!accepted}
                onClick={() =>
                  onSend({ feedId: feed.id, version, endpoints, purpose, message })
                }
              >
                <Send data-icon="inline-start" />
                {resend ? "Resend request" : "Send request"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** For a feed that isn't in the catalogue at all: Vianova can add operators. */
function SupportDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (operator: string) => void;
}) {
  const [operator, setOperator] = React.useState("");
  const [standard, setStandard] = React.useState<"MDS" | "GBFS" | "other">("MDS");
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setOperator("");
      setStandard("MDS");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask for a new feed</DialogTitle>
          <DialogDescription>
            Tell us which operator you need. The support team adds it to the
            catalogue, usually within two weeks.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="support-operator">Operator</FieldLabel>
            <Input
              id="support-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="e.g. Tier"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="support-standard">Data standard</FieldLabel>
            <Select
              items={{ MDS: "MDS", GBFS: "GBFS", other: "Other, or not sure" }}
              value={standard}
              onValueChange={(v) => setStandard((v ?? "MDS") as typeof standard)}
            >
              <SelectTrigger id="support-standard" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MDS">MDS</SelectItem>
                <SelectItem value="GBFS">GBFS</SelectItem>
                <SelectItem value="other">Other, or not sure</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="support-note">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </FieldLabel>
            <Textarea
              id="support-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A contact at the operator, a link to their docs"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!operator.trim()} onClick={() => onSend(operator.trim())}>
            <Send data-icon="inline-start" />
            Send to support
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

export function FeedsWorkspace({
  className,
  feeds: initial = SAMPLE_FEEDS,
  status = "ready",
  onRetry,
  onRequest,
}: {
  className?: string;
  feeds?: Feed[];
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  /** Called when a request is sent or resent. */
  onRequest?: (request: FeedRequest) => void;
}) {
  const [feeds, setFeeds] = React.useState(initial);
  const [section, setSection] = React.useState<Section>("yours");
  const [query, setQuery] = React.useState("");
  const [healthFilter, setHealthFilter] = React.useState<HealthFilter>("all");
  const [standardFilter, setStandardFilter] = React.useState<StandardFilter>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<{ title: string; body: string } | null>(
    null,
  );
  // The sample never changes, so a check only proves the control works:
  // it shows a moment of loading and moves "checked" forward.
  const [checking, setChecking] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState(NOW - 2 * 60_000);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const check = () => {
    setChecking(true);
    timer.current = setTimeout(() => {
      setChecking(false);
      setCheckedAt(NOW);
    }, 700);
  };

  const yours = feeds.filter((f) => f.status !== "available");
  const catalogue = feeds.filter((f) => f.status === "available");
  const connected = yours.filter((f) => f.status === "connected");
  const withIncident = connected.filter((f) => openIncidents(f).length > 0);
  const pending = yours.filter((f) => f.status === "pending");
  const rejected = yours.filter((f) => f.status === "rejected");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = section === "yours" ? yours : catalogue;
    return list
      .filter((f) => standardFilter === "all" || f.standard === standardFilter)
      .filter((f) => section !== "yours" || healthFilter === "all" || feedHealth(f) === healthFilter)
      .filter((f) => !q || `${f.name} ${f.operator} ${f.standard}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          HEALTH_RANK[feedHealth(a)] - HEALTH_RANK[feedHealth(b)] ||
          a.name.localeCompare(b.name),
      );
  }, [section, yours, catalogue, standardFilter, healthFilter, query]);

  const open = feeds.find((f) => f.id === openId) ?? null;
  const requesting = feeds.find((f) => f.id === requestId) ?? null;

  const send = (request: FeedRequest) => {
    const feed = feeds.find((f) => f.id === request.feedId);
    if (!feed) return;
    setFeeds((all) =>
      all.map((f) =>
        f.id === request.feedId
          ? {
              ...f,
              status: "pending",
              version: request.version,
              endpoints: request.endpoints,
              requestedAt: FEEDS_NOW,
              respondedAt: undefined,
              rejectionReason: undefined,
            }
          : f,
      ),
    );
    setRequestId(null);
    setNotice({
      title: `Request sent to ${feed.operator}`,
      body: "Operators usually answer within 5 working days. You'll get an email when they do.",
    });
    if (!openId) {
      setSection("yours");
      setHealthFilter("all");
      setQuery("");
    }
    onRequest?.(request);
  };

  const cancelRequest = (id: string) => {
    setFeeds((all) =>
      all.map((f) =>
        f.id === id
          ? { ...f, status: "available", requestedAt: undefined }
          : f,
      ),
    );
    setOpenId(null);
    setNotice(null);
  };

  const noticeAlert = notice ? (
    <Alert>
      <CheckCircle2 />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription>{notice.body}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="xs" onClick={() => setNotice(null)}>
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  ) : null;

  return (
    <div
      data-slot="feeds-workspace"
      className={cn(
        // Same envelope as the other workspaces, so the docs page does not
        // jump when one block replaces another.
        "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
        className,
      )}
    >
      {open ? (
        <>
          {notice ? <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6 md:pt-6">{noticeAlert}</div> : null}
          <FeedDetail
            feed={open}
            onBack={() => {
              setOpenId(null);
              setNotice(null);
            }}
            onRequest={() => setRequestId(open.id)}
            onCancelRequest={() => cancelRequest(open.id)}
          />
        </>
      ) : (
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Feeds</h2>
              <p className="text-muted-foreground text-sm">
                Operator data shared with {ORGANIZATION}, and the feeds you can request.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-muted-foreground text-xs"
                aria-live="polite"
              >
                {checking ? "Checking…" : `Checked ${ago(new Date(checkedAt).toISOString())}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={check}
                disabled={checking || status !== "ready"}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(checking && "animate-spin")}
                />
                Check now
              </Button>
            </div>
          </header>

          {noticeAlert}

          {status === "ready" ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Connected"
                value={connected.length}
                unit={`of ${yours.length}`}
                hint="feeds sending data"
              />
              <StatTile
                label="Open incidents"
                value={connected.reduce((s, f) => s + openIncidents(f).length, 0)}
                hint={
                  withIncident.length
                    ? withIncident.map((f) => f.operator).join(", ")
                    : "All feeds healthy"
                }
              />
              <StatTile
                label="Awaiting operator"
                value={pending.length}
                hint={pending.length ? pending.map((f) => f.operator).join(", ") : "Nothing pending"}
              />
              <StatTile
                label="Rejected"
                value={rejected.length}
                hint={rejected.length ? "Review and resend" : "None"}
              />
            </div>
          ) : null}

          <Tabs
            value={section}
            onValueChange={(v) => {
              setSection(v as Section);
              setQuery("");
              setHealthFilter("all");
            }}
          >
            <TabsList>
              <TabsTrigger value="yours">
                Your feeds
                <Badge variant="secondary" className="tabular-nums">
                  {yours.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="catalogue">
                Catalogue
                <Badge variant="secondary" className="tabular-nums">
                  {catalogue.length}
                </Badge>
              </TabsTrigger>
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
                placeholder="Search by operator"
                aria-label="Search by operator"
              />
            </InputGroup>
            {section === "yours" ? (
              <Select
                items={HEALTH_FILTERS}
                value={healthFilter}
                onValueChange={(v) => setHealthFilter((v ?? "all") as HealthFilter)}
              >
                <SelectTrigger className="w-44" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(HEALTH_FILTERS) as HealthFilter[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {HEALTH_FILTERS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <SegmentedControl
              size="sm"
              className="w-48"
              aria-label="Data standard"
              value={standardFilter}
              onValueChange={(v) => setStandardFilter(v as StandardFilter)}
              items={[
                { value: "all", label: "All" },
                { value: "MDS", label: "MDS" },
                { value: "GBFS", label: "GBFS" },
              ]}
            />
          </div>

          {status === "loading" ? (
            <div role="status" aria-label="Loading feeds" className="grid gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : status === "error" ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TriangleAlert />
                </EmptyMedia>
                <EmptyTitle>Couldn&apos;t load your feeds</EmptyTitle>
                <EmptyDescription>
                  Something went wrong reaching the feed service. Your feeds are
                  still running.
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
                  <Search />
                </EmptyMedia>
                <EmptyTitle>
                  {section === "catalogue" && !query && standardFilter === "all"
                    ? "You've requested every feed"
                    : "No feeds match"}
                </EmptyTitle>
                <EmptyDescription>
                  {section === "catalogue" && !query && standardFilter === "all"
                    ? "Everything in the catalogue is in Your feeds. Ask support for an operator that isn't listed."
                    : "Try another operator name, or clear the filters."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {query || standardFilter !== "all" || healthFilter !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setStandardFilter("all");
                      setHealthFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setSupportOpen(true)}>
                    <LifeBuoy data-icon="inline-start" />
                    Ask for a new feed
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="grid gap-2" aria-label={section === "yours" ? "Your feeds" : "Catalogue"}>
              {visible.map((f) => (
                <li key={f.id} className="flex min-w-0">
                  {section === "yours" ? (
                    <FeedRow feed={f} onOpen={() => {
                      setOpenId(f.id);
                      setNotice(null);
                    }} />
                  ) : (
                    <CatalogueRow feed={f} onRequest={() => setRequestId(f.id)} />
                  )}
                </li>
              ))}
            </ul>
          )}

          {status === "ready" ? (
            <Alert>
              <LifeBuoy />
              <AlertTitle>Looking for another operator?</AlertTitle>
              <AlertDescription>
                Vianova can add operators and data standards to the catalogue.
              </AlertDescription>
              <AlertAction>
                <Button variant="outline" size="xs" onClick={() => setSupportOpen(true)}>
                  Contact support
                </Button>
              </AlertAction>
            </Alert>
          ) : null}
        </div>
      )}

      <RequestDialog
        feed={requesting}
        onOpenChange={(o) => !o && setRequestId(null)}
        onSend={send}
      />
      <SupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        onSend={(operator) => {
          setSupportOpen(false);
          setNotice({
            title: "Sent to support",
            body: `We'll let you know when ${operator} is in the catalogue.`,
          });
        }}
      />
    </div>
  );
}

export default FeedsWorkspace;
