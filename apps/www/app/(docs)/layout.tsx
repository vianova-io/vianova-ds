import Link from "next/link";

import { asset } from "@/lib/asset";
import { SiteNav } from "@/components/site-nav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      {/*
        The brand ribbon: the five logo-gradient stops, left to right, in the
        order the mark uses them.

        Full-bleed by construction rather than by accident. It sits OUTSIDE the
        `mx-auto max-w-[100rem] px-6` wrapper that the header row and `main`
        share -- put it inside and it would inherit their margins and stop
        short of the edges, which is the whole point of a ribbon it would miss.

        `w-full`, never `w-screen`/`100vw`. A viewport unit includes the
        scrollbar gutter, so on any platform with a classic scrollbar it would
        be ~15px wider than the page and bring back exactly the horizontal
        document overflow that e2e/responsive.spec.ts now guards against.

        Not sticky, deliberately: it belongs to the top of the document, and
        the header below it is what pins. Scrolling takes the ribbon away and
        leaves the header flush against the top edge, which is where a reader
        wants the navigation.

        Read from `--brand-*` rather than pasted hex so it stays on the token
        pipeline. Note these five do NOT follow the white-label theme -- they
        are Vianova's own brand expression, fixed across all six themes, and
        the digest is explicit that they are never product UI colour.
      */}
      <div
        aria-hidden
        data-slot="brand-ribbon"
        className="h-1.5 w-full"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--brand-red-pink), var(--brand-magenta), var(--brand-violet), var(--brand-blue), var(--brand-teal))",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[100rem] items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* The real mark, not a gradient stand-in. Plain img on purpose:
                a logo should not go through the image optimiser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/brand/vianova-symbol.svg")} alt="" aria-hidden className="size-5" />
            <span className="text-sm font-semibold">Vianova DS</span>
          </Link>
          <SiteNav />
        </div>
      </header>

      {/* No component rail here. It belongs to the /components subtree and is
          rendered by that route's own layout, so Foundations, Showcase and
          Blocks get the full width instead of a list they cannot use. */}
      <main className="mx-auto min-w-0 max-w-[100rem] px-6 py-8">{children}</main>

    </div>
  );
}
