import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { CodeBlock } from "@/components/code-block";
import { InstallTabs } from "@/components/install-tabs";
import { readRegistryFile, rewriteAliases } from "@/lib/source";
import { Blocks } from "@/__registry__";

export function generateStaticParams() {
  return Object.keys(Blocks).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const b = Blocks[slug];
  return b ? { title: b.title, description: b.description } : {};
}

export default async function BlockPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const block = Blocks[slug];
  if (!block) notFound();

  const Demo = block.component;
  const source = rewriteAliases(readRegistryFile(block.source));

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{block.title}</h1>
        <p className="text-muted-foreground">{block.description}</p>
      </header>

      <React.Suspense
        fallback={<div className="h-[700px] animate-pulse rounded-xl bg-muted" />}
      >
        <Demo />
      </React.Suspense>

      <section className="mx-auto max-w-3xl space-y-3">
        <h2 className="text-sm font-medium">Installation</h2>
        <InstallTabs name={block.name} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Source</h2>
        <CodeBlock code={source} />
      </section>
    </article>
  );
}
