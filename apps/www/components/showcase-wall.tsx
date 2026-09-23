import * as React from "react";
import Link from "next/link";

import { ExampleBoundary } from "@/components/example-boundary";
import { Index } from "@/__registry__";

/**
 * Every component rendered live in one wall.
 *
 * Uniform card widths, three columns at most. Three rather than four or five
 * because a column has to be wide enough to show a component whole — at five
 * tracks a card was ~296px and the data grid showed two of its seven columns.
 *
 * CSS multi-column rather than a grid: with every card the same width there is
 * nothing for a grid to align that columns do not already handle, and columns
 * let each card take exactly the height it needs with no measurement, no
 * layout effect and nothing to reflow when a lazy demo mounts.
 * `break-inside-avoid` is what stops a card splitting across a column.
 *
 * An earlier version varied the widths into a bento. It packed tighter, but a
 * wall of mixed widths is harder to scan than a plain one, and three wide
 * columns show almost everything whole regardless.
 */
export function ShowcaseWall() {
  const components = Object.values(Index).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4">
      {components.map((c) => {
        const example = c.examples[0];
        if (!example) return null;
        const Demo = example.component;

        return (
          <section
            key={c.name}
            data-name={c.name}
            className="border-border bg-card break-inside-avoid rounded-xl border"
          >
            <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-2.5">
              <Link
                href={`/components/${c.name}`}
                className="hover:text-primary text-sm font-medium"
              >
                {c.title}
              </Link>
              <span className="text-muted-foreground text-[11px]">{c.category}</span>
            </header>
            {/* overflow-x-auto so a demo wider than the column scrolls inside
                its own card rather than forcing the page to scroll sideways. */}
            <div className="overflow-x-auto p-4">
              <ExampleBoundary name={c.title}>
                <React.Suspense
                  fallback={<div className="bg-muted h-16 animate-pulse rounded-md" />}
                >
                  <Demo />
                </React.Suspense>
              </ExampleBoundary>
            </div>
          </section>
        );
      })}
    </div>
  );
}
