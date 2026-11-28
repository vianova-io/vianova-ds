"use client";

/**
 * The Alerts page.
 *
 * One page per scope, beside Regulations. An alert watches something in the
 * scope's data and sends an e-mail when it happens.
 *
 * The page follows Katell's prototype of 26 Nov screen for screen: the list
 * and Recipients, a Create dialog that asks first and suggests on the same
 * screen, and an editor with the settings in a panel on the left and the
 * e-mail on the right. What this file adds is the design system's parts in
 * place of the prototype's own, and the decisions the prototype left open.
 *
 * Decisions behind the shape, from the call of 26 Nov and #munich-alerts:
 *
 * - **Ask and suggestions share one screen.** VIP's GenAI flow asks on one
 *   page and suggests on another; the call named that as the thing to fix. A
 *   suggestion puts its words in the box rather than acting behind your back,
 *   so Generate is always the step that makes the draft. "Start from scratch"
 *   is beside it for people who would rather set the numbers themselves.
 * - **The summary is one sentence, and it is the alert.** Every field in the
 *   panel changes a word of it, so what the page promises is read back in
 *   plain language before anything is saved.
 * - **Zones use the Regulations panel as it is.** Library, Draw and Import,
 *   the same three tabs in the same place, so the two pages feel the same and
 *   a zone drawn here lands in the one library.
 * - **Hourly is said as hourly.** The data is checked once an hour, so "as
 *   soon as it happens" would not be true. Jimmy's wording of 19 Nov, kept.
 * - **A repeat is set the way a calendar event is.** Daily, weekly or monthly
 *   from a short list, and a "Custom" dialog for every-N, several weekdays
 *   and an end -- Gmail's recurrence, which Katell named as the benchmark.
 * - **Recipients are one list.** A name from it, an operator's address, a
 *   pasted list or another alert's people. Swapping someone is changing their
 *   address once, in Recipients, and every alert follows.
 * - **The e-mail is the one we already send.** Not redesigned here. The
 *   preview is a frame around it, with how many vehicles it would list now.
 * - **A no-parking alert starts on its rule.** The "Alerts" switch on a
 *   no-parking rule, in Regulations, makes a row here marked Reported device.
 *   What it watches stays the rule's; who hears about it and whether it is on
 *   are handled here, like any other alert.
 *
 * Deliberately NOT here:
 *
 * - **No "regulation broken" or "data stopped" in What to watch.** The first
 *   is the switch on the rule; the second is already the feed status e-mails.
 *   Asking for either says where it lives instead of drafting something.
 * - **No type icons in the list.** Katell asked; the name already says what
 *   an alert watches, and a sixth column of marks would only be learned twice.
 * - **No redesign of the e-mail.** See above.
 * - **Nothing only the backend can be the truth about:** the sentence a real
 *   model would draft, how many vehicles match right now, whether an e-mail
 *   was delivered. `draftFromSentence` and `estimateMatches` stand in for the
 *   first two and say so.
 */

import * as React from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Info,
  Lightbulb,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  Alert as AlertBanner,
  AlertAction,
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/registry/vianova/ui/radio-group";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import { Switch } from "@/registry/vianova/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import { Textarea } from "@/registry/vianova/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";
import { TooltipProvider } from "@/registry/vianova/ui/tooltip";
import { ConfirmDialog } from "@/registry/vianova/patterns/confirm-dialog";
import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";
import { PersonCell } from "@/registry/vianova/patterns/person-cell";
import { RelativeTime } from "@/registry/vianova/patterns/relative-time";
import { SelectionBar } from "@/registry/vianova/patterns/selection-bar";
import {
  TableSettings,
  useTableView,
  type ViewColumn,
} from "@/registry/vianova/patterns/table-settings";
import { StatusBadge } from "@/registry/vianova/patterns/status-badge";
import { TableCard } from "@/registry/vianova/patterns/table-card";
import { TagInput } from "@/registry/vianova/patterns/tag-input";
import { ToolBand } from "@/registry/vianova/patterns/tool-band";
import { RuleTypeIcon } from "@/registry/vianova/product/rule-type-icon";
import { ZoneDrawMap } from "@/registry/vianova/product/zone-draw-map";
import {
  ZonePickerPanel,
  ZoneThumbnail,
  type PickerZone,
  type ZoneDrawTool,
} from "@/registry/vianova/product/zone-picker";
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
 * When to send.
 *
 * `hourly` is as close to real time as the platform gets: the data is checked
 * once an hour and each vehicle is sent once, so the label says the hour out
 * loud. `repeat` is one e-mail with the whole list, the shape clients already
 * receive today.
 */
export type SendMode = "hourly" | "repeat";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type RepeatUnit = "day" | "week" | "month";

/** How a repeat stops. Gmail's three: never, on a date, after a number. */
export type ScheduleEnd =
  | { kind: "never" }
  | { kind: "on"; date: string }
  | { kind: "after"; count: number };

export type AlertSchedule = {
  mode: SendMode;
  /**
   * Hourly only: stop after this many e-mails in one day, resuming the next.
   * Absent means no cap, which is how a new alert starts in Katell's
   * prototype: the cap is a tick box, and it is not ticked.
   */
  dailyCap?: number;
  /** Repeat only. Every `every` days, weeks or months. Defaults to 1. */
  every?: number;
  unit?: RepeatUnit;
  /** Weekly: the days it goes out on. Empty reads as Monday. */
  weekdays?: Weekday[];
  /** Monthly: the day of the month, 1 to 28 so every month has it. */
  monthDay?: number;
  /** HH:mm, read in the scope's time zone. Repeat only. */
  hour?: string;
  ends?: ScheduleEnd;
};

/** The number the cap's field starts at once its box is ticked. Katell's 5. */
const DEFAULT_DAILY_CAP = 5;

export type RecipientKind = "member" | "operator";

/**
 * One person on the scope's report contacts list, from Settings › Report
 * contacts. The same list serves the report rules and these alerts, which is
 * the whole point of it.
 */
export type Contact = {
  id: string;
  /**
   * May be empty. An operator's address is often a shared mailbox with no
   * person behind it, and the list shows the address where a name would be.
   */
  name: string;
  email: string;
  kind: RecipientKind;
  /** Operator contacts only: whose fleet they answer for. */
  operator?: string;
  /** Invited, has not signed in yet. Their read-only account is pending. */
  pending?: boolean;
  /**
   * A VIP user of the organisation. Their name and e-mail are the Members
   * page's to change, so here they can only be given alerts.
   */
  account?: boolean;
  /** Put on the list by Vianova when the scope was set up. */
  managed?: boolean;
};

/**
 * What an alert watches.
 *
 * The five Jimmy confirmed run today (19 Nov), each one number against one
 * measure, plus `no_parking`: a no-parking rule broken for some hours. That
 * last one is never picked here. It is made by the Alerts switch on the rule,
 * in Regulations, and arrives as a `report` row.
 */
export type WatchType =
  | "battery"
  | "idle"
  | "available"
  | "cap"
  | "parked"
  | "no_parking";

/**
 * `report` rows come from a no-parking rule's Alerts switch. Besides the
 * e-mail they file a reported device, with its own lifecycle, which is why
 * the list marks them. What they watch is the rule's and is changed there;
 * their recipients and their switch are handled on this page.
 */
export type AlertKind = "alert" | "report";

export type Alert = {
  id: string;
  kind: AlertKind;
  name: string;
  watch: WatchType;
  /** The number the watch compares against: a percentage, hours or vehicles. */
  threshold: number;
  /** `no_parking` only: the rule watched, and the regulation it belongs to. */
  regulationId?: string;
  ruleId?: string;
  /** Empty means the whole scope. */
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
  /** E-mails sent in the last seven days. Shown beside the switch. */
  sentLastWeek?: number;
  on: boolean;
};

export const SAMPLE_CONTACTS: Contact[] = [
  {
    id: "c-anja",
    name: "Anja Reiter",
    email: "anja.reiter@muenchen.de",
    kind: "member",
    account: true,
  },
  {
    id: "c-thomas",
    name: "Thomas Brandl",
    email: "thomas.brandl@muenchen.de",
    kind: "member",
    account: true,
  },
  {
    id: "c-you",
    name: "You",
    email: "you@muenchen.de",
    kind: "member",
    account: true,
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
    name: "",
    email: "munich-ops@bolt.eu",
    kind: "operator",
    operator: "Bolt",
    managed: true,
  },
  {
    id: "c-voi",
    name: "",
    email: "munich@voi.com",
    kind: "operator",
    operator: "Voi",
    managed: true,
  },
  {
    id: "c-lime",
    name: "",
    email: "muc-ops@li.me",
    kind: "operator",
    operator: "Lime",
    managed: true,
  },
];

export const SAMPLE_ALERTS: Alert[] = [
  {
    id: "al-battery",
    kind: "alert",
    name: "Low battery scooters",
    watch: "battery",
    threshold: 15,
    zoneIds: [],
    vehicles: ["scooter"],
    operators: [],
    schedule: { mode: "hourly" },
    recipientIds: ["c-anja", "c-thomas"],
    extraEmails: [],
    createdBy: "Anja Reiter",
    createdAt: "2026-11-12T10:12:00Z",
    lastSentAt: "2026-11-27T08:00:00Z",
    sentLastWeek: 37,
    on: true,
  },
  {
    id: "al-idle",
    kind: "alert",
    name: "Idle for 72 hours",
    watch: "idle",
    threshold: 72,
    zoneIds: [],
    vehicles: [],
    operators: [],
    schedule: { mode: "repeat", unit: "day", every: 1, hour: "08:00" },
    recipientIds: ["c-kvr", "c-anja", "c-thomas", "c-you"],
    extraEmails: ["verkehr@landkreis.de"],
    createdBy: "Thomas Brandl",
    createdAt: "2026-11-14T14:30:00Z",
    lastSentAt: "2026-11-27T07:00:00Z",
    sentLastWeek: 7,
    on: true,
  },
  {
    id: "al-council",
    kind: "alert",
    name: "Monday summary for the council",
    watch: "cap",
    threshold: 2000,
    zoneIds: [],
    vehicles: [],
    operators: ["Bolt", "Voi"],
    schedule: {
      mode: "repeat",
      unit: "week",
      every: 1,
      weekdays: ["mon"],
      hour: "09:00",
    },
    recipientIds: ["c-you", "c-kvr"],
    extraEmails: [],
    createdBy: "You",
    mine: true,
    createdAt: "2026-11-18T09:05:00Z",
    lastSentAt: "2026-11-23T08:00:00Z",
    sentLastWeek: 1,
    on: true,
  },
  {
    id: "al-bikes",
    kind: "alert",
    name: "Too few bikes",
    watch: "available",
    threshold: 5,
    zoneIds: [],
    vehicles: ["bike"],
    operators: [],
    schedule: { mode: "hourly", dailyCap: 5 },
    recipientIds: ["c-anja", "c-bolt"],
    extraEmails: [],
    createdBy: "Anja Reiter",
    createdAt: "2026-11-17T11:45:00Z",
    on: false,
  },
  {
    id: "al-parked",
    kind: "alert",
    name: "Parked too long",
    watch: "parked",
    threshold: 24,
    zoneIds: [],
    vehicles: [],
    operators: [],
    schedule: { mode: "hourly" },
    recipientIds: ["c-kvr", "c-lime", "c-bolt"],
    extraEmails: [],
    createdBy: "Vianova",
    createdAt: "2026-10-30T11:45:00Z",
    lastSentAt: "2026-11-26T16:42:00Z",
    sentLastWeek: 9,
    on: true,
  },
  /*
   * The one made by a rule. It reads like the others, carries a badge, and
   * opens with the rule's part of it fixed: see `AlertKind`.
   */
  {
    id: "al-report-historic",
    kind: "report",
    name: "No parking · Historic centre",
    watch: "no_parking",
    threshold: 2,
    regulationId: "reg-no-parking-historic",
    ruleId: "rule-npk",
    zoneIds: [],
    vehicles: [],
    operators: [],
    schedule: { mode: "hourly" },
    recipientIds: ["c-anja", "c-bolt", "c-voi", "c-lime"],
    extraEmails: [],
    createdBy: "Vianova",
    createdAt: "2026-11-23T13:00:00Z",
    lastSentAt: "2026-11-27T08:00:00Z",
    sentLastWeek: 12,
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

const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

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

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "a", "a or b", "a, b or c" -- and the same with "and". */
const listOf = (items: string[], joiner: "or" | "and") =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${joiner} ${items[items.length - 1]}`;

const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Everything the page needs to know about one thing it can watch.
 *
 * Kept in the frontend on Jimmy's advice (19 Nov): the stream metadata gives
 * a field its unit and label, but not a starting value, not "below" or "more
 * than", and nothing at all for computed measures like idle time.
 */
type WatchSpec = {
  /** In the What to watch list. */
  label: string;
  /** Over the number: "Battery below". */
  compare: string;
  unit: string;
  initial: number;
  step: number;
  /** The e-mail table's third column. */
  column: string;
  /** Where the numbers come from, said under the picker. */
  source: string;
  /** What "right now" counts: vehicles, or operators for a fleet cap. */
  counts: "vehicle" | "operator";
};

const WATCH: Record<WatchType, WatchSpec> = {
  battery: {
    label: "Low battery",
    compare: "Battery below",
    unit: "%",
    initial: 20,
    step: 5,
    column: "Battery",
    source: "live vehicle positions",
    counts: "vehicle",
  },
  idle: {
    label: "Idle vehicles",
    compare: "Not moved for more than",
    unit: "hours",
    initial: 72,
    step: 12,
    column: "Idle",
    source: "live vehicle positions",
    counts: "vehicle",
  },
  available: {
    label: "Too few available",
    compare: "Fewer available than",
    unit: "vehicles",
    initial: 5,
    step: 5,
    column: "Available",
    source: "fleet availability, every hour",
    counts: "vehicle",
  },
  cap: {
    label: "Above the cap",
    compare: "More vehicles than",
    unit: "vehicles",
    initial: 2000,
    step: 100,
    column: "Fleet",
    source: "fleet availability, every hour",
    counts: "operator",
  },
  parked: {
    label: "Parked too long",
    compare: "Parked longer than",
    unit: "hours",
    initial: 24,
    step: 1,
    column: "Parked",
    source: "live vehicle positions",
    counts: "vehicle",
  },
  no_parking: {
    label: "No-parking rule broken",
    compare: "In the zone for more than",
    unit: "hours",
    initial: 2,
    step: 1,
    column: "In the zone",
    source: "your regulations and live vehicle positions",
    counts: "vehicle",
  },
};

/** What can be picked here. `no_parking` is made on its rule; see `WatchType`. */
export const PICKABLE_WATCHES: WatchType[] = [
  "battery",
  "idle",
  "available",
  "cap",
  "parked",
];

/** "scooters", "scooters or mopeds", or just "vehicles". */
const vehicleWords = (vehicles: Vehicle[]) =>
  vehicles.length === 0
    ? "vehicles"
    : listOf(
        vehicles.map(
          (v) =>
            `${VEHICLES.find((x) => x.value === v)?.label.toLowerCase() ?? v}s`,
        ),
        "or",
      );

/** The repeat as words: "every Monday at 09:00", "every 2 weeks on …". */
function repeatPhrase(schedule: AlertSchedule) {
  const at = schedule.hour ?? "08:00";
  const every = Math.max(1, schedule.every ?? 1);
  const unit = schedule.unit ?? "day";
  let text: string;
  if (unit === "week") {
    const chosen = schedule.weekdays?.length ? schedule.weekdays : ["mon" as const];
    const days = listOf(
      WEEK.filter((d) => chosen.includes(d)).map((d) => WEEKDAYS[d]),
      "and",
    );
    text =
      every === 1 ? `every ${days} at ${at}` : `every ${every} weeks on ${days} at ${at}`;
  } else if (unit === "month") {
    const day = ordinal(schedule.monthDay ?? 1);
    text =
      every === 1
        ? `on the ${day} of each month at ${at}`
        : `every ${every} months on the ${day} at ${at}`;
  } else {
    text = every === 1 ? `every day at ${at}` : `every ${every} days at ${at}`;
  }
  const ends = schedule.ends;
  if (ends?.kind === "on" && ends.date) {
    const date = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${ends.date}T00:00:00Z`));
    text += `, until ${date}`;
  } else if (ends?.kind === "after") {
    text += `, ${plural(ends.count, "time", "times")}`;
  }
  return text;
}

