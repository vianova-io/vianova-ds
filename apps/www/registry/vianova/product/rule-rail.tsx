"use client";

import * as React from "react";
import { Copy, Ellipsis, Plus, Settings2, Trash2 } from "lucide-react";

import {
  RULE_TYPES,
  RuleTypeIcon,
  type RuleType,
} from "@/registry/vianova/product/rule-type-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import { cn } from "@/registry/vianova/lib/utils";

export type RuleRailItem = { id: string; type: RuleType; label: string };

/** The `value` of the pinned settings tile, which belongs to no single rule. */
export const RULE_RAIL_GLOBAL = "global";

/*
 * Tiles are a fixed height so the action buttons can be placed over them by
 * arithmetic. They cannot simply live inside each tile: a tile is a tab, and a
 * button inside a button is both invalid HTML and two controls a screen reader
 * cannot tell apart. Nor can they sit inside the tablist next to their tab,
 * because a tablist may only own tabs (axe's aria-required-children, which the
 * a11y suite enforces). So they are siblings of the whole tablist, laid over
 * the tiles they belong to.
 *
 * 68px holds a 6px inset, the 24px icon, a 2px gap and two 14px lines of label.
 */
const TILE = 68;
const GAP = 4;
/** The scroller's padding: room for a 3px focus ring that overflow would clip. */
const PAD = 8;

const focusRing = "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * The rules of one regulation, as a vertical strip of tiles: an add tile on
 * top, a tile per rule, and a pinned "Global" tile for the settings the rules
 * share.
 *
 * A tablist, because that is what it is: each tile swaps the panel beside it,
 * exactly one is always showing, and arrow keys move between them. Selection
 * follows focus, since showing a rule's settings is cheap and harmless.
 *
 * Only the selected rule's ⋯ button is in the tab order. Every tile's button
 * still answers a click, but a keyboard user tabbing past a long regulation
 * should not have to step through a menu per rule to reach the panel -- they
 * pick the rule with the arrows, and its menu is the next stop.
 */
