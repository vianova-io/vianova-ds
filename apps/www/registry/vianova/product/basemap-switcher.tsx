"use client";

import * as React from "react";

import {
  BASEMAPS,
  BASEMAP_BY_ID,
  DEFAULT_BASEMAP_ID,
  type BasemapId,
} from "@/registry/vianova/lib/basemaps";
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
 * ## The previews are drawn, not photographed
 *
 * The obvious build is three little live maps. It is also the wrong one: three
 * WebGL contexts and three tile streams, torn down and rebuilt every time a
 * popover opens, for a control that is shut almost always. Worse for this repo,
 * it would be non-deterministic, and the examples could then never be
 * pixel-pinned -- `map-canvas-default` is already excluded from the visual
 * suite for exactly that reason.
 *
 * So each option draws a square impression of what it is: a street grid, a
 * photographic wash, contour bands. They cost no network, theme themselves from
 * tokens, and are honest about being a legend rather than a picture of your
 * city.
 *
 * ## Shape
 *
 * The trigger is a 64px square showing only the current basemap's thumbnail.
 * 64 and not 32: it sits beside the zoom STACK, which is two 32px buttons, so
 * a single-button square read as undersized next to it. The name is the
 * accessible name and the tooltip; the thumbnail is the glance.
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
                className="size-16 cursor-pointer rounded-lg border border-border bg-card/95 p-px backdrop-blur transition-colors hover:border-foreground/25 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            )
          }
          // The bare button this replaces had no accessible name beyond its
          // label text, which said "Satellite" over a map that was not.
          aria-label={`Basemap: ${current.label}`}
        >
          {trigger ? null : (
            <BasemapPreview id={current.id} className="size-[62px] rounded-[7px]" />
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
                  {/* The name, back inside the thumbnail now that the band is
                      too short to carry it underneath.

                      On a scrim rather than straight onto the artwork: these
                      sit over a street grid, a photographic wash and contour
                      bands, three backgrounds with nothing in common, and
                      white text is only reliable over the first two. The
                      gradient makes the bottom strip dark whatever is beneath
                      it, which is the same reason the satellite basemap itself
                      carries one.

                      No overflow-hidden on the button, deliberately: that is
                      the bug map-controls.tsx carries a comment about, since a
                      focus ring reaches 3px past the box. The preview rounds
                      itself and the scrim rounds its own two corners. */}
                  <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[4px] bg-linear-to-t from-black/85 via-black/60 to-transparent px-1 pt-2 pb-[3px] text-[9px] leading-none font-medium text-white"
                  >
                    {basemap.label}
                  </span>
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
 * A drawn impression of a basemap, square.
 *
 * Deliberately schematic. A 48px photograph of anywhere is unreadable, and a
 * photograph of the WRONG place is worse than a diagram -- it implies the map
 * will look like that, in a product whose maps are of the reader's own city.
 * Token colours wherever the thing drawn is UI; literal colours only for the
 * satellite wash, which is a photograph and has no token.
 */
function BasemapPreview({ id, className }: { id: BasemapId; className?: string }) {
  const common = { viewBox: "0 0 36 36", "aria-hidden": true as const, className };

  if (id === "satellite") {
    return (
      <svg {...common}>
        <rect width="36" height="36" fill="#1f3326" />
        <path d="M0 22 L10 15 L20 20 L28 11 L36 16 V36 H0Z" fill="#2f4a33" />
        <path d="M0 30 L12 26 L22 31 L36 27 V36 H0Z" fill="#24402c" />
        <circle cx="27" cy="7" r="5" fill="#3c5a3f" />
        {/* The giveaway that it is a hybrid: a road and a label over the photo. */}
        <path
          d="M2 27 L16 18 L34 22"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          fill="none"
        />
        <rect x="12" y="7" width="10" height="2" rx="1" fill="#ffffff" fillOpacity="0.75" />
      </svg>
    );
  }

  if (id === "terrain") {
    return (
      <svg {...common}>
        <rect width="36" height="36" className="fill-surface-sunken" />
        {[0.35, 0.28, 0.2, 0.12].map((opacity, i) => (
          <path
            key={i}
            d={`M-2 ${30 - i * 6} Q 9 ${21 - i * 6} 18 ${26 - i * 6} T 38 ${22 - i * 6}`}
            className="stroke-foreground"
            strokeOpacity={opacity}
            strokeWidth="1.1"
            fill="none"
          />
        ))}
        <path
          d="M3 34 L15 19 L23 26 L33 11"
          className="stroke-muted-foreground"
          strokeWidth="1"
          fill="none"
        />
      </svg>
    );
  }

  // Plan: a street grid with one landuse block and one route.
  return (
    <svg {...common}>
      <rect width="36" height="36" className="fill-surface-sunken" />
      <path d="M0 22 L14 22 L14 36 L0 36Z" className="fill-primary" fillOpacity="0.12" />
      <path
        d="M22 0 L22 36 M0 11 L36 11"
        className="stroke-foreground"
        strokeOpacity="0.34"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M8 0 L8 36 M0 25 L36 25 M30 0 L30 36"
        className="stroke-foreground"
        strokeOpacity="0.2"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M0 5 Q 12 8 36 3"
        className="stroke-primary"
        strokeOpacity="0.5"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}
