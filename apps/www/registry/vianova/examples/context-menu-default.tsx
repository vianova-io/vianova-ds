import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/registry/vianova/ui/context-menu";

export default function ContextMenuDefault() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Right-click the map
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Set as origin</ContextMenuItem>
        <ContextMenuItem>Set as destination</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Zoom to district</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
