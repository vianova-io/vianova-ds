import type { Metadata } from "next";
import Link from "next/link";
import * as React from "react";

import { CodeBlock } from "@/components/code-block";
import { readRegistryFile, rewriteAliases } from "@/lib/source";
import { orderWorkspaces } from "@/lib/workspaces";
import { Blocks } from "@/__registry__";

export const metadata: Metadata = { title: "Workspaces" };

export default function BlocksPage() {
  // Same order as the rail beside it, which is not the manifest's.
  const all = orderWorkspaces(Object.values(Blocks));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground">
          Whole layouts composed from Vianova components, rebuilt from the
          Figma library. {all.length} workspace{all.length === 1 ? "" : "s"}.
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
            {/* Tracks the workspaces' own responsive height so the page does
                not jump when one resolves. map-workspace is 60px taller at lg;
                the others match this exactly. */}
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
