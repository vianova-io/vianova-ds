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
  orientation = "vertical",
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
  /**
   * "responsive" is a horizontal strip of chips below `lg` and this column from
   * `lg` up. Switched by CSS, not a media query: the site is a static export,
   * and a hook would paint every phone a frame of the column first. In the
   * strip the per-rule ⋯ menus are hidden -- chips have no fixed height to
   * place them by -- so the host must offer Duplicate and Delete for the
   * selected rule itself.
   */
  orientation?: "vertical" | "responsive";
  className?: string;
}) {
  const r = orientation === "responsive";
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
    const forward = order[(at + 1) % order.length];
    const backward = order[(at - 1 + order.length) % order.length];
    const next = {
      ArrowDown: forward,
      ArrowUp: backward,
      // Both axes when the strip can be horizontal: which one it is depends on
      // a breakpoint the keyboard handler cannot see.
      ...(r ? { ArrowRight: forward, ArrowLeft: backward } : {}),
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
        r
          ? "flex w-full min-w-0 shrink-0 flex-row items-center rounded-lg border border-border bg-card lg:h-full lg:w-[72px] lg:flex-col lg:items-stretch"
          : "flex h-full w-[72px] shrink-0 flex-col rounded-lg border border-border bg-card",
        className,
      )}
    >
      {addable.length > 0 ? (
        <div className={r ? "shrink-0 pl-2 lg:px-2 lg:pt-2" : "px-2 pt-2"}>
          {addable.length === 1 ? (
            <AddTile
              chip={r}
              label={`Add ${RULE_TYPES[addable[0]!].label.toLowerCase()} rule`}
              onClick={() => onAdd?.(addable[0]!)}
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger render={<AddTile chip={r} label="Add rule" />} />
              <DropdownMenuContent side={r ? "bottom" : "right"} align="start" className="w-48">
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
        className={cn(
          "relative flex flex-1 [scrollbar-width:thin]",
          r
            ? "min-w-0 flex-row overflow-x-auto max-lg:[scrollbar-width:none] lg:min-h-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto"
            : "min-h-0 flex-col overflow-y-auto",
        )}
        style={{ padding: PAD }}
      >
        <div
          role="tablist"
          aria-orientation={r ? undefined : "vertical"}
          aria-label={ariaLabel}
          className={r ? "flex flex-1 flex-row lg:flex-col" : "flex flex-1 flex-col"}
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
                  "flex shrink-0 items-center rounded-md text-foreground transition-shadow",
                  r
                    ? "h-9 max-w-40 flex-row gap-1.5 px-2.5 lg:h-[68px] lg:w-full lg:max-w-none lg:flex-col lg:gap-0.5 lg:px-1 lg:pt-1.5"
                    : "w-full flex-col gap-0.5 px-1 pt-1.5",
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
                  height: r ? undefined : TILE,
                  backgroundColor: `color-mix(in oklab, ${color} 12%, var(--card))`,
                }}
              >
                {r ? <RuleTypeIcon type={item.type} size="sm" className="lg:hidden" /> : null}
                <RuleTypeIcon
                  type={item.type}
                  size="md"
                  className={r ? "hidden lg:inline-flex" : undefined}
                />
                <span
                  className={
                    r
                      ? "truncate text-sm lg:line-clamp-2 lg:w-full lg:text-center lg:text-xs lg:leading-[14px] lg:break-words lg:whitespace-normal"
                      : "line-clamp-2 w-full text-center text-xs leading-[14px] break-words"
                  }
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {showGlobal ? (
            // Sticky rather than outside the scroller: it has to stay in the
            // tablist so the arrow keys reach it, and the tablist scrolls. Not
            // sticky in the phone strip, where pinning it to the right edge
            // covered the very chips it was meant to sit after.
            <div
              className={
                r
                  ? "flex shrink-0 items-center gap-1 pl-1 lg:sticky lg:bottom-0 lg:z-10 lg:mt-auto lg:block lg:bg-card lg:pt-1 lg:pl-0"
                  : "sticky bottom-0 z-10 mt-auto bg-card pt-1"
              }
            >
              <div
                className={
                  r
                    ? "h-6 border-l border-border lg:mb-1 lg:h-auto lg:border-t lg:border-l-0"
                    : "mb-1 border-t border-border"
                }
              />
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
                  "flex items-center justify-center rounded-md bg-muted/60 text-xs text-muted-foreground transition-shadow",
                  r
                    ? "h-9 flex-row gap-1.5 px-2.5 text-sm lg:h-14 lg:w-full lg:flex-col lg:gap-0.5 lg:px-0 lg:text-xs"
                    : "h-14 w-full flex-col gap-0.5",
                  value === RULE_RAIL_GLOBAL
                    ? "text-foreground inset-ring-2 inset-ring-primary"
                    : "hover:text-foreground",
                  focusRing,
                )}
              >
                <Settings2 className={r ? "size-4 lg:size-5" : "size-5"} aria-hidden />
                Global
              </button>
            </div>
          ) : null}
        </div>

        {hasMenu ? (
          <div className={r ? "hidden lg:contents" : "contents"}>
            {items.map((item, i) => (
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
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddTile({
  label,
  chip = false,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & { label: string; chip?: boolean }) {
  return (
    <button
      type="button"
      // The visible word is "Add"; the name says what is added. It starts with
      // the visible word so voice control ("click Add") still finds it.
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted",
        chip
          ? "h-9 flex-row gap-1 px-2.5 text-sm lg:h-12 lg:w-full lg:flex-col lg:gap-0.5 lg:px-0 lg:text-xs"
          : "h-12 w-full flex-col gap-0.5",
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
