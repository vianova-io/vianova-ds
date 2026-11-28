import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";
import { Button } from "@/registry/vianova/ui/button";

/**
 * What is ticked, and what can be done to all of it.
 *
 * Above the table rather than in place of anything, so ticking a row never
 * moves the row under the pointer. The count is a live region: the bar is the
 * only thing that says a tick landed to someone who cannot see the box.
 *
 * The actions are the caller's. Clear is the bar's own, because every list
 * has it and each one had spelled it differently.
 *
 * The tick boxes themselves are turned on from the list's `TableSettings`.
 */
export function SelectionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number;
  onClear: () => void;
  /** The bulk actions, as buttons. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="selection-bar"
      className={cn(
        "bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
        className,
      )}
    >
      <p aria-live="polite" className="text-sm">
        <span className="font-medium tabular-nums">{count}</span> selected
      </p>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}
