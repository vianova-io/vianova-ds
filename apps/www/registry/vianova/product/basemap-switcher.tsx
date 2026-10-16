"use client";

import * as React from "react";

import {
  BASEMAPS,
  BASEMAP_BY_ID,
  DEFAULT_BASEMAP_ID,
  type BasemapId,
} from "@/registry/vianova/lib/basemaps";
import { BASEMAP_PREVIEWS } from "@/registry/vianova/lib/basemap-previews";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Picks the basemap a map is drawn on.
 *
 * ## The previews are photographs, taken once
 *
 * Each option shows a real render of its basemap -- see lib/basemap-previews.
 * Not three live maps, which is the obvious build and the wrong one: three
 * WebGL contexts and three tile streams, torn down and rebuilt every time a
 * popover opens, for a control that is shut almost always, and
 * non-deterministic enough that the examples could never be pixel-pinned
 * (`map-canvas-default` is already excluded from the visual suite for exactly
 * that reason). Stills cost no network, stay deterministic, and show the
 * reader what they are actually choosing between.
 *
 * ## Shape
 *
 * The trigger is a 64px square showing the current basemap's thumbnail, named
 * across the bottom the same way the options are. 64 and not 32: it sits
 * beside the zoom STACK, which is two 32px buttons, so a single-button square
 * read as undersized next to it. The name is written because a thumbnail alone
 * answers "which map is this" only for someone who already knows the three.
 *
 * The menu is a row of three rather than a stacked list, and exactly as tall as
 * the trigger -- 64px, three 56px thumbnails on 4px of padding -- so the open
 * control reads as one band rather than a panel hung off a button. There is no
 * room for a name under a thumbnail at that height, so each name sits inside
 * its own thumbnail on a gradient scrim, and the tooltip carries the longer
 * description.
 *
 * As a stacked list this had a layout bug worth remembering. Each row was a
 * grid item, and a grid item is `min-width: auto`, so it would not shrink below
 * its own text: `truncate` never engaged, the longest hint set the width of
 * every row, and the rows and their check marks were drawn 70px outside the
 * rounded panel they belonged to.
 *
 * ## Why a radiogroup
 *
 * Three options, exactly one chosen. `role="radio"` inside `role="radiogroup"`
 * gives arrow-key traversal and announces "2 of 3" without any of it being
 * written here. Selection is carried by `aria-checked`, by a ring present on
 * one thumbnail and absent on the others, and by the weight of the name -- an
 * outline appearing where there was none reads without colour vision, which a
 * teal ring alone would not.
 */
