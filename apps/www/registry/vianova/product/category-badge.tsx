import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * A category as a map draws it close up: its logo on a disc, inside a ring in the
 * theme's border colour -- the same colour the map outlines its dots with, so a
 * category is one thing at every zoom.
 *
 * One component so the places that show a category agree -- the picker that sets
 * its logo, the legend that explains it, and the map symbol it is drawn as all
 * look the same, which is what lets someone match what is on the map to what the
 * legend says.
 *
 * `logoKind` is the difference between the two kinds of logo. A transparent one
 * (a wordmark, a glyph) floats on the disc at a smaller size, because it needs
 * the colour behind it to be read. A solid one (a logo with its own background)
 * fills the disc and the colour survives only as a ring. With no logo it is just
 * the disc.
 *
 * Decorative by default: every use sits next to the category's name, so the
 * badge repeating it to a screen reader would only say it twice.
 */
export function CategoryBadge({
  color,
  logo,
  logoKind = "transparent",
  size = 24,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> & {
  /** The disc the logo sits on. Any CSS colour. */
  color: string;
  /** Image source for the logo: a URL or a data URL. */
  logo?: string;
  logoKind?: "transparent" | "solid";
  /** Diameter in pixels, ring included. */
  size?: number;
}) {
  return (
    <span
      aria-hidden
      data-slot="category-badge"
      className={cn("bg-border inline-flex shrink-0 rounded-full", className)}
      // The ring is worked out from the badge's own size. A percentage padding
      // would not do: it is a share of the PARENT's width, so the same badge is
      // fine in a narrow box and swallowed whole by a wide row.
      style={{ width: size, height: size, padding: Math.max(1.5, size * 0.08), ...style }}
      {...props}
    >
      <span
        className="flex size-full items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: color }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className={
              logoKind === "solid"
                ? "size-full object-cover"
                : "size-[64%] object-contain"
            }
          />
        ) : null}
      </span>
    </span>
  );
}
