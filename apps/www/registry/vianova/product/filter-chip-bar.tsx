"use client";

import * as React from "react";
import { FilterX, XIcon } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/registry/vianova/ui/tooltip";
import { cn } from "@/registry/vianova/lib/utils";
import {
  describeCondition,
  isGroup,
  removeNode,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
} from "@/registry/vianova/lib/filter-ast";

/**
 * The active filter, flattened into removable chips.
 *
 * The companion to FilterBuilder: the builder is where a query is composed,
 * this is what stays on screen next to the results. It reads the same tree, so
 * the two cannot disagree about what is applied.
 *
 * Nesting cannot be shown honestly in a flat row, so a nested group collapses
 * into one chip that removes the whole group and says how many conditions it
 * holds. Listing its children individually would imply they can be removed
 * one at a time without changing the grouping, which is false.
 */
export function FilterChipBar({
  value,
  fields,
  onValueChange,
  onClear,
  emptyMessage = "No filters applied.",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value: FilterGroup;
  fields: FilterField[];
  onValueChange?: (next: FilterGroup) => void;
  onClear?: () => void;
  emptyMessage?: React.ReactNode;
}) {
  const remove = (id: string) => onValueChange?.(removeNode(value, id) as FilterGroup);

  if (!value.children.length) {
    return (
      <div
        data-slot="filter-chip-bar"
        className={cn("text-muted-foreground text-sm", className)}
        {...props}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      data-slot="filter-chip-bar"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    >
      {value.children.map((child, index) => (
        <React.Fragment key={child.id}>
          {index > 0 ? (
            <span className="text-muted-foreground px-0.5 text-xs font-medium uppercase">
              {value.combinator}
            </span>
          ) : null}
          {isGroup(child) ? (
            <GroupChip group={child} fields={fields} onRemove={() => remove(child.id)} />
          ) : (
            <Chip
              label={describeCondition(child as FilterCondition, fields)}
              onRemove={() => remove(child.id)}
            />
          )}
        </React.Fragment>
      ))}

      {onClear ? (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClear}>
          <FilterX /> Clear all
        </Button>
      ) : null}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      data-slot="filter-chip"
      className="bg-secondary text-secondary-foreground inline-flex max-w-72 items-center gap-1 rounded-md py-1 pr-1 pl-2 text-xs font-medium"
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="hover:bg-muted-foreground/20 focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

function GroupChip({
  group,
  fields,
  onRemove,
}: {
  group: FilterGroup;
  fields: FilterField[];
  onRemove: () => void;
}) {
  const count = group.children.length;
  const label = `${count} ${group.combinator === "or" ? "alternative" : "combined"} condition${count === 1 ? "" : "s"}`;

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Chip label={label} onRemove={onRemove} />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <ul className="space-y-0.5">
          {group.children.map((child) => (
            <li key={child.id}>
              {isGroup(child)
                ? `(${child.children.length} nested)`
                : describeCondition(child as FilterCondition, fields)}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
