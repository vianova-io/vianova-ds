"use client";

import * as React from "react";
import { Info, TriangleAlert, Wrench, X } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * `maintenance` is a planned intervention that takes VIP down or degrades it
 * for users -- a DB migration, a restart, a security update. Affected cities
 * are emailed five working days ahead, so these are announced well in advance
 * and stay rare.
 *
 * A routine deploy is NOT maintenance. Backend ships about five times a day
 * and frontend once; wiring this to the deploy pipeline would leave a banner
 * up around the clock, which is the fastest way to teach everyone to ignore
 * it. Announcements are authored by hand, deliberately.
 */
export type AnnouncementKind = "maintenance" | "info" | "incident";

/**
 * Where an announcement sits relative to its window. Derived from the dates,
 * never set by the caller -- a notice that says "in progress" while the window
 * closed an hour ago is worse than no notice.
 */
export type AnnouncementPhase = "scheduled" | "imminent" | "active" | "done";

export type Announcement = {
  /** Stable across renders and deploys: dismissal is remembered against it. */
  id: string;
  kind?: AnnouncementKind;
  title: string;
  body?: string;
  /**
   * ISO 8601 with an offset. A bare `yyyy-mm-ddThh:mm` is read as local time.
   *
   * A maintenance announcement needs both: the planned start and the planned
   * end are the whole payload, and how long the intervention actually takes
   * is not something the author can promise. An incident has a start and no
   * known end, which is why these stay optional on the type.
   */
  startsAt?: string;
  endsAt?: string;
  /**
   * When the team last said something about this. Incidents only, where it is
   * the most reassuring line on the card -- "updated 20 minutes ago" says
   * someone is on it in a way a start time never does.
   */
  updatedAt?: string;
  /** IANA zone the window was authored in, e.g. "Europe/Berlin". */
  timeZone?: string;
  /** Affected Solutions, Tools or feeds. Shown after the title. */
  scope?: string[];
  href?: string;
  linkLabel?: string;
  dismissible?: boolean;
  /** Hours before the start at which the tone escalates. Default 24. */
  leadTimeHours?: number;
};

/**
 * Tones are solid fills, not tinted surfaces with coloured text.
 *
 * `--warning` fails contrast as text on a light surface -- the same reason
 * StatusBadge keeps its label in the foreground colour and lets the dot carry
 * the state. Filling the bar and taking the matching `-foreground` sidesteps
 * that, and gives a platform-wide notice the weight it should have.
 *
 * `--warning` is the same amber in light and dark, so that row needs no
 * dark-mode fork. That is deliberate, not an oversight.
 */
const TONE_CLASS: Record<"info" | "warning" | "destructive", string> = {
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const KIND_ICON: Record<AnnouncementKind, React.ComponentType<{ className?: string }>> = {
  maintenance: Wrench,
  info: Info,
  incident: TriangleAlert,
};

const HOUR = 60 * 60 * 1000;

/** Where `instant` sits relative to the announcement's window. */
export function announcementPhase(a: Announcement, now: number): AnnouncementPhase {
  const start = a.startsAt ? Date.parse(a.startsAt) : undefined;
  const end = a.endsAt ? Date.parse(a.endsAt) : undefined;

  if (end !== undefined && now >= end) return "done";
  if (start === undefined) return "active";
  if (now >= start) return "active";

  const lead = (a.leadTimeHours ?? 24) * HOUR;
  return start - now <= lead ? "imminent" : "scheduled";
}

function toneFor(a: Announcement, phase: AnnouncementPhase) {
  if (a.kind === "incident") return "destructive" as const;
  return phase === "scheduled" ? ("info" as const) : ("warning" as const);
}

/**
 * The window in the zone it was authored in: "Sat 8 Nov, 22:00–02:00 CET".
 *
 * Both ends are formatted in `timeZone` rather than read as local time. A
 * maintenance window belongs to the city whose data goes dark, and reading its
 * calendar day locally moves it a day for anyone west of Greenwich -- the same
 * trap `schedule-editor` calls out.
 */
export function formatWindow(a: Announcement): string | undefined {
  if (!a.startsAt) return undefined;
  const zone = a.timeZone;
  const start = new Date(a.startsAt);
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: zone,
    }).format(d);
  const clock = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zone,
    }).format(d);
  const zoneName = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    timeZoneName: "short",
  })
    .formatToParts(start)
    .find((p) => p.type === "timeZoneName")?.value;

  if (!a.endsAt) return `${day(start)}, ${clock(start)} ${zoneName ?? ""}`.trim();

  const end = new Date(a.endsAt);
  // A window that runs past midnight has to name the second day, or
  // "22:00–02:00" reads as a twenty-hour outage running backwards. The
  // weekday is dropped on that second date -- it is always the next day, and
  // repeating "Sat … Sun" is what pushed this bar onto two lines.
  const endDay = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).format(end);
  const head = `${day(start)}, ${clock(start)}`;
  return day(start) === day(end)
    ? `${head}–${clock(end)} ${zoneName ?? ""}`.trim()
    : `${head} – ${endDay}, ${clock(end)} ${zoneName ?? ""}`.trim();
}

