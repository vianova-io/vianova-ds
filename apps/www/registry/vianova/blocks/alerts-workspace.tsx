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
 *   across everything. So the Recipients view edits that one list, and
 *   swapping someone is changing their address there: every alert follows.
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
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserCog,
  Users,
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
import { Textarea } from "@/registry/vianova/ui/textarea";
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
    lastSentAt: "2026-11-26T07:00:00Z",
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

/**
 * The IANA name behind "Munich time". Every date on this page is formatted in
 * it rather than in the reader's zone, for the reason the hours are: an alert
 * sent at 09:00 in Munich was sent at 09:00, whoever is looking and from where.
 * It also makes the server and the browser print the same string.
 */
const SCOPE_TZ = "Europe/Berlin";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: SCOPE_TZ });
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCOPE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCOPE_TZ,
  day: "numeric",
  month: "short",
});
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCOPE_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "12 Nov 2026". */
const formatDate = (iso: string) => dateFmt.format(Date.parse(iso));

/**
 * "Today 10:00", "Yesterday 17:42", "14 Nov 09:30" -- or nothing, for an alert
 * that has never sent. A day and a time rather than "3 h ago": the question
 * someone brings to this column is "did this morning's one go out", and an
 * hour on a clock answers it where an age has to be subtracted first.
 */
function formatSent(iso: string | undefined, now = NOW) {
  if (!iso) return null;
  const then = Date.parse(iso);
  const time = timeFmt.format(then);
  const day = dayKeyFmt.format(then);
  if (day === dayKeyFmt.format(now)) return `Today ${time}`;
  if (day === dayKeyFmt.format(now - 86_400_000)) return `Yesterday ${time}`;
  return `${dayFmt.format(then)} ${time}`;
}

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
        getTagLabel={(v) => {
          const c = contacts.find((x) => x.id === v);
          return c ? contactLongLabel(c) : v;
        }}
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
    ...chosenContacts.map(contactLongLabel),
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
      className="text-primary focus-visible:ring-ring max-w-full scroll-m-1 truncate rounded underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
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

/**
 * The list, on Katell's columns: Name, Created by, Date, Sent to, Last sent,
 * On.
 *
 * No tick boxes and no bulk bar. An alert is switched off far more often than
 * it is deleted, the switch is already on the row, and deleting one is a thing
 * you do having opened it and looked -- so Delete lives in the editor, and the
 * table gives its first column back to the name.
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
  /** Opens one recipient, in Recipients. */
  onPerson: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [on, setOn] = React.useState<OnFilter>("all");
  /** The alert whose whole recipient list is open. */
  const [listing, setListing] = React.useState<string | null>(null);

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
      </div>

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
          <Table inset className="min-w-[60rem] table-fixed">
            <caption className="sr-only">
              Alerts in {scope}, newest first. Rules that file a report are
              listed but set on their regulation.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Created by</TableHead>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="w-72">Sent to</TableHead>
                <TableHead className="w-36">Last sent</TableHead>
                <TableHead className="w-20 text-right">On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status === "loading"
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
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
                    const found = rules.get(alert.ruleId);
                    const report = alert.kind === "report";
                    const sent = formatSent(alert.lastSentAt);
                    return (
                      <TableRow key={alert.id}>
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
                          <span className="block truncate">
                            {alert.createdBy}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(alert.createdAt)}
                        </TableCell>
                        <TableCell>
                          <SentTo
                            people={peopleOf(alert, contacts)}
                            onPerson={onPerson}
                            onAll={() => setListing(alert.id)}
                          />
                        </TableCell>
                        <TableCell
                          className={
                            sent ? "font-medium" : "text-muted-foreground"
                          }
                        >
                          {sent ?? "Never sent"}
                        </TableCell>
                        <TableCell>
                          {/* Against the right edge, not under the left of
                              its header. Tab scrolls a control only just into
                              view, and in the last column that leaves its ring
                              cut by the table's own scroll edge -- measured at
                              2.4px on the report badge. At the end of the row
                              the cell's inset is always there to paint on. */}
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
  /** The alerts someone can be put on: never the rules that file a report. */
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
              <FieldDescription className="text-destructive">
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
                className="text-destructive hover:text-destructive"
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

/**
 * The recipients, on Katell's columns: who, and which alerts they get.
 *
 * It is the scope's report contacts -- the list Settings › Report contacts
 * edits and the report rules read -- seen from the other side: not who an
 * alert goes to, but what a person gets. That is the view someone needs when
 * a colleague leaves, and it is why a name opens that person rather than a
 * menu of things to do to them.
 *
 * Tick boxes here, where the alerts list has none. Alerts are switched off,
 * not deleted, and one at a time; people leave in groups -- an operator loses
 * a contract, a team is reorganised -- and removing eleven addresses one
 * dialog at a time is the chore this tab exists to end.
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
  const [selected, setSelected] = React.useState<string[]>([]);

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

  /** Only alerts can be given or taken here; a report rule's people are its own. */
  const editable = alerts.filter((a) => a.kind === "alert");
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
              Clear selection
            </Button>
          </div>
        </div>
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
              Everyone on the scope&rsquo;s report contacts list, and the
              alerts they get.
            </caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                <TableHead className="w-[45%]">Recipient</TableHead>
                <TableHead>Gets these alerts</TableHead>
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
                            className="text-primary focus-visible:ring-ring flex min-w-0 scroll-m-1 items-center gap-1.5 rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
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
                              className="hover:text-primary focus-visible:ring-ring max-w-full scroll-m-1 rounded text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {alert.name}
                              {i < theirs.length - 1 ? "," : ""}
                            </button>
                          ))}
                        </span>
                      )}
                    </TableCell>
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
  /**
   * Held here, not in the Recipients view, because two things outside it open
   * its dialogs: Add recipient in the band, and a name pressed in the alerts
   * list.
   */
  const [recipientDialog, setRecipientDialog] =
    React.useState<RecipientDialogState>(null);
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
                    // Alerts only: who a report rule tells is set on its
                    // regulation, and is not this dialog's to change.
                    setAlerts((all) =>
                      all.map((a) => {
                        if (a.kind !== "alert") return a;
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
      </div>
    </TooltipProvider>
  );
}

export default AlertsWorkspace;
