import * as React from "react";
import { notFound } from "next/navigation";

import { Index } from "@/__registry__";

/**
 * Chrome-less render target for a single example.
 *
 * Serves three consumers at once:
 *   1. the docs iframe, for blocks whose fixed-position chrome would otherwise
 *      escape a plain div and eat the docs layout,
 *   2. the axe-core accessibility crawl,
 *   3. Playwright visual-regression screenshots.
 */
export function generateStaticParams() {
  return Object.values(Index).flatMap((c) =>
    c.examples.map((e) => ({ name: e.name })),
  );
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const example = Object.values(Index)
    .flatMap((c) => c.examples)
    .find((e) => e.name === name);

  if (!example) notFound();

  const Demo = example.component;

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <React.Suspense fallback={null}>
        <Demo />
      </React.Suspense>
    </main>
  );
}
