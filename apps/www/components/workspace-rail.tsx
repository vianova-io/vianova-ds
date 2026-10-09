"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute } from "@/lib/active-route";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The workspace rail: the three workspaces, with the current one marked.
 *
 * Deliberately a much smaller thing than ComponentRail. That one groups 96
 * entries by category and manages its own scrollport and scrollbar fade,
 * because it has to; three links need none of it, and copying the machinery
 * over would be inherited complexity with nothing to do. What is shared is
 * what a reader actually sees: the same widths, spacing, type and active
 * treatment, so the two rails read as one pattern.
 *
 * A client component for one reason only -- `usePathname` for the active
 * state. The list itself is passed in from the server layout, so the registry
 * is still read at build time.
 */
export function WorkspaceRail({
  workspaces,
}: {
  workspaces: { name: string; title: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspaces" className="space-y-1">
      <p className="text-foreground px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
        Workspaces
      </p>
      {workspaces.map((w) => {
        const href = `/blocks/${w.name}`;
        const active = isActiveRoute(pathname, href);
        return (
          <Link
            key={w.name}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground block rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            {w.title}
          </Link>
        );
      })}
    </nav>
  );
}
