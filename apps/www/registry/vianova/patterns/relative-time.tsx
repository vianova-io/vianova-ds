"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const dateFormat = (timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });

const exactFormat = (timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

/**
 * "Just now", "3 h ago", "3 d ago", then the date itself.
 *
 * Relative only while relative is the shorter thing to read. Past a week an
 * age stops being a feeling and becomes arithmetic -- "23 d ago" has to be
 * counted back to a date before it means anything -- so from there the date
 * is simply given.
 */
export function formatRelative(
  iso: string,
  now: number,
  timeZone?: string,
): string {
  const then = Date.parse(iso);
  const age = now - then;
  if (age < HOUR) return "Just now";
  if (age < DAY) return `${Math.round(age / HOUR)} h ago`;
  if (age < 7 * DAY) return `${Math.round(age / DAY)} d ago`;
  return dateFormat(timeZone).format(then);
}

/**
 * When something happened, as a list wants it: how long ago, with the exact
 * day and time one hover away.
 *
 * Four lists wrote dates four ways -- "Nov 12, 2026, 9:00:00 AM", "12 Nov
 * 2026", "3 d ago" and a bare "Date" column -- so the same Tuesday looked
 * like four different facts. A list is scanned for what is recent, which an
 * age answers at a glance; the precise moment is for the one row you stop
 * on, and that is what the tooltip is.
 *
 * `now` and `timeZone` exist for the two things a browser cannot know. A
 * demo with a fixed "today" passes `now`, so its ages never drift. A page
 * whose times belong to a place -- an alert sent at 09:00 in Munich -- passes
 * `timeZone`, so the hover says that clock and not the reader's.
 *
 * Without `now`, the age is worked out in the browser, after mount: the
 * server cannot know when the page will be read, and an age baked in at
 * build time is wrong by however long ago the build was. Until then it shows
 * the date, which is true whenever it is read.
 */
export function RelativeTime({
  iso,
  now,
  timeZone,
  never = "Never",
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "children" | "dateTime"> & {
  /** ISO 8601. Absent, the cell says `never`. */
  iso?: string;
  /** The moment to count back from, in ms. Defaults to the reader's clock. */
  now?: number;
  /** IANA zone for the dates and the hover. Defaults to the reader's own. */
  timeZone?: string;
  /** What to say when it has not happened. */
  never?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!iso) {
    return (
      <span
        data-slot="relative-time"
        className={cn("text-muted-foreground", className)}
      >
        {never}
      </span>
    );
  }

  // Before mount the reader's zone is unknown, so UTC stands in: the same
  // string on the server and in the browser's first paint.
  const zone = timeZone ?? (mounted ? undefined : "UTC");
  const clock = now ?? (mounted ? Date.now() : undefined);
  const then = Date.parse(iso);

  return (
    <time
      data-slot="relative-time"
      dateTime={iso}
      title={exactFormat(zone).format(then)}
      className={cn("whitespace-nowrap", className)}
      {...props}
    >
      {clock === undefined
        ? dateFormat(zone).format(then)
        : formatRelative(iso, clock, zone)}
    </time>
  );
}