export function RuleRail({
  items,
  value,
  onValueChange,
  addableTypes,
  onAdd,
  onDuplicate,
  onDelete,
  showGlobal = true,
  "aria-label": ariaLabel = "Rules",
  getPanelId,
  className,
}: {
  items: RuleRailItem[];
  /** A rule id, or RULE_RAIL_GLOBAL. */
  value: string;
  onValueChange: (id: string) => void;
  /**
   * What the add tile can add. None, no tile. One, the tile adds it outright.
   * Several, it opens a menu of them.
   */
  addableTypes?: RuleType[];
  onAdd?: (type: RuleType) => void;
  onDuplicate?: (id: string) => void;
  /** Offered but disabled on the last rule: a regulation with no rules is not one. */
  onDelete?: (id: string) => void;
  showGlobal?: boolean;
  "aria-label"?: string;
  /** The id of the panel a tile controls, for aria-controls. */
  getPanelId?: (id: string) => string;
  className?: string;
}) {
  const baseId = React.useId();
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const refs = React.useRef(new Map<string, HTMLButtonElement>());

  const order = React.useMemo(
    () => [...items.map((i) => i.id), ...(showGlobal ? [RULE_RAIL_GLOBAL] : [])],
    [items, showGlobal],
  );
  // A value that names nothing here (a rule just deleted, say) would leave no
  // tile tabbable and the whole rail unreachable by keyboard.
  const focusable = order.includes(value) ? value : order[0];

  const move = (id: string | undefined) => {
    if (id === undefined) return;
    onValueChange(id);
    refs.current.get(id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    const at = order.indexOf(id);
    const next = {
      ArrowDown: order[(at + 1) % order.length],
      ArrowUp: order[(at - 1 + order.length) % order.length],
      Home: order[0],
      End: order[order.length - 1],
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  };

  const hasMenu = Boolean(onDuplicate || onDelete);
  const addable = onAdd ? (addableTypes ?? []) : [];

  return (
    <div
      data-slot="rule-rail"
      className={cn(
        "flex h-full w-[72px] shrink-0 flex-col rounded-lg border border-border bg-card",
        className,
      )}
    >
      {addable.length > 0 ? (
        <div className="px-2 pt-2">
          {addable.length === 1 ? (
            <AddTile
              label={`Add ${RULE_TYPES[addable[0]!].label.toLowerCase()} rule`}
              onClick={() => onAdd?.(addable[0]!)}
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger render={<AddTile label="Add rule" />} />
              <DropdownMenuContent side="right" align="start" className="w-48">
                {addable.map((type) => (
                  <DropdownMenuItem key={type} onClick={() => onAdd?.(type)}>
                    <RuleTypeIcon type={type} size="sm" />
                    {RULE_TYPES[type].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : null}

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:thin]"
        style={{ padding: PAD }}
      >
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label={ariaLabel}
          className="flex flex-1 flex-col"
          style={{ gap: GAP }}
        >
          {items.map((item) => {
            const selected = item.id === value;
            const { color } = RULE_TYPES[item.type];
            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) refs.current.set(item.id, el);
                  else refs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={tabId(item.id)}
                aria-selected={selected}
                aria-controls={getPanelId?.(item.id)}
                tabIndex={item.id === focusable ? 0 : -1}
                title={item.label}
                data-state={selected ? "selected" : "default"}
                onClick={() => onValueChange(item.id)}
                onKeyDown={(e) => onKeyDown(e, item.id)}
                className={cn(
                  "flex w-full shrink-0 flex-col items-center gap-0.5 rounded-md px-1 pt-1.5 text-foreground transition-shadow",
                  // An inset ring for "selected", so it composes with the
                  // outer focus ring instead of being replaced by it, and so a
                  // scroller cannot clip it.
                  selected
                    ? "inset-ring-2 inset-ring-primary"
                    : "hover:inset-ring-1 hover:inset-ring-border",
                  focusRing,
                )}
                // A tint of the rule's own map colour, mixed into the card so
                // it follows the theme: 12% of purple over a dark card is a
                // dark purple, where a fixed light tint would glare.
                style={{
                  height: TILE,
                  backgroundColor: `color-mix(in oklab, ${color} 12%, var(--card))`,
                }}
              >
                <RuleTypeIcon type={item.type} size="md" />
                <span className="line-clamp-2 w-full text-center text-xs leading-[14px] break-words">
                  {item.label}
                </span>
              </button>
            );
          })}

          {showGlobal ? (
            // Sticky rather than outside the scroller: it has to stay in the
            // tablist so the arrow keys reach it, and the tablist scrolls.
            <div className="sticky bottom-0 z-10 mt-auto bg-card pt-1">
              <div className="mb-1 border-t border-border" />
              <button
                ref={(el) => {
                  if (el) refs.current.set(RULE_RAIL_GLOBAL, el);
                  else refs.current.delete(RULE_RAIL_GLOBAL);
                }}
                type="button"
                role="tab"
                id={tabId(RULE_RAIL_GLOBAL)}
                aria-selected={value === RULE_RAIL_GLOBAL}
                aria-controls={getPanelId?.(RULE_RAIL_GLOBAL)}
                tabIndex={focusable === RULE_RAIL_GLOBAL ? 0 : -1}
                data-state={value === RULE_RAIL_GLOBAL ? "selected" : "default"}
                onClick={() => onValueChange(RULE_RAIL_GLOBAL)}
                onKeyDown={(e) => onKeyDown(e, RULE_RAIL_GLOBAL)}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md bg-muted/60 text-xs text-muted-foreground transition-shadow",
                  value === RULE_RAIL_GLOBAL
                    ? "text-foreground inset-ring-2 inset-ring-primary"
                    : "hover:text-foreground",
                  focusRing,
                )}
              >
                <Settings2 className="size-5" aria-hidden />
                Global
              </button>
            </div>
          ) : null}
        </div>

        {hasMenu
          ? items.map((item, i) => (
              <RuleMenu
                key={item.id}
                item={item}
                top={PAD + i * (TILE + GAP)}
                right={PAD}
                tabbable={item.id === focusable}
                canDelete={items.length > 1}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))
          : null}
      </div>
    </div>
  );
}

function AddTile({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & { label: string }) {
  return (
    <button
      type="button"
      // The visible word is "Add"; the name says what is added. It starts with
      // the visible word so voice control ("click Add") still finds it.
      aria-label={label}
      title={label}
      className={cn(
        "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted",
        focusRing,
        className,
      )}
      {...props}
    >
      <Plus className="size-4" aria-hidden />
      Add
    </button>
  );
}

function RuleMenu({
  item,
  top,
  right,
  tabbable,
  canDelete,
  onDuplicate,
  onDelete,
}: {
  item: RuleRailItem;
  top: number;
  right: number;
  tabbable: boolean;
  canDelete: boolean;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${item.label}`}
            tabIndex={tabbable ? 0 : -1}
            // A full 24px target, but the dots sit in its top-right corner so
            // they clear the shield the hit area overlaps.
            className={cn(
              "absolute flex size-6 items-start justify-end rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground data-popup-open:text-foreground",
              focusRing,
            )}
            style={{ top, right }}
          />
        }
      >
        <Ellipsis className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-40">
        {onDuplicate ? (
          <DropdownMenuItem onClick={() => onDuplicate(item.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            onClick={() => onDelete(item.id)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