/**
 * The schedule as the end of the sentence.
 *
 * "As soon as it happens" is not among them, because it would not be true: the
 * platform checks once an hour. Jimmy's wording of 19 Nov, kept.
 */
function schedulePhrase(schedule: AlertSchedule) {
  if (schedule.mode === "hourly")
    return `every hour, new vehicles only${
      schedule.dailyCap
        ? `, at most ${plural(schedule.dailyCap, "e-mail", "e-mails")} a day`
        : ""
    }`;
  return `${repeatPhrase(schedule)} ${SCOPE_TIME_ZONE}, with the full list`;
}

/** The schedule as a section's summary: short, and never a sentence. */
export function scheduleLabel(schedule: AlertSchedule) {
  if (schedule.mode === "hourly")
    return `Hourly, new vehicles only${schedule.dailyCap ? `, max ${schedule.dailyCap} a day` : ""}`;
  return `${capitalise(repeatPhrase(schedule))}, ${SCOPE_TIME_ZONE}`;
}

type RepeatPreset = "daily" | "weekly" | "monthly" | "custom";

/** Which line of the short list a repeat is, or `custom` when it is none. */
function repeatPreset(schedule: AlertSchedule): RepeatPreset {
  if ((schedule.every ?? 1) !== 1) return "custom";
  if (schedule.ends && schedule.ends.kind !== "never") return "custom";
  const unit = schedule.unit ?? "day";
  if (unit === "day") return "daily";
  if (unit === "week") return "weekly";
  return (schedule.monthDay ?? 1) === 1 ? "monthly" : "custom";
}

const zoneWords = (ids: string[], zones: Map<string, PickerZone>) =>
  ids.length === 0
    ? "the whole scope"
    : ids.length <= 2
      ? listOf(
          ids.map((id) => zones.get(id)?.name ?? "a zone"),
          "and",
        )
      : plural(ids.length, "zone", "zones");

/**
 * The alert as one sentence.
 *
 * Built from the same fields the panel edits, so it can never say something
 * the settings do not. `ruleName` is the no-parking rule's, for the one kind
 * that has a rule.
 */
function summarySentence(
  alert: Alert,
  zones: Map<string, PickerZone>,
  ruleName?: string,
) {
  const who = alert.operators.length
    ? `${listOf(alert.operators, "or")} `
    : "";
  const v = vehicleWords(alert.vehicles);
  const n = alert.threshold;
  const when = schedulePhrase(alert.schedule);
  if (alert.watch === "no_parking")
    return `${who}${v} break “${ruleName ?? "a no-parking rule"}” for more than ${plural(n, "hour", "hours")}, ${when}`;
  const core: Record<Exclude<WatchType, "no_parking">, string> = {
    battery: `${who}${v} fall below ${n} % battery`,
    idle: `${who}${v} have not moved for more than ${plural(n, "hour", "hours")}`,
    available: `fewer than ${n} ${who}${v} are available`,
    cap: `${who ? `${who.trim()}'s ` : "an operator's "}fleet goes above ${n.toLocaleString("en-GB")} ${v}`,
    parked: `${who}${v} stay parked more than ${plural(n, "hour", "hours")}`,
  };
  return `${core[alert.watch]} in ${zoneWords(alert.zoneIds, zones)}, ${when}`;
}

/**
 * A name for an alert nobody has named yet.
 *
 * It follows the settings until the title is typed in, after which it is
 * left alone. Most alerts are named by what they watch, so most never need
 * the field at all.
 */
function autoName(alert: Alert, zones: Map<string, PickerZone>) {
  const v = alert.vehicles.length ? `${vehicleWords(alert.vehicles)} ` : "";
  const n = alert.threshold;
  const op = alert.operators.length === 1 ? alert.operators[0]! : "Fleet";
  const base: Record<WatchType, string> = {
    battery: `Low battery ${v}`,
    idle: `Idle ${v}for ${n} h`,
    available: `Too few ${v || "vehicles"}`,
    cap: `${op} above ${n.toLocaleString("en-GB")}`,
    parked: `${v}parked over ${n} h`,
    no_parking: "No-parking rule broken",
  };
  const where =
    alert.zoneIds.length === 1
      ? ` in ${zones.get(alert.zoneIds[0]!)?.name ?? "a zone"}`
      : "";
  return capitalise(`${base[alert.watch]}${where}`.replace(/\s+/g, " ").trim());
}

/**
 * How many vehicles would set the alert off right now.
 *
 * A STAND-IN. The alert API already has a preview count (Paz's notifications
 * app calls it), and this is where it goes. Until then the number only has to
 * move the right way when a setting changes, so the page can be read as it
 * will work.
 */
function estimateMatches(alert: Alert) {
  if (alert.watch === "cap") return alert.threshold < 1900 ? 1 : 0;
  const base = { battery: 37, idle: 12, available: 2, parked: 9, no_parking: 9 }[
    alert.watch
  ];
  const initial = WATCH[alert.watch].initial;
  const rising = alert.watch === "battery" || alert.watch === "available";
  let n =
    base *
    (rising
      ? alert.threshold / initial
      : initial / Math.max(alert.threshold, 0.1));
  if (alert.vehicles.length) n *= 0.55;
  if (alert.operators.length) n *= 0.4;
  if (alert.zoneIds.length) n *= Math.min(1, 0.25 * alert.zoneIds.length);
  return Math.max(0, Math.round(n));
}

/**
 * The IANA name behind "Munich time". Every date on this page is formatted in
 * it rather than in the reader's zone, for the reason the hours are: an alert
 * sent at 09:00 in Munich was sent at 09:00, whoever is looking and from where.
 * It also makes the server and the browser print the same string.
 */
const SCOPE_TZ = "Europe/Berlin";


/** "Anja Reiter" -> "AR", "Vianova" -> "V". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

/** What someone is called: their name, or their address when they have none. */
const contactLabel = (c: Contact) => c.name || c.email;

/**
 * The same, for a place with no badge beside it to say whose address it is:
 * "Bolt · munich-ops@bolt.eu" where the list has the address and a Bolt chip.
 */
const contactLongLabel = (c: Contact) =>
  !c.name && c.operator ? `${c.operator} · ${c.email}` : contactLabel(c);

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
        {initials(contact.name || contact.operator || contact.email)}
      </AvatarFallback>
    </Avatar>
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
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The suggestions, written the way a city manager talks.
 *
 * Katell's five. Each needs a kind of data, and a scope that lacks it never
 * sees the suggestion (`watchable`), so nobody is offered an alert that cannot
 * run. `patch` is what the sentence means, so pressing a suggestion and then
 * Generate does not depend on the stand-in parser reading it back correctly.
 */
const SUGGESTIONS: { text: string; name: string; patch: Partial<Alert> }[] = [
  {
    text: "Tell me when scooters fall below 15 % battery, anywhere in the scope.",
    name: "Low battery scooters",
    patch: { watch: "battery", threshold: 15, vehicles: ["scooter"] },
  },
  {
    text: "Tell me when vehicles have not moved for 72 hours. Send me one summary each morning.",
    name: "Vehicles idle for days",
    patch: {
      watch: "idle",
      threshold: 72,
      schedule: { mode: "repeat", unit: "day", every: 1, hour: "08:00" },
    },
  },
  {
    text: "Tell me when there are fewer than 5 bikes available.",
    name: "Too few bikes",
    patch: { watch: "available", threshold: 5, vehicles: ["bike"] },
  },
  {
    text: "Tell me when an operator puts more than 2,000 vehicles on the street.",
    name: "An operator above its cap",
    patch: { watch: "cap", threshold: 2000 },
  },
  {
    text: "Tell me when vehicles stay parked more than 24 hours.",
    name: "Vehicles parked too long",
    patch: { watch: "parked", threshold: 24 },
  },
];

/**
 * A sentence, read into the settings it describes.
 *
 * A STAND-IN for the model behind VIA-1071. It recognises the words the
 * suggestions use and nothing cleverer, which is enough to show the flow: you
 * say it, you get a draft, you check the draft. The two things people will
 * ask for that do not live here get an answer saying where they do live,
 * rather than a draft of something else.
 */
function draftFromSentence(
  text: string,
  zones: PickerZone[],
): { patch: Partial<Alert> } | { problem: string } {
  const t = text.toLowerCase();
  if (/no.?park|regulation|break/.test(t))
    return {
      problem:
        "No-parking alerts are switched on from the rule itself, in Regulations.",
    };
  const watch: WatchType | null = /batter/.test(t)
    ? "battery"
    : /idle|not moved|hasn.t moved|haven.t moved/.test(t)
      ? "idle"
      : /few|available/.test(t)
        ? "available"
        : /\bcap\b|above|on the street/.test(t)
          ? "cap"
          : /park/.test(t)
            ? "parked"
            : null;
  if (!watch)
    return {
      problem: /data|feed|silent/.test(t)
        ? "Operator feed problems already come in the feed status e-mails."
        : "Name what to watch: battery, idle vehicles, available vehicles, the fleet cap or vehicles parked too long.",
    };

  const patch: Partial<Alert> = { watch, threshold: WATCH[watch].initial };
  const number = /\d[\d.,]*/.exec(t)?.[0].replace(/[.,]$/, "");
  if (number) {
    // "2,000" is two thousand; "2,5" is two and a half.
    const value = /^\d{1,3}([.,]\d{3})+$/.test(number)
      ? Number(number.replace(/[.,]/g, ""))
      : Number(number.replace(",", "."));
    if (Number.isFinite(value)) patch.threshold = value;
  }
  patch.vehicles = VEHICLES.filter((v) =>
    t.includes(v.label.toLowerCase()),
  ).map((v) => v.value);
  patch.operators = OPERATORS.filter((o) => t.includes(o.toLowerCase()));
  patch.zoneIds = zones
    .filter((z) => z.name.length > 3 && t.includes(z.name.toLowerCase()))
    .map((z) => z.id);
  if (/monthly|every month|once a month/.test(t))
    patch.schedule = { mode: "repeat", unit: "month", every: 1, monthDay: 1, hour: "08:00" };
  else if (/weekly|every week|once a week/.test(t))
    patch.schedule = { mode: "repeat", unit: "week", every: 1, weekdays: ["mon"], hour: "08:00" };
  else if (/daily|every day|once a day|each morning|every morning|summary/.test(t))
    patch.schedule = { mode: "repeat", unit: "day", every: 1, hour: "08:00" };
  return { patch };
}

