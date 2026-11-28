"use client";

import * as React from "react";
import { RotateCw, Wrench } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { cn } from "@/registry/vianova/lib/utils";
import {
  announcementPhase,
  formatViewerWindow,
  formatWindow,
  type Announcement,
} from "@/registry/vianova/patterns/announcement-bar";

/**
 * The time a window is expected to close, on its own. "02:00 CET".
 *
 * Kept separate from the full window string: on this screen the start has
 * already happened and nobody waiting cares when it began.
 */
function formatEnd(a: Announcement): { clock: string; zone?: string } | undefined {
  if (!a.endsAt) return undefined;
  const end = new Date(a.endsAt);
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: a.timeZone,
  }).format(end);
  const zone = new Intl.DateTimeFormat("en-GB", {
    timeZone: a.timeZone,
    timeZoneName: "short",
  })
    .formatToParts(end)
    .find((p) => p.type === "timeZoneName")?.value;
  return { clock, zone };
}

/**
 * A wall clock for the reader's own machine: "14:32".
 *
 * Deliberately the browser's zone and not the announcement's. Everything else
 * on this screen is in the city's zone, because the window belongs to the city
 * -- but the last check happened to the person reading, wherever they are.
 */
function formatClock(at: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
}

/**
 * The screen VIP shows while a maintenance window is open: the platform is
 * down or degraded, and there is nothing to do but wait.
 *
 * Deliberately not a tone-filled surface. A bar borrows colour to catch an eye
 * that is busy elsewhere; this already has the reader's full attention, and a
 * full viewport of amber would read as an error the reader caused. It stays on
 * the ordinary background and lets the words carry it.
 */
