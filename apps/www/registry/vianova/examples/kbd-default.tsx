import { Kbd, KbdGroup } from "@/registry/vianova/ui/kbd";

export default function KbdDefault() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <span className="flex items-center gap-2">
        Open command palette
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </span>
      <span className="flex items-center gap-2">
        Fit map to selection
        <Kbd>F</Kbd>
      </span>
    </div>
  );
}
