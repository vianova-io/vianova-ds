"use client";

import * as React from "react";
import { Info, TriangleAlert, Wrench, X } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import {
  Toast,
  ToastContent,
  ToastPortal,
  ToastProvider,
  ToastViewport,
  createToastManager,
  useToastManager,
} from "@/registry/vianova/ui/toast";
import {
  announcementPhase,
  formatWindow,
  type Announcement,
} from "@/registry/vianova/patterns/announcement-bar";

// Re-exported so a consumer wiring up status toasts has one import, not two.
export type { Announcement };

/**
 * Severity, in the order it escalates.
 *
 * Modelled on the Statuspage status-embed widget Fred pointed at, which ships
 * exactly two states -- incident and maintenance -- and lets you colour each
 * one. Its defaults are `#E67E22` and `#3498DB`; those are Statuspage's brand,
 * not ours, so the mapping below goes through our own semantic roles and the
 * hexes stay out of the codebase.
 *
 * Statuspage collapses incident severity into one colour. We already have the
 * ladder, so `incident` is a degradation and `outage` is the thing being down,
 * and nobody has to invent an orange token to sit between amber and red.
 */
export type StatusToastVariant = "maintenance" | "incident" | "outage";

/**
 * Filled surfaces, matching AnnouncementBar: `--warning` fails contrast as
 * text on a light surface, so every tone fills and takes its own
 * `-foreground` rather than tinting and colouring the text.
 */
const VARIANT_CLASS: Record<StatusToastVariant, string> = {
  maintenance: "bg-info text-info-foreground border-transparent",
  incident: "bg-warning text-warning-foreground border-transparent",
  outage: "bg-destructive text-destructive-foreground border-transparent",
};

const VARIANT_ICON: Record<StatusToastVariant, React.ComponentType<{ className?: string }>> = {
  maintenance: Wrench,
  incident: TriangleAlert,
  outage: TriangleAlert,
};

/**
 * Which variant an announcement deserves.
 *
 * Maintenance stays blue throughout, where AnnouncementBar escalates it to
 * amber as the window nears. That is not an inconsistency: the bar is trying
 * to catch someone mid-task before VIP closes under them, and this card is
 * ambient. Planned work is not a warning, and colouring it like one is how a
 * palette stops meaning anything.
 */
