"use client";

import * as React from "react";
import { Columns3, RotateCcw } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Checkbox } from "@/registry/vianova/ui/checkbox";
import { Label } from "@/registry/vianova/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/vianova/ui/popover";
import { Separator } from "@/registry/vianova/ui/separator";
import { cn } from "@/registry/vianova/lib/utils";

export type ManagedColumn = {
  id: string;
  label: string;
  visible: boolean;
  /** Columns the grid cannot function without, e.g. the row identifier. */
  locked?: boolean;
};

/**
 * Show/hide control for a grid's columns.
 *
 * Takes a plain array rather than a table instance, so it does not depend on
 * the table library and can drive a card list or a chart's series just as
 * easily. DataGrid adapts its own columns into this shape.
 *
 * Locked columns are listed but disabled instead of hidden, so the set on
 * screen always matches the grid and nobody hunts for a column that was quietly
 * withheld from the menu.
 */
export function ColumnManager({
  columns,
  onToggle,
  onReset,
  label = "Columns",
  align = "end",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onToggle"> & {
  columns: ManagedColumn[];
  onToggle?: (id: string, visible: boolean) => void;
  onReset?: () => void;
  label?: string;
  align?: "start" | "center" | "end";
}) {
  const hidden = columns.filter((c) => !c.visible).length;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            data-slot="column-manager"
            className={cn(className)}
            {...props}
          >
            <Columns3 />
            {label}
            {hidden > 0 ? (
              <span className="text-muted-foreground tabular-nums">({hidden} hidden)</span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align={align} className="w-56 p-0">
        <div className="max-h-72 overflow-y-auto p-2">
          {columns.map((column) => (
            <div
              key={column.id}
              className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
            >
              <Checkbox
                id={`col-${column.id}`}
                checked={column.visible}
                disabled={column.locked}
                onCheckedChange={(checked) => onToggle?.(column.id, checked === true)}
              />
              <Label
                htmlFor={`col-${column.id}`}
                className={cn(
                  "flex-1 truncate text-sm font-normal",
                  column.locked ? "text-muted-foreground" : "cursor-pointer",
                )}
              >
                {column.label}
              </Label>
            </div>
          ))}
        </div>
        {onReset ? (
          <>
            <Separator />
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                disabled={hidden === 0}
                onClick={onReset}
              >
                <RotateCcw /> Show all
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
