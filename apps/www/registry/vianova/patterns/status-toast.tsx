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
  formatPhaseRelative,
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
 *
 * For an incident, `impact` decides. A minor degradation is amber and a major
 * or critical one is red, whether or not anyone has put a time on the end of
 * it -- which is the right question, because how bad it is and how long it
 * will last are two different things.
 *
 * Without `impact` the end date still decides, as it always has. That fallback
 * is not legacy: a known end means somebody has scoped the problem, which is
 * the best signal available to a caller with no Statuspage behind it, and
 * every announcement authored by hand is such a caller. VIP sets `impact`
 * because it polls Statuspage; a config file has nothing to set it from.
 *
 * Derived here rather than passed as `variant` on purpose. `announceStatus`
 * puts this on the queued toast as its `type` and `StatusToastList` reads it
 * back off the item, so a tone the caller sets by hand reaches the card only
 * on the direct-render path and never through the queue.
 */
export function statusToastVariant(a: Announcement): StatusToastVariant {
  if (a.kind === "maintenance") return "maintenance";
  if (a.impact) return a.impact === "minor" ? "incident" : "outage";
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
  titleId,
  onDismiss,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "onDismiss"> & {
  announcement: Announcement;
  variant?: StatusToastVariant;
  /** Pin the instant so "last updated" is stable. Defaults to the clock. */
  now?: number;
  /**
   * Put this id on the card's headline, so something outside the card can name
   * itself from it. `StatusToastList` uses it to give the toast dialog Base UI
   * wraps the card in an accessible name, without an extra copy of the title
   * for a screen reader to read twice.
   */
  titleId?: string;
  onDismiss?: (announcement: Announcement) => void;
}) {
  const a = announcement;
  const tone = variant ?? statusToastVariant(a);
  const Icon = VARIANT_ICON[tone];
  const instant = now ?? Date.now();

  // Maintenance is defined by its window; an incident is defined by how fresh
  // the news is. Same slot on the card, different question answered.
  //
  // The window alone is not enough for maintenance, though: "Sat 8 Nov,
  // 22:00-02:00 CET" reads identically whether that window is open right now or
  // a week out, and the one thing a reader wants off this card is which. So the
  // window carries AnnouncementBar's phase vocabulary after it -- "ends in
  // about an hour" against "starts in 3 days" -- from the bar's own helper
  // rather than a second copy of the wording.
  const meta =
    a.kind === "maintenance"
      ? [formatWindow(a), formatPhaseRelative(a, instant)].filter(Boolean).join(" · ") ||
        undefined
      : a.updatedAt
        ? formatUpdated(a.updatedAt, instant)
        : formatWindow(a);

  return (
    /*
      No `role="status" aria-live="polite"` on this card, deliberately.

      Base UI's toast viewport is itself a live region -- it ships
      `aria-live="polite" aria-atomic="false" aria-relevant="additions text"`
      -- so a card inside it that declared its own put the same sentence inside
      two nested polite regions, and the arrival of one status update was
      announced twice.

      The viewport won. It is the layer that actually knows a card has
      ARRIVED, it is what makes every other toast in the system announce at
      all, and it belongs to Base UI, so removing it would mean forking the
      viewport. The card's own region was the newer and the narrower of the
      two, and it was also doing nothing in the case it looks like it serves:
      a live region announces changes, so the three cards in
      `status-toast-default` were never announced by it either way -- they are
      present at load.

      Rendering a card on its own and toggling it in IS the case that loses
      something. `role` and `aria-live` both spread from props below, so that
      caller passes `role="status" aria-live="polite"` explicitly and gets the
      old behaviour back, without every queued card paying for it.
    */
    <div
      data-slot="status-toast"
      data-variant={tone}
      className={cn(
        "relative flex w-full gap-3 rounded-lg border p-3 pr-9 text-left shadow-lg",
        VARIANT_CLASS[tone],
        className
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />

      <div className="flex min-w-0 flex-col gap-0.5">
        <p id={titleId} className="text-sm font-medium text-pretty">
          {a.title}
        </p>
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
          /*
            THE TOUCH-TARGET CONVENTION -- the registry's first use of it.

            VIP is used on tablets and phones in the field, not only on desks,
            and this control is 24px. That clears WCAG 2.2 AA (2.5.8 asks for
            24x24) and is still a poor thing to hit with a thumb.

            The control ladder is NOT the place to fix it: e2e/control-size.spec.ts
            pins sm 32 / default 36 / lg 40 across six control types, and those
            numbers are right for a pointer. So a control grows to the 44px
            touch floor only where the pointer is actually coarse:

                pointer-coarse:size-11      icon-only controls
                pointer-coarse:h-11         controls with a label

            Tailwind v4 ships `pointer-coarse` built in -- nothing to register.
            Put it on the element's own className, never inside a cva size
            variant: a variant reaches every control in the system, including
            the ladder's own preview page under touch emulation. On a `Button`,
            pass it through `className`; tailwind-merge keeps both the variant's
            height and this one, because the modifier puts them in separate
            groups, so the fine-pointer size is untouched.

            These two controls grow their real box because neither has any
            slop to grow instead -- this one is parked absolutely over the
            card's corner, where padding it out would overlap the link beneath
            it. It is not a rule against slop. Slop conforms: 2.5.8 is about the
            region that accepts the pointer action, so `ToastClose`'s 32px box
            with 48px of `after:-inset-2` around it already clears the floor and
            is deliberately left alone.

            Do not write a registry-wide rule off getBoundingClientRect. Slop is
            invisible to a rect, but it is NOT unmeasurable: elementFromPoint
            resolves a hit on a `::after` back to the element that owns it, so
            probing outward from a control's centre reads the real tap area in
            pixels. Checkbox is a 16x16 box with a 38x28 tap area -- a rect-only
            sweep calls that a 16px failure and sends someone off to grow a box
            that is 16px on purpose.

            Two numbers exist for a control inside a Label and the census picks
            the smaller deliberately. Checkbox's own aimable area is 38x28;
            Label makes the whole 187x16 row clickable, verified by clicking
            164px from the box. 187 is why a checkbox in a form is fine to tap;
            38 is why one outside a Label would not be. Counting the Label would
            report every checkbox as a 187px target and hide exactly what the
            audit looks for.

            The registry-wide census and that ruling are
            e2e/touch-target-floor.spec.ts; e2e/touch-target.spec.ts is the
            per-control gate that asserts these two controls.
          */
          className="absolute top-2 right-2 grid size-6 shrink-0 place-items-center rounded-sm outline-none hover:bg-current/15 focus-visible:ring-3 focus-visible:ring-current/40 pointer-coarse:size-11"
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
  const titlePrefix = React.useId();

  return manager.toasts.map((item) => {
    const data = item.data as StatusToastData | undefined;
    if (!data?.announcement) return null;
    // Base UI renders each toast as role="dialog" and names it from whatever
    // `Toast.Title` rendered. This list renders a whole card instead of the
    // stock title/description pair, so there was no Title and every status
    // card was a dialog with no accessible name -- announced as "dialog" and
    // nothing else. Pointed at the card's own visible headline rather than a
    // screen-reader-only copy of it, so the title is in the tree once.
    const titleId = `${titlePrefix}-${item.id}`;
    return (
      <Toast
        key={item.id}
        toast={item}
        aria-labelledby={titleId}
        className="border-transparent bg-transparent shadow-none"
      >
        <ToastContent className="p-0">
          <StatusToast
            announcement={data.announcement}
            now={data.now}
            titleId={titleId}
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
export function StatusToaster({
  children,
  label = "Platform status",
  hotkey = "F6",
}: {
  children?: React.ReactNode;
  /**
   * The region's name in a screen reader's landmark list.
   *
   * Not "Notifications", which is Base UI's default for every viewport and
   * therefore what the app's ordinary `Toaster` is already called. Two regions
   * with one name is a landmark list that cannot tell a reader which of them
   * holds the reason the platform is misbehaving.
   */
  label?: string;
  /**
   * The key that moves focus into this region. Keeps Base UI's F6.
   *
   * Free to keep: VIP's app toasts answer F8, so give the ordinary `Toaster`
   * `hotkey="F8"` and the two stop fighting over one key.
   */
  hotkey?: string;
}) {
  return (
    <ToastProvider toastManager={statusToastManager}>
      {children}
      <ToastPortal>
        <ToastViewport label={label} hotkey={hotkey}>
          <StatusToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}
