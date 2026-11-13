"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { TableHead } from "@/registry/vianova/ui/table";

/**
 * The edge a table sits in when the table is the screen's content.
 *
 * Before this, seventeen tables wore six different edges -- `rounded-xl
 * border`, `rounded-xl ring-1 ring-foreground/10`, `rounded-lg border` with no
 * fill, `rounded-md border`, a `SectionCard` with its padding switched off,
 * and nothing at all.
 *
 * Not every table wants one. Nine of the seventeen sit inside a section, a
 * panel or a sheet that already draws an edge, and a card there would be two
 * borders describing the same line. Those take `<Table inset>` alone, which
 * is also what a table in this card takes -- the gutter is the table's, the
 * edge is the card's, and neither knows about the other.
 *
 * `border` and not `ring`: the two resolve to the same colour in both themes
 * today -- white at 10% in the dark, and a grey of the same luminance in the
 * light -- so nothing was chosen for how it looks. `border` reads `--border`,
 * which is the token the theme tunes; `ring-foreground/10` derives from
 * `--foreground` and would stay behind the day that token moves. It also
 * costs 1px of layout on each side, which `ring` does not, and that is the
 * honest price of being the one that tracks the theme.
 *
 * No height and no flex: a list card is as tall as its rows. Growing it to
 * fill the frame puts the dead space *inside* the edge -- measured at 751px
 * of nothing under five rows -- so a long list pushes past the frame and the
 * page scrolls instead, which is what `ToolBand` is built to sit over.
 */
function TableCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-card"
      className={cn("bg-card overflow-hidden rounded-xl border", className)}
      {...props}
    />
  );
}

/** Which way a sorted column is sorted. Not sorting at all is `undefined`. */
export type SortDirection = "asc" | "desc";

/**
 * The cycle, for a table where not sorting is a state worth having: off, then
 * ascending, then descending, then off again.
 *
 * Four tables sorted four ways before this, and one of them claimed a
 * direction in `aria-sort` even for the columns it was not sorting by.
 * Returning `undefined` is the third state, and it is what lets a reader put
 * the rows back the order they arrived in.
 *
 * Not every table has that order. A list that opens sorted by its one sortable
 * column -- Dashboards by Created at, Regulations the same -- has nothing
 * meaningful to go back to, so those two stay on two states and simply never
 * pass `undefined`. What they share with the other two is everything a reader
 * sees: the glyphs, the focus ring and the `aria-sort`.
 */
export function nextSort<T>(
  column: T,
  current: { id: T; dir: SortDirection } | undefined,
): { id: T; dir: SortDirection } | undefined {
  if (current?.id !== column) return { id: column, dir: "asc" };
  if (current.dir === "asc") return { id: column, dir: "desc" };
  return undefined;
}

/**
 * A column header that sorts.
 *
 * `direction` is the direction this column is sorted in, or nothing when it is
 * not the one being sorted by -- in which case the neutral glyph still shows,
 * so a reader can tell which columns are sortable before clicking any of them.
 * That is the whole argument for three states over two.
 */
function SortableTableHead({
  direction,
  onSort,
  icon: Icon,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof TableHead>, "onSort"> & {
  direction?: SortDirection;
  onSort: () => void;
  /**
   * A type glyph before the label, as the Data Hub's column headers have.
   *
   * Anything that takes a `className`, not `LucideIcon`: the Data Hub picks
   * its glyph out of a lookup typed as a plain component, and narrowing this
   * to lucide's own forwardRef type would shut that out for no gain.
   */
  icon?: React.ComponentType<{
    className?: string;
    "aria-hidden"?: boolean;
  }>;
}) {
  const SortIcon = !direction ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className="hover:text-foreground focus-visible:ring-ring -mx-1 inline-flex items-center gap-1.5 rounded px-1 whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
      >
        {Icon ? <Icon className="text-muted-foreground size-3.5" aria-hidden /> : null}
        {children}
        <SortIcon className={cn("size-3", !direction && "opacity-50")} aria-hidden />
      </button>
    </TableHead>
  );
}

export { SortableTableHead, TableCard };
