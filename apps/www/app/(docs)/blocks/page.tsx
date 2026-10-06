import type { Metadata } from "next";
import Link from "next/link";
import * as React from "react";

import { CodeBlock } from "@/components/code-block";
import { readRegistryFile, rewriteAliases } from "@/lib/source";
import { Blocks } from "@/__registry__";

export const metadata: Metadata = { title: "Blocks" };

export default function BlocksPage() {
  const all = Object.values(Blocks);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Blocks</h1>
        <p className="text-muted-foreground">
          Whole layouts composed from Vianova components, rebuilt from the
          the Figma library. {all.length} block{all.length === 1 ? "" : "s"}.
        </p>
      </header>

      {all.map((b) => {
        const Demo = b.component;
        const source = rewriteAliases(readRegistryFile(b.source));
        return (
          <section key={b.name} className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/blocks/${b.name}`}
                className="text-sm font-medium hover:text-primary"
              >
                {b.title}
              </Link>
              <code className="text-xs text-muted-foreground">
                shadcn add @vianova/{b.name}
              </code>
            </div>
            {/* Tracks the blocks' own responsive height so the page does not
                jump when one resolves. map-workspace is 60px taller at lg;
                explore-map matches exactly. */}
            <React.Suspense
              fallback={
                <div className="h-[max(480px,75svh)] animate-pulse rounded-xl bg-muted md:h-[700px]" />
              }
            >
              <Demo />
            </React.Suspense>
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                View source
              </summary>
              <div className="pt-3">
                <CodeBlock code={source} />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
