import { REGULATION_TYPE_ICONS } from "@/registry/vianova/product/regulation-type-icons";

export default function RegulationTypeIconsDefault() {
  return (
    <ul className="grid w-full max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4">
      {Object.entries(REGULATION_TYPE_ICONS).map(([name, Icon]) => (
        <li
          key={name}
          className="flex flex-col items-center gap-2 rounded-lg border border-border p-3"
        >
          <Icon aria-hidden className="size-6" />
          <span className="text-muted-foreground text-xs">{name}</span>
        </li>
      ))}
    </ul>
  );
}
