"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

export type FoundationsSection = { id: string; label: string };

/**
 * Section rail for Foundations, with the current section highlighted.
 *
 * Uses IntersectionObserver rather than a scroll handler: the page is long and
 * a scroll listener recalculating offsets on every frame is exactly the kind of
 * jank a design system should not ship as an example of itself.
 */
export function FoundationsNav({ sections }: { sections: FoundationsSection[] }) {
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Topmost intersecting heading wins. Taking the last entry instead
        // makes the highlight jump backwards when several are on screen.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Bottom margin keeps only the upper band of the viewport eligible, so
      // the active item tracks what is being read rather than what is merely
      // on screen.
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Foundations sections" className="space-y-1">
      <p className="text-foreground px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
        On this page
      </p>
      {sections.map((section) => {
        const isActive = active === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={isActive ? "location" : undefined}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground block rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
