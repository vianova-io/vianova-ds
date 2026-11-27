"use client";

/**
 * The Alerts page.
 *
 * One page per scope, beside Regulations. An alert watches a no-parking rule
 * and sends an e-mail; it does not file anything and it has no lifecycle of
 * its own. That single sentence is the whole boundary between this page and
 * the report rules Jimmy ships on 10 Dec, and the page says it out loud
 * rather than leaving two features that both "notify people" to be told apart
 * by their names.
 *
 * Three decisions behind the shape, all from #munich-alerts:
 *
 * - **An alert points at a RULE, not a regulation.** A multi-parking
 *   regulation holds a parking rule and a no-parking rule; you alert on the
 *   second. Keying on the regulation would make "No parking outside bays"
 *   unaddressable, and the one regulation Munich cares about is exactly that
 *   shape.
 * - **Recipients are the report contacts.** Jimmy's point 4 of 19 Nov: a
 *   separate list of addresses per alert puts the same people in two places,
 *   and the thing CS actually does all day is swap one person for another
 *   across everything. So the Recipients tab edits that one list, and the
 *   per-row action is Replace, not Delete-then-add.
 * - **The e-mail is the one we already send.** Not redesigned here. The
 *   preview is a frame around it, so what the page promises is what arrives.
 *
 * Deliberately NOT here:
 *
 * - **No threshold builder.** No "battery below 20%", no "idle more than 3
 *   days". Those datasets exist and Jimmy confirmed they run, but v1 is
 *   no-parking only, and a builder with one data source in it would be a
 *   promise of nine more.
 * - **No report-rule editing.** Report rules are listed, badged and
 *   read-only; their switch lives on the regulation. One place to SEE
 *   everything that notifies people, without moving where it is set.
 * - **No Draw or Import in the zone step.** An alert adds no areas to
 *   anything -- it narrows to some of the rule's own zones. The zone picker's
 *   job is the opposite, so it is not reused here; only its thumbnail is.
 * - **Nothing only the backend can be the truth about:** whether the hourly
 *   check found anything, whether an e-mail was delivered, what the daily cap
 *   really is. `dailyCap` below carries a placeholder and says so.
 */

import * as React from "react";
import {
  ArrowLeft,
  BellRing,
  Check,
  Clock,
  Copy,
  FileText,
  Mail,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  Alert as AlertBanner,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import { Avatar, AvatarFallback } from "@/registry/vianova/ui/avatar";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Separator } from "@/registry/vianova/ui/separator";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import { Switch } from "@/registry/vianova/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/vianova/ui/tooltip";
import { SaveBar } from "@/registry/vianova/patterns/save-bar";
import { SectionCard } from "@/registry/vianova/patterns/section-card";
import { StatusBadge } from "@/registry/vianova/patterns/status-badge";
import { TagInput } from "@/registry/vianova/patterns/tag-input";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import {
  RULE_TYPES,
  RuleTypeIcon,
} from "@/registry/vianova/product/rule-type-icon";
import { ZoneThumbnail, type PickerZone } from "@/registry/vianova/product/zone-picker";
import {
  OPERATORS,
  SAMPLE_REGULATIONS,
  VEHICLES,
  loadZoneLibrary,
  type Regulation,
  type Rule,
  type Vehicle,
} from "@/registry/vianova/lib/sample-regulations";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node. The
 * expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM, because
 * Next substitutes that exact text at build time.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The demo's "today", so "Last sent" never drifts. */
export const ALERTS_NOW = "2026-11-27T09:00:00Z";
const NOW = Date.parse(ALERTS_NOW);

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What sends the e-mail.
 *
 * `hourly` is as close to real time as the platform gets: the data is checked
 * once an hour, so "as soon as it happens" would be a lie and the label says
 * the hour out loud. The other three are one e-mail with the whole list, the
 * shape clients already receive today.
 */
export type SendMode = "hourly" | "daily" | "weekly" | "monthly";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type AlertSchedule = {
  mode: SendMode;
  /** HH:mm, read in the scope's time zone. Summaries only. */
  hour?: string;
  /** Weekly only. */
  weekday?: Weekday;
  /**
   * Hourly only: stop after this many e-mails in one day, resuming the next.
   *
   * PLACEHOLDER. The cap exists in Katell's prototype but its number was
   * unreadable in the capture and no one has confirmed it. Written once, here,
   * so changing it is one edit.
   */
  dailyCap?: number;
};

/** The cap the editor starts a new alert with. See `dailyCap`. */
const DEFAULT_DAILY_CAP = 10;

export type RecipientKind = "member" | "operator";

/**
 * One person on the scope's report contacts list, from Settings › Report
 * contacts. The same list serves the report rules and these alerts, which is
 * the whole point of it.
 */
export type Contact = {
  id: string;
  name: string;
  email: string;
  kind: RecipientKind;
  /** Operator contacts only: whose fleet they answer for. */
  operator?: string;
  /** Invited, has not signed in yet. Their read-only account is pending. */
  pending?: boolean;
};

/**
 * `report` rows are Jimmy's "Create reports" switch on a no-parking rule,
 * shown here so one page lists everything that notifies people. They are
 * read-only: the switch and the contacts both live on the regulation.
 */
export type AlertKind = "alert" | "report";

export type Alert = {
  id: string;
  kind: AlertKind;
  name: string;
  /** The rule watched, and the regulation it belongs to. See the file header. */
  regulationId: string;
  ruleId: string;
  /** Hours a breach must last to be worth an e-mail. Munich asked for 2. */
  breachHours: number;
  /** A subset of the rule's zones. Empty means every zone in the rule. */
  zoneIds: string[];
  /** Empty means every type. */
  vehicles: Vehicle[];
  /** Empty means every operator. */
  operators: string[];
  schedule: AlertSchedule;
  /** Ids into the contacts list. */
  recipientIds: string[];
  /** Addresses typed in that are not on the contacts list. */
  extraEmails: string[];
  createdBy: string;
  /** Drives the "Created by: Me" filter. */
  mine?: boolean;
  createdAt: string;
  lastSentAt?: string;
  on: boolean;
};

export const SAMPLE_CONTACTS: Contact[] = [
  {
    id: "c-anja",
    name: "Anja Reiter",
    email: "anja.reiter@muenchen.de",
    kind: "member",
  },
  {
    id: "c-thomas",
    name: "Thomas Brandl",
    email: "thomas.brandl@muenchen.de",
    kind: "member",
  },
  {
    id: "c-you",
    name: "You",
    email: "you@muenchen.de",
    kind: "member",
  },
  {
    id: "c-kvr",
    name: "KVR duty desk",
    email: "streetops@muenchen.de",
    kind: "member",
    pending: true,
  },
  {
    id: "c-bolt",
    name: "Bolt city team",
    email: "munich-ops@bolt.eu",
    kind: "operator",
    operator: "Bolt",
  },
  {
    id: "c-voi",
    name: "Voi city team",
    email: "munich@voi.com",
    kind: "operator",
    operator: "Voi",
  },
  {
    id: "c-lime",
    name: "Lime city team",
    email: "muc-ops@li.me",
    kind: "operator",
    operator: "Lime",
  },
];

