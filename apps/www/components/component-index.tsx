"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Badge } from "@/registry/vianova/ui/badge";
import { groupByCategory, matchesQuery } from "@/lib/search";
import { cn } from "@/registry/vianova/lib/utils";

export type IndexComponent = {
  name: string;
  title: string;
  description: string;
  category: string;
  status: "stable" | "beta" | "deprecated";
  exampleCount: number;
};

/** Searchable grid of every component, grouped by category. */
export function ComponentIndex({
  components,
  order,
}: {
  components: IndexComponent[];
  order: string[];
}) {
  const [query, setQuery] = React.useState("");

  const groups = React.useMemo(() => {
    const matching = query ? components.filter((c) => matchesQuery(c, query)) : components;
    return groupByCategory(matching, order);
  }, [components, order, query]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search components…"
            aria-label="Search components"
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
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {query ? `${total} of ${components.length} shown` : `${components.length} components`}
        </p>
      </div>

      {groups.map(({ category, items }) => (
        <section key={category} className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium">{category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <Link
                key={c.name}
                href={`/components/${c.name}`}
                className="group border-border bg-card hover:border-ring/50 flex flex-col gap-2 rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="group-hover:text-primary font-medium">{c.title}</span>
                  {c.status !== "stable" ? (
                    <Badge variant="secondary">{c.status}</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground line-clamp-2 text-sm">{c.description}</p>
                {/* Counts are derived from the registry index at build time,
                    never hand-maintained -- they go stale within a week. */}
                <span className="text-muted-foreground mt-auto pt-1 text-xs">
                  {c.exampleCount
                    ? `${c.exampleCount} ${c.exampleCount === 1 ? "example" : "examples"}`
                    : "source only"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {total === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing matches “{query}”. Try a category like “product”, “patterns” or “forms”.
        </p>
      ) : null}
    </div>
  );
}
