"use client";

import * as React from "react";

import { SavedViewMenu, type SavedView } from "@/registry/vianova/product/saved-view-menu";

const initial: SavedView[] = [
  { id: "am-peak", name: "Weekday AM peak" },
  { id: "scooters", name: "Scooter trips only" },
  { id: "all-modes", name: "All modes — 2026", shared: true },
  { id: "default", name: "Workspace default", shared: true, locked: true },
];

export default function SavedViewMenuDefault() {
  const [views, setViews] = React.useState(initial);
  const [activeId, setActiveId] = React.useState("am-peak");
  const [dirty, setDirty] = React.useState(true);

  return (
    <div className="flex flex-col items-start gap-3">
      <SavedViewMenu
        views={views}
        activeId={activeId}
        dirty={dirty}
        onSelect={(view) => {
          setActiveId(view.id);
          setDirty(false);
        }}
        onSaveChanges={() => setDirty(false)}
        onSaveAsNew={() => setDirty(false)}
        onDelete={(view) => setViews((all) => all.filter((v) => v.id !== view.id))}
      />
      <button
        type="button"
        className="text-muted-foreground text-xs underline"
        onClick={() => setDirty((d) => !d)}
      >
        Toggle unsaved changes
      </button>
    </div>
  );
}
