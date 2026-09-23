/** Shared matching for the component search, used by the rail and the index. */

export type SearchableComponent = {
  name: string;
  title: string;
  description: string;
  category: string;
};

/**
 * Every query word must match somewhere, but not necessarily in the same field.
 *
 * That is what makes "product legend" or "forms input" work: the first word
 * hits the category and the second the title. Requiring one contiguous match
 * across a joined string would fail both, and matching *any* word instead of
 * all of them turns a two-word query into a longer list than a one-word query,
 * which is the opposite of what typing more should do.
 */
export function matchesQuery(component: SearchableComponent, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;

  const haystack = [
    component.title,
    // The registry name matters on its own: someone who knows they want
    // `data-grid` should not have to guess it is titled "Data Grid".
    component.name,
    component.name.replaceAll("-", " "),
    component.category,
    component.description,
  ]
    .join(" ")
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}

/** Groups by category, preserving the order given and dropping empty groups. */
export function groupByCategory<T extends SearchableComponent>(
  components: T[],
  order: string[],
): { category: string; items: T[] }[] {
  return order
    .map((category) => ({
      category,
      items: components
        .filter((c) => c.category === category)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Patterns and Product last: they are ours, and belong together at the end. */
export function categoryOrder(categories: readonly string[]): string[] {
  return [
    ...categories.filter((c) => c !== "Patterns" && c !== "Product"),
    "Patterns",
    "Product",
  ];
}