/**
 * Create alert: say it, or pick a sentence someone else already said.
 *
 * One dialog, so asking and the suggestions are on the same screen. Pressing
 * a suggestion writes it into the box and stops there: the words are yours to
 * change before Generate, and nothing is drafted until you press it.
 */
function CreateDialog({
  open,
  onOpenChange,
  watchable,
  zones,
  onDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watchable: WatchType[];
  zones: PickerZone[];
  /** `name` is set when the draft came from a suggestion that has one. */
  onDraft: (patch: Partial<Alert>, from: "sentence" | "scratch", name?: string) => void;
}) {
  const [text, setText] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [reading, setReading] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const box = React.useRef<HTMLTextAreaElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const offered = SUGGESTIONS.filter(
    (s) => s.patch.watch && watchable.includes(s.patch.watch),
  );
  const shown = offered.filter((s) =>
    s.text.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const generate = () => {
    const said = text.trim();
    if (!said || reading) return;
    setProblem(null);
    setReading(true);
    // Stands in for the request: long enough to see that something is being
    // read, short enough not to be annoying in a demo.
    timer.current = setTimeout(() => {
      setReading(false);
      const suggestion = offered.find((s) => s.text === said);
      if (suggestion) {
        onDraft(suggestion.patch, "sentence", suggestion.name);
        return;
      }
      const read = draftFromSentence(said, zones);
      if ("problem" in read) setProblem(read.problem);
      else if (read.patch.watch && !watchable.includes(read.patch.watch))
        setProblem("This scope has no data for that yet.");
      else onDraft(read.patch, "sentence");
    }, 750);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create alert</DialogTitle>
          <DialogDescription>
            Say what you want to hear about. You can change everything next.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <div className="relative">
            <Textarea
              ref={box}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  generate();
                }
              }}
              aria-label="Describe the alert"
              aria-invalid={problem ? true : undefined}
              placeholder="e.g. Tell me when Bolt scooters fall below 15 % battery."
              // Room under the words for the button, which sits inside the
              // box so the two read as one control.
              className="min-h-28 resize-none pb-14"
            />
            <Button
              type="submit"
              disabled={!text.trim() || reading}
              className="absolute right-2 bottom-2"
            >
              <Sparkles data-icon="inline-start" />
              {reading ? "Generating…" : "Generate"}
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="text-destructive-ink text-sm">
              {problem}
            </p>
          ) : null}
        </form>

        {offered.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb aria-hidden className="text-muted-foreground size-4" />
              Suggestions
            </p>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search suggestions"
                aria-label="Search suggestions"
              />
            </InputGroup>
            <ul className="flex flex-col gap-2">
              {shown.map((s) => (
                <li key={s.text}>
                  <button
                    type="button"
                    data-slot="alert-suggestion"
                    onClick={() => {
                      setText(s.text);
                      setProblem(null);
                      box.current?.focus();
                    }}
                    className="hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 w-full scroll-m-1 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-3"
                  >
                    <span className="min-w-0 flex-1">{s.text}</span>
                    <ChevronRight
                      aria-hidden
                      className="text-muted-foreground size-4 shrink-0"
                    />
                  </button>
                </li>
              ))}
            </ul>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No suggestion matches.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onDraft({}, "scratch")}
          >
            Start from scratch
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* The panel's parts                                                          */
/* -------------------------------------------------------------------------- */

/**
 * One section of the panel: its name, what is set in it, and the fields.
 *
 * The summary on the right is why these fold at all. Closed, a section still
 * says what it holds -- "whole scope", "Every Monday at 09:00" -- so the panel
 * can be read top to bottom without opening anything.
 */
function PanelSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <section data-slot="alert-section" className="not-last:border-b">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          // The ring is drawn inside: the sections share one rounded frame
          // that clips, and a ring outside the row would lose its corners.
          className="focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <span className="shrink-0">{title}</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs font-normal">
            {summary}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      {open ? (
        <div id={id} className="flex flex-col gap-3 px-3 pt-1 pb-3">
          {children}
        </div>
      ) : null}
    </section>
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
 * All of something, or a named few, behind a button that says which.
 *
 * An empty list means "all", which is only safe if the control says so in
 * words -- so "all" is a row of its own at the top, ticked when nothing else
 * is, and ticking it is how you clear the rest. Several can be ticked, which
 * the prototype's single select could not do and "Bolt and Voi" needs.
 */
function FilterPick<T extends string>({
  label,
  all,
  options,
  chosen,
  onChange,
}: {
  /** What is being chosen, for assistive tech: "Vehicle types". */
  label: string;
  all: string;
  options: readonly { value: T; label: string }[];
  chosen: T[];
  onChange: (next: T[]) => void;
}) {
  const text =
    chosen.length === 0
      ? all
      : chosen
          .map((v) => options.find((o) => o.value === v)?.label ?? v)
          .join(", ");
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`${label}: ${text}`}
            className="min-w-0 flex-1 basis-40 justify-between font-normal"
          />
        }
      >
        <span className="truncate">{text}</span>
        <ChevronDown aria-hidden className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
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
      </PopoverContent>
    </Popover>
  );
}

/**
 * The one number an alert turns on, with a step either side.
 *
 * The buttons move by the measure's own step -- 5 % of battery, 12 hours of
 * idling -- because that is how the number is talked about; typing is there
 * for anything between.
 */
function Stepper({
  label,
  value,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  unit: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label}: less`}
        onClick={() => onChange(Math.max(0, value - step))}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        min={0}
        inputMode="decimal"
        aria-label={label}
        className="w-24 text-right tabular-nums"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${label}: more`}
        onClick={() => onChange(value + step)}
      >
        <Plus />
      </Button>
      <span className="text-muted-foreground text-sm">{unit}</span>
    </div>
  );
}

/**
 * The days a weekly repeat goes out on.
 *
 * Seven round toggles, as a calendar draws them. At least one stays pressed:
 * a weekly e-mail on no day is not a schedule, and unpressing the last one
 * would only leave the sentence above with nothing to say.
 */
