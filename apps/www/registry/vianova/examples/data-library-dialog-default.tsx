"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { DataLibraryDialog } from "@/registry/vianova/product/data-library-dialog";
import { SAMPLE_FEEDS } from "@/registry/vianova/lib/sample-datasets";

export default function DataLibraryDialogDefault() {
  const [open, setOpen] = React.useState(false);
  // One layer already added, so the example shows both states a card has:
  // pickable, and already in the workspace.
  const [added, setAdded] = React.useState<string[]>([SAMPLE_FEEDS[0]!.id]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Plus data-icon="inline-start" />
        Add data layer
      </Button>
      <p className="text-muted-foreground text-sm">
        {added.length} layer{added.length === 1 ? "" : "s"} added
      </p>
      <DataLibraryDialog
        open={open}
        onOpenChange={setOpen}
        added={added}
        onAdd={(ids) => setAdded((all) => [...all, ...ids])}
      />
    </div>
  );
}
