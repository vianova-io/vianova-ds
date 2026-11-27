"use client";

import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/registry/vianova/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/vianova/ui/tooltip";

/**
 * The standing icon rail down the left of a Solution: the few places you can
 * go, always visible, never more than one click away.
 *
 * Not `Sidebar collapsible="icon"`. That is a labelled sidebar in its narrow
 * STATE -- it carries a provider, a cookie, a keyboard shortcut and a width
 * that the user is expected to change, because its whole point is that the
 * labels come back. A rail has no wide state to return to. The labels live in
 * tooltips permanently, the width is a constant, and nothing about it is
 * worth persisting. Building it as a collapsed sidebar means shipping the
 * machinery for an expansion that never happens, and inheriting an active
 * treatment designed for a 256px row.
 *
 * Which is the part that matters here. At 256px an active row can be a filled
 * bar and read as one; at 44px the same fill is a chip, and the usual fix is
 * a coloured stroke pinned to the rail's edge. That stroke is a third thing
 * to draw, it dictates the rail's left padding, and it says nothing the
 * icon's own colour does not already say. So the rail does without it: the
 * active destination is the one whose icon is `sidebar-primary`.
 *
 * The soft `sidebar-accent` tile stays, and is not decoration. Against the
 * rail it is only about 1.1:1, so it is no good as a contrast cue -- but it
 * is a non-colour one, which is what keeps the active state from resting on
 * hue alone (WCAG 1.4.1). `aria-current="page"` carries it for anyone not
 * looking at either.
 *
 * Chosen over four quieter and louder alternatives (glyph alone, a coloured
 * hairline, a tinted wash, a filled chip). It is the smallest step from what
 * VIP ships, it is the only one of the five that keeps a non-colour cue
 * without introducing a second coloured surface, and the tile gives the 44px
 * target a visible edge. The cost is measured and accepted: the neutral fill
 * lightens the backdrop in dark, so the glyph reads 8.0:1 on the tile where
 * it would read 9.5:1 on the bare rail.
 *
 * Items are 44px, not the 36px control ladder. The rail is the one piece of
 * chrome that gets used on a tablet in a van, and 44px is the touch target
 * that survives that; the ladder exists to line controls up in a toolbar row,
 * which a vertical rail never has to do.
 */
