"use client";

import * as React from "react";
import { CheckIcon, PencilLine, XIcon } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Text that becomes an input when you click it.
 *
 * Enter commits, Escape reverts, blur commits. Escape reverting matters: an
 * inline edit has no visible Cancel until it is already open, so the keyboard
 * is the only way out of a half-typed change, and blur-to-cancel would throw
 * away work whenever someone clicked elsewhere mid-edit.
 *
 * The read state is a real button so it is tab-reachable and announced as
 * activatable -- a click handler on a span is invisible to a screen reader.
 */
export function InlineEdit({
  value,
  onValueChange,
  placeholder = "Empty",
  label,
  disabled,
  validate,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "children"> & {
  value: string;
  onValueChange?: (next: string) => void;
  placeholder?: string;
  /** Names the field for assistive tech while editing. */
  label?: string;
  disabled?: boolean;
  /** Return an error message to reject the commit, or null to accept. */
  validate?: (next: string) => string | null;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const open = () => {
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    const message = validate?.(next) ?? null;
    if (message) {
      setError(message);
      inputRef.current?.focus();
      return;
    }
    setEditing(false);
    if (next !== value) onValueChange?.(next);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setDraft(value);
  };

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <div data-slot="inline-edit" className={cn("inline-flex", className)} {...props}>
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className="group hover:bg-muted focus-visible:ring-ring inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <span className={cn("truncate", !value && "text-muted-foreground italic")}>
            {value || placeholder}
          </span>
          <PencilLine
            aria-hidden
            className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
          <span className="sr-only">Edit{label ? ` ${label}` : ""}</span>
        </button>
      </div>
    );
  }

  return (
    <div data-slot="inline-edit" className={cn("inline-flex flex-col gap-1", className)} {...props}>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          autoFocus
          aria-label={label}
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-7 min-w-32 rounded-md border bg-transparent px-1.5 text-sm focus-visible:ring-3 focus-visible:outline-none",
            error && "border-destructive focus-visible:border-destructive",
          )}
        />
        {/* onMouseDown, not onClick: blur fires first and would commit instead. */}
        <button
          type="button"
          aria-label="Confirm"
          onMouseDown={(e) => {
            e.preventDefault();
            commit();
          }}
          className="hover:bg-muted focus-visible:ring-ring rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <CheckIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          className="hover:bg-muted focus-visible:ring-ring rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
