"use client";

import * as React from "react";
import { Bookmark, Check, ChevronDown, Lock, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import { cn } from "@/registry/vianova/lib/utils";

export type SavedView = {
  id: string;
  name: string;
  /** Shared views are visible to the workspace; personal ones are not. */
  shared?: boolean;
  /** Cannot be renamed or deleted, e.g. a workspace default. */
  locked?: boolean;
};

/**
 * Picker for saved filter/map views, with save and delete.
 *
 * `dirty` drives the whole component. Once the current view has unsaved edits,
 * the trigger says so and "Save changes" appears above "Save as new" -- without
 * that distinction the usual outcome is someone overwriting a shared view they
 * only meant to tweak for themselves.
 */
export function SavedViewMenu({
  views,
  activeId,
  dirty = false,
  onSelect,
  onSaveChanges,
  onSaveAsNew,
  onDelete,
  placeholder = "Saved views",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onSelect"> & {
  views: SavedView[];
  activeId?: string;
  dirty?: boolean;
  onSelect?: (view: SavedView) => void;
  onSaveChanges?: (view: SavedView) => void;
  onSaveAsNew?: () => void;
  onDelete?: (view: SavedView) => void;
  placeholder?: string;
}) {
  const active = views.find((v) => v.id === activeId);
  const personal = views.filter((v) => !v.shared);
  const shared = views.filter((v) => v.shared);

  const renderGroup = (label: string, items: SavedView[]) =>
    items.length ? (
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-muted-foreground text-xs">{label}</DropdownMenuLabel>
        {items.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onClick={() => onSelect?.(view)}
            className="justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-2">
              {view.id === activeId ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <span aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{view.name}</span>
              {view.locked ? (
                <Lock aria-label="Locked" className="text-muted-foreground size-3 shrink-0" />
              ) : null}
            </span>
            {onDelete && !view.locked ? (
              <button
                type="button"
                aria-label={`Delete ${view.name}`}
                // Stop the click reaching the item, which would select the view
                // being deleted on the way out.
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(view);
                }}
                className="hover:bg-muted-foreground/20 focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            data-slot="saved-view-menu"
            data-dirty={dirty || undefined}
            className={cn("max-w-64 justify-between gap-2", className)}
            {...props}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Bookmark className="shrink-0" />
              <span className="truncate">{active?.name ?? placeholder}</span>
              {dirty ? <span className="text-muted-foreground shrink-0 text-xs">• edited</span> : null}
            </span>
            <ChevronDown className="shrink-0 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        {renderGroup("Personal", personal)}
        {personal.length && shared.length ? <DropdownMenuSeparator /> : null}
        {renderGroup("Shared", shared)}
        {views.length ? <DropdownMenuSeparator /> : null}

        <DropdownMenuGroup>
          {active && !active.locked ? (
            <DropdownMenuItem disabled={!dirty} onClick={() => onSaveChanges?.(active)}>
              <Star />
              Save changes
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onSaveAsNew?.()}>
            <Plus />
            Save as new view
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