export function NavRail({
  className,
  children,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="nav-rail"
      className={cn(
        // The colour an active item takes, unless the item names its own.
        // Declared here rather than on each item so a rail whose Tools have
        // no colours of their own needs to say nothing at all.
        //
        // `-ink`, not `--sidebar-primary`: the glyph is ink on the rail, and
        // `--sidebar-primary` is the FILL half of the role -- teal-700 in every
        // theme, which on a dark rail is 3.2:1 and on the accent tile under it
        // closer to 2.8. The ink half is the per-theme value that stays
        // readable on both, and that distinction is the whole reason it exists.
        "[--nav-rail-accent:var(--sidebar-primary-ink)]",
        "bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r py-2",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

/**
 * The mark, or whatever identifies the Solution. Sized to the rail rather
 * than to an item: it is not a destination and must not look like one.
 */
export function NavRailHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="nav-rail-header"
      className={cn(
        "flex h-11 w-full shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A run of destinations. Scrolls on its own if there are more than fit, so a
 * long list never pushes the footer off the bottom of the rail.
 *
 * `overflow-y-auto` would clip a focus ring, which e2e/focus-ring.spec.ts
 * treats as a defect and is right to -- the ring is the keyboard user's only
 * position indicator. The horizontal padding gives it room to paint inside
 * the scrollport.
 */
export function NavRailGroup({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="nav-rail-group"
      className={cn(
        "flex w-full min-h-0 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The same run of destinations, pushed to the bottom: settings, help, the
 * account. A list rather than a plain box, because what goes in it is
 * `NavRailItem`s and an `li` outside a `ul` is not markup anyone should have
 * to debug.
 */
export function NavRailFooter({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="nav-rail-footer"
      className={cn(
        "mt-auto flex w-full shrink-0 flex-col items-center gap-1 px-1.5 pt-1",
        className,
      )}
      {...props}
    />
  );
}

export function NavRailSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="nav-rail-separator"
      role="separator"
      aria-orientation="horizontal"
      className={cn("bg-sidebar-border my-1 h-px w-8 shrink-0", className)}
      {...props}
    />
  );
}

/**
 * One destination.
 *
 * `label` is required and is doing three jobs: the tooltip, the accessible
 * name, and the thing that stops an icon-only rail from being a guessing
 * game. An item without one is not an item worth having in a rail.
 *
 * Renders a `button` by default and a link through `render` -- Base UI's
 * composition prop, not `asChild`:
 *
 *   <NavRailItem render={<Link href="/map" />} icon={<Map />} label="Map" />
 *
 * `color` is the Tool's own colour, for a product that gives each Tool one.
 * It arrives as a CSS custom property rather than a class, because the set of
 * Tools is the product's to decide and Tailwind cannot build a class for a
 * colour it has never seen. A rail that passes nothing falls back to the
 * sidebar primary, which is the whole of the single-colour case.
 *
 * Only the ACTIVE item spends it. A rail that paints all eight Tools in all
 * eight colours at rest has no colour left to say which one you are in.
 *
 * Use `--tool-accent-1` through `--tool-accent-8`. They exist for exactly
 * this and nothing else, and they are theme-aware, which a Tool colour has to
 * be: the glyph sits on the accent TILE, not on the rail, and the light tile
 * and the white-label themes' 700-step tiles are at opposite ends of the
 * range, so one fixed hex cannot clear 3:1 on both.
 *
 * Do NOT reach for `--chart-categorical-*`, which is the set everyone tries
 * first. Those eight were derived to separate from each other as marks on a
 * plot, never to be read against a surface; several fall under 3:1 on the
 * light tile, and they are persisted in saved `CategoryStyle` records, so
 * they are not free to change.
 *
 * Eight is the ceiling, not a round number: once a Tool colour has to clear
 * the tile in all six themes, hold an even visual weight, stay separable
 * under two colour-deficiency models, and keep clear of `destructive`, the
 * wheel has room for about eight. A product with more Tools than that repeats
 * them, which costs nothing here -- only the ACTIVE item is coloured, so two
 * Tools sharing a hue are never on screen in colour at the same time.
 */
export function NavRailItem({
  icon,
  label,
  active = false,
  color,
  render,
  className,
  style,
  ...props
}: useRender.ComponentProps<"button"> &
  Omit<React.ComponentProps<"button">, "children" | "color"> & {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    /** Any CSS colour, including `var(--chart-categorical-3)`. */
    color?: string;
  }) {
  const element = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          // `scroll-my-1.5` is the focus ring's, not the layout's. Focusing an
          // item in a rail long enough to scroll makes the browser align it to
          // the scrollport edge, which cuts the ring off flush -- the exact
          // defect e2e/focus-ring.spec.ts exists to catch, and it caught this.
          // The scroll margin keeps the ring inside the group's own padding.
          "flex size-11 scroll-my-1.5 items-center justify-center rounded-lg border border-transparent bg-clip-padding transition-colors outline-none",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent",
          "focus-visible:border-sidebar-ring focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
          // The whole active treatment, and all of it: a quiet surface and a
          // coloured glyph. Nothing is pinned to the rail's edge.
          //
          // Hover is split rather than shared. Both states take the same
          // surface, so if hover also set the foreground it would drain the
          // colour out of the active item the moment the pointer crossed it --
          // the one item whose colour is the entire point.
          active
            ? "bg-sidebar-accent text-[var(--nav-rail-accent)]"
            : "hover:text-sidebar-foreground",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
          className,
        ),
        children: icon,
        "aria-label": label,
        ...(active ? { "aria-current": "page" as const } : {}),
        style: {
          ...(color
            ? ({ "--nav-rail-accent": color } as React.CSSProperties)
            : null),
          ...style,
        },
      },
      props,
    ),
    render: <TooltipTrigger render={render} />,
    state: { slot: "nav-rail-item", active },
  });

  return (
    <li className="flex w-full justify-center">
      <Tooltip>
        {element}
        <TooltipContent side="right" align="center" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
