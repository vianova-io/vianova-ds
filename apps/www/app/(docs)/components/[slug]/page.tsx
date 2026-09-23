import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CodeBlock } from "@/components/code-block";
import { ComponentPreview } from "@/components/component-preview";
import { InstallTabs } from "@/components/install-tabs";
import { readRegistryFile, rewriteAliases } from "@/lib/source";
import { Badge } from "@/registry/vianova/ui/badge";
import { Index } from "@/__registry__";

/**
 * Fully registry-driven: adding an example file and re-running
 * `pnpm registry:index` publishes a new preview card with no page edits.
 * Hand-authoring one MDX file per component is what kills these sites by
 * month three.
 */
export function generateStaticParams() {
  return Object.keys(Index).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = Index[slug];
  if (!entry) return {};
  return { title: entry.title, description: entry.description };
}

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = Index[slug];
  if (!entry) notFound();

  const source = rewriteAliases(readRegistryFile(entry.source));

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {entry.title}
          </h1>
          {entry.status !== "stable" ? (
            <Badge variant="secondary">{entry.status}</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground">{entry.description}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Installation</h2>
        <InstallTabs name={entry.name} />
      </section>

      {entry.examples.length > 0 ? (
        <section className="space-y-8">
          <h2 className="text-sm font-medium">Examples</h2>
          {entry.examples.map((ex) => (
            <ComponentPreview key={ex.name} component={entry.name} example={ex.name} />
          ))}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Examples</h2>
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No examples yet. Add{" "}
            <code className="text-foreground">
              registry/vianova/examples/{entry.name}-&lt;variant&gt;.tsx
            </code>{" "}
            and re-run <code className="text-foreground">pnpm registry:index</code> — it
            will appear here automatically.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Source</h2>
        <CodeBlock code={source} />
      </section>
    </article>
  );
}
