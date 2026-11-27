"use client";

/**
 * The Alerts page.
 *
 * One page per scope, beside Regulations. An alert watches a no-parking rule
 * and sends an e-mail; it does not file anything and it has no lifecycle of
 * its own. That single sentence is the whole boundary between this page and
 * the report rules Jimmy ships on 10 Dec.
 *
 * The editor IS that sentence. "When a scooter from any operator stays in any
 * zone of Historic centre for more than 2 hours, e-mail Anja every hour" --
 * every part you can change is a word you can press. There is no form beside
 * it saying the same thing in fields, and so nothing that can disagree with
 * it. It is also the only layout in which a report rule can be shown honestly:
 * the same sentence, with nothing in it pressable.
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
 *   across everything. So the Recipients view edits that one list, and the
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
 * - **No description lines.** The first version explained itself under every
 *   heading and every field, and read as a document about alerts rather than
 *   a place to set one. What a control does is now said by the control.
 * - **Nothing only the backend can be the truth about:** whether the hourly
 *   check found anything, whether an e-mail was delivered, what the daily cap
 *   really is. `dailyCap` below carries a placeholder and says so.
 */

import * as React from "react";
import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronDown,
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
import { Input } from "@/registry/vianova/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/registry/vianova/ui/native-select";
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
import { Switch } from "@/registry/vianova/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/vianova/ui/tooltip";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import { SaveBar } from "@/registry/vianova/patterns/save-bar";
import { StatusBadge } from "@/registry/vianova/patterns/status-badge";
import { TableCard } from "@/registry/vianova/patterns/table-card";
import { TagInput } from "@/registry/vianova/patterns/tag-input";
import { ToolBand } from "@/registry/vianova/patterns/tool-band";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { RuleTypeIcon } from "@/registry/vianova/product/rule-type-icon";
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
const HOURS = Array.from(
  { length: 15 },
  (_, i) => `${String(i + 6).padStart(2, "0")}:00`,
);

/** The scope's own time zone. Every hour here is read in it, never in UTC. */
const SCOPE_TIME_ZONE = "Munich time";

/** The schedule as a list cell: short enough to never wrap. */
export function scheduleLabel(schedule: AlertSchedule) {
  const at = schedule.hour ?? "08:00";
  switch (schedule.mode) {
    case "hourly":
      return "Every hour";
    case "daily":
      return `Daily · ${at}`;
    case "weekly":
      return `${WEEKDAYS[schedule.weekday ?? "mon"]}s · ${at}`;
    case "monthly":
      return `Monthly · ${at}`;
  }
}

/**
 * The schedule as the end of the sentence.
 *
 * "As soon as it happens" is not among them, because it would not be true: the
 * platform checks once an hour. Jimmy's wording of 19 Nov, kept.
 */
