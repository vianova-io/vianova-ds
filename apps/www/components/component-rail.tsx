"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute } from "@/lib/active-route";
import { groupByCategory, type SearchableComponent } from "@/lib/search";
import { useScrollActivity } from "@/registry/vianova/hooks/use-scroll-activity";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The component rail: a grouped index of everything, with the current page
 * marked.
 *
 * No search box here on purpose. /components already has one, and two search
 * fields on the same screen make the reader decide which scope each covers
 * before typing in either. This is a client component only so it can read the
 * pathname for the active state.
 */
export function ComponentRail({
  components,
  order,
}: {
  components: SearchableComponent[];
  order: string[];
}) {
  const pathname = usePathname();
  const groups = groupByCategory(components, order);

  const ref = React.useRef<HTMLElement>(null);
  const scrolling = useScrollActivity(ref);

  return (
    /*
     * The scrollbar shows only while this is being scrolled.
     *
     * Only its COLOUR changes, never `scrollbar-width`. A thin scrollbar that
     * is transparent still reserves its gutter, so the list does not shift
     * sideways each time the bar appears -- which is what switching between
     * `scrollbar-none` and `scrollbar-thin` would do, and it is far more
     * distracting than the bar ever was.
     */
    <nav
      ref={ref}
      aria-label="Components"
      data-scrolling={scrolling || undefined}
      className={cn(
        "max-h-[calc(100dvh-6rem)] space-y-6 overflow-y-auto pb-8",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-transparent",
        "data-scrolling:scrollbar-thumb-muted-foreground/40",
      )}
    >
      {groups.map(({ category, items }) => (
        <div key={category} className="space-y-1">
          {/* Headings take the foreground colour and the links stay muted,
              rather than both sitting on muted-foreground where only a
              1px size difference separated a label from a link. */}
          <p className="text-foreground px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
            {category}
          </p>
          {items.map((c) => {
            const href = `/components/${c.name}`;
            const active = isActiveRoute(pathname, href);
            return (
              <Link
                key={c.name}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground block rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {c.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
