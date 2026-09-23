"use client";

import * as React from "react";
import { Download, Layers, Map, Plus, Settings, Share2 } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { CommandPalette } from "@/registry/vianova/patterns/command-palette";
import { Kbd } from "@/registry/vianova/ui/kbd";

export default function CommandPaletteDefault() {
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState<string | null>(null);

  const actions = [
    { id: "new-view", group: "Create", label: "New saved view", icon: <Plus />, shortcut: "⌘N" },
    { id: "new-layer", group: "Create", label: "New data layer", icon: <Layers /> },
    { id: "explore", group: "Go to", label: "Explore map", icon: <Map />, keywords: ["od", "flows"] },
    { id: "settings", group: "Go to", label: "Workspace settings", icon: <Settings /> },
    { id: "export", group: "Actions", label: "Export as GeoJSON", icon: <Download /> },
    { id: "share", group: "Actions", label: "Share current view", icon: <Share2 />, shortcut: "⌘⇧S" },
  ].map((action) => ({ ...action, onSelect: () => setLast(action.label) }));

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open palette <Kbd>⌘K</Kbd>
      </Button>
      {last ? <p className="text-muted-foreground text-sm">Ran: {last}</p> : null}
      <CommandPalette actions={actions} open={open} onOpenChange={setOpen} />
    </div>
  );
}
