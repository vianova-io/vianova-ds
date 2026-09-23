"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { ConfirmDialog } from "@/registry/vianova/patterns/confirm-dialog";

export default function ConfirmDialogDefault() {
  const [deleted, setDeleted] = React.useState(false);

  return (
    <div className="flex items-center gap-3">
      <ConfirmDialog
        destructive
        title="Delete this saved view?"
        description="“Le Havre — weekday AM peak” will be removed for everyone in the workspace. This cannot be undone."
        confirmLabel="Delete view"
        trigger={
          <Button variant="destructive" size="sm">
            <Trash2 /> Delete
          </Button>
        }
        // Stands in for a request: the dialog holds its pending state until
        // this settles, rather than closing optimistically.
        onConfirm={() =>
          new Promise((resolve) => setTimeout(() => resolve(setDeleted(true)), 1200))
        }
      />
      {deleted ? <span className="text-muted-foreground text-sm">View deleted.</span> : null}
    </div>
  );
}
