import * as React from "react";
import { notFound } from "next/navigation";

import { EnableMapSnapshots } from "@/components/enable-map-snapshots";
import { Blocks } from "@/__registry__";

/**
 * Chrome-less render target for one block, at the iframe's own viewport.
 *
 * This exists because of how the workspaces decide their layout. They do it
 * from the VIEWPORT -- 42 `lg:`/`max-lg:` classes in `map-workspace`, 27 in
 * `regulations-workspace`, and `useIsMobile()` reading `window.innerWidth`.
 * A width-constrained `div` on the docs page, which is what `PreviewFrame`
 * gives the components, leaves every one of those resolving against the
 * reader's window instead: the docked panel stays docked at 375px wide and
 * the bottom tray never appears. The preview would show a phone layout that
 * does not exist.
 *
 * An iframe has a viewport of its own, so the media queries and `innerWidth`
 * both resolve against the frame. That is the whole reason for the extra
 * route.
 *
 * It is deliberately NOT `/preview/[name]`. That route's params come from the
 * registry's `examples`, and `a11y.spec.ts` and `visual.spec.ts` both iterate
 * that same list -- folding blocks into it would silently enrol seven heavy
 * workspaces into the a11y crawl and mint two visual baselines apiece. This
 * route is reachable only from the docs page that embeds it.
 *
 * Note that blocks render here exactly as published, without the docs-page
 * wrappers: `regulations-workspace` ships no geocoder, so its search field is
 * inert here where `RegulationsWorkspaceDemo` would have lent it one.
 */
export function generateStaticParams() {
  return Object.keys(Blocks).map((slug) => ({ slug }));
}

export default async function WorkspaceFramePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const block = Blocks[slug];
  if (!block) notFound();

  const Demo = block.component;

  return (
    <main className="min-h-dvh">
      {/* Before <Demo/>, so the flag is set by the time a map constructs. */}
      <EnableMapSnapshots />
      <React.Suspense fallback={null}>
        <Demo />
      </React.Suspense>
    </main>
  );
}
