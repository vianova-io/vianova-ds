import { ComponentRail } from "@/components/component-rail";
import { Index, categories } from "@/__registry__";
import { categoryOrder } from "@/lib/search";

/**
 * The component rail, scoped to /components.
 *
 * It used to live in the docs layout and therefore rendered on Foundations,
 * Showcase and Blocks too, where a list of 96 components is noise and steals
 * 13rem of width from pages that need it — the showcase wall especially.
 *
 * Only the searchable list itself is a client component. The layout stays on
 * the server so the registry is read at build time and never shipped twice.
 */
export default function ComponentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const components = Object.values(Index).map((c) => ({
    name: c.name,
    title: c.title,
    description: c.description,
    category: c.category,
  }));

  return (
    <div className="flex gap-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20">
          <ComponentRail components={components} order={categoryOrder(categories)} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
