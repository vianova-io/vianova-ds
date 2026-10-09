import { CategoryBadge } from "@/registry/vianova/product/category-badge";

/** Stand-in logos: generic marks, so no example carries anyone's trademark. */
const mark = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`,
  )}`;

const BOLT = mark('<path d="M36 6 14 36h14l-4 22 26-34H34z" fill="#ffffff"/>');
const RING = mark('<circle cx="32" cy="32" r="21" fill="none" stroke="#111827" stroke-width="9"/>');
const SOLID = mark('<rect width="64" height="64" fill="#facc15"/><path d="M14 48 32 14l18 34z" fill="#111827"/>');

export default function CategoryBadgeDefault() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-6">
        <figure className="flex flex-col items-center gap-2">
          <CategoryBadge size={44} color="#0f766e" logo={BOLT} />
          <figcaption className="text-xs text-muted-foreground">Transparent logo</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <CategoryBadge size={44} color="#ffffff" logo={RING} />
          <figcaption className="text-xs text-muted-foreground">On its own badge colour</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <CategoryBadge size={44} color="#7c3aed" logo={SOLID} logoKind="solid" />
          <figcaption className="text-xs text-muted-foreground">Solid logo</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-2">
          <CategoryBadge size={44} color="#d97706" />
          <figcaption className="text-xs text-muted-foreground">No logo</figcaption>
        </figure>
      </div>
      <div className="flex items-center gap-3">
        <CategoryBadge size={16} color="#0f766e" logo={BOLT} />
        <CategoryBadge size={20} color="#0f766e" logo={BOLT} />
        <CategoryBadge size={24} color="#0f766e" logo={BOLT} />
        <CategoryBadge size={32} color="#0f766e" logo={BOLT} />
        <span className="text-xs text-muted-foreground">16, 20, 24 and 32px</span>
      </div>
    </div>
  );
}