function schedulePhrase(schedule: AlertSchedule) {
  const at = schedule.hour ?? "08:00";
  switch (schedule.mode) {
    case "hourly":
      return "every hour";
    case "daily":
      return `every day at ${at}`;
    case "weekly":
      return `every ${WEEKDAYS[schedule.weekday ?? "mon"]} at ${at}`;
    case "monthly":
      return `on the 1st of each month at ${at}`;
  }
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "a", "a or b", "a, b or c". */
const orList = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

const vehiclePhrase = (vehicles: Vehicle[]) =>
  vehicles.length === 0
    ? "any vehicle"
    : // The article belongs here, not in the list: "When scooter stays" is not
      // a sentence, and the sentence is the thing being read.
      `a ${orList(
        vehicles.map(
          (v) => VEHICLES.find((x) => x.value === v)?.label.toLowerCase() ?? v,
        ),
      )}`;

const operatorPhrase = (operators: string[]) =>
  operators.length === 0 ? "any operator" : orList(operators);

const zonePhrase = (ids: string[], zones: Map<string, PickerZone>) =>
  ids.length === 0
    ? "any zone"
    : ids.length === 1
      ? (zones.get(ids[0]!)?.name ?? "1 zone")
      : plural(ids.length, "zone", "zones");

const recipientPhrase = (names: string[]) =>
  names.length === 0
    ? "nobody yet"
    : names.length === 1
      ? names[0]!
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;

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
 * Which of the tool's two lists is showing.
 *
 * Under the band that names the tool -- never above it. A switcher that sits
 * over the title reads as the thing the title belongs to, when it is the other
 * way round: Alerts is the tool, and these are two views of it. Tabs with a
 * count each, on a row of their own, exactly as Feeds draws "Your feeds" and
 * "Catalogue".
 */
type Section = "alerts" | "recipients";

function SectionTabs({
  value,
  onChange,
  alerts,
  recipients,
}: {
  value: Section;
  onChange: (next: Section) => void;
  alerts: number;
  recipients: number;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Section)}>
      <TabsList>
        <TabsTrigger value="alerts">
          Alerts
          <Badge variant="secondary" className="tabular-nums">
            {alerts}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="recipients">
          Recipients
          <Badge variant="secondary" className="tabular-nums">
            {recipients}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */
/* The sentence                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One changeable part of the sentence.
 *
 * It reads as the words it stands for and opens the picker for them, so the
 * sentence is always the current state of the alert and never a summary of a
 * form somewhere else. `readOnly` drops the control and keeps the words, which
 * is how a report rule is shown: the same sentence, with nothing to press.
 *
 * The accessible name is the question and the answer -- "Vehicles: a scooter"
 * -- because out of the sentence's flow, "a scooter" alone names nothing.
 */
function Slot({
  title,
  label,
  empty,
  readOnly,
  className,
  children,
}: {
  /** What is being chosen, for assistive tech: "Vehicles". */
  title: string;
  /** The words the sentence shows. */
  label: string;
  /** Nothing chosen where the alert needs something. Drawn as a gap to fill. */
  empty?: boolean;
  readOnly?: boolean;
  /** The picker's width. */
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  if (readOnly) {
    return <span className="text-foreground font-medium">{label}</span>;
  }

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next)}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${title}: ${label}`}
            className={cn(
              // inline-flex on the baseline, so a slot sits in the line of
              // text like a word and wraps with it. The negative margin gives
              // back the padding, or every slot would open a gap in the line.
              // leading-snug is not cosmetic: a flex box is as tall as its
              // line, and the sentence's own generous leading would make
              // every slot a 46px slab.
              "text-foreground bg-primary/10 hover:bg-primary/15 data-[popup-open]:bg-primary/20 -my-1 inline-flex max-w-full scroll-m-1 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 align-baseline leading-snug font-medium transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
              empty &&
                "border-border text-muted-foreground hover:bg-muted border-dashed bg-transparent",
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown
              aria-hidden
              className="text-muted-foreground size-[0.7em] shrink-0"
            />
          </button>
        }
      />
      <PopoverContent
        align="start"
        className={cn("max-w-[calc(100vw-2rem)]", className)}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A row in a picker. 44px tall: VIP is used on tablets in the field, and a
 * list of options is exactly where a finger lands.
 */
function PickRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
}

/**
 * All of something, or a named few.
 *
 * An empty list means "all", which is only safe if the control says so in
 * words -- so "any" is a row of its own at the top, ticked when nothing else
 * is, and ticking it is how you clear the rest.
 */
function CheckPicker<T extends string>({
  all,
  options,
  chosen,
  onChange,
}: {
  all: string;
  options: readonly { value: T; label: string }[];
  chosen: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div className="-m-1 flex flex-col">
      <PickRow
        checked={chosen.length === 0}
        onChange={() => onChange([])}
        label={all}
      />
      <div aria-hidden className="bg-border mx-2 my-1 h-px" />
      {options.map((option) => (
        <PickRow
          key={option.value}
          checked={chosen.includes(option.value)}
          onChange={() => onChange(toggle(chosen, option.value))}
          label={option.label}
        />
      ))}
    </div>
  );
}

const SEND_MODES: { value: SendMode; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * When to send, as four choices rather than a cron expression.
 *
 * Native selects for the day and the hour: they sit inside a popover, and a
 * second popup opened from inside the first is one more layer to dismiss on a
 * tablet, where the system's own picker is also simply better.
 */
function SchedulePicker({
  schedule,
  onChange,
}: {
  schedule: AlertSchedule;
  onChange: (next: AlertSchedule) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        items={SEND_MODES}
        value={schedule.mode}
        onValueChange={(v) => {
          const mode = v as SendMode;
          onChange(
            mode === "hourly"
              ? { mode, dailyCap: schedule.dailyCap ?? DEFAULT_DAILY_CAP }
              : {
                  mode,
                  hour: schedule.hour ?? "08:00",
                  weekday:
                    mode === "weekly" ? (schedule.weekday ?? "mon") : undefined,
                },
          );
        }}
        size="sm"
        aria-label="How often to send"
      />

      {schedule.mode === "hourly" ? (
        <label className="flex items-center gap-2 text-sm">
          Stop after
          <Input
            type="number"
            min={1}
            max={24}
            inputMode="numeric"
            className="w-16 tabular-nums"
            value={schedule.dailyCap ?? DEFAULT_DAILY_CAP}
            onChange={(e) =>
              onChange({
                ...schedule,
                dailyCap: Math.min(24, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
          e-mails a day
        </label>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {schedule.mode === "weekly" ? (
            <NativeSelect
              aria-label="Day of the week"
              value={schedule.weekday ?? "mon"}
              onChange={(e) =>
                onChange({ ...schedule, weekday: e.target.value as Weekday })
              }
            >
              {(Object.keys(WEEKDAYS) as Weekday[]).map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {WEEKDAYS[d]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
          {/* Monthly is the 1st and nothing else, because that is all the
              backend offers. Said, rather than offered as a picker of one. */}
          <span>{schedule.mode === "monthly" ? "On the 1st, at" : "at"}</span>
          <NativeSelect
            aria-label="Hour"
            value={schedule.hour ?? "08:00"}
            onChange={(e) => onChange({ ...schedule, hour: e.target.value })}
          >
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {/* Which clock. The difference between an hour a client trusts and
              the "UTC+1 (Europe/Brussels)" nobody understood on Streamlit. */}
          <span className="text-muted-foreground">{SCOPE_TIME_ZONE}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Who gets it.
 *
 * One field for both kinds of recipient: a name from the scope's report
 * contacts, or a plain address for someone with no VIP account. While nothing
 * is typed, the list under the field is the other alerts -- copying one's
 * recipients is the common case, and it is one press here rather than a dialog
 * of its own.
 */
function RecipientPicker({
  alert,
  contacts,
  others,
  onChange,
  onManage,
}: {
  alert: Alert;
  contacts: Contact[];
  /** Other alerts, to copy recipients from. */
  others: Alert[];
  onChange: (next: Pick<Alert, "recipientIds" | "extraEmails">) => void;
  onManage: () => void;
}) {
  const [draft, setDraft] = React.useState("");

  /** Contacts and typed addresses in one chip field, as one list of values. */
  const values = [...alert.recipientIds, ...alert.extraEmails];
  const isContact = (v: string) => contacts.some((c) => c.id === v);
  const setValues = (next: string[]) =>
    onChange({
      recipientIds: next.filter(isContact),
      extraEmails: next.filter((v) => !isContact(v)),
    });

  const q = draft.trim().toLowerCase();
  const matches = q
    ? contacts
        .filter((c) => !alert.recipientIds.includes(c.id))
        .filter((c) =>
          `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : [];
  const sources = others.filter(
    (a) => a.recipientIds.length + a.extraEmails.length > 0,
  );

  const rowClass =
    "hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none focus-visible:ring-3";

  return (
    <div className="flex flex-col gap-2">
      <TagInput
        value={values}
        onValueChange={setValues}
        getTagLabel={(v) => contacts.find((c) => c.id === v)?.name ?? v}
        draft={draft}
        onDraftChange={setDraft}
        onDraftCommit={(text) => {
          const top = matches[0];
          const typed = text.trim();
          if (top) setValues([...values, top.id]);
          // A plain address is still allowed: not everyone who wants an alert
          // needs a VIP account.
          else if (typed.includes("@") && !values.includes(typed))
            setValues([...values, typed]);
          else return;
          setDraft("");
        }}
        inputLabel="Add a recipient by name, e-mail or operator"
        placeholder="Name, e-mail or operator"
        maxVisible={6}
      />

      {q ? (
        matches.length > 0 ? (
          <div className="-mx-1 flex flex-col">
            {matches.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  setValues([...values, contact.id]);
                  setDraft("");
                }}
                className={rowClass}
              >
                <ContactMark contact={contact} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{contact.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {contact.email}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground px-1 text-xs">
            {q.includes("@")
              ? "Press Enter to add this address."
              : "Nobody on the contacts list matches."}
          </p>
        )
      ) : sources.length > 0 ? (
        <div className="-mx-1 flex flex-col">
          <p className="text-muted-foreground px-2 py-1 text-xs">
            Copy from another alert
          </p>
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() =>
                onChange({
                  recipientIds: [
                    ...new Set([...alert.recipientIds, ...source.recipientIds]),
                  ],
                  extraEmails: [
                    ...new Set([...alert.extraEmails, ...source.extraEmails]),
                  ],
                })
              }
              className={rowClass}
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {source.name}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {source.recipientIds.length + source.extraEmails.length}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="-mx-2.5 -mb-2.5 border-t px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onManage}
        >
          <UserCog data-icon="inline-start" />
          Manage contacts
        </Button>
      </div>
    </div>
  );
}

/**
 * The suggestions, written the way a city manager talks.
 *
 * Paz's template gallery and the Streamlit list are mostly fee and billing
 * examples; these three are the Munich ones, and all three are no-parking,
 * because that is all v1 watches.
 */
const SUGGESTIONS: { text: string; apply: (draft: Alert) => Alert }[] = [
  {
    text: "Tell me when a scooter sits in a no-parking zone for 2 hours",
    apply: (d) => ({
      ...d,
      name: "Scooters parked 2 hours in a no-parking zone",
      vehicles: ["scooter"],
      operators: [],
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
      operators: [],
      breachHours: 2,
      schedule: { mode: "daily", hour: "08:00" },
    }),
  },
  {
    text: "Tell Bolt and Voi about their own vehicles, once a week",
    apply: (d) => ({
      ...d,
      name: "Weekly summary for Bolt and Voi",
      vehicles: [],
      operators: ["Bolt", "Voi"],
      breachHours: 2,
      schedule: { mode: "weekly", hour: "09:00", weekday: "mon" },
    }),
  },
];

/**
 * Describing the alert instead of building it.
 *
 * On the same screen as the sentence it fills, which is the whole point:
 * today's GenAI flow in VIP asks on one page and suggests on another, and the
 * call of 26 Nov named that as the thing to fix. A suggestion puts its words
 * in the field rather than acting behind your back, so Generate is always the
 * step that changes the sentence.
 *
 * Under the sentence, not over it. Seven words to press is not much to fill
 * in, and typing a description of them is slower than pressing them -- so this
 * is an offer below the thing itself, and the thing is complete without it.
 */
function AskRow({ onGenerate }: { onGenerate: (index: number) => void }) {
  const [text, setText] = React.useState("");
  const [reading, setReading] = React.useState(false);
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
  const index = SUGGESTIONS.findIndex((s) => s.text === text.trim());
  const run = () => {
    if (index === -1 || reading) return;
    setReading(true);
    timer.current = setTimeout(() => {
      setReading(false);
      setText("");
      onGenerate(index);
    }, 600);
  };

  return (
    <div className="space-y-2">
      <InputGroup>
        <InputGroupAddon>
          <Sparkles />
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
          placeholder="Or describe it in your own words"
          aria-label="Describe the alert you want"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            disabled={index === -1 || reading}
            onClick={run}
            // A greyed button with no reason reads as a bug, and in this
            // prototype only the three sentences below can be read.
            title={
              index === -1
                ? "In this prototype, only the suggestions below can be read"
                : "Fill the sentence from this description"
            }
          >
            {reading ? "Reading…" : "Generate"}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <Button
            key={s.text}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 py-1 text-left font-normal whitespace-normal"
            onClick={() => setText(s.text)}
          >
            {s.text}
          </Button>
        ))}
      </div>
    </div>
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
 * part of this scope. So this is a frame around it.
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
    <section
      aria-label="E-mail preview"
      className="bg-card overflow-hidden rounded-xl border"
    >
      <p className="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium">
        <Mail aria-hidden className="size-3.5" />
        What the recipient gets
      </p>

      <dl className="divide-y text-xs">
        {[
          ["From", "Vianova"],
          ["To", recipients.length ? recipients.join(", ") : "Nobody yet"],
          ["Subject", subject],
        ].map(([key, value]) => (
          <div key={key} className="flex gap-3 px-4 py-2">
            <dt className="text-muted-foreground w-14 shrink-0">{key}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3 border-t p-4">
        <p className="text-sm">
          Please find the attached CSV with all the records.
        </p>
        <p className="flex items-center gap-2 text-xs font-medium">
          <Paperclip aria-hidden className="text-muted-foreground size-3.5" />
          records.csv
        </p>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <caption className="sr-only">
              The first rows of the attached CSV, as a sample.
            </caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                <TableRow key={vehicle} className="hover:bg-transparent">
                  <TableCell className="py-1.5 text-xs tabular-nums">
                    {vehicle}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{operator}</TableCell>
                  <TableCell className="py-1.5 text-xs">{where}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function AlertEditor({
  saved,
  initialDraft,
  isNew,
  contacts,
  others,
  rules,
  zones,
  zonesLoading,
  navSlot,
  onSave,
  onDelete,
  onClose,
  onManageRecipients,
}: {
  saved?: Alert;
  initialDraft: Alert;
  isNew: boolean;
  contacts: Contact[];
  /** Every other alert, to copy recipients from. */
  others: Alert[];
  rules: { regulation: Regulation; rule: Rule }[];
  zones: Map<string, PickerZone>;
  zonesLoading: boolean;
  navSlot?: React.ReactNode;
  onSave: (alert: Alert) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onManageRecipients: () => void;
}) {
  const [draft, setDraft] = React.useState(initialDraft);
  const [saving, setSaving] = React.useState(false);
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
  // A report rule is set on its regulation. Here it is the same sentence with
  // nothing in it to press.
  const readOnly = draft.kind === "report";

  const update = (next: Partial<Alert>) => setDraft((d) => ({ ...d, ...next }));

  const found = rules.find((r) => r.rule.id === draft.ruleId);
  /** The rule's own zones. An alert narrows to a subset; it adds none. */
  const ruleZones = (found?.rule.zoneIds ?? [])
    .map((id) => zones.get(id))
    .filter((z): z is PickerZone => Boolean(z));

  const chosenContacts = draft.recipientIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is Contact => Boolean(c));
  const recipientNames = [
    ...chosenContacts.map((c) => c.name),
    ...draft.extraEmails,
  ];
  const recipientEmails = [
    ...chosenContacts.map((c) => c.email),
    ...draft.extraEmails,
  ];

  const save = () => {
    setSaving(true);
    // Stands in for a request: long enough to see the pending state, short
    // enough not to be annoying in a demo.
    timer.current = setTimeout(() => {
      setSaving(false);
      onSave(draft);
    }, 500);
  };

  return (
    <div className="flex min-h-full flex-col">
      <ToolBand
        nav={navSlot}
        actions={
          !isNew && !readOnly ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(draft.id)}
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          ) : null
        }
      >
        <Button
          variant="outline"
          size="icon"
          aria-label="Back to alerts"
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        {/* The band's title, editable in place. An h2 like every other tool's,
            so the name of the alert is the name of the screen. */}
        <h2 className="min-w-0 text-base font-semibold tracking-tight">
          {readOnly ? (
            <span className="block truncate">{draft.name}</span>
          ) : (
            <InlineEdit
              variant="title"
              value={draft.name}
              onValueChange={(name) => update({ name })}
              placeholder="Untitled alert"
              label="alert name"
            />
          )}
        </h2>
      </ToolBand>

      <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="space-y-6">
          {readOnly ? (
            <AlertBanner>
              <BellRing />
              <AlertTitle>This rule files a report</AlertTitle>
              <AlertDescription>
                It is switched on and changed on its regulation
                {found ? `, ${found.regulation.name}` : ""}, in Regulations.
              </AlertDescription>
            </AlertBanner>
          ) : null}

          {/* The alert. leading is generous on purpose: every slot is a
              control with its own padding, and a line of them needs the room a
              line of words does not. */}
          <p className="text-muted-foreground text-xl leading-[2.1] text-pretty md:text-2xl md:leading-[1.9]">
            When{" "}
            <Slot
              title="Vehicles"
              label={vehiclePhrase(draft.vehicles)}
              readOnly={readOnly}
              className="w-56"
            >
              {() => (
                <CheckPicker
                  all="Any vehicle"
                  options={VEHICLES}
                  chosen={draft.vehicles}
                  onChange={(vehicles) => update({ vehicles })}
                />
              )}
            </Slot>{" "}
            from{" "}
            <Slot
              title="Operators"
              label={operatorPhrase(draft.operators)}
              readOnly={readOnly}
              className="w-56"
            >
              {() => (
                <CheckPicker
                  all="Any operator"
                  options={OPERATORS.map((o) => ({ value: o, label: o }))}
                  chosen={draft.operators as (typeof OPERATORS)[number][]}
                  onChange={(operators) => update({ operators: [...operators] })}
                />
              )}
            </Slot>{" "}
            stays in{" "}
            <Slot
              title="Zones"
              label={zonePhrase(draft.zoneIds, zones)}
              readOnly={readOnly}
              className="w-72"
            >
              {() =>
                zonesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : ruleZones.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    This rule has no zones yet. Add them to it in Regulations.
                  </p>
                ) : (
                  <div className="-m-1 flex max-h-72 flex-col overflow-y-auto">
                    <PickRow
                      checked={draft.zoneIds.length === 0}
                      onChange={() => update({ zoneIds: [] })}
                      label={`Any of the ${ruleZones.length} zones`}
                    />
                    <div aria-hidden className="bg-border mx-2 my-1 h-px" />
                    {ruleZones.map((zone) => (
                      <PickRow
                        key={zone.id}
                        checked={draft.zoneIds.includes(zone.id)}
                        onChange={() =>
                          update({ zoneIds: toggle(draft.zoneIds, zone.id) })
                        }
                        label={zone.name}
                      >
                        <ZoneThumbnail ring={zone.ring} size={24} />
                      </PickRow>
                    ))}
                  </div>
                )
              }
            </Slot>{" "}
            of{" "}
            <Slot
              title="Rule"
              label={found?.rule.name ?? "a rule"}
              empty={!found}
              readOnly={readOnly}
              className="w-80"
            >
              {(close) => (
                <div className="-m-1 flex flex-col">
                  {rules.map(({ regulation, rule }) => (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => {
                        // A different rule has different zones, so a subset
                        // chosen from the old one cannot be carried over.
                        if (rule.id !== draft.ruleId)
                          update({
                            ruleId: rule.id,
                            regulationId: regulation.id,
                            zoneIds: [],
                          });
                        close();
                      }}
                      className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3"
                    >
                      <RuleTypeIcon type={rule.type} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {rule.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {regulation.name}
                        </span>
                      </span>
                      {rule.id === draft.ruleId ? (
                        <Check aria-hidden className="text-primary size-4" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </Slot>{" "}
            for more than{" "}
            <Slot
              title="Duration"
              label={plural(draft.breachHours, "hour", "hours")}
              readOnly={readOnly}
              className="w-64"
            >
              {() => (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
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
                    {draft.breachHours === 1 ? "hour" : "hours"}
                  </label>
                  <div className="flex gap-1.5">
                    {[1, 2, 4, 8, 24].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={n === draft.breachHours ? "default" : "outline"}
                        className="flex-1 tabular-nums"
                        onClick={() => update({ breachHours: n })}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </Slot>
            , {readOnly ? "file a report and e-mail" : "e-mail"}{" "}
            <Slot
              title="Recipients"
              label={recipientPhrase(recipientNames)}
              empty={recipientNames.length === 0}
              readOnly={readOnly}
              className="w-96"
            >
              {(close) => (
                <RecipientPicker
                  alert={draft}
                  contacts={contacts}
                  others={others}
                  onChange={update}
                  onManage={() => {
                    close();
                    onManageRecipients();
                  }}
                />
              )}
            </Slot>{" "}
            <Slot
              title="Schedule"
              label={schedulePhrase(draft.schedule)}
              readOnly={readOnly}
              className="w-80"
            >
              {() => (
                <SchedulePicker
                  schedule={draft.schedule}
                  onChange={(schedule) => update({ schedule })}
                />
              )}
            </Slot>
            .
          </p>

          {/* The one thing the sentence cannot carry in its own words: what
              "every hour" leaves out, and whose clock the hours are on. */}
          {readOnly ? null : (
            <p className="text-muted-foreground text-sm">
              {draft.schedule.mode === "hourly"
                ? `Only vehicles you have not been told about yet, and never more than ${plural(draft.schedule.dailyCap ?? DEFAULT_DAILY_CAP, "e-mail", "e-mails")} a day.`
                : `One e-mail with the whole list. The hour is ${SCOPE_TIME_ZONE}.`}
            </p>
          )}

          {isNew ? (
            <AskRow
              onGenerate={(i) => setDraft((d) => SUGGESTIONS[i]!.apply(d))}
            />
          ) : null}
        </div>

        {/* Two elements, not one. A sticky GRID ITEM cannot travel: given
            self-start it is only as tall as its content, and left to stretch
            it already fills the row. The item takes the row's height and the
            preview sticks inside it, under the band. */}
        <div>
          <div className="lg:sticky lg:top-20">
            <EmailPreview
              alert={draft}
              recipients={recipientEmails}
              ruleName={found?.rule.name ?? "a rule"}
            />
          </div>
        </div>
      </div>

      {readOnly ? null : (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onDiscard={isNew ? undefined : () => setDraft(saved ?? initialDraft)}
          saveLabel={isNew ? "Create alert" : "Save"}
          message={isNew ? "Not created yet" : "Unsaved changes"}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alerts list                                                                */
/* -------------------------------------------------------------------------- */

type OnFilter = "all" | "on" | "off";

const ON_FILTERS: Record<OnFilter, string> = {
  all: "On and off",
  on: "On",
  off: "Off",
};

function AlertList({
  alerts,
  contacts,
  rules,
  status,
  scope,
  onRetry,
  onCreate,
  onOpen,
  onToggle,
  onDelete,
}: {
  alerts: Alert[];
  contacts: Map<string, Contact>;
  rules: Map<string, { rule: Rule; regulation: Regulation }>;
  status: "ready" | "loading" | "error";
  scope: string;
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
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search alerts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search alerts"
          />
        </InputGroup>
        <Select
          items={ON_FILTERS}
          value={on}
          onValueChange={(v) => setOn((v ?? "all") as OnFilter)}
        >
          <SelectTrigger className="w-36" aria-label="On or off">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ON_FILTERS) as OnFilter[]).map((k) => (
              <SelectItem key={k} value={k}>
                {ON_FILTERS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.length > 0 ? (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
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
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              <X data-icon="inline-start" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <Empty className="min-h-fit flex-auto border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>We could not load your alerts</EmptyTitle>
            <EmptyDescription>
              The alerts are still running. It is this list that failed.
            </EmptyDescription>
          </EmptyHeader>
          {onRetry ? (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw data-icon="inline-start" />
                Try again
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : status === "ready" && visible.length === 0 ? (
        /* Two different empties. "Nothing matches" is a filter problem with a
           way out; "no alerts yet" is a scope nobody has set one up in.
           Showing the wrong one sends the user looking for a filter that is
           not set. */
        <Empty className="min-h-fit flex-auto border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {filtering ? <Search /> : <BellRing />}
            </EmptyMedia>
            <EmptyTitle>
              {filtering ? "No alerts match" : "No alerts yet"}
            </EmptyTitle>
            {filtering ? null : (
              <EmptyDescription>
                An alert watches a no-parking rule and e-mails the people who
                need to know.
              </EmptyDescription>
            )}
          </EmptyHeader>
          <EmptyContent>
            {filtering ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={onCreate}>
                <Plus data-icon="inline-start" />
                Create alert
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <TableCard>
          {/*
           * Fixed layout, with a floor under it.
           *
           * Every row is one line, so every cell truncates -- and a cell can
           * only truncate against a width that is definite, which auto layout
           * never gives it. Fixed layout does: the narrow columns take what
           * their header says and Name takes the rest. The floor keeps that
           * rest from collapsing on a tablet; below it the table scrolls
           * sideways rather than cutting every name to three words.
           */}
          <Table inset className="min-w-[60rem] table-fixed">
            <caption className="sr-only">
              Alerts in {scope}, newest first. Rules that file a report are
              listed but set on their regulation.
            </caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
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
                <TableHead className="w-52">Rule</TableHead>
                <TableHead className="w-44">Sent to</TableHead>
                <TableHead className="w-36">When</TableHead>
                <TableHead className="w-28">Last sent</TableHead>
                <TableHead className="w-20 text-right">On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status === "loading"
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell>
                        <Skeleton className="size-4 rounded-[4px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-5 w-8 rounded-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : visible.map((alert) => {
                    const ticked = selected.includes(alert.id);
                    const found = rules.get(alert.ruleId);
                    const report = alert.kind === "report";
                    return (
                      <TableRow
                        key={alert.id}
                        data-state={ticked ? "selected" : undefined}
                      >
                        <TableCell>
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
                            // Not decoration: Tab scrolls a focused row flush
                            // with the workspace's edge, and the ring paints
                            // outside the box, so it would be cut.
                            className="scroll-my-1"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpen(alert.id)}
                              data-slot="alert-open-link"
                              className="hover:text-primary focus-visible:ring-ring min-w-0 scroll-m-1 truncate rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {alert.name}
                            </button>
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
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="flex min-w-0 items-center gap-2"
                            title={
                              found
                                ? `${found.regulation.name} · ${found.rule.name}`
                                : undefined
                            }
                          >
                            {found ? (
                              <RuleTypeIcon type={found.rule.type} size="sm" />
                            ) : null}
                            <span className="text-muted-foreground truncate">
                              {found?.rule.name ?? "Deleted rule"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="block truncate">{sentTo(alert)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="block truncate">
                            {scheduleLabel(alert.schedule)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatSent(alert.lastSentAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end">
                            {report ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span
                                      tabIndex={0}
                                      className="focus-visible:ring-ring inline-flex scroll-m-1 rounded focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                      <StatusBadge tone="info">On</StatusBadge>
                                    </span>
                                  }
                                />
                                <TooltipContent>
                                  Switched on its regulation
                                  {found ? `, ${found.regulation.name}` : ""}
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
                  })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {status === "ready" && visible.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {visible.length === alerts.length
            ? plural(alerts.length, "alert", "alerts")
            : `${visible.length} of ${plural(alerts.length, "alert", "alerts")}`}{" "}
          · hours are {SCOPE_TIME_ZONE}
        </p>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipients                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The contacts list, read by who gets what.
 *
 * This view exists for one job Katell named as the painful one: people change
 * all the time, mostly at the operators, and today a swap is done one alert at
 * a time in Streamlit. So the row action is **Replace**, which moves someone
 * out of every alert and someone else in, in one go -- the thing CS actually
 * needs -- and Remove is the destructive sibling rather than the main verb.
 *
 * It is the scope's report contacts, the same list Settings › Report contacts
 * edits and the report rules read. Nothing here is a second copy of it.
 */
function RecipientList({
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
        !q ||
        `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search recipients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search recipients by name, e-mail or operator"
          />
        </InputGroup>
      </div>

      {visible.length === 0 ? (
        <Empty className="min-h-fit flex-auto border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {query ? <Search /> : <Users />}
            </EmptyMedia>
            <EmptyTitle>
              {query ? "Nobody matches" : "No contacts yet"}
            </EmptyTitle>
          </EmptyHeader>
          {query ? (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <TableCard>
          <Table inset>
            <caption className="sr-only">
              Everyone on the scope&rsquo;s report contacts list, and the
              alerts they are on.
            </caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recipient</TableHead>
                <TableHead>Gets these alerts</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((contact) => {
                const theirs = alertsFor(contact.id);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="max-w-64">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <ContactMark contact={contact} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {contact.name}
                            </span>
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
                    <TableCell className="whitespace-normal">
                      {theirs.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {theirs.map((alert) => (
                            <Button
                              key={alert.id}
                              type="button"
                              variant="outline"
                              size="xs"
                              className="max-w-56 scroll-m-1 font-normal"
                              onClick={() => onOpenAlert(alert.id)}
                            >
                              <span className="truncate">{alert.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <IconAction
                          label={`Replace ${contact.name} everywhere`}
                          onClick={() => setReplacing(contact)}
                        >
                          <UserCog />
                        </IconAction>
                        <IconAction
                          label={`Remove ${contact.name} from every alert`}
                          onClick={() => onRemove(contact.id)}
                          className="hover:text-destructive"
                        >
                          <Trash2 />
                        </IconAction>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

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
    </>
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
            Whoever you pick takes their place on{" "}
            {plural(count, "alert", "alerts")}.
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Replacement"
          className="-mx-1 flex max-h-72 flex-col overflow-auto"
        >
          {others.map((c) => (
            <label
              key={c.id}
              className="hover:bg-muted has-[:checked]:bg-primary/10 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5"
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
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!picked} onClick={() => picked && onReplace(picked)}>
            Replace
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
  scope = "Munich",
  navSlot,
  onRetry,
  onSave,
}: {
  className?: string;
  alerts?: Alert[];
  contacts?: Contact[];
  regulations?: Regulation[];
  status?: "ready" | "loading" | "error";
  /** Names the scope for assistive tech. The host's shell says it on screen. */
  scope?: string;
  /**
   * The host shell's own control -- hiding its navigation. Drawn first in the
   * band of every view, so it is in one place whatever the tool is showing.
   * Built in from the start, where the older workspaces had it added to their
   * vendored copies afterwards.
   */
  navSlot?: React.ReactNode;
  onRetry?: () => void;
  /** Called with the saved alert, after the workspace has kept it. */
  onSave?: (alert: Alert) => void;
}) {
  const [alerts, setAlerts] = React.useState(initialAlerts);
  const [contacts, setContacts] = React.useState(initialContacts);
  const [section, setSection] = React.useState<Section>("alerts");
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
    setView({ kind: "edit", id, isNew: true });
  };

  const open = (id: string) => {
    setNotice(null);
    setView({ kind: "edit", id, isNew: false });
  };

  const remove = (ids: string[]) => {
    setAlerts((all) => all.filter((a) => !ids.includes(a.id)));
    setNotice(
      ids.length === 1 ? "Alert deleted" : `${ids.length} alerts deleted`,
    );
  };

  const saved =
    view.kind === "edit" ? alerts.find((a) => a.id === view.id) : undefined;
  const editing = view.kind === "edit" ? (drafts[view.id] ?? saved) : undefined;

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
              // A different alert is a different sentence: nothing chosen in
              // one may leak into the next.
              key={view.id}
              saved={saved}
              initialDraft={editing}
              isNew={view.isNew}
              contacts={contacts}
              others={alerts.filter(
                (a) => a.id !== view.id && a.kind === "alert",
              )}
              rules={rules}
              zones={zoneIndex}
              zonesLoading={zonesLoading}
              navSlot={navSlot}
              onManageRecipients={() => {
                if (view.isNew) setDrafts(({ [view.id]: _, ...rest }) => rest);
                setView({ kind: "list" });
                setSection("recipients");
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
                setSection("alerts");
                setView({ kind: "list" });
                onSave?.(named);
              }}
              onClose={() => {
                if (view.isNew) setDrafts(({ [view.id]: _, ...rest }) => rest);
                setView({ kind: "list" });
              }}
            />
          ) : (
            <>
              <ToolBand nav={navSlot} title="Alerts" />
              <div className="mx-auto flex min-h-[calc(100%-3.5rem)] w-full max-w-6xl flex-col p-4 md:p-6">
                <Empty className="min-h-fit flex-auto border">
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
            </>
          )
        ) : (
          <>
            {/* The tool's name, then what you can do to it. The two lists are
                views of the tool, so their tabs come under it -- see
                `SectionTabs`. */}
            <ToolBand
              nav={navSlot}
              title="Alerts"
              actions={
                <Button onClick={create}>
                  <Plus data-icon="inline-start" />
                  Create alert
                </Button>
              }
            />
            <div className="mx-auto flex min-h-[calc(100%-3.5rem)] w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
              {notice ? (
                <AlertBanner>
                  <Check />
                  <AlertTitle>{notice}</AlertTitle>
                  <AlertAction>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setNotice(null)}
                    >
                      Dismiss
                    </Button>
                  </AlertAction>
                </AlertBanner>
              ) : null}

              <SectionTabs
                value={section}
                onChange={setSection}
                alerts={alerts.length}
                recipients={contacts.length}
              />

              {section === "alerts" ? (
                <AlertList
                  alerts={alerts}
                  contacts={contactIndex}
                  rules={ruleIndex}
                  status={status}
                  scope={scope}
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
              ) : (
                <RecipientList
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
                    const gone = contactIndex.get(id);
                    setAlerts((all) =>
                      all.map((a) => ({
                        ...a,
                        recipientIds: a.recipientIds.filter((r) => r !== id),
                      })),
                    );
                    setContacts((all) => all.filter((c) => c.id !== id));
                    setNotice(`${gone?.name ?? "Contact"} removed`);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AlertsWorkspace;
