"use client";

import * as React from "react";
import { RotateCcw, Settings2 } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { Button } from "@/registry/vianova/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";

/** A column a list can show or hide. */
export type ViewColumn = {
  id: string;
  label: string;
  /** Always shown: the list cannot be read without it. Listed, but disabled. */
  locked?: boolean;
};

/** How a list writes its dates: how long ago, or the day and time. */
export type DateDisplay = "relative" | "exact";

/**
 * How one person wants to look at one list, and the menu that sets it.
 *
 * The first version of this was a lone button that turned tick boxes on. It
 * read as odd, and it was: a control with one job, at the end of a toolbar,
 * with nothing to say what else might live there. Three things belong
 * together because they are the same kind of thing -- none of them changes
 * the data, all of them change how this reader sees it:
 *
 * - **Select rows.** Tick boxes are a column a list pays for on every row for
 *   something it is occasionally used for, so they are off until asked for.
 * - **Columns.** Which ones are worth their width depends on the job. Someone
 *   checking who gets an alert does not need to know who made it.
 * - **Dates.** An age is right for scanning what is recent and wrong for an
 *   audit, where "3 d ago" has to be turned back into a date. The reader
 *   knows which they are doing; the list does not.
 *
 * A menu and not a popover of form controls, because every item is a single
 * toggle or a single choice and the menu roles say exactly that. It stays
 * open while items are ticked, so three columns are three presses and not
 * three trips.
 *
 * Locked columns are listed and disabled rather than left out, as
 * `ColumnManager` does, so the menu always matches the table and nobody
 * hunts for a column that was quietly withheld.
 */
export function TableSettings({
  columns,
  hidden,
  onToggleColumn,
  selecting,
  onSelectingChange,
  dates,
  onDatesChange,
  changed,
  onReset,
  label = "Table settings",
  className,
}: {
  columns?: ViewColumn[];
  /** Ids of the columns not shown. */
  hidden?: ReadonlySet<string>;
  onToggleColumn?: (id: string, visible: boolean) => void;
  /** Omit both to leave row selection out, for a list with no bulk action. */
  selecting?: boolean;
  onSelectingChange?: (selecting: boolean) => void;
  /** Omit both for a list with no dates in it. */
  dates?: DateDisplay;
  onDatesChange?: (dates: DateDisplay) => void;
  /** Anything differs from how the list opens. Marks the button. */
  changed?: boolean;
  onReset?: () => void;
  /** Names the button. It has no visible text. */
  label?: string;
  className?: string;
}) {
  const hasSelection = selecting !== undefined && onSelectingChange;
  const hasColumns = columns && columns.length > 0 && onToggleColumn;
  const hasDates = dates !== undefined && onDatesChange;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={changed ? `${label}, changed` : label}
            title={label}
            data-slot="table-settings"
            className={cn("relative", className)}
          />
        }
      >
        <Settings2 />
        {/* Says the list is not as it opens -- a column is hidden, the boxes
            are on. Without it, a missing column looks like missing data. */}
        {changed ? (
          <span
            aria-hidden
            className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
          />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {hasSelection ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Rows</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={selecting}
                onCheckedChange={(next) => onSelectingChange(Boolean(next))}
              >
                Select rows
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            {hasColumns || hasDates ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}

        {hasColumns ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.locked || !hidden?.has(column.id)}
                  disabled={column.locked}
                  onCheckedChange={(next) =>
                    onToggleColumn(column.id, Boolean(next))
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            {hasDates ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}

        {hasDates ? (
          // The label goes INSIDE the radio group: Base UI's GroupLabel
          // labels the group it is in, and throws without one around it.
          <DropdownMenuRadioGroup
            value={dates}
            onValueChange={(value: string) =>
              onDatesChange(value as DateDisplay)
            }
          >
            <DropdownMenuLabel>Dates</DropdownMenuLabel>
            <DropdownMenuRadioItem value="relative">
              How long ago
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="exact">
              Date and time
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        ) : null}

        {onReset ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!changed} onClick={onReset}>
              <RotateCcw />
              Reset view
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The state behind `TableSettings`, for a list that owns its own view.
 *
 * Held per list and per visit: this is how somebody wants to look right now,
 * not a saved preference. A host that wants it remembered keeps the three
 * values itself and passes them to `TableSettings` directly.
 */
export function useTableView(
  columns: ViewColumn[],
  {
    selection = false,
    dates: withDates = false,
  }: { selection?: boolean; dates?: boolean } = {},
) {
  const [selecting, setSelecting] = React.useState(false);
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [dates, setDates] = React.useState<DateDisplay>("relative");

  const changed = selecting || hidden.size > 0 || dates !== "relative";

  return {
    /** Tick boxes are showing. Always false without `selection`. */
    selecting: selection && selecting,
    dates,
    /** Whether a column is on screen. */
    shows: (id: string) => !hidden.has(id),
    /** Spread onto `TableSettings`. */
    settings: {
      columns,
      hidden,
      onToggleColumn: (id: string, visible: boolean) =>
        setHidden((current) => {
          const next = new Set(current);
          if (visible) next.delete(id);
          else next.add(id);
          return next;
        }),
      ...(selection
        ? { selecting, onSelectingChange: setSelecting }
        : {}),
      ...(withDates ? { dates, onDatesChange: setDates } : {}),
      changed,
      onReset: () => {
        setSelecting(false);
        setHidden(new Set());
        setDates("relative");
      },
    },
  };
}
