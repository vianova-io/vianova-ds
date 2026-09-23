import type { Metadata } from "next";

import { ComponentIndex } from "@/components/component-index";
import { Index, categories } from "@/__registry__";
import { categoryOrder } from "@/lib/search";

export const metadata: Metadata = { title: "Components" };

export default function ComponentsIndexPage() {
  const all = Object.values(Index);

  // Only the fields the grid renders cross to the client; the lazy component
  // references and source paths on a registry entry stay on the server.
  const components = all.map((c) => ({
    name: c.name,
    title: c.title,
    description: c.description,
    category: c.category,
    status: c.status,
    exampleCount: c.examples.length,
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Components</h1>
        <p className="text-muted-foreground">
          {all.length} components, {all.reduce((n, c) => n + c.examples.length, 0)}{" "}
          examples. Every one is installable with the shadcn CLI and themed by{" "}
          <code className="text-foreground">@vianova/tokens</code>.
        </p>
      </header>

      <ComponentIndex components={components} order={categoryOrder(categories)} />
    </div>
  );
}