/**
 * The same window as a bare clock range in the reader's own zone.
 *
 * Clock only, no dates: the full date is right next to it in the announced
 * zone, and repeating it doubles the length of the bar to say nothing new.
 */
export function formatViewerWindow(
  a: Announcement,
  viewer: string | undefined
): string | undefined {
  if (!a.startsAt || !a.timeZone || !viewer || viewer === a.timeZone) return undefined;
  const clock = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: viewer,
    }).format(new Date(iso));
  const range = a.endsAt ? `${clock(a.startsAt)}–${clock(a.endsAt)}` : clock(a.startsAt);
  return `${range} your time`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** "in 3 days", "starts in 40 minutes", "ends in about an hour". */
function formatRelative(a: Announcement, phase: AnnouncementPhase, now: number): string | undefined {
  const target =
    phase === "active" ? (a.endsAt ? Date.parse(a.endsAt) : undefined) : a.startsAt ? Date.parse(a.startsAt) : undefined;
  if (target === undefined || Number.isNaN(target)) return undefined;

  const delta = target - now;
  const minutes = Math.round(delta / 60000);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(minutes) < 60
      ? [minutes, "minute"]
      : Math.abs(minutes) < 60 * 24
        ? [Math.round(minutes / 60), "hour"]
        : [Math.round(minutes / (60 * 24)), "day"];

  const when = RELATIVE.format(value, unit);
  return phase === "active" ? `ends ${when}` : `starts ${when}`;
}

const STORAGE_PREFIX = "vianova.announcement.dismissed.";

/**
 * Dismissal is remembered per announcement *and per phase*.
 *
 * Waving away a window three days out should not also silence the bar on the
 * night it happens, so the stored phase is compared, not just the id.
 */
function readDismissed(id: string): AnnouncementPhase | undefined {
  try {
    return (window.localStorage.getItem(STORAGE_PREFIX + id) as AnnouncementPhase) ?? undefined;
  } catch {
    // Private windows throw on access. A bar that shows twice beats one that crashes.
    return undefined;
  }
}

function writeDismissed(id: string, phase: AnnouncementPhase) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, phase);
  } catch {
    /* no-op */
  }
}

/**
 * A platform-wide notice carrying a scheduled window: planned maintenance, a
 * live incident, a one-off announcement.
 *
 * Built for VIA-1136 -- maintenance announcements should carry their times and
 * appear in the product rather than arriving by email. It takes a plain data
 * object so the same bar serves a hardcoded config today and an API later.
 *
 * Sits in `AppShell`'s `banner` slot, above the header and outside the scroll
 * container, so it stays put while the page moves.
 *
 * This is the lead-up only. Once a maintenance window opens VIP is not
 * usable, so the bar is the wrong shape for it -- `MaintenanceGate` takes
 * over and blocks the whole screen. An incident is different: it degrades
 * rather than closes, so its bar does stay up while it runs.
 */
