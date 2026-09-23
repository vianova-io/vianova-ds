import type { Metadata } from "next";

import { ShowcaseWall } from "@/components/showcase-wall";
import { Index } from "@/__registry__";

export const metadata: Metadata = { title: "Showcase" };

export default function ShowcasePage() {
  const all = Object.values(Index);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Showcase</h1>
        <p className="text-muted-foreground">
          All {all.length} components, live and on the real tokens. Switch theme,
          white-label brand or map scheme in the header and the whole wall follows.
        </p>
      </header>
      <ShowcaseWall />
    </div>
  );
}