export function MaintenanceScreen({
  announcement,
  viewerTimeZone,
  onRetry,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  announcement: Announcement;
  /**
   * The reader's zone. Defaults to the browser's -- pass it in tests and
   * examples, or the baseline pins whatever zone the machine happened to be
   * in. See the same prop on `AnnouncementBar`.
   */
  viewerTimeZone?: string;
  /**
   * Defaults to a reload. In the app, re-fetch the announcement instead.
   *
   * May return a promise, and the button waits for it before saying the check
   * is done. Widening the return type rather than changing it: a
   * `() => void` callback is still assignable, so nothing already passing one
   * has to be touched.
   */
  onRetry?: () => void | Promise<void>;
}) {
  const a = announcement;
  const heading = React.useRef<HTMLHeadingElement>(null);
  const [viewer, setViewer] = React.useState<string | undefined>(viewerTimeZone);
  const [checking, setChecking] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (viewerTimeZone === undefined) {
      setViewer(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
    // The screen has just replaced everything the reader was doing. Put focus
    // where the explanation is, or a screen-reader user is left on a node that
    // no longer exists.
    heading.current?.focus();
  }, [viewerTimeZone]);

  /**
   * "Check again" with something to show for it.
   *
   * It had none: the click either reloaded the page or called `onRetry` and
   * returned, so a check that found the window still open was
   * indistinguishable from a button that did nothing -- and the honest answer
   * ("still down") looks exactly like the screen already on display. Hence
   * both halves: the button says it is working, and the line under it says
   * when it last did, which is the only evidence a check even ran.
   *
   * `await` on a callback that may return nothing is fine -- `await undefined`
   * resolves -- so this handles the sync and async shapes without asking the
   * caller which it is. The guard matters on a slow re-fetch, where the button
   * stays live long enough to be pressed again.
   */
  async function check() {
    if (checking) return;
    setChecking(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        location.reload();
        // The reload replaces the document; leaving `checking` set keeps the
        // spinner up for the frames before it does, rather than flashing back.
        return;
      }
    } finally {
      // Stamped whatever the check returned, including a throw. A failed check
      // is still a check, and the time it happened is what the reader is being
      // told -- not that it succeeded.
      setChecking(false);
      setCheckedAt(Date.now());
    }
  }

  const end = formatEnd(a);
  const viewerWindow = formatViewerWindow(a, viewer);

  return (
    <div
      data-slot="maintenance-screen"
      className={cn(
        "bg-background text-foreground grid min-h-svh w-full place-items-center p-6",
        className
      )}
      {...props}
    >
      <main className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="bg-muted grid size-12 place-items-center rounded-full">
          <Wrench className="size-5" aria-hidden />
        </div>

        <h1
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold text-balance outline-none"
        >
          {a.title}
        </h1>

        {a.scope?.length ? (
          <p className="text-muted-foreground -mt-2 text-sm">{a.scope.join(" · ")}</p>
        ) : null}

        <p className="text-muted-foreground text-sm text-pretty">
          {a.body ?? "Vianova is unavailable while we carry out planned maintenance."}
        </p>

        {end ? (
          <div className="bg-muted/50 w-full rounded-lg border p-4">
            <p className="text-sm">
              Expected back at{" "}
              <time dateTime={a.endsAt} className="font-medium">
                {end.clock} {end.zone}
              </time>
            </p>
            {/*
              The end is a plan, not a promise -- Katell's point: how long an
              intervention runs depends on the intervention. Saying so here is
              cheaper than a reader watching the clock tick past and assuming
              VIP is broken.

              "Some interventions run over" is what this said, and Frederic
              caught it: "run over" is an English idiom that also means being
              hit by a car, and VIP's readers are mostly not reading in their
              first language. Spelled out instead.
            */}
            <p className="text-muted-foreground mt-1 text-xs text-pretty">
              This is the planned end. Some interventions take longer than planned.
            </p>
          </div>
        ) : null}

        {/*
          The full window in the reader's own zone, below the fold of the
          sentence above -- useful for anyone outside the announced city, noise
          for everyone in it.
        */}
        {viewerWindow ? (
          <p className="text-muted-foreground text-xs">{viewerWindow}</p>
        ) : (
          <p className="text-muted-foreground text-xs">{formatWindow(a)}</p>
        )}

        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={check}
            /*
              `aria-busy`, not `disabled`. Disabling the button mid-check takes
              focus off it -- a disabled element is not focusable, so the
              browser drops focus to the body and the reader who just pressed
              it loses their place, which is the same defect being fixed in the
              toast viewport one file over. Re-entry is already handled by the
              guard in `check()`, so the button has nothing to gain by going
              dead, and `aria-busy` is what actually tells a screen reader the
              control is working.
            */
            aria-busy={checking}
            /*
              THE TOUCH-TARGET CONVENTION. Written down in full beside the other
              first use of it, the close button in patterns/status-toast.tsx.

              The short version: VIP is used on tablets and phones, this button
              is 32px (`size="sm"`), and the 32/36/40 ladder that
              e2e/control-size.spec.ts pins is right for a pointer and not for a
              thumb. So it reaches the 44px touch floor only where the pointer is
              coarse, and the fine-pointer height is untouched -- which is why
              the ladder spec needed no changes. On a `Button` this goes through
              `className`, never into a cva size variant.
            */
            className="pointer-coarse:h-11 pointer-coarse:px-4"
          >
            <RotateCw className={checking ? "animate-spin" : undefined} />
            {checking ? "Checking…" : "Check again"}
          </Button>

          {/*
            Not a live region. The button carries its own state through
            `disabled` and its label, which is what a screen reader follows
            while the check runs; announcing a timestamp on top of that is
            noise. This line is here for the reader who pressed the button, got
            the same screen back, and needs to know the screen is current.
          */}
          {checkedAt !== undefined ? (
            <p className="text-muted-foreground text-xs">
              Last checked at{" "}
              <time dateTime={new Date(checkedAt).toISOString()}>{formatClock(checkedAt)}</time>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/**
 * What the gate should conclude. Three states, because the caller has three.
 *
 * `window` is the announced plan and the default: the door is shut for exactly
 * as long as the author said it would be. `closed` and `open` are for a caller
 * who knows better than the plan -- in VIP, the live Statuspage status, where
 * `in_progress` is `closed` and `completed` is `open`.
 *
 * A union rather than a boolean, because "I have no idea" is a real answer and
 * deserves a name. With `closed?: boolean` the two halves of a half-wired
 * caller look identical: `closed={false}` meaning "the API has not answered
 * yet" would hold the door open straight through a window that really is open,
 * and nothing in the type would have warned anyone. Here that caller writes
 * `window` and gets the behaviour it had before it knew anything.
 */
export type MaintenanceGateState = "window" | "closed" | "open";

/**
 * Wrap the app once. While a maintenance window is open the gate swaps
 * everything for `MaintenanceScreen`; the rest of the time it is invisible.
 *
 * Only `maintenance` closes the door. An incident degrades VIP rather than
 * closing it, and locking people out of a product that still half works helps
 * nobody -- that case keeps its AnnouncementBar and stays usable. `gate` does
 * not change that: it overrules the window, never the kind, and the screen it
 * would put up is written about planned work.
 *
 * `gate` exists because the window ends on time and interventions do not.
 * `announcementPhase` goes `done` at `endsAt`, which would let everyone back
 * into a platform that is still mid-migration -- and `endsAt` cannot simply be
 * dropped to avoid that, because it is what the screen shows as "Expected back
 * at". So the plan and the verdict are separated: hold `gate` at `closed` past
 * the planned end and the screen keeps saying when it was meant to be over,
 * under the line that already admits some interventions run over.
 */
export function MaintenanceGate({
  announcement,
  gate = "window",
  now,
  viewerTimeZone,
  onRetry,
  className,
  children,
}: {
  announcement?: Announcement;
  /**
   * Let the announced window decide (the default, and what this did before
   * the prop existed), or override it from what the caller knows.
   */
  gate?: MaintenanceGateState;
  /** Pin the instant to force a state. Live otherwise. */
  now?: number;
  viewerTimeZone?: string;
  onRetry?: () => void | Promise<void>;
  /**
   * Passed through to the screen. The screen fills the viewport by default,
   * which is right when it replaces the app and wrong inside a bounded demo
   * -- `min-h-0 h-full` scopes it to the box it is in.
   */
  className?: string;
  children: React.ReactNode;
}) {
  // Re-checked on a timer, not only on navigation: someone already sitting in
  // VIP when the window opens has to be let out of the app, and someone
  // staring at the screen when it closes should get back in without being
  // told to refresh.
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (now !== undefined) return;
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [now]);

  if (!announcement || announcement.kind !== "maintenance") return <>{children}</>;

  const phase = announcementPhase(announcement, now ?? Date.now());
  const closed = gate === "closed" || (gate === "window" && phase === "active");
  if (!closed) return <>{children}</>;

  return (
    <MaintenanceScreen
      announcement={announcement}
      viewerTimeZone={viewerTimeZone}
      onRetry={onRetry}
      className={className}
    />
  );
}
