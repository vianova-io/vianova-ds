import Link from "next/link";

import { Button } from "@/registry/vianova/ui/button";
import { Index } from "@/__registry__";

export default function HomePage() {
  const all = Object.values(Index);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-12">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          The Vianova Design System
        </h1>
        <p className="text-lg text-muted-foreground">
          Brand foundations and production-ready components for Vianova&rsquo;s
          spatial intelligence platform. One token pipeline drives the CSS, the
          Figma library, and the deck.gl map layers.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* base-nova is Base UI underneath: composition is `render`, not
            `asChild`. `nativeButton={false}` is required when rendering as an
            anchor -- Base UI otherwise warns that native button semantics are
            being dropped. */}
        <Button nativeButton={false} render={<Link href="/components" />}>
          Browse {all.length} components
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/foundations" />}
        >
          Foundations
        </Button>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Components", v: String(all.length) },
          {
            k: "Examples",
            v: String(all.reduce((n, c) => n + c.examples.length, 0)),
          },
          { k: "Modes", v: "Light + dark" },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{s.k}</dt>
            <dd className="text-xl font-semibold">{s.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
