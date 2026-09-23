"use client";

import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/registry/vianova/ui/command";

export type CommandPaletteAction = {
  id: string;
  label: string;
  group?: string;
  icon?: React.ReactNode;
  /** Displayed hint, e.g. "⌘E". Not bound -- register real shortcuts yourself. */
  shortcut?: string;
  /** Extra words to match on that are not in the label. */
  keywords?: string[];
  onSelect?: () => void;
};

/**
 * ⌘K palette over a flat list of actions.
 *
 * The hotkey is bound here rather than left to the consumer because the
 * listener has to know whether the palette is already open in order to toggle
 * it, and because it must not fire while the user is typing in a field. It
 * checks for `metaKey` and `ctrlKey` so one binding covers macOS and Windows.
 */
export function CommandPalette({
  actions,
  open,
  onOpenChange,
  placeholder = "Type a command or search…",
  emptyMessage = "No results found.",
  hotkey = "k",
  title = "Command palette",
}: {
  actions: CommandPaletteAction[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  emptyMessage?: React.ReactNode;
  /** Single key, combined with ⌘/Ctrl. Pass null to disable the binding. */
  hotkey?: string | null;
  title?: string;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  React.useEffect(() => {
    if (!hotkey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== hotkey.toLowerCase()) return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen(!isOpen);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hotkey, isOpen, setOpen]);

  // Preserve the order groups first appear in rather than sorting them: the
  // author's order encodes importance, and alphabetising buries "Create".
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandPaletteAction[]>();
    for (const action of actions) {
      const key = action.group ?? "";
      map.set(key, [...(map.get(key) ?? []), action]);
    }
    return [...map.entries()];
  }, [actions]);

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen} title={title} description={placeholder}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {groups.map(([group, items]) => (
          <CommandGroup key={group || "ungrouped"} heading={group || undefined}>
            {items.map((action) => (
              <CommandItem
                key={action.id}
                value={[action.label, ...(action.keywords ?? [])].join(" ")}
                onSelect={() => {
                  setOpen(false);
                  action.onSelect?.();
                }}
              >
                {action.icon}
                <span>{action.label}</span>
                {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