function WeekdayToggles({
  value,
  onChange,
  disabled,
}: {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Repeat on" className="flex flex-wrap gap-1.5">
      {WEEK.map((day) => {
        const on = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={WEEKDAYS[day]}
            onClick={() => {
              const next = toggle(value, day);
              if (next.length > 0) onChange(next);
            }}
            className={cn(
              "focus-visible:border-ring focus-visible:ring-ring/50 size-9 scroll-m-1 rounded-full border text-xs font-semibold outline-none focus-visible:ring-3 disabled:opacity-50",
              on
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {WEEKDAYS[day].charAt(0)}
          </button>
        );
      })}
    </div>
  );
}

const UNIT_WORDS: Record<RepeatUnit, [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
};

/**
 * A repeat the short list does not have.
 *
 * Gmail's "Custom recurrence", which Katell named as the benchmark: repeat
 * every so many days, weeks or months, on which days, and until when. It is
 * edited on a copy and only kept on Done, so opening it to look changes
 * nothing.
 */
function RecurrenceDialog({
  schedule,
  onChange,
  onClose,
}: {
  schedule: AlertSchedule;
  onChange: (next: AlertSchedule) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState<AlertSchedule>({
    ...schedule,
    every: schedule.every ?? 1,
    unit: schedule.unit ?? "week",
    weekdays: schedule.weekdays?.length ? schedule.weekdays : ["mon"],
    monthDay: schedule.monthDay ?? 1,
    ends: schedule.ends ?? { kind: "never" },
  });
  const set = (next: Partial<AlertSchedule>) =>
    setDraft((d) => ({ ...d, ...next }));
  const unit = draft.unit ?? "week";
  const every = draft.every ?? 1;
  const ends = draft.ends ?? { kind: "never" };
  // A month from the demo's today: far enough to be a real end, near enough
  // to be believed.
  const soon = new Date(NOW + 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom repeat</DialogTitle>
          <DialogDescription>
            One e-mail with the full list, as often as you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Repeat every</span>
            <Input
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              aria-label="Repeat every"
              className="w-16 tabular-nums"
              value={every}
              onChange={(e) =>
                set({
                  every: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
            <NativeSelect
              aria-label="Unit"
              value={unit}
              onChange={(e) => set({ unit: e.target.value as RepeatUnit })}
            >
              {(Object.keys(UNIT_WORDS) as RepeatUnit[]).map((u) => (
                <NativeSelectOption key={u} value={u}>
                  {UNIT_WORDS[u][every === 1 ? 0 : 1]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {unit === "week" ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Repeat on</span>
              <WeekdayToggles
                value={draft.weekdays ?? ["mon"]}
                onChange={(weekdays) => set({ weekdays })}
              />
            </div>
          ) : null}

          {unit === "month" ? (
            <label className="flex items-center gap-2 text-sm">
              On day
              <NativeSelect
                aria-label="Day of the month"
                value={String(draft.monthDay ?? 1)}
                onChange={(e) => set({ monthDay: Number(e.target.value) })}
              >
                {/* 28 and no further, so every month has the day. */}
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <NativeSelectOption key={d} value={String(d)}>
                    {ordinal(d)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          ) : null}

          <div className="flex flex-col gap-2">
            <span id="alert-ends" className="text-sm font-medium">
              Ends
            </span>
            <RadioGroup
              aria-labelledby="alert-ends"
              value={ends.kind}
              onValueChange={(kind) =>
                set({
                  ends:
                    kind === "on"
                      ? { kind: "on", date: soon }
                      : kind === "after"
                        ? { kind: "after", count: 10 }
                        : { kind: "never" },
                })
              }
              className="gap-1"
            >
              <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <RadioGroupItem value="never" />
                Never
              </label>
              <div className="flex min-h-11 flex-wrap items-center gap-2.5 text-sm">
                <label className="flex w-20 items-center gap-2.5">
                  <RadioGroupItem value="on" />
                  On
                </label>
                <Input
                  type="date"
                  aria-label="End date"
                  className="w-44"
                  disabled={ends.kind !== "on"}
                  value={ends.kind === "on" ? ends.date : soon}
                  onChange={(e) =>
                    set({ ends: { kind: "on", date: e.target.value } })
                  }
                />
              </div>
              <div className="flex min-h-11 flex-wrap items-center gap-2.5 text-sm">
                <label className="flex w-20 items-center gap-2.5">
                  <RadioGroupItem value="after" />
                  After
                </label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  aria-label="Number of e-mails"
                  className="w-20 tabular-nums"
                  disabled={ends.kind !== "after"}
                  value={ends.kind === "after" ? ends.count : 10}
                  onChange={(e) =>
                    set({
                      ends: {
                        kind: "after",
                        count: Math.min(
                          365,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      },
                    })
                  }
                />
                <span className="text-muted-foreground">e-mails</span>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange({
                mode: "repeat",
                hour: draft.hour ?? "08:00",
                every,
                unit,
                weekdays: unit === "week" ? draft.weekdays : undefined,
                monthDay: unit === "month" ? draft.monthDay : undefined,
                ends,
              });
              onClose();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One of the two ways to send, as a card with its own settings inside.
 *
 * The settings stay visible under the choice that is not picked, greyed, so
 * choosing between the two is choosing between two things you can read --
 * not between two labels whose consequences appear afterwards.
 */
function SendOption({
  value,
  selected,
  title,
  description,
  children,
}: {
  value: SendMode;
  selected: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-selected={selected ? "" : undefined}
      className="data-[selected]:border-primary-ink data-[selected]:bg-primary/5 flex flex-col gap-2.5 rounded-lg border p-3"
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <RadioGroupItem value={value} className="mt-0.5" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="text-muted-foreground block text-xs">
            {description}
          </span>
        </span>
      </label>
      <div className="flex flex-col gap-2 pl-6.5">{children}</div>
    </div>
  );
}

/**
 * When to send: Hourly, or Repeat.
 *
 * Native selects for the list and the hour: they sit in a narrow panel, and on
 * a tablet the system's own picker is simply better than a popup of ours.
 */
function ScheduleFields({
  schedule,
  onChange,
}: {
  schedule: AlertSchedule;
  onChange: (next: AlertSchedule) => void;
}) {
  const [custom, setCustom] = React.useState(false);
  const repeat = schedule.mode === "repeat";
  const preset = repeatPreset(schedule);
  const capped = schedule.dailyCap != null;
  /** The repeat the cards show while Hourly is picked: the one it would be. */
  const asRepeat: AlertSchedule = repeat
    ? schedule
    : { mode: "repeat", unit: "day", every: 1, hour: schedule.hour ?? "08:00" };

  return (
    <>
      <RadioGroup
        aria-label="Schedule"
        value={schedule.mode}
        onValueChange={(mode) =>
          onChange(
            mode === "hourly"
              ? { mode: "hourly", hour: schedule.hour }
              : asRepeat,
          )
        }
      >
        <SendOption
          value="hourly"
          selected={!repeat}
          title="Hourly"
          description="As soon as we have the data: checked every hour, each vehicle sent once."
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex min-h-9 cursor-pointer items-center gap-2">
              <Checkbox
                checked={capped}
                disabled={repeat}
                onCheckedChange={(on) =>
                  onChange({
                    ...schedule,
                    dailyCap: on ? DEFAULT_DAILY_CAP : undefined,
                  })
                }
              />
              Stop after
            </label>
            <Input
              type="number"
              min={1}
              max={24}
              inputMode="numeric"
              aria-label="E-mails a day"
              className="w-16 tabular-nums"
              disabled={repeat || !capped}
              value={schedule.dailyCap ?? DEFAULT_DAILY_CAP}
              onChange={(e) =>
                onChange({
                  ...schedule,
                  dailyCap: Math.min(24, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
            <span className="text-muted-foreground">e-mails a day</span>
          </div>
          <p className="text-muted-foreground text-xs">
            To avoid too many e-mails. It starts again the next day.
          </p>
        </SendOption>

        <SendOption
          value="repeat"
          selected={repeat}
          title="Repeat"
          description="One e-mail with the full list of matching vehicles."
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <NativeSelect
              aria-label="How often"
              disabled={!repeat}
              value={preset}
              onChange={(e) => {
                const next = e.target.value as RepeatPreset;
                const hour = schedule.hour ?? "08:00";
                if (next === "custom") setCustom(true);
                else if (next === "daily")
                  onChange({ mode: "repeat", unit: "day", every: 1, hour });
                else if (next === "weekly")
                  onChange({
                    mode: "repeat",
                    unit: "week",
                    every: 1,
                    weekdays: schedule.weekdays?.length
                      ? schedule.weekdays
                      : ["mon"],
                    hour,
                  });
                else
                  onChange({
                    mode: "repeat",
                    unit: "month",
                    every: 1,
                    monthDay: 1,
                    hour,
                  });
              }}
            >
              <NativeSelectOption value="daily">Daily</NativeSelectOption>
              <NativeSelectOption value="weekly">Weekly</NativeSelectOption>
              <NativeSelectOption value="monthly">
                Monthly, on the 1st
              </NativeSelectOption>
              <NativeSelectOption value="custom">Custom…</NativeSelectOption>
            </NativeSelect>
            <span>at</span>
            <NativeSelect
              aria-label="Hour"
              disabled={!repeat}
              value={asRepeat.hour ?? "08:00"}
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

          {repeat && preset === "weekly" ? (
            <WeekdayToggles
              value={schedule.weekdays?.length ? schedule.weekdays : ["mon"]}
              onChange={(weekdays) => onChange({ ...schedule, weekdays })}
            />
          ) : null}

          {repeat && preset === "custom" ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span>{capitalise(repeatPhrase(schedule))}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setCustom(true)}
              >
                Change
              </Button>
            </p>
          ) : null}
        </SendOption>
      </RadioGroup>

      {custom ? (
        <RecurrenceDialog
          schedule={asRepeat}
          onChange={onChange}
          onClose={() => setCustom(false)}
        />
      ) : null}
    </>
  );
}

const isAddress = (text: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text);

/**
 * A pasted list, sorted into addresses and everything else.
 *
 * Commas, semicolons, tabs and new lines all separate, and "Name <a@b.c>" is
 * read for its address: that is what comes out of Outlook, Excel and a CSV
 * export, which are the three places these lists actually come from.
 */
function sortAddresses(text: string) {
  const ok: string[] = [];
  const bad: string[] = [];
  for (const piece of text.split(/[\n,;\t]+/)) {
    const raw = piece.trim();
    if (!raw) continue;
    const address = (/<([^>]+)>/.exec(raw)?.[1] ?? raw)
      .replace(/^"|"$/g, "")
      .trim()
      .toLowerCase();
    // A CSV's header row is not a mistake to be fixed.
    if (/^(e-?mail|name)$/.test(address)) continue;
    if (!isAddress(address)) bad.push(raw);
    else if (!ok.includes(address)) ok.push(address);
  }
  return { ok, bad };
}

/**
 * Many addresses at once, onto this alert.
 *
 * The count is shown before anything is added -- how many are good, how many
 * the alert already has, how many could not be read -- because a list of 120
 * is exactly the size at which nobody checks by eye.
 */
function PasteEmailsDialog({
  current,
  onAdd,
  onClose,
}: {
  /** Addresses already on the alert, lower-cased. */
  current: string[];
  onAdd: (addresses: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = React.useState("");
  const { ok, bad } = sortAddresses(text);
  const fresh = ok.filter((a) => !current.includes(a));
  const already = ok.length - fresh.length;

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste many e-mails</DialogTitle>
          <DialogDescription>
            Paste a list from Excel or Outlook, or import a CSV. Commas,
            semicolons and new lines all work.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="E-mail addresses"
            placeholder={"ops-munich@bolt.eu; fleet-de@bolt.eu\nBolt Munich <munich@bolt.eu>"}
            className="min-h-32"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<label />}
              className="cursor-pointer"
            >
              <Upload data-icon="inline-start" />
              Import a CSV
              <input
                type="file"
                accept=".csv,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void file.text().then(setText);
                }}
              />
            </Button>
            {text.trim() ? (
              <p
                role="status"
                className="text-muted-foreground text-sm tabular-nums"
              >
                <span className="text-foreground">
                  {plural(fresh.length, "new address", "new addresses")}
                </span>
                {already ? ` · ${already} already on this alert` : ""}
                {bad.length ? (
                  <span className="text-destructive-ink">
                    {" "}
                    · {bad.length} not readable
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {bad.length ? (
            <p className="text-muted-foreground text-xs">
              To fix: {bad.slice(0, 5).join(", ")}
              {bad.length > 5 ? "…" : ""}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={fresh.length === 0}
            onClick={() => {
              onAdd(fresh);
              onClose();
            }}
          >
            {fresh.length
              ? `Add ${fresh.length} to this alert`
              : "Add to this alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who gets it.
 *
 * Four ways in, because the call of 26 Nov named all four as things CS does
 * today by hand: type a name or an address and it completes from the scope's
 * recipients; pick an operator's mailbox; copy the people of another alert;
 * paste a whole list. They all end in the same chips, so however someone got
 * here, taking them off again is one press.
 */
function RecipientFields({
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
  const [pasting, setPasting] = React.useState(false);

  /** Contacts and typed addresses in one chip field, as one list of values. */
  const values = [...alert.recipientIds, ...alert.extraEmails];
  const isContact = (v: string) => contacts.some((c) => c.id === v);
  const setValues = (next: string[]) =>
    onChange({
      recipientIds: next.filter(isContact),
      extraEmails: next.filter((v) => !isContact(v)),
    });
  /** Adds addresses, as contacts where the list knows them. */
  const addAddresses = (addresses: string[]) => {
    const next = [...values];
    for (const address of addresses) {
      const known = contacts.find((c) => c.email.toLowerCase() === address);
      const value = known?.id ?? address;
      if (!next.includes(value)) next.push(value);
    }
    setValues(next);
  };

  const q = draft.trim().toLowerCase();
  const matches = q
    ? contacts
        .filter((c) => !alert.recipientIds.includes(c.id))
        .filter((c) =>
          `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : [];
  const operatorContacts = contacts.filter(
    (c) => c.kind === "operator" && !alert.recipientIds.includes(c.id),
  );
  const sources = others.filter(
    (a) => a.recipientIds.length + a.extraEmails.length > 0,
  );
  const taken = [
    ...alert.extraEmails,
    ...alert.recipientIds.map(
      (id) => contacts.find((c) => c.id === id)?.email ?? "",
    ),
  ].map((a) => a.toLowerCase());

  return (
    <>
      <p className="text-muted-foreground text-xs">
        Type a name or e-mail to add a member, or pick an operator.
      </p>
      <TagInput
        value={values}
        onValueChange={setValues}
        getTagLabel={(v) => {
          const c = contacts.find((x) => x.id === v);
          return c ? contactLongLabel(c) : v;
        }}
        draft={draft}
        onDraftChange={setDraft}
        onDraftCommit={(text) => {
          const top = matches[0];
          const typed = text.trim().toLowerCase();
          if (top) setValues([...values, top.id]);
          // A plain address is still allowed: not everyone who wants an alert
          // needs a VIP account.
          else if (isAddress(typed)) addAddresses([typed]);
          else return;
          setDraft("");
        }}
        inputLabel="Add a recipient by name, e-mail or operator"
        placeholder="Type a name or e-mail"
        maxVisible={5}
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
                className="hover:bg-muted focus-visible:ring-ring flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <ContactMark contact={contact} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {contactLabel(contact)}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {contact.name ? contact.email : contact.operator}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            {isAddress(q)
              ? "Press Enter to add this address."
              : "Nobody on the recipients list matches."}
          </p>
        )
      ) : null}

      <div className="flex flex-wrap gap-2">
        {/* Both reset to their first line once used: they are actions with a
            list of targets, not settings that hold a value. */}
        <NativeSelect
          aria-label="Add an operator e-mail"
          className="min-w-0 flex-1 basis-40"
          value=""
          disabled={operatorContacts.length === 0}
          onChange={(e) => {
            if (e.target.value) setValues([...values, e.target.value]);
          }}
        >
          <NativeSelectOption value="">Add an operator e-mail</NativeSelectOption>
          {operatorContacts.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.operator} · {c.email}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Copy recipients from another alert"
          className="min-w-0 flex-1 basis-40"
          value=""
          disabled={sources.length === 0}
          onChange={(e) => {
            const source = sources.find((a) => a.id === e.target.value);
            if (!source) return;
            onChange({
              recipientIds: [
                ...new Set([...alert.recipientIds, ...source.recipientIds]),
              ],
              extraEmails: [
                ...new Set([...alert.extraEmails, ...source.extraEmails]),
              ],
            });
          }}
        >
          <NativeSelectOption value="">Copy from another alert</NativeSelectOption>
          {sources.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.name} ({a.recipientIds.length + a.extraEmails.length})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="-mx-1 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPasting(true)}
        >
          <ClipboardPaste data-icon="inline-start" />
          Paste many e-mails
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onManage}>
          <UserCog data-icon="inline-start" />
          Manage recipients
        </Button>
      </div>

      {pasting ? (
        <PasteEmailsDialog
          current={taken}
          onAdd={addAddresses}
          onClose={() => setPasting(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The e-mail a recipient will get.
 *
 * Deliberately the one the platform sends today, down to its subject line,
 * the attached `records.csv` and the single line of body text. Jimmy's point
 * 5 of 19 Nov: either the preview shows the real e-mail, or redesigning the
 * e-mail becomes part of this scope. So this is a frame around it, and the
 * line above the frame is the one thing the e-mail cannot say about itself:
 * what it would contain if it went out now.
 */
function EmailPreview({
  alert,
  name,
  scope,
  to,
  places,
}: {
  alert: Alert;
  name: string;
  scope: string;
  /** Addresses, in the order they were added. */
  to: string[];
  /** Zone names for the sample rows; the scope's own when none are chosen. */
  places: string[];
}) {
  const spec = WATCH[alert.watch];
  const count = estimateMatches(alert);
  const thing = spec.counts === "operator" ? "operator" : "vehicle";
  const n = alert.threshold;
  const operators = alert.operators.length
    ? alert.operators
    : ["Bolt", "Lime", "Voi"];
  const where = places.length
    ? places
    : ["Marienplatz", "Viktualienmarkt", "Sendlinger Straße"];
  const value = (i: number) =>
    ({
      battery: `${Math.max(3, n - 4 - 3 * i)} %`,
      idle: `${n + 6 + 5 * i} h`,
      available: `${Math.max(0, n - 3)} available`,
      cap: (n + 140).toLocaleString("en-GB"),
      parked: `${n + 2 + i} h`,
      no_parking: `${n + i} h`,
    })[alert.watch];

  return (
    <section
      aria-label="E-mail preview"
      data-slot="alert-email-preview"
      className="mx-auto flex w-full max-w-xl flex-col gap-3"
    >
      <p className="text-muted-foreground text-sm">
        {count > 0 ? (
          <>
            If it ran now, this e-mail would list{" "}
            <b className="text-foreground font-medium tabular-nums">
              {plural(count, thing, `${thing}s`)}
            </b>
            .
          </>
        ) : (
          "Nothing would trigger it right now, so no e-mail would go out."
        )}{" "}
        This is the e-mail we send today.
      </p>

      <div className="bg-card overflow-hidden rounded-xl border">
        <dl className="divide-y text-xs">
          {[
            ["From", "Vianova"],
            [
              "To",
              to.length === 0
                ? "Nobody yet"
                : to.length > 2
                  ? `${to.slice(0, 2).join(", ")} and ${to.length - 2} more`
                  : to.join(", "),
            ],
            ["Subject", `[Vianova] Alert was triggered: ${name}`],
          ].map(([key, text]) => (
            <div key={key} className="flex gap-3 px-4 py-2">
              <dt className="text-muted-foreground w-20 shrink-0">{key}</dt>
              <dd className="min-w-0 font-medium break-words">{text}</dd>
            </div>
          ))}
          <div className="flex gap-3 px-4 py-2">
            <dt className="text-muted-foreground w-20 shrink-0">Attachment</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-medium">
              <Paperclip aria-hidden className="text-muted-foreground size-3.5" />
              records.csv
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t p-4">
          <p className="text-lg font-bold tracking-tight">vianova</p>
          <p className="text-sm">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground block">
              Triggered in: {scope}
            </span>
          </p>
          <p className="text-sm tabular-nums">
            {plural(count, "record", "records")} triggered the alert.
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
                  <TableHead className="h-8 text-xs">{spec.column}</TableHead>
                  <TableHead className="h-8 text-xs">Where</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {count === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground py-1.5 text-xs"
                    >
                      No rows right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  ["BL-4821", "LI-0937", "DT-2210"]
                    .slice(0, Math.min(3, count))
                    .map((vehicle, i) => (
                      <TableRow key={vehicle} className="hover:bg-transparent">
                        <TableCell className="py-1.5 text-xs tabular-nums">
                          {vehicle}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs">
                          {operators[i % operators.length]}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs tabular-nums">
                          {value(i)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs">
                          {where[i % where.length]}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground text-xs">
            Please find the attached CSV with all the records.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

/** A GeoJSON file served beside the page, for Import's "Try a sample". */
const SAMPLE_GEOJSON = `${BASE_PATH}/data/parking-bays-lisbon.geojson`;

function AlertEditor({
  saved,
  initialDraft,
  isNew,
  drafted,
  scope,
  contacts,
  others,
  rules,
  zones,
  zoneIndex,
  zonesLoading,
  watchable,
  navSlot,
  onSave,
  onDelete,
  onClose,
  onManageRecipients,
  onZonesCreated,
  onOpenRegulation,
}: {
  saved?: Alert;
  initialDraft: Alert;
  isNew: boolean;
  /** The draft came from a sentence, so it says to check it. */
  drafted: boolean;
  scope: string;
  contacts: Contact[];
  /** Every other alert, to copy recipients from. */
  others: Alert[];
  rules: Map<string, { regulation: Regulation; rule: Rule }>;
  zones: PickerZone[];
  zoneIndex: Map<string, PickerZone>;
  zonesLoading: boolean;
  watchable: WatchType[];
  navSlot?: React.ReactNode;
  onSave: (alert: Alert) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onManageRecipients: () => void;
  /** Zones drawn or imported here, to be kept in the one library. */
  onZonesCreated: (zones: PickerZone[]) => void;
  onOpenRegulation?: (rule: { regulationId: string; ruleId: string }) => void;
}) {
  const [draft, setDraft] = React.useState(initialDraft);
  /** True until the title is typed in: the name follows the settings. */
  const [autoNamed, setAutoNamed] = React.useState(
    isNew && !initialDraft.name,
  );
  const [checkIt, setCheckIt] = React.useState(drafted);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  /* The zone step. The picker replaces the panel and the map replaces the
     e-mail, exactly as in Regulations. The drawing session is held here, not
     in the picker, because the shapes arrive from the map. */
  const [picking, setPicking] = React.useState(false);
  const [tool, setTool] = React.useState<ZoneDrawTool | null>(null);
  const [drawn, setDrawn] = React.useState<PickerZone[]>([]);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<PickerZone[]>([]);
  const [preview, setPreview] = React.useState<PickerZone | null>(null);
  const stopPicking = () => {
    setPicking(false);
    setTool(null);
    setDrawn([]);
    setFocusId(null);
    setCandidates([]);
    setPreview(null);
  };

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = (next: Partial<Alert>) => setDraft((d) => ({ ...d, ...next }));

  /** Made by a rule: what it watches is the rule's, the rest is ours. */
  const fromRule = draft.kind === "report";
  const found = draft.ruleId ? rules.get(draft.ruleId) : undefined;
  const spec = WATCH[draft.watch];
  const name = autoNamed ? autoName(draft, zoneIndex) : draft.name;
  const current: Alert = { ...draft, name };

  const baseline = React.useMemo(() => JSON.stringify(saved ?? null), [saved]);
  // A new alert is unsaved from the start: there is nothing behind it to fall
  // back to.
  const dirty = isNew || JSON.stringify(current) !== baseline;

  /** A rule's alert covers the rule's zones; any other, the ones chosen. */
  const zoneIds = fromRule ? (found?.rule.zoneIds ?? []) : draft.zoneIds;
  const chosenZones = zoneIds
    .map((id) => zoneIndex.get(id))
    .filter((z): z is PickerZone => Boolean(z));

  const chosenContacts = draft.recipientIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is Contact => Boolean(c));
  const addresses = [
    ...chosenContacts.map((c) => c.email),
    ...draft.extraEmails,
  ];
  const sentence = summarySentence(current, zoneIndex, found?.rule.name);

  const save = () => {
    setSaving(true);
    // Stands in for a request: long enough to see the pending state, short
    // enough not to be annoying in a demo.
    timer.current = setTimeout(() => {
      setSaving(false);
      onSave(current);
    }, 500);
  };

  const vehicleSummary = `${
    draft.vehicles.length ? vehicleWords(draft.vehicles) : "all types"
  }, ${draft.operators.length ? draft.operators.join(", ") : "all operators"}`;

  /** What the request would carry. Shown under Advanced, never edited. */
  const query = JSON.stringify(
    {
      data_layer: {
        battery: "vehicle_positions_realtime",
        idle: "vehicle_positions_realtime",
        available: "fleet_availability_hourly",
        cap: "fleet_availability_hourly",
        parked: "vehicle_positions_realtime",
        no_parking: "regulation_infringements",
      }[draft.watch],
      filter: {
        vehicle_type: draft.vehicles.length ? draft.vehicles : "any",
        provider: draft.operators.length ? draft.operators : "any",
      },
      geo_features: zoneIds.length ? zoneIds : "zone_limits",
      threshold:
        draft.watch === "no_parking"
          ? { rule: draft.ruleId, hours: draft.threshold }
          : { measure: draft.watch, value: draft.threshold },
      schedule: schedulePhrase(draft.schedule),
      max_emails_per_day:
        draft.schedule.mode === "hourly" ? (draft.schedule.dailyCap ?? null) : null,
    },
    null,
    2,
  );

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <ToolBand nav={navSlot}>
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
          <InlineEdit
            variant="title"
            value={name}
            onValueChange={(next) => {
              setAutoNamed(false);
              update({ name: next });
            }}
            placeholder="Untitled alert"
            label="alert name"
          />
        </h2>
      </ToolBand>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div
          data-slot="alert-panel"
          className="flex min-h-0 min-w-0 flex-col lg:border-r"
        >
          {picking ? (
            <ZonePickerPanel
              zones={zones}
              excludeIds={draft.zoneIds}
              backLabel={name || "Alert"}
              onBack={stopPicking}
              urlSample={SAMPLE_GEOJSON}
              onPreviewChange={setPreview}
              onSelectionChange={setCandidates}
              onAdd={(chosen) => {
                // Drawn and imported shapes are new to the library; a zone
                // that only lived in an alert is the thing Katell ruled out.
                onZonesCreated(chosen.filter((z) => !zoneIndex.has(z.id)));
                update({
                  zoneIds: [
                    ...new Set([...draft.zoneIds, ...chosen.map((z) => z.id)]),
                  ],
                });
                stopPicking();
              }}
              session={{
                tool,
                drafts: drawn,
                focusId,
                onRename: (id, next) =>
                  setDrawn((all) =>
                    all.map((z) => (z.id === id ? { ...z, name: next } : z)),
                  ),
                onRemove: (id) =>
                  setDrawn((all) => all.filter((z) => z.id !== id)),
              }}
              onDraw={setTool}
            />
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-4 p-4 lg:min-h-0 lg:overflow-y-auto">
                {checkIt ? (
                  <AlertBanner>
                    <Sparkles />
                    <AlertTitle>Drafted from your sentence. Check it.</AlertTitle>
                    <AlertAction>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setCheckIt(false)}
                      >
                        Dismiss
                      </Button>
                    </AlertAction>
                  </AlertBanner>
                ) : null}

                {/* On or off, who made it, and whether it has been sending:
                    the three things asked about an alert before its settings. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {isNew ? (
                    <>
                      <Badge variant="outline">Draft</Badge>
                      <span className="text-muted-foreground text-xs">
                        by you
                      </span>
                    </>
                  ) : (
                    <>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                        <Switch
                          checked={draft.on}
                          onCheckedChange={(on) => update({ on })}
                          aria-label="Alert on or off"
                        />
                        {draft.on ? "On" : "Off"}
                      </label>
                      <span className="text-muted-foreground text-xs">
                        by {draft.createdBy} ·{" "}
                        {draft.sentLastWeek
                          ? `sent ${plural(draft.sentLastWeek, "time", "times")} in the last 7 days`
                          : "not sent in the last 7 days"}
                      </span>
                    </>
                  )}
                </div>

                {fromRule ? (
                  <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2.5">
                      <RuleTypeIcon type="no_parking" size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {found?.rule.name ?? "A no-parking rule"}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {found?.regulation.name ?? "Regulations"}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className="border-info-ink/30 bg-info/10 text-info-ink shrink-0 text-[11px] font-normal"
                      >
                        Reported device
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      This alert comes from the rule. A vehicle in its zones
                      for more than {plural(draft.threshold, "hour", "hours")}{" "}
                      is reported to its operator, and the recipients below get
                      the e-mail. What it watches is changed on the rule.
                    </p>
                    {onOpenRegulation && draft.regulationId && draft.ruleId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() =>
                          onOpenRegulation({
                            regulationId: draft.regulationId!,
                            ruleId: draft.ruleId!,
                          })
                        }
                      >
                        Open the regulation
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="alert-watch">What to watch</FieldLabel>
                      <NativeSelect
                        id="alert-watch"
                        className="w-full"
                        value={draft.watch}
                        onChange={(e) => {
                          const watch = e.target.value as WatchType;
                          // A different measure has a different scale: 20 is
                          // a battery level, and nonsense as a fleet cap.
                          update({ watch, threshold: WATCH[watch].initial });
                        }}
                      >
                        {PICKABLE_WATCHES.filter(
                          (w) => watchable.includes(w) || w === draft.watch,
                        ).map((w) => (
                          <NativeSelectOption key={w} value={w}>
                            {WATCH[w].label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldDescription className="flex items-center gap-1.5">
                        <Info aria-hidden className="size-3.5 shrink-0" />
                        Uses {spec.source}.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel>{spec.compare}</FieldLabel>
                      <Stepper
                        label={spec.compare}
                        value={draft.threshold}
                        step={spec.step}
                        unit={spec.unit}
                        onChange={(threshold) => update({ threshold })}
                      />
                    </Field>
                  </>
                )}

                {/* The alert, read back. Every field below changes a word of
                    it; see the file header. */}
                <p
                  data-slot="alert-summary"
                  className="border-primary-ink/40 bg-primary/5 rounded-lg border p-3 text-sm text-pretty"
                >
                  <span className="text-primary-ink mb-0.5 block text-[11px] font-semibold tracking-wider uppercase">
                    Summary
                  </span>
                  You&rsquo;ll get an e-mail when {sentence}.
                </p>

                <div className="rounded-lg border">
                  <PanelSection
                    title="Zones"
                    summary={
                      zoneIds.length
                        ? plural(zoneIds.length, "zone", "zones")
                        : "whole scope"
                    }
                    defaultOpen={!fromRule}
                  >
                    {zonesLoading ? (
                      <Skeleton className="h-11 w-full" />
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-muted-foreground min-w-0 flex-1 text-xs">
                            {fromRule
                              ? "The rule's own zones. Change them on the rule."
                              : zoneIds.length === 0
                                ? "No zone: the alert covers the whole scope."
                                : "Only vehicles inside these zones."}
                          </p>
                          {fromRule ? null : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPicking(true)}
                            >
                              <Plus data-icon="inline-start" />
                              Add zones
                            </Button>
                          )}
                        </div>
                        {chosenZones.length > 0 ? (
                          <ul className="flex flex-col gap-1.5">
                            {chosenZones.map((zone) => (
                              <li
                                key={zone.id}
                                className="flex min-h-11 items-center gap-2.5 rounded-md border py-1 pr-1 pl-2"
                              >
                                <ZoneThumbnail ring={zone.ring} size={24} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {zone.name}
                                  </span>
                                  {zone.tags.length ? (
                                    <span className="text-muted-foreground block truncate text-xs">
                                      {zone.tags.join(", ")}
                                    </span>
                                  ) : null}
                                </span>
                                {fromRule ? null : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remove ${zone.name}`}
                                    onClick={() =>
                                      update({
                                        zoneIds: draft.zoneIds.filter(
                                          (id) => id !== zone.id,
                                        ),
                                      })
                                    }
                                  >
                                    <X />
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </PanelSection>

                  {fromRule ? null : (
                    <PanelSection title="Vehicles" summary={vehicleSummary}>
                      <div className="flex flex-wrap gap-2">
                        <FilterPick
                          label="Vehicle types"
                          all="All vehicle types"
                          options={VEHICLES.map((v) => ({
                            value: v.value,
                            label: `${v.label}s`,
                          }))}
                          chosen={draft.vehicles}
                          onChange={(vehicles) => update({ vehicles })}
                        />
                        <FilterPick
                          label="Operators"
                          all="All operators"
                          options={OPERATORS.map((o) => ({ value: o, label: o }))}
                          chosen={draft.operators as (typeof OPERATORS)[number][]}
                          onChange={(operators) =>
                            update({ operators: [...operators] })
                          }
                        />
                      </div>
                    </PanelSection>
                  )}

                  <PanelSection
                    title="Schedule"
                    summary={scheduleLabel(draft.schedule)}
                    defaultOpen={!fromRule}
                  >
                    {fromRule ? (
                      <p className="text-muted-foreground text-sm">
                        Checked every hour, and each vehicle is reported once.
                        A report has its own follow-up, so it is not held back
                        for a summary.
                      </p>
                    ) : (
                      <ScheduleFields
                        schedule={draft.schedule}
                        onChange={(schedule) => update({ schedule })}
                      />
                    )}
                  </PanelSection>

                  <PanelSection
                    title="Recipients"
                    summary={plural(addresses.length, "recipient", "recipients")}
                    defaultOpen
                  >
                    <RecipientFields
                      alert={draft}
                      contacts={contacts}
                      others={others}
                      onChange={update}
                      onManage={onManageRecipients}
                    />
                  </PanelSection>

                  <PanelSection title="Advanced" summary="the query behind it">
                    <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 text-xs">
                      {query}
                    </pre>
                  </PanelSection>
                </div>
              </div>

              <footer
                data-slot="alert-save-bar"
                className="bg-background flex flex-wrap items-center gap-2 border-t p-3"
              >
                {!isNew && !fromRule ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive-ink hover:text-destructive-ink"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                ) : null}
                {addresses.length === 0 ? (
                  <span
                    id="alert-needs-recipient"
                    className="text-muted-foreground text-xs"
                  >
                    Add a recipient to save.
                  </span>
                ) : null}
                <span className="flex-1" />
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!dirty || saving || addresses.length === 0}
                  aria-describedby={
                    addresses.length === 0 ? "alert-needs-recipient" : undefined
                  }
                  onClick={save}
                >
                  {saving ? "Saving…" : isNew ? "Create alert" : "Save changes"}
                </Button>
              </footer>
            </>
          )}
        </div>

        {/* The e-mail, or the map while zones are being chosen: whichever the
            panel beside it is about. */}
        <div className="bg-muted/40 min-h-[26rem] min-w-0 border-t lg:min-h-0 lg:border-t-0">
          {picking ? (
            <ZoneDrawMap
              className="h-full min-h-[26rem]"
              zones={chosenZones}
              candidates={candidates}
              preview={preview}
              tool={tool}
              onToolChange={setTool}
              onDrawn={(zone) => {
                setDrawn((all) => [...all, zone]);
                setFocusId(zone.id);
              }}
            />
          ) : (
            <div className="h-full p-4 md:p-6 lg:overflow-y-auto">
              <EmailPreview
                alert={current}
                name={name || "Untitled alert"}
                scope={scope}
                to={addresses}
                places={chosenZones.map((z) => z.name)}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name || "this alert"}?`}
        description="It stops sending e-mails, and it cannot be brought back."
        confirmLabel="Delete alert"
        destructive
        onConfirm={() => onDelete(draft.id)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alerts list                                                                */
/* -------------------------------------------------------------------------- */

type OnFilter = "all" | "on" | "off";

const ON_FILTERS: Record<OnFilter, string> = {
  all: "All",
  on: "On",
  off: "Off",
};

/** Someone an alert goes to, as the list shows them. */
type Person = {
  key: string;
  /** A contact's name, or the address itself for one with no VIP account. */
  label: string;
  email: string;
  /** Only a contact has a row in Recipients to go to. */
  contact: boolean;
};

function peopleOf(alert: Alert, contacts: Map<string, Contact>): Person[] {
  return [
    ...alert.recipientIds.flatMap((id) => {
      const c = contacts.get(id);
      return c
        ? [{ key: c.id, label: contactLongLabel(c), email: c.email, contact: true }]
        : [];
    }),
    ...alert.extraEmails.map((email) => ({
      key: email,
      label: email,
      email,
      contact: false,
    })),
  ];
}

/** A recipient's name opens that recipient; a plain address is text. */
function PersonLink({
  person,
  onPerson,
}: {
  person: Person;
  onPerson: (id: string) => void;
}) {
  if (!person.contact) {
    return <span className="max-w-full truncate">{person.label}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onPerson(person.key)}
      // The ring paints outside the box, so nothing around a name may clip:
      // the name truncates itself rather than being cut by its cell.
      className="text-primary-ink focus-visible:ring-ring max-w-full scroll-m-1 truncate rounded underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
    >
      {person.label}
    </button>
  );
}

/**
 * Who an alert goes to, as Katell's list draws it: the names themselves while
 * there are one or two, then the first name and "+ N more".
 *
 * Names, not a count. "3 recipients" says how many and nothing else, and the
 * question this column answers is "does Stefan get this one" -- which a name
 * answers at a glance and a number never does. The chip opens the rest.
 */
function SentTo({
  people,
  onPerson,
  onAll,
}: {
  people: Person[];
  onPerson: (id: string) => void;
  onAll: () => void;
}) {
  if (people.length === 0) {
    return <span className="text-muted-foreground">Nobody yet</span>;
  }
  const shown = people.length <= 2 ? people : people.slice(0, 1);
  const rest = people.length - shown.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {shown.map((person, i) => (
        <React.Fragment key={person.key}>
          {i > 0 ? (
            <span aria-hidden className="text-muted-foreground -ml-1.5">
              ,
            </span>
          ) : null}
          <PersonLink person={person} onPerson={onPerson} />
        </React.Fragment>
      ))}
      {rest > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0 scroll-m-1 rounded-full font-normal"
          aria-label={`${plural(rest, "more recipient", "more recipients")}, show everyone`}
          onClick={onAll}
        >
          + {rest} more
        </Button>
      ) : null}
    </span>
  );
}

/**
 * Everyone an alert goes to.
 *
 * Behind "+ N more", because a Munich alert can have 121 recipients and a
 * table cell cannot. Each name is the same way into Recipients it is in the
 * row, and Open the alert is there for the other thing you might have come to
 * do: change who is on it.
 */
function SentToDialog({
  alert,
  people,
  onOpenChange,
  onOpenAlert,
  onPerson,
}: {
  alert: Alert | null;
  people: Person[];
  onOpenChange: (open: boolean) => void;
  onOpenAlert: (id: string) => void;
  onPerson: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  // A different alert is a different list: nothing typed for one may be
  // carried into the next.
  React.useEffect(() => setQuery(""), [alert?.id]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? people.filter((p) => `${p.label} ${p.email}`.toLowerCase().includes(q))
    : people;

  return (
    <Dialog open={alert !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{alert?.name}</DialogTitle>
          <DialogDescription>
            {plural(people.length, "person gets", "people get")} this alert.
          </DialogDescription>
        </DialogHeader>
        {/* Worth a field only once the list is longer than the eye takes in. */}
        {people.length > 8 ? (
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search this alert's recipients"
            />
          </InputGroup>
        ) : null}
        <div className="-mx-1 flex max-h-72 flex-col overflow-auto">
          {visible.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              Nobody matches.
            </p>
          ) : (
            visible.map((person) =>
              person.contact ? (
                <button
                  key={person.key}
                  type="button"
                  onClick={() => onPerson(person.key)}
                  className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 w-full flex-col justify-center rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3"
                >
                  <span className="truncate text-sm">{person.label}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {person.email}
                  </span>
                </button>
              ) : (
                <p
                  key={person.key}
                  className="flex min-h-11 items-center truncate px-2 text-sm"
                >
                  {person.label}
                </p>
              ),
            )
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (alert) onOpenAlert(alert.id);
            }}
          >
            Open the alert
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What the alerts list can show. Name and On are what make it a list. */
const ALERT_COLUMNS: ViewColumn[] = [
  { id: "name", label: "Name", locked: true },
  { id: "createdBy", label: "Created by" },
  { id: "created", label: "Created" },
  { id: "sentTo", label: "Sent to" },
  { id: "lastSent", label: "Last sent" },
  { id: "on", label: "On", locked: true },
];

/**
 * The list, on Katell's columns: Name, Created by, Created, Sent to, Last
 * sent, On.
 *
 * It opens with no tick boxes. An alert is switched off far more often than it
 * is deleted, the switch is already on the row, and so the first column is the
 * name's. The boxes and the bulk Delete come in from `TableSettings` at the
 * end of the toolbar, which is also where columns are hidden and dates are
 * switched between ages and clock times -- the same menu every list in the
 * workspaces has.
 */
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
  onPerson,
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
  /** Opens one recipient, in Recipients. */
  onPerson: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [on, setOn] = React.useState<OnFilter>("all");
  /** The alert whose whole recipient list is open. */
  const [listing, setListing] = React.useState<string | null>(null);
  const view = useTableView(ALERT_COLUMNS, { selection: true, dates: true });
  const selecting = view.selecting;
  const [selected, setSelected] = React.useState<string[]>([]);
  // Tick boxes put away take their ticks with them.
  React.useEffect(() => {
    if (!selecting) setSelected([]);
  }, [selecting]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts
      .filter((a) => (on === "all" ? true : on === "on" ? a.on : !a.on))
      .filter(
        (a) => !q || `${a.name} ${a.createdBy}`.toLowerCase().includes(q),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [alerts, on, query]);

  const filtering = query.trim() !== "" || on !== "all";
  const clearFilters = () => {
    setQuery("");
    setOn("all");
  };

  const listed = listing ? alerts.find((a) => a.id === listing) : undefined;

  // An alert filtered out from under a tick must not stay ticked, or Delete
  // would remove something the user can no longer see.
  React.useEffect(() => {
    setSelected((cur) => cur.filter((id) => visible.some((a) => a.id === id)));
  }, [visible]);

  // Report rules cannot be deleted from here, so they are never part of a
  // batch: a Delete that silently skipped half the ticks would be worse than
  // one that cannot tick them.
  const deletable = visible.filter((a) => a.kind === "alert");
  const allTicked =
    deletable.length > 0 && selected.length === deletable.length;
  const someTicked = selected.length > 0 && !allTicked;

  /** Who made each alert, found by name: the model keeps the name alone. */
  const author = (name: string) => {
    for (const c of contacts.values()) if (c.name === name) return c;
    return undefined;
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
          <SelectTrigger className="w-24" aria-label="On or off">
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
        <TableSettings {...view.settings} />
      </div>

      {selecting && selected.length > 0 ? (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
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
        </SelectionBar>
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
                Each one sends an e-mail when something happens in your data.
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
          <Table inset className="min-w-[64rem] table-fixed">
            <caption className="sr-only">
              Alerts in {scope}, newest first. An alert made by a no-parking
              rule is marked Reported device.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {selecting ? (
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
                ) : null}
                <TableHead>Name</TableHead>
                {view.shows("createdBy") ? (
                <TableHead className="w-56">Created by</TableHead>
                ) : null}
                {view.shows("created") ? (
                <TableHead
                  // The column is fixed-width, and a day with a time is
                  // wider than an age: at w-28 it ran into Sent to.
                  className={view.dates === "exact" ? "w-40" : "w-28"}
                >
                  Created
                </TableHead>
                ) : null}
                {view.shows("sentTo") ? (
                <TableHead className="w-64">Sent to</TableHead>
                ) : null}
                {view.shows("lastSent") ? (
                <TableHead className="w-40">Last sent</TableHead>
                ) : null}
                <TableHead className="w-20 text-right">On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status === "loading"
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {selecting ? (
                        <TableCell>
                          <Skeleton className="size-4 rounded-[4px]" />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-5 w-8 rounded-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : visible.map((alert) => {
                    const report = alert.kind === "report";
                    const ticked = selected.includes(alert.id);
                    const by = author(alert.createdBy);
                    return (
                      <TableRow
                        key={alert.id}
                        data-state={ticked ? "selected" : undefined}
                      >
                        {selecting ? (
                          <TableCell>
                            <Checkbox
                              checked={ticked}
                              disabled={report}
                              onCheckedChange={() =>
                                setSelected((cur) => toggle(cur, alert.id))
                              }
                              aria-label={
                                report
                                  ? `${alert.name} is removed on its rule, in Regulations`
                                  : `Select ${alert.name}`
                              }
                              // Not decoration: Tab scrolls a focused row
                              // flush with the workspace's edge, and the ring
                              // paints outside the box, so it would be cut.
                              className="scroll-my-1"
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          {/* The badge goes under the name, not beside it: the
                              column is the narrowest on a full table, and a
                              badge on the same line left "No parking · Hist…"
                              where the whole name fits. */}
                          <span className="flex min-w-0 flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => onOpen(alert.id)}
                              data-slot="alert-open-link"
                              className="hover:text-primary-ink focus-visible:ring-ring min-w-0 scroll-m-1 truncate rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
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
                                className="border-info-ink/30 bg-info/10 text-info-ink shrink-0 text-[11px] font-normal"
                              >
                                Reported device
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        {view.shows("createdBy") ? (
                        <TableCell>
                          <PersonCell
                            name={alert.createdBy}
                            email={by?.email}
                            // The platform files the report rules, and it is
                            // not one of the people.
                            organisation={alert.createdBy === "Vianova"}
                          />
                        </TableCell>
                        ) : null}
                        {view.shows("created") ? (
                        <TableCell className="text-muted-foreground">
                          <RelativeTime
                            iso={alert.createdAt}
                            now={NOW}
                            timeZone={SCOPE_TZ}
                            display={view.dates}
                          />
                        </TableCell>
                        ) : null}
                        {view.shows("sentTo") ? (
                        <TableCell>
                          <SentTo
                            people={peopleOf(alert, contacts)}
                            onPerson={onPerson}
                            onAll={() => setListing(alert.id)}
                          />
                        </TableCell>
                        ) : null}
                        {view.shows("lastSent") ? (
                        <TableCell>
                          <RelativeTime
                            iso={alert.lastSentAt}
                            now={NOW}
                            timeZone={SCOPE_TZ}
                            display={view.dates}
                            never="Never sent"
                          />
                        </TableCell>
                        ) : null}
                        <TableCell>
                          {/* Against the right edge, not under the left of
                              its header. Tab scrolls a control only just into
                              view, and in the last column that leaves its ring
                              cut by the table's own scroll edge -- measured at
                              2.4px on the report badge. At the end of the row
                              the cell's inset is always there to paint on. */}
                          <div className="flex items-center justify-end">
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
          · times are {SCOPE_TIME_ZONE}
        </p>
      ) : null}

      <SentToDialog
        alert={listed ?? null}
        people={listed ? peopleOf(listed, contacts) : []}
        onOpenChange={(open) => {
          if (!open) setListing(null);
        }}
        onOpenAlert={(id) => {
          setListing(null);
          onOpen(id);
        }}
        onPerson={(id) => {
          setListing(null);
          onPerson(id);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Recipients                                                                 */
/* -------------------------------------------------------------------------- */

type KindFilter = "all" | RecipientKind;

const KIND_FILTERS: Record<KindFilter, string> = {
  all: "All",
  member: "Members",
  operator: "Operators",
};

const KIND_LABELS: Record<RecipientKind, string> = {
  member: "Member",
  operator: "Operator",
};

/** Which of the Recipients view's dialogs is open, and on whom. */
type RecipientDialogState =
  | { kind: "add" }
  | { kind: "paste" }
  | { kind: "edit"; id: string }
  | null;

/**
 * Addresses out of whatever was pasted.
 *
 * Commas, semicolons and new lines all separate, because the three places a
 * list comes from -- a spreadsheet column, Outlook's To line, a CSV -- use one
 * each. "Bolt Munich <munich@bolt.eu>" keeps its name; a bare address has
 * none. An address pasted twice is one recipient.
 */
export function parseRecipients(text: string): { name: string; email: string }[] {
  const found = new Map<string, { name: string; email: string }>();
  for (const part of text.split(/[\n;,]+/)) {
    const match = /<?([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)>?/.exec(part);
    if (!match) continue;
    const email = match[1]!.toLowerCase();
    const name = part.slice(0, match.index).replace(/["']/g, "").trim();
    if (!found.has(email)) found.set(email, { name, email });
  }
  return [...found.values()];
}

const PASTE_SAMPLE = `ops-munich@bolt.eu; fleet-de@bolt.eu
Bolt Munich <munich@bolt.eu>
streife-nord@muenchen.de, streife-sued@muenchen.de`;

/**
 * Which alerts someone gets, as chips with a search under them.
 *
 * The same field in the editor of one recipient and in Add recipient, because
 * it is the same question, and the one that makes this tab worth having: a
 * person's alerts are changed in one place rather than alert by alert.
 */
function AlertsField({
  id,
  alerts,
  value,
  onChange,
}: {
  id: string;
  alerts: Alert[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const q = draft.trim().toLowerCase();
  const matches = q
    ? alerts
        .filter((a) => !value.includes(a.id))
        .filter((a) => a.name.toLowerCase().includes(q))
        .slice(0, 5)
    : [];
  const add = (alertId: string) => {
    onChange([...value, alertId]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-muted-foreground text-xs">No alert yet.</p>
      ) : null}
      <TagInput
        id={id}
        value={value}
        onValueChange={onChange}
        getTagLabel={(v) => alerts.find((a) => a.id === v)?.name ?? v}
        draft={draft}
        onDraftChange={setDraft}
        onDraftCommit={() => {
          if (matches[0]) add(matches[0].id);
        }}
        placeholder="Search alerts to add"
        inputLabel="Search alerts to add"
      />
      {matches.length > 0 ? (
        <div className="-mx-1 flex flex-col">
          {matches.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => add(alert.id)}
              className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm outline-none focus-visible:ring-3"
            >
              <span className="truncate">{alert.name}</span>
            </button>
          ))}
        </div>
      ) : q ? (
        <p className="text-muted-foreground px-1 text-xs">No alert matches.</p>
      ) : null}
    </div>
  );
}

const optional = (
  <span className="text-muted-foreground font-normal">(optional)</span>
);

/**
 * One recipient: adding them, or changing them.
 *
 * This is where a person is swapped. Somebody leaves an operator, their
 * address is changed here, and every alert they were on now goes to their
 * replacement -- which is the whole of what CS used to do one alert at a time.
 * So there is no separate "replace" action: editing the address is it.
 *
 * A VIP user of the organisation is the exception. Their name and e-mail are
 * the Members page's to change, and letting this dialog edit them would make
 * two places disagree about who someone is. Here they only get their alerts
 * chosen, and they cannot be deleted from a list they are not really kept in.
 */
function RecipientDialog({
  contact,
  contacts,
  alerts,
  onOpenChange,
  onSave,
  onDelete,
  onPasteMany,
}: {
  /** The recipient being changed, or nothing when adding one. */
  contact?: Contact;
  contacts: Contact[];
  /** The alerts someone can be put on. */
  alerts: Alert[];
  onOpenChange: (open: boolean) => void;
  onSave: (contact: Contact, alertIds: string[]) => void;
  onDelete: (id: string) => void;
  onPasteMany: () => void;
}) {
  const uidPrefix = React.useId();
  const [first, ...rest] = (contact?.name ?? "").split(" ");
  const [firstName, setFirstName] = React.useState(first ?? "");
  const [lastName, setLastName] = React.useState(rest.join(" "));
  const [email, setEmail] = React.useState(contact?.email ?? "");
  const [kind, setKind] = React.useState<RecipientKind>(
    contact?.kind ?? "member",
  );
  const [operator, setOperator] = React.useState<string>(
    contact?.operator ?? OPERATORS[0],
  );
  const [alertIds, setAlertIds] = React.useState(() =>
    contact
      ? alerts.filter((a) => a.recipientIds.includes(contact.id)).map((a) => a.id)
      : [],
  );

  const locked = Boolean(contact?.account);
  const address = email.trim().toLowerCase();
  const taken = contacts.some(
    (c) => c.id !== contact?.id && c.email.toLowerCase() === address,
  );
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && !taken;

  const save = () => {
    if (!valid) return;
    onSave(
      {
        // Everything not edited here -- being a VIP user, being invited,
        // having been set up by Vianova -- is carried, not rebuilt.
        ...contact,
        id: contact?.id ?? uid("c"),
        name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
        email: address,
        kind,
        operator: kind === "operator" ? operator : undefined,
        // Someone new to the organisation is invited; an operator's address
        // is just an address and has no account to wait for.
        pending: contact ? contact.pending : kind === "member" ? true : undefined,
      },
      alertIds,
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contact ? contactLongLabel(contact) : "Add recipient"}
          </DialogTitle>
          <DialogDescription>
            {!contact
              ? "Add someone who gets alert e-mails."
              : locked
                ? "VIP user of your organisation: name and e-mail come from the Members page. Here you only choose the alerts."
                : contact.managed
                  ? "Set up by Vianova. You can change the address or the alerts it gets."
                  : "Change the address, and every alert they are on follows it."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`${uidPrefix}-first`}>
                First name {optional}
              </FieldLabel>
              <Input
                id={`${uidPrefix}-first`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={locked}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uidPrefix}-last`}>
                Last name {optional}
              </FieldLabel>
              <Input
                id={`${uidPrefix}-last`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={locked}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={`${uidPrefix}-email`}>Email address</FieldLabel>
            <Input
              id={`${uidPrefix}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@work-email.com"
              disabled={locked}
              aria-invalid={taken || undefined}
              autoComplete="off"
            />
            {taken ? (
              <FieldDescription className="text-destructive-ink">
                That address is already a recipient.
              </FieldDescription>
            ) : null}
          </Field>

          {locked ? null : (
            <>
              <Field>
                <FieldLabel htmlFor={`${uidPrefix}-kind`}>Type</FieldLabel>
                <NativeSelect
                  id={`${uidPrefix}-kind`}
                  className="w-full"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as RecipientKind)}
                >
                  {(Object.keys(KIND_LABELS) as RecipientKind[]).map((k) => (
                    <NativeSelectOption key={k} value={k}>
                      {KIND_LABELS[k]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {!contact && kind === "member" ? (
                  <FieldDescription>
                    If they are not in your organisation yet, they get an
                    invitation with read-only access to VIP.
                  </FieldDescription>
                ) : null}
              </Field>
              {kind === "operator" ? (
                <Field>
                  <FieldLabel htmlFor={`${uidPrefix}-operator`}>
                    Operator
                  </FieldLabel>
                  <NativeSelect
                    id={`${uidPrefix}-operator`}
                    className="w-full"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                  >
                    {OPERATORS.map((o) => (
                      <NativeSelectOption key={o} value={o}>
                        {o}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </>
          )}

          <Field>
            <FieldLabel htmlFor={`${uidPrefix}-alerts`}>
              Gets these alerts
            </FieldLabel>
            <AlertsField
              id={`${uidPrefix}-alerts`}
              alerts={alerts}
              value={alertIds}
              onChange={setAlertIds}
            />
          </Field>

          <DialogFooter className="sm:justify-between">
            {/* The quiet end of the footer: the way out of this one person,
                in whichever direction applies. */}
            {!contact ? (
              <Button type="button" variant="ghost" onClick={onPasteMany}>
                Paste many e-mails
              </Button>
            ) : locked ? (
              <span />
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive-ink hover:text-destructive-ink"
                onClick={() => onDelete(contact.id)}
              >
                Delete
              </Button>
            )}
            <span className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!valid}>
                {contact ? "Save" : "Add recipient"}
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Many recipients at once, from a paste or a file.
 *
 * The count on the button is the parse, live: what will be added is said
 * before it is, and an address already on the list is not counted, so "Add 3
 * recipients" never adds two.
 */
function PasteDialog({
  contacts,
  alerts,
  onOpenChange,
  onAdd,
}: {
  contacts: Contact[];
  alerts: Alert[];
  onOpenChange: (open: boolean) => void;
  onAdd: (
    people: { name: string; email: string }[],
    kind: RecipientKind,
    operator: string | undefined,
    alertId: string | null,
  ) => void;
}) {
  const uidPrefix = React.useId();
  const [kind, setKind] = React.useState<RecipientKind>("member");
  const [operator, setOperator] = React.useState<string>(OPERATORS[0]);
  const [text, setText] = React.useState("");
  const [alertId, setAlertId] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const known = new Set(contacts.map((c) => c.email.toLowerCase()));
  const parsed = parseRecipients(text);
  const fresh = parsed.filter((p) => !known.has(p.email));
  const skipped = parsed.length - fresh.length;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add recipients</DialogTitle>
          <DialogDescription>
            Paste a list from Excel or Outlook, or import a CSV. Commas,
            semicolons and new lines all work. New members get a read-only
            invitation to VIP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${uidPrefix}-kind`}>Type</FieldLabel>
              <NativeSelect
                id={`${uidPrefix}-kind`}
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as RecipientKind)}
              >
                {(Object.keys(KIND_LABELS) as RecipientKind[]).map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {KIND_LABELS[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {kind === "operator" ? (
              <Field>
                <FieldLabel htmlFor={`${uidPrefix}-operator`}>
                  Operator
                </FieldLabel>
                <NativeSelect
                  id={`${uidPrefix}-operator`}
                  className="w-full"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  {OPERATORS.map((o) => (
                    <NativeSelectOption key={o} value={o}>
                      {o}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </div>

          <Field>
            <FieldLabel htmlFor={`${uidPrefix}-text`} className="sr-only">
              E-mail addresses
            </FieldLabel>
            <Textarea
              id={`${uidPrefix}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={"ops-munich@bolt.eu; fleet-de@bolt.eu\nBolt Munich <munich@bolt.eu>"}
            />
            {skipped > 0 ? (
              <FieldDescription>
                {plural(skipped, "address is", "addresses are")} already on the
                list and will be left as they are.
              </FieldDescription>
            ) : null}
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              Import a CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setText(PASTE_SAMPLE)}
            >
              Try a sample
            </Button>
          </div>

          <Field>
            <FieldLabel htmlFor={`${uidPrefix}-alert`}>
              Also add them to
            </FieldLabel>
            <NativeSelect
              id={`${uidPrefix}-alert`}
              className="w-full"
              value={alertId}
              onChange={(e) => setAlertId(e.target.value)}
            >
              <NativeSelectOption value="">No alert for now</NativeSelectOption>
              {alerts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={fresh.length === 0}
            onClick={() =>
              onAdd(
                fresh,
                kind,
                kind === "operator" ? operator : undefined,
                alertId || null,
              )
            }
          >
            Add {plural(fresh.length, "recipient", "recipients")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RECIPIENT_COLUMNS: ViewColumn[] = [
  { id: "recipient", label: "Recipient", locked: true },
  { id: "alerts", label: "Gets these alerts" },
];

/**
 * The recipients, on Katell's columns: who, and which alerts they get.
 *
 * It is the scope's report contacts -- the list Settings › Report contacts
 * edits and the report rules read -- seen from the other side: not who an
 * alert goes to, but what a person gets. That is the view someone needs when
 * a colleague leaves, and it is why a name opens that person rather than a
 * menu of things to do to them.
 *
 * Bulk Delete matters more here than on the alerts list. Alerts are switched
 * off, not deleted, and one at a time; people leave in groups -- an operator
 * loses a contract, a team is reorganised -- and removing eleven addresses one
 * dialog at a time is the chore this tab exists to end. The boxes still wait
 * behind `TableSettings`, as they do on every list.
 */
function RecipientList({
  contacts,
  alerts,
  dialog,
  onDialogChange,
  onSave,
  onAddMany,
  onDelete,
  onOpenAlert,
}: {
  contacts: Contact[];
  alerts: Alert[];
  dialog: RecipientDialogState;
  onDialogChange: (next: RecipientDialogState) => void;
  onSave: (contact: Contact, alertIds: string[]) => void;
  onAddMany: (
    people: { name: string; email: string }[],
    kind: RecipientKind,
    operator: string | undefined,
    alertId: string | null,
  ) => void;
  onDelete: (ids: string[]) => void;
  onOpenAlert: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const view = useTableView(RECIPIENT_COLUMNS, { selection: true });
  const selecting = view.selecting;
  const [selected, setSelected] = React.useState<string[]>([]);
  // Tick boxes put away take their ticks with them.
  React.useEffect(() => {
    if (!selecting) setSelected([]);
  }, [selecting]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => kind === "all" || c.kind === kind)
      .filter(
        (c) =>
          !q ||
          `${c.name} ${c.email} ${c.operator ?? ""}`.toLowerCase().includes(q),
      );
  }, [contacts, kind, query]);

  // Someone filtered out from under a tick must not stay ticked, or Delete
  // would remove a person the user can no longer see.
  React.useEffect(() => {
    setSelected((cur) => cur.filter((id) => visible.some((c) => c.id === id)));
  }, [visible]);

  const filtering = query.trim() !== "" || kind !== "all";
  const allTicked = visible.length > 0 && selected.length === visible.length;
  const someTicked = selected.length > 0 && !allTicked;

  /** Every alert, a rule's included: who hears about it is handled here. */
  const editable = alerts;
  const editing =
    dialog?.kind === "edit"
      ? contacts.find((c) => c.id === dialog.id)
      : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search names or e-mails"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search names or e-mails"
          />
        </InputGroup>
        <Select
          items={KIND_FILTERS}
          value={kind}
          onValueChange={(v) => setKind((v ?? "all") as KindFilter)}
        >
          <SelectTrigger className="w-32" aria-label="Members or operators">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_FILTERS) as KindFilter[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_FILTERS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TableSettings {...view.settings} />
      </div>

      {selecting && selected.length > 0 ? (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
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
        </SelectionBar>
      ) : null}

      {visible.length === 0 ? (
        <Empty className="min-h-fit flex-auto border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {filtering ? <Search /> : <Users />}
            </EmptyMedia>
            <EmptyTitle>
              {filtering ? "Nobody matches" : "No recipients yet"}
            </EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            {filtering ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => onDialogChange({ kind: "add" })}>
                <Plus data-icon="inline-start" />
                Add recipient
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <TableCard>
          <Table inset className="min-w-[44rem] table-fixed">
            <caption className="sr-only">
              Everyone on the scope&rsquo;s recipients list, and the alerts
              they get.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {selecting ? (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allTicked}
                    indeterminate={someTicked}
                    onCheckedChange={() =>
                      setSelected(allTicked ? [] : visible.map((c) => c.id))
                    }
                    aria-label={
                      allTicked ? "Clear selection" : "Select every recipient"
                    }
                  />
                </TableHead>
                ) : null}
                <TableHead className="w-[45%]">Recipient</TableHead>
                {view.shows("alerts") ? (
                <TableHead>Gets these alerts</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((contact) => {
                const theirs = alerts.filter((a) =>
                  a.recipientIds.includes(contact.id),
                );
                const ticked = selected.includes(contact.id);
                const label = contactLabel(contact);
                // Under a name, the address. Under a bare address there is
                // nothing left to say but where it came from.
                const detail = contact.name
                  ? contact.email
                  : contact.managed
                    ? "Set up by Vianova"
                    : null;
                return (
                  <TableRow
                    key={contact.id}
                    data-state={ticked ? "selected" : undefined}
                  >
                    {selecting ? (
                    <TableCell className="align-top">
                      <Checkbox
                        checked={ticked}
                        onCheckedChange={() =>
                          setSelected((cur) => toggle(cur, contact.id))
                        }
                        aria-label={`Select ${label}`}
                        // Not decoration: Tab scrolls a focused row flush
                        // with the workspace's edge, and the ring paints
                        // outside the box, so it would be cut.
                        className="mt-0.5 scroll-my-1"
                      />
                    </TableCell>
                    ) : null}
                    <TableCell>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onDialogChange({ kind: "edit", id: contact.id })
                            }
                            data-slot="recipient-edit-link"
                            aria-label={`Edit ${label}`}
                            className="text-primary-ink focus-visible:ring-ring flex min-w-0 scroll-m-1 items-center gap-1.5 rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <span className="truncate underline underline-offset-2">
                              {label}
                            </span>
                            <Pencil
                              aria-hidden
                              className="text-muted-foreground size-3 shrink-0"
                            />
                          </button>
                          {contact.operator ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[11px]"
                            >
                              {contact.operator}
                            </Badge>
                          ) : null}
                          {contact.pending ? (
                            <StatusBadge tone="warning" className="shrink-0">
                              Invited
                            </StatusBadge>
                          ) : null}
                        </span>
                        {detail ? (
                          <span className="text-muted-foreground truncate text-xs">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    {view.shows("alerts") ? (
                    <TableCell className="whitespace-normal">
                      {theirs.length === 0 ? (
                        <span className="text-muted-foreground">none</span>
                      ) : (
                        <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                          {theirs.map((alert, i) => (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => onOpenAlert(alert.id)}
                              className="hover:text-primary-ink focus-visible:ring-ring max-w-full scroll-m-1 rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {alert.name}
                              {i < theirs.length - 1 ? "," : ""}
                            </button>
                          ))}
                        </span>
                      )}
                    </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {visible.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {visible.length === contacts.length
            ? plural(contacts.length, "recipient", "recipients")
            : `${visible.length} of ${plural(contacts.length, "recipient", "recipients")}`}
        </p>
      ) : null}

      {dialog?.kind === "add" || editing ? (
        <RecipientDialog
          // A different person is a different form.
          key={editing?.id ?? "add"}
          contact={editing}
          contacts={contacts}
          alerts={editable}
          onOpenChange={(open) => {
            if (!open) onDialogChange(null);
          }}
          onSave={(contact, alertIds) => {
            onSave(contact, alertIds);
            onDialogChange(null);
          }}
          onDelete={(id) => {
            onDelete([id]);
            onDialogChange(null);
          }}
          onPasteMany={() => onDialogChange({ kind: "paste" })}
        />
      ) : null}

      {dialog?.kind === "paste" ? (
        <PasteDialog
          contacts={contacts}
          alerts={editable}
          onOpenChange={(open) => {
            if (!open) onDialogChange(null);
          }}
          onAdd={(people, as, operator, alertId) => {
            onAddMany(people, as, operator, alertId);
            onDialogChange(null);
          }}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                  */
/* -------------------------------------------------------------------------- */

type View =
  | { kind: "list" }
  | { kind: "edit"; id: string; isNew: boolean; drafted: boolean };

export function AlertsWorkspace({
  className,
  alerts: initialAlerts = SAMPLE_ALERTS,
  contacts: initialContacts = SAMPLE_CONTACTS,
  regulations = SAMPLE_REGULATIONS,
  watchable = PICKABLE_WATCHES,
  status = "ready",
  scope = "Munich",
  navSlot,
  onRetry,
  onSave,
  onOpenRegulation,
}: {
  className?: string;
  alerts?: Alert[];
  contacts?: Contact[];
  regulations?: Regulation[];
  /**
   * What this scope has the data to watch. A suggestion or a measure whose
   * data the scope lacks is not offered, rather than offered and failing.
   */
  watchable?: WatchType[];
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
  /**
   * Opens a rule in Regulations, from the alert that rule made. Left out, the
   * alert still says where it comes from; it just cannot take you there.
   */
  onOpenRegulation?: (rule: { regulationId: string; ruleId: string }) => void;
}) {
  const [alerts, setAlerts] = React.useState(initialAlerts);
  const [contacts, setContacts] = React.useState(initialContacts);
  const [section, setSection] = React.useState<Section>("alerts");
  /**
   * Held here, not in the Recipients view, because two things outside it open
   * its dialogs: Add recipient in the band, and a name pressed in the alerts
   * list.
   */
  const [recipientDialog, setRecipientDialog] =
    React.useState<RecipientDialogState>(null);
  const [view, setView] = React.useState<View>({ kind: "list" });
  /** The Create dialog, and a count that gives each opening a clean one. */
  const [creating, setCreating] = React.useState(false);
  const [createCount, setCreateCount] = React.useState(0);
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
    setCreateCount((n) => n + 1);
    setCreating(true);
  };

  /** A draft from the Create dialog: a sentence read into settings, or bare. */
  const startDraft = (
    patch: Partial<Alert>,
    from: "sentence" | "scratch",
    name?: string,
  ) => {
    const id = uid("al");
    const watch =
      patch.watch ?? PICKABLE_WATCHES.find((w) => watchable.includes(w)) ?? "battery";
    const draft: Alert = {
      id,
      kind: "alert",
      // Empty on purpose: the editor names it from its settings until someone
      // types a name. A suggestion brings its own.
      name: name ?? "",
      watch,
      threshold: WATCH[watch].initial,
      zoneIds: [],
      vehicles: [],
      operators: [],
      schedule: { mode: "hourly" },
      // The person making it hears about it, unless they say otherwise.
      recipientIds: contacts.some((c) => c.id === "c-you") ? ["c-you"] : [],
      extraEmails: [],
      createdBy: "You",
      mine: true,
      createdAt: new Date().toISOString(),
      on: true,
      ...patch,
    };
    setDrafts((d) => ({ ...d, [id]: draft }));
    setNotice(null);
    setCreating(false);
    setView({ kind: "edit", id, isNew: true, drafted: from === "sentence" });
  };

  const open = (id: string) => {
    setNotice(null);
    setView({ kind: "edit", id, isNew: false, drafted: false });
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
              drafted={view.drafted}
              scope={scope}
              contacts={contacts}
              others={alerts.filter((a) => a.id !== view.id)}
              rules={ruleIndex}
              zones={zones}
              zoneIndex={zoneIndex}
              zonesLoading={zonesLoading}
              watchable={watchable}
              navSlot={navSlot}
              onOpenRegulation={onOpenRegulation}
              onZonesCreated={(made) =>
                setZones((all) => [
                  ...made.filter((z) => !all.some((x) => x.id === z.id)),
                  ...all,
                ])
              }
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
                // The band's one action is the thing this view makes.
                section === "recipients" ? (
                  <Button onClick={() => setRecipientDialog({ kind: "add" })}>
                    <Plus data-icon="inline-start" />
                    Add recipient
                  </Button>
                ) : (
                  <Button onClick={create}>
                    <Plus data-icon="inline-start" />
                    Create alert
                  </Button>
                )
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
                onChange={(next) => {
                  setRecipientDialog(null);
                  setSection(next);
                }}
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
                  onPerson={(id) => {
                    setRecipientDialog({ kind: "edit", id });
                    setSection("recipients");
                  }}
                />
              ) : (
                <RecipientList
                  contacts={contacts}
                  alerts={alerts}
                  dialog={recipientDialog}
                  onDialogChange={setRecipientDialog}
                  onOpenAlert={open}
                  onSave={(contact, alertIds) => {
                    const existed = contactIndex.has(contact.id);
                    setContacts((all) =>
                      existed
                        ? all.map((c) => (c.id === contact.id ? contact : c))
                        : [contact, ...all],
                    );
                    setAlerts((all) =>
                      all.map((a) => {
                        const wanted = alertIds.includes(a.id);
                        const has = a.recipientIds.includes(contact.id);
                        if (wanted === has) return a;
                        return {
                          ...a,
                          recipientIds: wanted
                            ? [...a.recipientIds, contact.id]
                            : a.recipientIds.filter((r) => r !== contact.id),
                        };
                      }),
                    );
                    setNotice(
                      `${contactLabel(contact)} ${existed ? "saved" : "added"}`,
                    );
                  }}
                  onAddMany={(people, kind, operator, alertId) => {
                    const made: Contact[] = people.map((person) => ({
                      id: uid("c"),
                      name: person.name,
                      email: person.email,
                      kind,
                      operator,
                      pending: kind === "member" ? true : undefined,
                    }));
                    setContacts((all) => [...made, ...all]);
                    if (alertId)
                      setAlerts((all) =>
                        all.map((a) =>
                          a.id === alertId
                            ? {
                                ...a,
                                recipientIds: [
                                  ...a.recipientIds,
                                  ...made.map((c) => c.id),
                                ],
                              }
                            : a,
                        ),
                      );
                    setNotice(
                      `${plural(made.length, "recipient", "recipients")} added`,
                    );
                  }}
                  onDelete={(ids) => {
                    const only = ids.length === 1 ? contactIndex.get(ids[0]!) : undefined;
                    setAlerts((all) =>
                      all.map((a) => ({
                        ...a,
                        recipientIds: a.recipientIds.filter(
                          (r) => !ids.includes(r),
                        ),
                      })),
                    );
                    setContacts((all) => all.filter((c) => !ids.includes(c.id)));
                    setNotice(
                      only
                        ? `${contactLabel(only)} removed`
                        : `${plural(ids.length, "recipient", "recipients")} removed`,
                    );
                  }}
                />
              )}
            </div>
          </>
        )}

        <CreateDialog
          key={createCount}
          open={creating}
          onOpenChange={setCreating}
          watchable={watchable}
          zones={zones}
          onDraft={startDraft}
        />
      </div>
    </TooltipProvider>
  );
}

export default AlertsWorkspace;