export const SAMPLE_ALERTS: Alert[] = [
  {
    id: "al-historic-2h",
    kind: "alert",
    name: "Parked in the historic centre for 2 hours",
    regulationId: "reg-no-parking-historic",
    ruleId: "rule-npk",
    breachHours: 2,
    zoneIds: [],
    vehicles: [],
    operators: [],
    schedule: { mode: "hourly", dailyCap: 10 },
    recipientIds: ["c-anja", "c-bolt", "c-voi"],
    extraEmails: [],
    createdBy: "Anja Reiter",
    createdAt: "2026-11-10T10:12:00Z",
    lastSentAt: "2026-11-27T08:00:00Z",
    on: true,
  },
  {
    id: "al-bays-daily",
    kind: "alert",
    name: "Daily list · parked outside the bays",
    regulationId: "reg-parking-baixa-chiado",
    ruleId: "rule-no-parking-baixa",
    breachHours: 2,
    zoneIds: [],
    vehicles: ["scooter", "moped"],
    operators: [],
    schedule: { mode: "daily", hour: "08:00" },
    recipientIds: ["c-anja", "c-thomas"],
    extraEmails: ["verkehr@landkreis.de"],
    createdBy: "Thomas Brandl",
    createdAt: "2026-11-12T14:30:00Z",
    lastSentAt: "2026-11-27T07:00:00Z",
    on: true,
  },
  {
    id: "al-weekly-council",
    kind: "alert",
    name: "Monday summary for the council",
    regulationId: "reg-no-parking-historic",
    ruleId: "rule-npk",
    breachHours: 4,
    zoneIds: [],
    vehicles: [],
    operators: ["Bolt", "Voi"],
    schedule: { mode: "weekly", hour: "09:00", weekday: "mon" },
    recipientIds: ["c-you", "c-kvr"],
    extraEmails: [],
    createdBy: "You",
    mine: true,
    createdAt: "2026-11-18T09:05:00Z",
    lastSentAt: "2026-11-24T08:00:00Z",
    on: true,
  },
  {
    id: "al-lime-off",
    kind: "alert",
    name: "Lime · parked outside the bays",
    regulationId: "reg-parking-baixa-chiado",
    ruleId: "rule-no-parking-baixa",
    breachHours: 2,
    zoneIds: [],
    vehicles: [],
    operators: ["Lime"],
    schedule: { mode: "hourly", dailyCap: 10 },
    recipientIds: ["c-lime"],
    extraEmails: [],
    createdBy: "Anja Reiter",
    createdAt: "2026-10-30T11:45:00Z",
    on: false,
  },
  /*
   * The report rule. One is enough to make the distinction legible: it reads
   * like the others, carries a badge, and nothing about it can be changed from
   * here.
   */
  {
    id: "al-report-historic",
    kind: "report",
    name: "Historic centre · files a report",
    regulationId: "reg-no-parking-historic",
    ruleId: "rule-npk",
    breachHours: 2,
    zoneIds: [],
    vehicles: [],
    operators: [],
    schedule: { mode: "hourly" },
    recipientIds: ["c-anja", "c-bolt", "c-voi", "c-lime"],
    extraEmails: [],
    createdBy: "Vianova",
    createdAt: "2026-11-23T13:00:00Z",
    lastSentAt: "2026-11-27T08:00:00Z",
    on: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Rules an alert may watch: no-parking rules, wherever they live. */
export function alertableRules(
  regulations: Regulation[],
): { regulation: Regulation; rule: Rule }[] {
  return regulations.flatMap((regulation) =>
    regulation.rules
      .filter((rule) => rule.type === "no_parking")
      .map((rule) => ({ regulation, rule })),
  );
}

const WEEKDAYS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/**
 * Hours a summary may be sent at.
 *
 * 06:00 to 20:00, from Katell's prototype. Narrower than a day on purpose: a
 * summary is read by someone at a desk, and offering 03:00 invites a client to
 * pick an hour nobody will act on until the morning anyway.
 */
const HOURS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => {
    const h = `${String(i + 6).padStart(2, "0")}:00`;
    return [h, h];
  }),
);

/** The scope's own time zone. The hour above is read in it, never in UTC. */
const SCOPE_TIME_ZONE = "Munich time";

