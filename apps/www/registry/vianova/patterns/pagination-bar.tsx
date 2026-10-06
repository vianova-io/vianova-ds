"use client";

import * as React from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/registry/vianova/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Page controls, a row count and a page-size select in one bar.
 *
 * Page numbers are Buttons rather than PaginationLink. PaginationLink always
 * renders an anchor, and this bar drives client-side state with no URL behind
 * it -- an anchor would offer "open in new tab" on something that cannot be.
 * The nav/ul/li structure around them is still the pagination primitive's.
 *
 * The window is clamped so the bar never changes width as you page through --
 * always first, last, the current page and its neighbours, with ellipses
 * filling the gaps.
 */
export function PaginationBar({
  page,
  pageCount,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  totalItems,
  /**
   * What is being paginated. Defaults to "rows" for the grid case, but the bar
   * is not grid-specific -- the icon browser paginates icons, and a bar that
   * insists on "rows" there is just wrong.
   */
  itemLabel = "rows",
  /** How many pages to show either side of the current one. */
  siblings = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  totalItems?: number;
  itemLabel?: string;
  siblings?: number;
}) {
  const selectId = React.useId();

  const pages = React.useMemo(() => {
    const window = new Set<number>([1, pageCount]);
    for (let p = page - siblings; p <= page + siblings; p++) {
      if (p >= 1 && p <= pageCount) window.add(p);
    }
    const sorted = [...window].sort((a, b) => a - b);

    // Insert a gap marker wherever the sequence skips.
    return sorted.flatMap<number | string>((p, i) =>
      i > 0 && p - sorted[i - 1]! > 1 ? [`gap-${p}`, p] : [p],
    );
  }, [page, pageCount, siblings]);

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), pageCount);
    if (clamped !== page) onPageChange?.(clamped);
  };

  return (
    <div
      data-slot="pagination-bar"
      className={cn("flex flex-wrap items-center justify-between gap-4", className)}
      {...props}
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {totalItems !== undefined ? (
          <>
            <span className="tabular-nums">{totalItems.toLocaleString("en-GB")}</span>{" "}
            {itemLabel} ·{" "}
          </>
        ) : null}
        Page <span className="tabular-nums">{page}</span> of{" "}
        <span className="tabular-nums">{pageCount}</span>
      </p>

      {/*
        Wraps, like the row above it. The outer bar has always been
        `flex-wrap`, but this group was not, so it stayed one unbreakable
        375.31px line -- "Per page", a 72px select and the page buttons -- at
        every viewport width. On a 327px column it did not wrap or shrink, it
        simply hung off the end and scrolled the whole document sideways, and
        it did so by so little (2px under Linux metrics, 0.31px under macOS)
        that it read as a rounding artefact rather than a layout bug.

        `justify-end` keeps it against the right edge once wrapped, which is
        where the outer `justify-between` puts it when it does fit.
      */}
      <div className="flex flex-wrap items-center justify-end gap-4">
        {pageSize !== undefined ? (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-muted-foreground text-sm">
              Per page
            </label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger id={selectId} size="sm" className="w-[4.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to previous page"
                disabled={page <= 1}
                onClick={() => go(page - 1)}
              >
                <ChevronLeftIcon />
              </Button>
            </PaginationItem>

            {pages.map((entry) =>
              typeof entry === "string" ? (
                <PaginationItem key={entry}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <Button
                    variant={entry === page ? "outline" : "ghost"}
                    size="icon"
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                    className="tabular-nums"
                    onClick={() => go(entry)}
                  >
                    {entry}
                  </Button>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to next page"
                disabled={page >= pageCount}
                onClick={() => go(page + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