export function statusToastVariant(a: Announcement): StatusToastVariant {
  if (a.kind === "maintenance") return "maintenance";
  return a.endsAt ? "incident" : "outage";
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

function formatUpdated(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(minutes) < 60
      ? [minutes, "minute"]
      : Math.abs(minutes) < 60 * 24
        ? [Math.round(minutes / 60), "hour"]
        : [Math.round(minutes / (60 * 24)), "day"];
  return `Last updated ${RELATIVE.format(value, unit)}`;
}

/**
 * The status card: a small filled panel carrying one announcement, a line of
 * context and a way to read more.
 *
 * Usable on its own, and what `StatusToaster` renders for each queued status
 * toast. The anatomy follows the Statuspage widget because that shape is
 * well-worn and people already read it: mark, headline, the one line that
 * dates it, the link, and a way out.
 */
export function StatusToast({
  announcement,
  variant,
  now,
  onDismiss,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "onDismiss"> & {
  announcement: Announcement;
  variant?: StatusToastVariant;
  /** Pin the instant so "last updated" is stable. Defaults to the clock. */
  now?: number;
  onDismiss?: (announcement: Announcement) => void;
}) {
  const a = announcement;
  const tone = variant ?? statusToastVariant(a);
  const Icon = VARIANT_ICON[tone];
  const instant = now ?? Date.now();

  // Maintenance is defined by its window; an incident is defined by how fresh
  // the news is. Same slot on the card, different question answered.
  const meta =
    a.kind === "maintenance"
      ? formatWindow(a)
      : a.updatedAt
        ? formatUpdated(a.updatedAt, instant)
        : formatWindow(a);

  return (
    <div
      data-slot="status-toast"
      data-variant={tone}
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-full gap-3 rounded-lg border p-3 pr-9 text-left shadow-lg",
        VARIANT_CLASS[tone],
        className
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-pretty">{a.title}</p>
        {/*
          No opacity on the meta line. Measured: 90% over `--destructive` in
          light mode puts this 12px text at 3.83:1, under AA -- the red has a
          lower base ratio (4.57:1) than info or warning, so the dimming that
          survives on those tones fails here. Size and weight carry the
          hierarchy instead.
        */}
        {meta ? <p className="text-xs">{meta}</p> : null}
        {a.href ? (
          <a
            href={a.href}
            className="mt-0.5 w-fit rounded-sm text-xs font-medium underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-current/40"
          >
            {a.linkLabel ?? "View latest updates"}
          </a>
        ) : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={() => onDismiss(a)}
          aria-label="Dismiss status update"
          className="absolute top-2 right-2 grid size-6 shrink-0 place-items-center rounded-sm outline-none hover:bg-current/15 focus-visible:ring-3 focus-visible:ring-current/40"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Its own queue, so a status card never gets bumped by a "Copied" toast. */
export const statusToastManager = createToastManager();

/**
 * Live toast per announcement id, so the queue holds one card per real-world
 * thing rather than one per call.
 */
const live = new Map<string, string>();

/**
 * Put an announcement on screen, or refresh the one already there.
 *
 * `timeout: 0` on purpose. Everything else in a toast queue is a receipt for
 * something the reader just did and can disappear; this is the state of the
 * platform, and it stays until they dismiss it or it stops being true.
 *
 * Which is exactly why this has to be idempotent. A transient toast is fired
 * once by a click, but a status card gets announced on mount, on every poll
 * and on every reconnect -- and a card that never times out turns each of
 * those into another copy. Keyed on the announcement id, a repeat call
 * updates in place; an announcement whose window has closed is taken down.
 */
export function announceStatus(announcement: Announcement, now?: number) {
  const existing = live.get(announcement.id);
  const phase = announcementPhase(announcement, now ?? Date.now());

  if (phase === "done") {
    if (existing) {
      statusToastManager.close(existing);
      live.delete(announcement.id);
    }
    return;
  }

  const options = {
    title: announcement.title,
    type: statusToastVariant(announcement),
    timeout: 0,
    data: { announcement, now },
  };

  if (existing) {
    statusToastManager.update(existing, options);
    return existing;
  }

  const id = statusToastManager.add(options);
  live.set(announcement.id, id);
  return id;
}

/** Take a card down and forget it, so a later announce can add it again. */
export function dismissStatus(announcement: Announcement) {
  const id = live.get(announcement.id);
  if (!id) return;
  statusToastManager.close(id);
  live.delete(announcement.id);
}

type StatusToastData = { announcement: Announcement; now?: number };

function StatusToastList() {
  const manager = useToastManager();

  return manager.toasts.map((item) => {
    const data = item.data as StatusToastData | undefined;
    if (!data?.announcement) return null;
    return (
      <Toast key={item.id} toast={item} className="border-transparent bg-transparent shadow-none">
        <ToastContent className="p-0">
          <StatusToast
            announcement={data.announcement}
            now={data.now}
            variant={item.type as StatusToastVariant | undefined}
            // Through dismissStatus, not manager.close: closing the toast
            // directly would leave the id in `live`, and the next announce
            // would update a card that is no longer on screen.
            onDismiss={() => dismissStatus(data.announcement)}
          />
        </ToastContent>
      </Toast>
    );
  });
}

/**
 * Drop in once, near the root. Pairs with `announceStatus`.
 *
 * Kept separate from the app's ordinary `Toaster` so the two queues cannot
 * crowd each other out of the viewport.
 */
export function StatusToaster({ children }: { children?: React.ReactNode }) {
  return (
    <ToastProvider toastManager={statusToastManager}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <StatusToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}
