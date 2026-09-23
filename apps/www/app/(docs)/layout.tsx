import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* The real mark, not a gradient stand-in. Plain img on purpose:
                a logo should not go through the image optimiser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/vianova-symbol.svg" alt="" aria-hidden className="size-5" />
            <span className="text-sm font-semibold">Vianova DS</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/showcase"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Showcase
            </Link>
            <Link
              href="/blocks"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Blocks
            </Link>
            <Link
              href="/components"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Components
            </Link>
            <Link
              href="/foundations"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Foundations
            </Link>
            <Link
              href="/changelog"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Changelog
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* No component rail here. It belongs to the /components subtree and is
          rendered by that route's own layout, so Foundations, Showcase and
          Blocks get the full width instead of a list they cannot use. */}
      <main className="mx-auto min-w-0 max-w-[100rem] px-6 py-8">{children}</main>

    </div>
  );
}