export function scheduleLabel(schedule: AlertSchedule) {
  const at = `${schedule.hour ?? "08:00"} ${SCOPE_TIME_ZONE}`;
  switch (schedule.mode) {
    case "hourly":
      return "Every hour, new cases only";
    case "daily":
      return `Every day at ${at}`;
    case "weekly":
      return `Every ${WEEKDAYS[schedule.weekday ?? "mon"]} at ${at}`;
    case "monthly":
      return `The 1st of the month at ${at}`;
  }
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function formatSent(iso: string | undefined, now = NOW) {
  if (!iso) return "Never";
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
 * The rule read back as one sentence.
 *
 * Derived, never typed. The call asked for "une phrase unique décrivant la
 * logique de l'alerte", and a summary someone can edit is a summary that can
 * disagree with the alert it describes. This is the one place the whole rule is
 * legible at a glance, so it is also what the list row shows under the name.
 */
export function summarize(
  alert: Alert,
  index: { rule?: Rule; regulation?: Regulation },
  zones: Map<string, PickerZone>,
) {
  const ruleName = index.rule?.name ?? "a rule that no longer exists";
  const where =
    alert.zoneIds.length === 0
      ? "any of its zones"
      : alert.zoneIds.length === 1
        ? (zones.get(alert.zoneIds[0]!)?.name ?? "one zone")
        : plural(alert.zoneIds.length, "zone", "zones");
  const what =
    alert.vehicles.length === 0
      ? "a vehicle"
      : // The article belongs here, not in the list: "When scooter breaks" is
        // not a sentence, and the sentence is the thing being read.
        `a ${alert.vehicles
          .map((v) => VEHICLES.find((x) => x.value === v)?.label.toLowerCase() ?? v)
          .join(" or ")}`;
  const whose =
    alert.operators.length === 0 ? "" : ` from ${alert.operators.join(" or ")}`;
  return `When ${what}${whose} breaks ${ruleName} for more than ${plural(alert.breachHours, "hour", "hours")}, in ${where}.`;
}

/** "Anja Reiter" -> "AR", "Vianova" -> "V". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

let seq = 0;
/** Ids for things made in this session. Prefixed so they never collide with a sample's. */
const uid = (prefix: string) => `${prefix}-new-${++seq}`;

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Who they are, as a mark beside the name: a round disc is a person, a rounded
 * square an organisation. The same distinction the reports list and the feeds
 * list draw, so a reader learns it once.
 */
function ContactMark({ contact }: { contact: Contact }) {
  const organisation = contact.kind === "operator";
  return (
    <Avatar
      aria-hidden
      className={cn("size-5", organisation && "rounded-md after:rounded-md")}
    >
      <AvatarFallback
        className={cn("text-[10px] font-medium", organisation && "rounded-md")}
      >
        {initials(contact.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
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
            disabled={disabled}
            onClick={onClick}
            // The ring paints outside the border box and Tab scrolls a control
            // flush against the scrollport edge, where there is nothing left
            // for it to paint on. Both axes: these sit in the last cell and the
            // table scrolls sideways on a phone.
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

/**
 * All of something, or a named few.
 *
 * Vehicles and operators are both "every one unless you say otherwise", and an
 * empty list meaning "all" is only safe if the control says so in words. The
 * same shape the regulations editor uses for the same question.
 */
function AllOrSome<T extends string>({
  label,
  all,
  options,
  chosen,
  onChange,
}: {
  label: string;
  /** What "everything" is called, e.g. "All vehicle types". */
  all: string;
  options: { value: T; label: string }[];
  chosen: T[];
  onChange: (next: T[]) => void;
}) {
  const everything = chosen.length === 0;
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={everything ? "default" : "outline"}
          onClick={() => onChange([])}
        >
          {everything ? <Check className="size-3.5" /> : null}
          {all}
        </Button>
        {options.map((option) => {
          const on = chosen.includes(option.value);
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              onClick={() => onChange(toggle(chosen, option.value))}
            >
              {on ? <Check className="size-3.5" /> : null}
              {option.label}
            </Button>
          );
        })}
      </div>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* E-mail preview                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The e-mail that arrives.
 *
 * Deliberately the one the platform sends today, down to the attached
 * `records.csv` and the single line of body text. Jimmy's point 5 of 19 Nov:
 * either the preview shows the real e-mail, or redesigning the e-mail becomes
 * part of this scope. So this is a frame around it, and the frame says whose
 * e-mail it is.
 */
function EmailPreview({
  alert,
  recipients,
  ruleName,
}: {
  alert: Alert;
  recipients: string[];
  ruleName: string;
}) {
  const subject =
    alert.schedule.mode === "hourly"
      ? `[Vianova] ${ruleName} — new cases`
      : `[Vianova] ${ruleName} — ${alert.schedule.mode} summary`;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-muted/50 flex items-center gap-2 border-b border-border px-3 py-2">
        <Mail aria-hidden className="text-muted-foreground size-3.5" />
        <p className="text-xs font-medium">What the recipient gets</p>
        <Badge
          variant="outline"
          className="border-info/30 bg-info/10 text-info ml-auto text-[11px] font-normal"
        >
          The e-mail we send today
        </Badge>
      </div>

      <dl className="divide-y divide-border text-xs">
        {[
          ["From", "Vianova"],
          [
            "To",
            recipients.length ? recipients.join(", ") : "Nobody yet",
          ],
          ["Subject", subject],
        ].map(([key, value]) => (
          <div key={key} className="flex gap-3 px-3 py-2">
            <dt className="text-muted-foreground w-16 shrink-0">{key}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3 border-t border-border p-3">
        <p className="text-sm">Please find the attached CSV with all the records.</p>
        <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
          <Paperclip aria-hidden className="text-muted-foreground size-3.5" />
          <span className="text-xs font-medium">records.csv</span>
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <caption className="sr-only">
              The first rows of the attached CSV, as a sample.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-8 text-xs">Vehicle</TableHead>
                <TableHead className="h-8 text-xs">Operator</TableHead>
                <TableHead className="h-8 text-xs">Where</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["BOLT-4471", "Bolt", "Marienplatz"],
                ["VOI-8820", "Voi", "Viktualienmarkt"],
                ["BOLT-1193", "Bolt", "Sendlinger Straße"],
              ].map(([vehicle, operator, where]) => (
                <TableRow key={vehicle}>
                  <TableCell className="py-1.5 text-xs tabular-nums">{vehicle}</TableCell>
                  <TableCell className="py-1.5 text-xs">{operator}</TableCell>
                  <TableCell className="py-1.5 text-xs">{where}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground text-xs">
          Three of the rows, as a sample. The real file carries every record the
          check found.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

type OnFilter = "all" | "on" | "off";

const ON_FILTERS: { value: OnFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

function RowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-10">
        <Skeleton className="size-4 rounded-[4px]" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-2 h-3 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-36" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="w-24">
        <Skeleton className="ml-auto h-5 w-8 rounded-full" />
      </TableCell>
    </TableRow>
  );
}

function AlertList({
  alerts,
  contacts,
  rules,
  zones,
  status,
  scope,
  notice,
  onDismissNotice,
  onRetry,
  onCreate,
  onOpen,
  onToggle,
  onDelete,
}: {
  alerts: Alert[];
  contacts: Map<string, Contact>;
  rules: Map<string, { rule: Rule; regulation: Regulation }>;
  zones: Map<string, PickerZone>;
  status: "ready" | "loading" | "error";
  scope: string;
  notice: string | null;
  onDismissNotice: () => void;
  onRetry?: () => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (ids: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [on, setOn] = React.useState<OnFilter>("all");
  const [selected, setSelected] = React.useState<string[]>([]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts
      .filter((a) => (on === "all" ? true : on === "on" ? a.on : !a.on))
      .filter(
        (a) =>
          !q ||
          `${a.name} ${rules.get(a.ruleId)?.rule.name ?? ""}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [alerts, on, query, rules]);

  // An alert filtered out from under a tick must not stay ticked, or the
  // toolbar would delete something the user can no longer see.
  React.useEffect(() => {
    setSelected((cur) => cur.filter((id) => visible.some((a) => a.id === id)));
  }, [visible]);

  const filtering = query.trim() !== "" || on !== "all";
  const clearFilters = () => {
    setQuery("");
    setOn("all");
  };

  // Report rules cannot be deleted from here, so they are never part of a
  // batch: a Delete that silently skipped half the ticks would be worse than
  // one that cannot tick them.
  const deletable = visible.filter((a) => a.kind === "alert");
  const allTicked =
    deletable.length > 0 && selected.length === deletable.length;
  const someTicked = selected.length > 0 && !allTicked;

  const sentTo = (alert: Alert) => {
    const named = alert.recipientIds.length + alert.extraEmails.length;
    if (named === 0) return "Nobody yet";
    const first =
      contacts.get(alert.recipientIds[0] ?? "")?.name ?? alert.extraEmails[0];
    return named === 1 ? (first ?? "1 recipient") : `${first} +${named - 1}`;
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground text-sm">
            Each one watches a no-parking rule and sends an e-mail. Nothing here
            files a report.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{scope}</Badge>
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" />
            Create alert
          </Button>
        </div>
      </header>

      {notice ? (
        <AlertBanner>
          <Check />
          <AlertTitle>{notice}</AlertTitle>
          <AlertAction>
            <Button variant="ghost" size="xs" onClick={onDismissNotice}>
              Dismiss
            </Button>
          </AlertAction>
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search alerts by name"
          />
        </InputGroup>
        <SegmentedControl
          items={ON_FILTERS}
          value={on}
          onValueChange={(v) => setOn(v as OnFilter)}
          size="sm"
          // Sized rather than full-width: the segments divide whatever they
          // are given, and a three-way filter stretched across the row reads
          // as a tab bar for the page rather than a filter on the list.
          className="w-44"
          aria-label="Show alerts that are on or off"
        />
        {filtering ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <p aria-live="polite" className="text-sm">
            <span className="font-medium">{selected.length}</span> selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDelete(selected);
                setSelected([]);
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
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
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>We could not load your alerts</EmptyTitle>
            <EmptyDescription>
              The alerts themselves are still running. This is the list that
              failed to load.
            </EmptyDescription>
          </EmptyHeader>
          {onRetry ? (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw className="size-4" />
                Try again
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          {/*
           * Fixed layout, unlike the other lists.
           *
           * In auto layout a column is sized from its content and the cell's
           * width is never definite, so `max-w-full` on anything inside it
           * resolves to none: the summary sentence under each name then runs
           * straight across Sent to instead of wrapping. Fixed layout makes
           * every width definite -- the five narrow columns take what their
           * header says and Name takes the rest -- and the sentence wraps
           * inside its own column at any width.
           *
           * With a floor under the table, so the remainder left to Name never
           * shrinks to the 150px a tablet would otherwise give it. Below that
           * the table scrolls sideways, as the reports list does, rather than
           * squeezing every name to three words and an ellipsis.
           */}
          <Table className="table-fixed min-w-[56rem]">
            <caption className="sr-only">
              Alerts in {scope}, newest first. Report rules are listed but set on
              their regulation.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    checked={allTicked}
                    indeterminate={someTicked}
                    onCheckedChange={() =>
                      setSelected(allTicked ? [] : deletable.map((a) => a.id))
                    }
                    disabled={status === "loading" || deletable.length === 0}
                    aria-label={
                      allTicked ? "Clear selection" : "Select every alert"
                    }
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-44">Sent to</TableHead>
                <TableHead className="w-48">When</TableHead>
                <TableHead className="w-24">Last sent</TableHead>
                <TableHead className="w-20 text-right">On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status === "loading" ? (
                <>
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                </>
              ) : visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    {/* Two different empties. "Nothing matches" is a filter
                        problem with a way out; "no alerts yet" is a scope
                        nobody has set one up in. Showing the wrong one sends
                        the user looking for a filter that is not set. */}
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          {filtering ? <Search /> : <BellRing />}
                        </EmptyMedia>
                        <EmptyTitle>
                          {filtering
                            ? "No alerts match these filters"
                            : "No alerts yet"}
                        </EmptyTitle>
                        <EmptyDescription>
                          {filtering
                            ? "Try another status, or clear the filters."
                            : "An alert watches one of your no-parking rules and e-mails the people who need to know."}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        {filtering ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" onClick={onCreate}>
                            <Plus className="size-4" />
                            Create alert
                          </Button>
                        )}
                      </EmptyContent>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((alert) => {
                  const ticked = selected.includes(alert.id);
                  const found = rules.get(alert.ruleId);
                  const report = alert.kind === "report";
                  return (
                    <TableRow
                      key={alert.id}
                      data-state={ticked ? "selected" : undefined}
                    >
                      <TableCell className="w-10 pl-3 align-top">
                        <Checkbox
                          checked={ticked}
                          disabled={report}
                          onCheckedChange={() =>
                            setSelected((cur) => toggle(cur, alert.id))
                          }
                          aria-label={
                            report
                              ? `${alert.name} is set on its regulation`
                              : `Select ${alert.name}`
                          }
                          className="scroll-my-1"
                        />
                      </TableCell>
                      {/* whitespace-normal: TableCell is nowrap by default, which is right
                          for a figure and wrong for a sentence. */}
                      <TableCell className="py-3 whitespace-normal">
                        <div className="flex items-start gap-2 pr-4">
                          {found ? (
                            <RuleTypeIcon
                              type={found.rule.type}
                              size="sm"
                              className="mt-0.5"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpen(alert.id)}
                              data-slot="alert-open-link"
                              className="hover:text-primary focus-visible:ring-ring block max-w-full scroll-m-1 truncate rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {alert.name}
                            </button>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {report ? (
                                /* Tinted with --info, the same trio the
                                   regulations row gives Public: reused rather
                                   than re-chosen, because that combination
                                   already passes AA as text in both themes. */
                                <Badge
                                  variant="outline"
                                  className="border-info/30 bg-info/10 text-info shrink-0 text-[11px] font-normal"
                                >
                                  Files a report
                                </Badge>
                              ) : null}
                              <p className="text-muted-foreground min-w-0 text-xs">
                                {summarize(
                                  alert,
                                  {
                                    rule: found?.rule,
                                    regulation: found?.regulation,
                                  },
                                  zones,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-44 align-top text-sm">
                        <span className="block truncate">{sentTo(alert)}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          by {alert.createdBy}
                        </span>
                      </TableCell>
                      <TableCell className="w-48 align-top text-sm whitespace-normal">
                        <span className="flex items-start gap-1.5">
                          <Clock
                            aria-hidden
                            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                          />
                          <span className="min-w-0">
                            {scheduleLabel(alert.schedule)}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground w-24 align-top text-sm">
                        {formatSent(alert.lastSentAt)}
                      </TableCell>
                      <TableCell className="w-20 align-top">
                        <div className="flex items-center justify-end">
                          {report ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span
                                    tabIndex={0}
                                    role="note"
                                    aria-label="Set on its regulation"
                                    className="focus-visible:ring-ring inline-flex scroll-m-1 rounded focus-visible:ring-2 focus-visible:outline-none"
                                  >
                                    <StatusBadge tone="info">On</StatusBadge>
                                  </span>
                                }
                              />
                              <TooltipContent>
                                Switched on the regulation, in Regulations ›{" "}
                                {found?.regulation.name ?? "its regulation"}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Switch
                              checked={alert.on}
                              onCheckedChange={() => onToggle(alert.id)}
                              aria-label={
                                alert.on
                                  ? `Turn off ${alert.name}`
                                  : `Turn on ${alert.name}`
                              }
                              className="scroll-m-1"
                            />
                          )}
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
          {visible.length} of {plural(alerts.length, "alert", "alerts")} ·
          checked once an hour · hours are {SCOPE_TIME_ZONE}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The suggestions, written the way a city manager talks.
 *
 * Paz's template gallery and the Streamlit list are mostly fee and billing
 * examples; these three are the Munich ones, and all three are no-parking,
 * because that is all v1 watches. A suggestion whose data a scope lacks must
 * not show, which is why they live beside the rules they fill rather than in a
 * gallery of their own.
 */
const SUGGESTIONS: { text: string; apply: (draft: Alert) => Alert }[] = [
  {
    text: "Tell me when a scooter sits in a no-parking zone for 2 hours",
    apply: (d) => ({
      ...d,
      name: "Scooters parked 2 hours in a no-parking zone",
      vehicles: ["scooter"],
      breachHours: 2,
      schedule: { mode: "hourly", dailyCap: DEFAULT_DAILY_CAP },
    }),
  },
  {
    text: "A daily list of everything parked where it should not be",
    apply: (d) => ({
      ...d,
      name: "Daily list · parked where it should not be",
      vehicles: [],
      breachHours: 2,
      schedule: { mode: "daily", hour: "08:00" },
    }),
  },
  {
    text: "Tell Bolt and Voi about their own vehicles, once a week",
    apply: (d) => ({
      ...d,
      name: "Weekly summary for Bolt and Voi",
      operators: ["Bolt", "Voi"],
      breachHours: 2,
      schedule: { mode: "weekly", hour: "09:00", weekday: "mon" },
    }),
  },
];

/**
 * The ask box.
 *
 * On the same screen as the form it fills, which is the whole point: today's
 * GenAI flow in VIP asks on one page and shows suggestions on another, and the
 * call named that as the thing to fix. Clicking a suggestion puts its words in
 * the field rather than applying it behind your back, so Generate is always
 * the step that changes the form.
 *
 * It is the second path, not the headline. Four pickers is not much to fill in,
 * and typing a sentence to fill them is slower than filling them -- so the ask
 * sits above the form as an offer, and the form is complete without it.
 */
function AskBox({ onGenerate }: { onGenerate: (index: number) => void }) {
  const [text, setText] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Faked, as Jimmy's prototype fakes it: the real parsing is VIA-1071. The
  // match is by the words the suggestion itself used, so the demo never
  // pretends to understand a sentence nobody wrote.
  const run = () => {
    const index = SUGGESTIONS.findIndex((s) => s.text === text.trim());
    if (index === -1) return;
    setThinking(true);
    timer.current = setTimeout(() => {
      setThinking(false);
      onGenerate(index);
    }, 600);
  };

  const known = SUGGESTIONS.some((s) => s.text === text.trim());

  return (
    <SectionCard
      title="Describe it instead"
      description="Pick one of these or write your own, and we fill the form below. You can change everything after."
    >
      <div className="space-y-2">
        <InputGroup>
          <InputGroupAddon>
            <Sparkles className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
            placeholder="Tell me when a scooter sits in a no-parking zone for 2 hours"
            aria-label="Describe the alert you want"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              disabled={!known || thinking}
              onClick={run}
              // A greyed button with no reason reads as a bug, and in this
              // prototype only the three sentences below can be parsed.
              title={
                known
                  ? "Fill the form from this sentence"
                  : "In this prototype, only the suggestions below can be read"
              }
            >
              {thinking ? "Reading…" : "Generate"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s.text}
              type="button"
              variant="outline"
              size="xs"
              className="font-normal"
              onClick={() => setText(s.text)}
            >
              {s.text}
            </Button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function AlertEditor({
  saved,
  initialDraft,
  isNew,
  contacts,
  rules,
  zones,
  zonesLoading,
  onSave,
  onDelete,
  onClose,
  onManageRecipients,
}: {
  saved?: Alert;
  initialDraft: Alert;
  isNew: boolean;
  contacts: Contact[];
  rules: { regulation: Regulation; rule: Rule }[];
  zones: Map<string, PickerZone>;
  zonesLoading: boolean;
  onSave: (alert: Alert) => void;
  onDelete: (id: string) => void;
  onClose: (notice?: string) => void;
  onManageRecipients: () => void;
}) {
  const [draft, setDraft] = React.useState(initialDraft);
  const [saving, setSaving] = React.useState(false);
  const [recipientDraft, setRecipientDraft] = React.useState("");
  const [copying, setCopying] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const baseline = React.useMemo(() => JSON.stringify(saved ?? null), [saved]);
  // A new alert is unsaved from the start: there is nothing behind it to fall
  // back to, and the bar should say so.
  const dirty = isNew || JSON.stringify(draft) !== baseline;

  const update = (next: Partial<Alert>) => setDraft((d) => ({ ...d, ...next }));

  const found = rules.find((r) => r.rule.id === draft.ruleId);
  /** The rule's own zones. An alert narrows to a subset; it adds none. */
  const ruleZones = (found?.rule.zoneIds ?? [])
    .map((id) => zones.get(id))
    .filter((z): z is PickerZone => Boolean(z));

  const RULE_ITEMS: Record<string, string> = Object.fromEntries(
    rules.map(({ regulation, rule }) => [
      rule.id,
      `${regulation.name} · ${rule.name}`,
    ]),
  );

  const chosenContacts = draft.recipientIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is Contact => Boolean(c));

  const recipientEmails = [
    ...chosenContacts.map((c) => c.email),
    ...draft.extraEmails,
  ];

  /** Contacts and typed addresses in one chip field, as one list of values. */
  const recipientValues = [...draft.recipientIds, ...draft.extraEmails];

  const setRecipientValues = (next: string[]) => {
    const ids = next.filter((v) => contacts.some((c) => c.id === v));
    const emails = next.filter((v) => !contacts.some((c) => c.id === v));
    update({ recipientIds: ids, extraEmails: emails });
  };

  const matches = React.useMemo(() => {
    const q = recipientDraft.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) => !draft.recipientIds.includes(c.id))
      .filter((c) => `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [contacts, draft.recipientIds, recipientDraft]);

  const save = () => {
    setSaving(true);
    // Stands in for a request: long enough to see the pending state, short
    // enough not to be annoying in a demo.
    timer.current = setTimeout(() => {
      setSaving(false);
      onSave(draft);
    }, 500);
  };

  const summaryHours = (
    <Field>
      <FieldLabel htmlFor="breach-hours">
        Only when it lasts longer than
      </FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id="breach-hours"
          type="number"
          min={1}
          max={72}
          inputMode="numeric"
          className="w-20 tabular-nums"
          value={draft.breachHours}
          onChange={(e) =>
            update({
              breachHours: Math.min(
                72,
                Math.max(1, Number(e.target.value) || 1),
              ),
            })
          }
        />
        <span className="text-muted-foreground text-sm">
          {draft.breachHours === 1 ? "hour" : "hours"}
        </span>
      </div>
      <FieldDescription>
        Munich asked for 2. A vehicle that moves before then is never e-mailed.
      </FieldDescription>
    </Field>
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => onClose()}>
              <ArrowLeft className="size-4" />
              Alerts
            </Button>
            {!isNew && draft.kind === "alert" ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(draft.id)}
              >
                <Trash2 className="size-4" />
                Delete alert
              </Button>
            ) : null}
          </div>

          <div className="space-y-1">
            <Input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Name this alert"
              aria-label="Alert name"
              className="h-auto border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {/* The derived sentence, in the one place it is worth reading in
                full. Never editable -- see `summarize`. */}
            <p className="text-muted-foreground text-sm">
              {summarize(
                draft,
                { rule: found?.rule, regulation: found?.regulation },
                zones,
              )}
            </p>
          </div>

          {isNew ? <AskBox onGenerate={(i) => setDraft((d) => SUGGESTIONS[i]!.apply(d))} /> : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <SectionCard
                title="What to watch"
                description="One no-parking rule. Alerts on the other rule types come after 14 Dec."
              >
                <div className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="alert-rule">Rule</FieldLabel>
                    <Select
                      items={RULE_ITEMS}
                      value={draft.ruleId}
                      onValueChange={(v) =>
                        // A different rule has different zones, so a subset
                        // chosen from the old one cannot be carried over.
                        update({ ruleId: (v ?? draft.ruleId) as string, zoneIds: [] })
                      }
                    >
                      <SelectTrigger id="alert-rule" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rules.map(({ regulation, rule }) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {regulation.name} · {rule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Only no-parking rules are listed, in every regulation that
                      has one — including the parking regulations that hold one
                      beside their bays.
                    </FieldDescription>
                  </Field>

                  {summaryHours}
                </div>
              </SectionCard>

              <SectionCard
                title="Where"
                description="Every zone in the rule, or a few of them."
              >
                {zonesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : ruleZones.length === 0 ? (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyTitle>This rule has no zones yet</EmptyTitle>
                      <EmptyDescription>
                        Add them to the rule in Regulations. An alert narrows to
                        a rule&rsquo;s zones; it cannot add one.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={draft.zoneIds.length === 0 ? "default" : "outline"}
                        onClick={() => update({ zoneIds: [] })}
                      >
                        {draft.zoneIds.length === 0 ? (
                          <Check className="size-3.5" />
                        ) : null}
                        All {ruleZones.length} zones
                      </Button>
                      {draft.zoneIds.length > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {plural(draft.zoneIds.length, "zone", "zones")} chosen
                        </span>
                      ) : null}
                    </div>
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {ruleZones.map((zone) => {
                        const on = draft.zoneIds.includes(zone.id);
                        return (
                          <label
                            key={zone.id}
                            className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2"
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={() =>
                                update({ zoneIds: toggle(draft.zoneIds, zone.id) })
                              }
                              className="scroll-my-1"
                            />
                            <ZoneThumbnail ring={zone.ring} size={28} />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {zone.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Filters"
                description="Narrow it to some vehicles or some operators. Both are everything unless you say otherwise."
              >
                <div className="space-y-4">
                  <AllOrSome
                    label="Vehicles"
                    all="All vehicle types"
                    options={VEHICLES}
                    chosen={draft.vehicles}
                    onChange={(vehicles) => update({ vehicles })}
                  />
                  <AllOrSome
                    label="Operators"
                    all="All operators"
                    options={OPERATORS.map((o) => ({ value: o, label: o }))}
                    chosen={draft.operators as (typeof OPERATORS)[number][]}
                    onChange={(operators) => update({ operators: [...operators] })}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="When to send"
                description="The data is checked once an hour, so nothing here is live."
              >
                <ScheduleFields
                  schedule={draft.schedule}
                  onChange={(schedule) => update({ schedule })}
                />
              </SectionCard>

              <SectionCard
                title="Recipients"
                description="From the scope's report contacts. The same list the report rules use."
              >
                <div className="space-y-3">
                  <TagInput
                    value={recipientValues}
                    onValueChange={setRecipientValues}
                    getTagLabel={(v) =>
                      contacts.find((c) => c.id === v)?.name ?? v
                    }
                    draft={recipientDraft}
                    onDraftChange={setRecipientDraft}
                    onDraftCommit={(text) => {
                      const top = matches[0];
                      if (top) {
                        setRecipientValues([...recipientValues, top.id]);
                        setRecipientDraft("");
                        return;
                      }
                      // A plain address is still allowed: not everyone who
                      // wants an alert needs a VIP account.
                      const typed = text.trim();
                      if (typed.includes("@") && !recipientValues.includes(typed)) {
                        setRecipientValues([...recipientValues, typed]);
                        setRecipientDraft("");
                      }
                    }}
                    startAddon={<Users className="text-muted-foreground size-4" />}
                    inputLabel="Add a recipient by name, e-mail or operator"
                    placeholder="Type a name, an e-mail, or an operator…"
                    maxVisible={8}
                  />
                  {matches.length > 0 ? (
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {matches.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setRecipientValues([...recipientValues, contact.id]);
                            setRecipientDraft("");
                          }}
                          className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-2 px-3 py-2 text-left scroll-m-1 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <ContactMark contact={contact} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {contact.name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {contact.email}
                            </span>
                          </span>
                          {contact.operator ? (
                            <Badge variant="outline" className="text-[11px]">
                              {contact.operator}
                            </Badge>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCopying(true)}
                    >
                      <Copy className="size-4" />
                      Copy from another alert
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onManageRecipients}
                    >
                      <UserCog className="size-4" />
                      Manage the contacts list
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    A name that is not on the list yet gets a read-only
                    invitation to VIP. A plain address just gets the e-mail.
                  </p>
                </div>
              </SectionCard>
            </div>

            {/* Below lg this follows the form rather than taking a pane of its
                own: it is not interactive, so reading it last costs nothing,
                and a pane switcher would be a control that exists only on
                small screens. */}
            {/* Two elements, not one. A sticky GRID ITEM cannot travel: given
                self-start it is only as tall as its content, and left to
                stretch it already fills the row. The item takes the row's
                height and the preview sticks inside it. */}
            <div>
              <div className="space-y-4 lg:sticky lg:top-0">
              <EmailPreview
                alert={draft}
                recipients={recipientEmails}
                ruleName={found?.rule.name ?? "a rule"}
              />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={isNew ? undefined : () => setDraft(saved ?? initialDraft)}
        saveLabel={isNew ? "Create alert" : "Save alert"}
        message={isNew ? "Not created yet" : "Unsaved changes"}
        className="sticky bottom-0"
      />

      <CopyRecipientsDialog
        open={copying}
        onOpenChange={setCopying}
        onCopy={(from) =>
          update({
            recipientIds: [...new Set([...draft.recipientIds, ...from.recipientIds])],
            extraEmails: [...new Set([...draft.extraEmails, ...from.extraEmails])],
          })
        }
      />
    </div>
  );
}

/**
 * When to send, as four choices rather than a cron expression.
 *
 * "As soon as it happens" is not on offer, because it would not be true: the
 * platform checks once an hour. Jimmy's wording, kept -- "new cases only" is
 * the part that stops an idle-vehicle alert re-sending the same vehicles every
 * hour for a week.
 */
function ScheduleFields({
  schedule,
  onChange,
}: {
  schedule: AlertSchedule;
  onChange: (next: AlertSchedule) => void;
}) {
  const MODES: { value: SendMode; label: string }[] = [
    { value: "hourly", label: "Every hour" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  const WEEKDAY_ITEMS: Record<string, string> = WEEKDAYS;

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel>How often</FieldLabel>
        <SegmentedControl
          items={MODES}
          value={schedule.mode}
          onValueChange={(v) => {
            const mode = v as SendMode;
            onChange(
              mode === "hourly"
                ? { mode, dailyCap: schedule.dailyCap ?? DEFAULT_DAILY_CAP }
                : {
                    mode,
                    hour: schedule.hour ?? "08:00",
                    weekday: mode === "weekly" ? (schedule.weekday ?? "mon") : undefined,
                  },
            );
          }}
          aria-label="How often to send this alert"
        />
        <FieldDescription>
          {schedule.mode === "hourly"
            ? "One e-mail an hour at most, listing only vehicles we have not told you about yet."
            : "One e-mail with the whole list of matching vehicles."}
        </FieldDescription>
      </Field>

      {schedule.mode === "hourly" ? (
        <Field>
          <FieldLabel htmlFor="daily-cap">Stop after</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="daily-cap"
              type="number"
              min={1}
              max={24}
              inputMode="numeric"
              className="w-20 tabular-nums"
              value={schedule.dailyCap ?? DEFAULT_DAILY_CAP}
              onChange={(e) =>
                onChange({
                  ...schedule,
                  dailyCap: Math.min(24, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
            <span className="text-muted-foreground text-sm">
              e-mails a day, starting again tomorrow
            </span>
          </div>
          <FieldDescription>
            {/* Flagged rather than guessed: the number in the prototype could
                not be read, and nobody has confirmed what the backend does. */}
            The cap itself is still to confirm with Jimmy.
          </FieldDescription>
        </Field>
      ) : (
        <div className="flex flex-wrap gap-4">
          {schedule.mode === "weekly" ? (
            <Field className="w-40">
              <FieldLabel htmlFor="weekday">On</FieldLabel>
              <Select
                items={WEEKDAY_ITEMS}
                value={schedule.weekday ?? "mon"}
                onValueChange={(v) =>
                  onChange({ ...schedule, weekday: (v ?? "mon") as Weekday })
                }
              >
                <SelectTrigger id="weekday" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(WEEKDAYS) as Weekday[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {WEEKDAYS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {schedule.mode === "monthly" ? (
            <Field className="w-40">
              <FieldLabel>On</FieldLabel>
              <p className="flex h-9 items-center text-sm">The 1st</p>
              <FieldDescription>The only day the backend offers.</FieldDescription>
            </Field>
          ) : null}
          <Field className="w-40">
            <FieldLabel htmlFor="send-hour">At</FieldLabel>
            <Select
              items={HOURS}
              value={schedule.hour ?? "08:00"}
              onValueChange={(v) => onChange({ ...schedule, hour: (v ?? "08:00") as string })}
            >
              <SelectTrigger id="send-hour" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(HOURS).map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* The hour is read in the scope's own time zone, never UTC and
                never the reader's. Saying which one is the difference between
                a time a client trusts and the "UTC+1 (Europe/Brussels)" they
                never understood on Streamlit. */}
            <FieldDescription>{SCOPE_TIME_ZONE}</FieldDescription>
          </Field>
        </div>
      )}
    </div>
  );
}

function CopyRecipientsDialog({
  open,
  onOpenChange,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (from: Alert) => void;
}) {
  const others = SAMPLE_ALERTS.filter((a) => a.kind === "alert");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy recipients from</DialogTitle>
          <DialogDescription>
            Their recipients are added to this alert. Nothing is taken away.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {others.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => {
                onCopy(alert);
                onOpenChange(false);
              }}
              className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="min-w-0 truncate text-sm">{alert.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {plural(
                  alert.recipientIds.length + alert.extraEmails.length,
                  "recipient",
                  "recipients",
                )}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipients                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The contacts list, read by who gets what.
 *
 * This tab exists for one job Katell named as the painful one: people change
 * all the time, mostly at the operators, and today a swap is done one alert at
 * a time in Streamlit. So the row action is **Replace**, which moves someone
 * out of every alert and someone else in, in one go -- the thing CS actually
 * needs -- and Remove is the destructive sibling rather than the main verb.
 */
function RecipientsTab({
  contacts,
  alerts,
  onReplace,
  onRemove,
  onOpenAlert,
}: {
  contacts: Contact[];
  alerts: Alert[];
  onReplace: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onOpenAlert: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [replacing, setReplacing] = React.useState<Contact | null>(null);

  const alertsFor = React.useCallback(
    (id: string) => alerts.filter((a) => a.recipientIds.includes(id)),
    [alerts],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        !q || `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Recipients</h2>
        <p className="text-muted-foreground text-sm">
          One list for the whole scope, shared with the report rules. Editing it
          here is editing Settings › Report contacts.
        </p>
      </header>

      <InputGroup className="w-full sm:w-72">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search by name, e-mail or operator"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recipients"
        />
      </InputGroup>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <caption className="sr-only">
            Everyone on the scope&rsquo;s report contacts list, and the alerts
            they are on.
          </caption>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Recipient</TableHead>
              <TableHead>Gets these alerts</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="p-0">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>Nobody matches that</EmptyTitle>
                      <EmptyDescription>
                        Try part of a name, an e-mail domain, or an operator.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((contact) => {
                const theirs = alertsFor(contact.id);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="max-w-64 py-3 align-top lg:max-w-80">
                      <span className="flex min-w-0 items-start gap-2">
                        <ContactMark contact={contact} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {contact.name}
                            </span>
                            {contact.operator ? (
                              <Badge variant="outline" className="text-[11px]">
                                {contact.operator}
                              </Badge>
                            ) : null}
                            {contact.pending ? (
                              <StatusBadge tone="warning">Invited</StatusBadge>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {contact.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      {theirs.length === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          No alerts yet
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {theirs.map((alert) => (
                            <Button
                              key={alert.id}
                              type="button"
                              variant="outline"
                              size="xs"
                              className="max-w-56 font-normal"
                              onClick={() => onOpenAlert(alert.id)}
                            >
                              <span className="truncate">{alert.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="w-36 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconAction
                          label={`Replace ${contact.name} everywhere`}
                          onClick={() => setReplacing(contact)}
                        >
                          <UserCog className="size-4" />
                        </IconAction>
                        <IconAction
                          label={`Remove ${contact.name} from every alert`}
                          onClick={() => onRemove(contact.id)}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs">
        {plural(contacts.length, "person", "people")} · replacing someone
        changes every alert they are on at once
      </p>

      <ReplaceDialog
        contact={replacing}
        contacts={contacts}
        count={replacing ? alertsFor(replacing.id).length : 0}
        onOpenChange={(open) => {
          if (!open) setReplacing(null);
        }}
        onReplace={(toId) => {
          if (replacing) onReplace(replacing.id, toId);
          setReplacing(null);
        }}
      />
    </div>
  );
}

function ReplaceDialog({
  contact,
  contacts,
  count,
  onOpenChange,
  onReplace,
}: {
  contact: Contact | null;
  contacts: Contact[];
  count: number;
  onOpenChange: (open: boolean) => void;
  onReplace: (toId: string) => void;
}) {
  const [picked, setPicked] = React.useState<string | null>(null);

  // A different person is a different question: nothing picked for one may be
  // carried into the next.
  React.useEffect(() => setPicked(null), [contact?.id]);

  const others = contacts.filter((c) => c.id !== contact?.id);

  return (
    <Dialog open={contact !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace {contact?.name}</DialogTitle>
          <DialogDescription>
            {contact
              ? `They come off ${plural(count, "alert", "alerts")}, and whoever you pick goes on the same ones.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border">
          {others.map((c) => (
            <label
              key={c.id}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2"
            >
              <input
                type="radio"
                name="replacement"
                className="accent-primary size-4"
                checked={picked === c.id}
                onChange={() => setPicked(c.id)}
              />
              <ContactMark contact={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {c.email}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!picked}
            onClick={() => picked && onReplace(picked)}
          >
            Replace on {plural(count, "alert", "alerts")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                  */
/* -------------------------------------------------------------------------- */

type View =
  | { kind: "list" }
  | { kind: "edit"; id: string; isNew: boolean };

export function AlertsWorkspace({
  className,
  alerts: initialAlerts = SAMPLE_ALERTS,
  contacts: initialContacts = SAMPLE_CONTACTS,
  regulations = SAMPLE_REGULATIONS,
  status = "ready",
  scope = "Munich · all operators",
  onRetry,
  onSave,
}: {
  className?: string;
  alerts?: Alert[];
  contacts?: Contact[];
  regulations?: Regulation[];
  status?: "ready" | "loading" | "error";
  scope?: string;
  onRetry?: () => void;
  /** Called with the saved alert, after the workspace has kept it. */
  onSave?: (alert: Alert) => void;
}) {
  const [alerts, setAlerts] = React.useState(initialAlerts);
  const [contacts, setContacts] = React.useState(initialContacts);
  const [tab, setTab] = React.useState("alerts");
  const [view, setView] = React.useState<View>({ kind: "list" });
  const [drafts, setDrafts] = React.useState<Record<string, Alert>>({});
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

  const zoneIndex = React.useMemo(
    () => new Map(zones.map((z) => [z.id, z])),
    [zones],
  );

  const rules = React.useMemo(() => alertableRules(regulations), [regulations]);
  const ruleIndex = React.useMemo(
    () =>
      new Map(
        rules.map(({ regulation, rule }) => [rule.id, { regulation, rule }]),
      ),
    [rules],
  );
  const contactIndex = React.useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  const create = () => {
    const first = rules[0];
    const id = uid("al");
    const draft: Alert = {
      id,
      kind: "alert",
      name: "",
      regulationId: first?.regulation.id ?? "",
      ruleId: first?.rule.id ?? "",
      breachHours: 2,
      zoneIds: [],
      vehicles: [],
      operators: [],
      schedule: { mode: "hourly", dailyCap: DEFAULT_DAILY_CAP },
      recipientIds: [],
      extraEmails: [],
      createdBy: "You",
      mine: true,
      createdAt: new Date().toISOString(),
      on: true,
    };
    setDrafts((d) => ({ ...d, [id]: draft }));
    setNotice(null);
    setTab("alerts");
    setView({ kind: "edit", id, isNew: true });
  };

  const open = (id: string) => {
    setNotice(null);
    setTab("alerts");
    setView({ kind: "edit", id, isNew: false });
  };

  const remove = (ids: string[]) => {
    setAlerts((all) => all.filter((a) => !ids.includes(a.id)));
    setNotice(
      ids.length === 1 ? "Alert deleted" : `${ids.length} alerts deleted`,
    );
  };

  const saved = view.kind === "edit" ? alerts.find((a) => a.id === view.id) : undefined;
  const editing =
    view.kind === "edit" ? (drafts[view.id] ?? saved) : undefined;

  return (
    <TooltipProvider>
      <div
        data-slot="alerts-workspace"
        className={cn(
          // Same envelope as the other workspaces, so the docs page does not
          // jump when one block replaces another.
          "bg-background relative h-[max(480px,75svh)] w-full overflow-auto rounded-xl border border-border md:h-[700px] lg:h-[760px]",
          className,
        )}
      >
        {view.kind === "edit" ? (
          editing ? (
            <AlertEditor
              // A different alert is a different form: nothing typed into one
              // may leak into the next.
              key={view.id}
              saved={saved}
              initialDraft={editing}
              isNew={view.isNew}
              contacts={contacts}
              rules={rules}
              zones={zoneIndex}
              zonesLoading={zonesLoading}
              onManageRecipients={() => {
                setView({ kind: "list" });
                setTab("recipients");
              }}
              onDelete={(id) => {
                remove([id]);
                setDrafts(({ [id]: _, ...rest }) => rest);
                setView({ kind: "list" });
              }}
              onSave={(alert) => {
                const named = alert.name.trim()
                  ? alert
                  : { ...alert, name: "Untitled alert" };
                setAlerts((all) =>
                  all.some((a) => a.id === named.id)
                    ? all.map((a) => (a.id === named.id ? named : a))
                    : [named, ...all],
                );
                setDrafts(({ [named.id]: _, ...rest }) => rest);
                setNotice(
                  view.isNew ? `${named.name} created` : `${named.name} saved`,
                );
                setView({ kind: "list" });
                onSave?.(named);
              }}
              onClose={(message) => {
                if (view.isNew) setDrafts(({ [view.id]: _, ...rest }) => rest);
                setNotice(message ?? null);
                setView({ kind: "list" });
              }}
            />
          ) : (
            <div className="p-6">
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>This alert no longer exists</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    onClick={() => setView({ kind: "list" })}
                  >
                    Back to alerts
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          )
        ) : (
          <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
              <TabsList>
                <TabsTrigger value="alerts">
                  <BellRing className="size-4" />
                  Alerts
                </TabsTrigger>
                <TabsTrigger value="recipients">
                  <Users className="size-4" />
                  Recipients
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="mt-2">
                <AlertList
                  alerts={alerts}
                  contacts={contactIndex}
                  rules={ruleIndex}
                  zones={zoneIndex}
                  status={status}
                  scope={scope}
                  notice={notice}
                  onDismissNotice={() => setNotice(null)}
                  onRetry={onRetry}
                  onCreate={create}
                  onOpen={open}
                  onToggle={(id) =>
                    setAlerts((all) =>
                      all.map((a) => (a.id === id ? { ...a, on: !a.on } : a)),
                    )
                  }
                  onDelete={remove}
                />
              </TabsContent>

              <TabsContent value="recipients" className="mt-2">
                <RecipientsTab
                  contacts={contacts}
                  alerts={alerts}
                  onOpenAlert={open}
                  onReplace={(fromId, toId) => {
                    setAlerts((all) =>
                      all.map((a) =>
                        a.recipientIds.includes(fromId)
                          ? {
                              ...a,
                              recipientIds: [
                                ...new Set(
                                  a.recipientIds.map((id) =>
                                    id === fromId ? toId : id,
                                  ),
                                ),
                              ],
                            }
                          : a,
                      ),
                    );
                    const from = contactIndex.get(fromId);
                    const to = contactIndex.get(toId);
                    setNotice(
                      `${to?.name ?? "They"} took over from ${from?.name ?? "them"}`,
                    );
                  }}
                  onRemove={(id) => {
                    setAlerts((all) =>
                      all.map((a) => ({
                        ...a,
                        recipientIds: a.recipientIds.filter((r) => r !== id),
                      })),
                    );
                    setContacts((all) => all.filter((c) => c.id !== id));
                  }}
                />
              </TabsContent>
            </Tabs>

            <Separator />

            {/* The boundary, said once, where both features are visible. A
                table of the difference lives in Jimmy's page; here one line is
                enough to stop "Files a report" reading as a kind of alert. */}
            <div className="text-muted-foreground flex items-start gap-2 text-xs">
              <FileText aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <p>
                An <strong className="font-medium">alert</strong> sends an
                e-mail. A <strong className="font-medium">report rule</strong>{" "}
                files a report with a lifecycle an operator works through — it is
                switched on its regulation, and listed here read-only.
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AlertsWorkspace;
