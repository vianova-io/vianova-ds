"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

import { CopyButton } from "@/registry/vianova/patterns/copy-button";
import { PaginationBar } from "@/registry/vianova/patterns/pagination-bar";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Names come from lucide's own dynamic-import map, so the list cannot drift
 * from the installed version — a renamed icon disappears from the grid instead
 * of rendering as a blank cell.
 *
 * Crucially this map holds *import functions*, not components. A barrel
 * (`import * as lucide`) pulls all 1,544 modules into the graph: the
 * production build survives it, but the dev server never finishes compiling,
 * which is how this was first written and why it is not written that way now.
 */
const ICON_NAMES = Object.keys(dynamicIconImports).sort();

const pascal = (kebab: string) =>
  kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

const iconCache = new Map<string, React.ComponentType<{ className?: string }>>();

/** One lazy component per icon, memoised so scrolling does not re-import. */
function lazyIcon(name: string) {
  const cached = iconCache.get(name);
  if (cached) return cached;
  const Component = React.lazy(
    dynamicIconImports[name as keyof typeof dynamicIconImports] as never,
  ) as unknown as React.ComponentType<{ className?: string }>;
  iconCache.set(name, Component);
  return Component;
}

/**
 * Paginated, searchable browser over the whole Lucide set.
 *
 * Paginated rather than capped: every icon is reachable, but not all at once.
 * 1,544 SVGs is roughly 30k DOM nodes, which janks scrolling for the entire
 * page — and each one is a lazily imported module, so rendering them together
 * would fire 1,544 chunk requests.
 *
 * Uses the system's own PaginationBar. If the design system's controls are not
 * good enough for its own documentation, that is worth finding out here rather
 * than in a product.
 */
export function IconBrowser({ initialPageSize = 96 }: { initialPageSize?: number }) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES;
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  // Clamped rather than stored back: a search that shrinks the result set can
  // leave `page` past the end, and resetting it in an effect would render one
  // empty frame first.
  const current = Math.min(page, pageCount);
  const shown = matches.slice((current - 1) * pageSize, current * pageSize);

  const search = (next: string) => {
    setQuery(next);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && search("")}
            placeholder="Search icons…"
            aria-label="Search icons"
            className={cn(
              "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border bg-transparent pr-8 pl-9 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none",
              "placeholder:text-muted-foreground dark:bg-input/30",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => search("")}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {matches.length === ICON_NAMES.length
            ? `${ICON_NAMES.length.toLocaleString("en-GB")} icons`
            : `${matches.length.toLocaleString("en-GB")} of ${ICON_NAMES.length.toLocaleString("en-GB")} match`}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
        {shown.map((kebab) => {
          const name = pascal(kebab);
          const Icon = lazyIcon(kebab);
          return (
          <div
            key={kebab}
            className="hover:bg-accent group relative flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-3 transition-colors hover:border-border"
          >
            <React.Suspense fallback={<span className="bg-muted size-5 rounded" />}>
              <Icon className="size-5" />
            </React.Suspense>
            <span className="text-muted-foreground w-full truncate text-center text-[10px]" title={kebab}>
              {kebab}
            </span>
            {/* The import statement, not the name: that is what actually gets
                pasted into a file, and getting the PascalCase right from the
                kebab name is the fiddly part. */}
            <CopyButton
              value={`import { ${name} } from "lucide-react";`}
              label={`Copy import for ${kebab}`}
              className="absolute top-1 right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            />
          </div>
          );
        })}
      </div>

      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No icon matches “{query}”. Names follow lucide.dev, e.g. “map-pin”, “route”, “bike”.
        </p>
      ) : (
        <PaginationBar
          className="pt-2"
          page={current}
          pageCount={pageCount}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={[48, 96, 192, 384]}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          totalItems={matches.length}
          itemLabel="icons"
        />
      )}
    </div>
  );
}