export function AnnouncementBar({
  announcement,
  now,
  viewerTimeZone,
  onDismiss,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  announcement: Announcement;
  /**
   * The instant to judge the window against. Defaults to the current time;
   * pass it to pin the phase, which is what keeps the visual baselines stable.
   */
  now?: number;
  /**
   * The reader's zone, for the "your time" gloss. Defaults to whatever the
   * browser reports.
   *
   * Worth passing in a test or an example: Playwright inherits the machine's
   * zone, so a baseline taken on a London laptop and one taken on a UTC runner
   * disagree about a string neither of them pinned.
   */
  viewerTimeZone?: string;
  onDismiss?: (announcement: Announcement) => void;
}) {
  const a = announcement;
  const instant = now ?? Date.now();
  const phase = announcementPhase(a, instant);
  const [dismissedAt, setDismissedAt] = React.useState<AnnouncementPhase | undefined>(undefined);

  // Mount-gated: localStorage, the reader's zone and the relative hint are
  // each unknown on the server, and rendering a guess hydrates into a
  // mismatch. Anything the caller pins is exempt -- it is the same on both
  // sides, which is what makes a pinned example render in one pass.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    setDismissedAt(readDismissed(a.id));
  }, [a.id]);

  if (phase === "done") return null;
  if (mounted && dismissedAt === phase) return null;

  const tone = toneFor(a, phase);
  const Icon = KIND_ICON[a.kind ?? "maintenance"];
  const windowText = formatWindow(a);
  const viewer =
    viewerTimeZone ?? (mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined);
  const viewerText = formatViewerWindow(a, viewer);
  const relativeText = now !== undefined || mounted ? formatRelative(a, phase, instant) : undefined;
  // An active window stays up. Dismissing the bar for an outage already under
  // way just hides the explanation for what the reader is looking at.
  const canDismiss = (a.dismissible ?? true) && phase !== "active";

  function dismiss() {
    setDismissedAt(phase);
    writeDismissed(a.id, phase);
    onDismiss?.(a);
  }

  return (
    <div
      data-slot="announcement-bar"
      data-tone={tone}
      data-phase={phase}
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm",
        // Room for the dismiss, which is parked rather than laid out -- on a
        // wrapped bar `ml-auto` strands it on the last line beside the link.
        // Alert takes the same approach with AlertAction.
        canDismiss && "pr-10",
        TONE_CLASS[tone],
        className
      )}
      {...props}
    >
      <Icon className="size-4 shrink-0" />
      <span className="font-medium">{a.title}</span>

      {/*
        Hierarchy here is weight, not opacity. Measured on the shipped tones:
        dimming the secondary text to 80% drops it to 4.23:1 on `info` in
        light mode, and 70% fails AA on every tone. 90% is the floor that
        clears 4.5:1 everywhere (worst case 4.92:1, info light), so that is as
        far down as this goes.
      */}
      {a.scope?.length ? <span className="opacity-90">{a.scope.join(" · ")}</span> : null}
      {a.body ? <span className="opacity-90">{a.body}</span> : null}

      {windowText ? (
        <span>
          <time dateTime={a.startsAt}>{windowText}</time>
          {viewerText ? <span className="opacity-90"> ({viewerText})</span> : null}
        </span>
      ) : null}

      {relativeText ? <span className="opacity-90">{relativeText}</span> : null}

      {a.href ? (
        <a
          href={a.href}
          className="rounded-sm font-medium underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-current/40"
        >
          {a.linkLabel ?? "Details"}
        </a>
      ) : null}

      {canDismiss ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute top-1.5 right-2 grid size-6 shrink-0 place-items-center rounded-sm outline-none hover:bg-current/15 focus-visible:ring-3 focus-visible:ring-current/40"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