export function BasemapSwitcher({
  value,
  onValueChange,
  side = "top",
  align = "end",
  defaultOpen,
  trigger,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "children"> & {
  value: BasemapId;
  onValueChange: (id: BasemapId) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
  /**
   * Replaces the default 32px tile, e.g. with a toolbar-sized icon button.
   * A single element, because Base UI merges its popover props onto it.
   */
  trigger?: React.ReactElement;
}) {
  const current = BASEMAP_BY_ID[value] ?? BASEMAP_BY_ID[DEFAULT_BASEMAP_ID];
  const labelId = React.useId();
  // Controlled so choosing dismisses. A picker that stays open after you have
  // picked leaves the thing you were comparing hidden behind itself.
  const [open, setOpen] = React.useState(defaultOpen ?? false);

  return (
    <div data-slot="basemap-switcher" className={cn("flex", className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            trigger ?? (
              <button
                type="button"
                title={`Basemap: ${current.label}`}
                // size-8 and rounded-lg are the zoom buttons' own values. p-px
                // leaves a hairline of card around the thumbnail so the square
                // reads as a control rather than a floating image.
                className="relative size-16 cursor-pointer rounded-lg border border-border bg-card/95 p-px backdrop-blur transition-colors hover:border-foreground/25 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            )
          }
          // The bare button this replaces had no accessible name beyond its
          // label text, which said "Satellite" over a map that was not.
          aria-label={`Basemap: ${current.label}`}
        >
          {trigger ? null : (
            <>
              {/* size-full, not a hardcoded 62px. The button is border-box, so
                  64 less a 1px border and 1px padding leaves a 60px content
                  box; 62 overhung it and painted over the border on the right
                  and bottom, leaving a square that looked bordered on two
                  sides only. */}
              <BasemapPreview id={current.id} className="size-full rounded-[6px]" />
              <PreviewLabel className="rounded-b-[6px]">{current.label}</PreviewLabel>
            </>
          )}
        </PopoverTrigger>

        {/* shadow-lg, where the rest of the surface is shadow-md: below xl this
            opens over a floating panel, and at the same elevation as the cards
            underneath the two merge into one object.

            No overflow-hidden anywhere below: a focus ring reaches 3px past its
            box, and clipping it is the bug map-controls.tsx carries a comment
            about. The thumbnails round themselves instead. */}
        <PopoverContent side={side} align={align} className="w-auto p-1 shadow-lg">
          {/* sr-only, not deleted. Three labelled thumbnails say what this is
              without a caption over them, and the caption was a third of the
              panel's height. But the popover still needs an accessible name,
              and the radiogroup below still points at this id -- drop the
              element and both lose their name while looking identical. */}
          <PopoverTitle id={labelId} className="sr-only">
            Basemap
          </PopoverTitle>
          <div
            data-slot="basemap-options"
            role="radiogroup"
            aria-labelledby={labelId}
            className="flex gap-1"
          >
            {BASEMAPS.map((basemap) => {
              const selected = basemap.id === value;
              return (
                <button
                  key={basemap.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  // The name and the one-line description both live here now
                  // that neither is printed. aria-label is load-bearing, not
                  // decoration: with the caption gone there is no text in this
                  // button at all, so without it the radio has no accessible
                  // name and announces as "blank".
                  aria-label={basemap.label}
                  title={`${basemap.label} -- ${basemap.hint}`}
                  onClick={() => {
                    onValueChange(basemap.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative size-14 cursor-pointer rounded-[4px] transition-opacity",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected ? "ring-2 ring-primary" : "ring-1 ring-border",
                    !selected && "opacity-85 hover:opacity-100",
                  )}
                >
                  <BasemapPreview id={basemap.id} className="size-full rounded-[4px]" />
                  <PreviewLabel className="rounded-b-[4px]">{basemap.label}</PreviewLabel>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * The basemap's name, over the bottom of its thumbnail.
 *
 * On a scrim rather than straight onto the artwork: these sit over a street
 * grid, a photographic wash and contour bands, three backgrounds with nothing
 * in common, and white text is only reliable over some of them. The gradient
 * makes the bottom strip dark whatever is beneath it, which is the same reason
 * the satellite basemap itself carries one.
 *
 * No overflow-hidden on the button that holds this, deliberately: that is the
 * bug map-controls.tsx carries a comment about, since a focus ring reaches 3px
 * past the box. The preview rounds itself and this rounds its own two corners,
 * which is why the radius is passed in rather than fixed.
 */
function PreviewLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/60 to-transparent px-1 pt-2 pb-[3px] text-[9px] leading-none font-medium text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A thumbnail of the basemap, as it actually renders.
 *
 * Both themes are rendered and one is hidden with `dark:`, rather than picking
 * with a hook. useColorScheme returns null until mounted, so choosing in JS
 * means either a flash of the wrong thumbnail or a hydration mismatch; the CSS
 * variant is resolved by the same `.dark` class before anything paints. The
 * images are data URIs, so the hidden one costs no request -- only the bytes
 * that are in the bundle either way.
 */
function BasemapPreview({ id, className }: { id: BasemapId; className?: string }) {
  const preview = BASEMAP_PREVIEWS[id] ?? BASEMAP_PREVIEWS[DEFAULT_BASEMAP_ID];
  const common = "block size-full object-cover";
  return (
    <span className={cn("block overflow-hidden", className)}>
      <img src={preview.light} alt="" aria-hidden className={cn(common, "dark:hidden")} />
      <img src={preview.dark} alt="" aria-hidden className={cn(common, "hidden dark:block")} />
    </span>
  );
}
