import * as React from "react";

import { CodeBlock } from "@/components/code-block";
import { PreviewFrame } from "@/components/preview-frame";
import { readRegistryFile, rewriteAliases } from "@/lib/source";
import { Index } from "@/__registry__";

/**
 * Renders one example as both a live preview and its exact source.
 *
 * This is a server component on purpose: the source is read from disk at build
 * time, so the code tab cannot drift from what actually renders above it.
 */
export function ComponentPreview({
  component,
  example,
}: {
  component: string;
  example: string;
}) {
  const entry = Index[component];
  const found = entry?.examples.find((e) => e.name === example);

  if (!entry || !found) {
    throw new Error(
      `Unknown preview "${component}/${example}". Run \`pnpm registry:index\` after adding an example file.`,
    );
  }

  const Demo = found.component;
  const source = rewriteAliases(readRegistryFile(found.file));

  return (
    <PreviewFrame
      title={titleFromName(component, example)}
      code={<CodeBlock code={source} />}
    >
      <React.Suspense
        fallback={<div className="h-20 animate-pulse rounded-md bg-muted" />}
      >
        <Demo />
      </React.Suspense>
    </PreviewFrame>
  );
}

function titleFromName(component: string, example: string) {
  const suffix = example.startsWith(`${component}-`)
    ? example.slice(component.length + 1)
    : example;
  return suffix.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
