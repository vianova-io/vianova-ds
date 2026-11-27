"use client";

import * as React from "react";
import { ListChecks } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { Button } from "@/registry/vianova/ui/button";
import { Toggle } from "@/registry/vianova/ui/toggle";

/**
 * The control that turns a list's tick boxes on and off.
 *
 * Bulk actions are something a list is occasionally used for and a column it
 * otherwise pays for on every row: forty pixels of boxes, on every line, for
 * the day somebody clears out eleven recipients. So the column is not there
 * until it is asked for. This sits at the end of the list's toolbar, the list
 * opens without it pressed, and pressing it is what brings the boxes in.
 *
 * A toggle and not a button, because it has a state the reader needs to see:
 * the boxes stay until it is released, and releasing it lets go of whatever
 * was ticked.
 */
export function SelectionToggle({
  pressed,
  onPressedChange,
  label = "Select several",
  className,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** Names the control. It has no visible text. */
  label?: string;
  className?: string;
}) {
  return (
    <Toggle
      variant="outline"
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      title={label}
      data-slot="selection-toggle"
      className={className}
    >
      <ListChecks />
    </Toggle>
  );
}

/**
 * What is ticked, and what can be done to all of it.
 *
 * Above the table rather than in place of anything, so ticking a row never
 * moves the row under the pointer. The count is a live region: the bar is the
 * only thing that says a tick landed to someone who cannot see the box.
 *
 * The actions are the caller's. Clear is the bar's own, because every list
 * has it and each one had spelled it differently.
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
