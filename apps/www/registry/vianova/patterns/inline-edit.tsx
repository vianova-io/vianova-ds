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
 *
 * `variant="title"` is for a page or document name, as Notion, Linear and
 * Figma treat theirs: it reads as plain heading text, takes its type from the
 * parent (wrap it in the heading), shows a soft background and a pencil only
 * on hover or focus, and opens into an input of the same type in the same
 * place, sized to the text, so nothing moves. It drops Confirm and Cancel --
 * Enter and blur commit, Escape reverts -- since a title has no row of
 * neighbours to tell a stray click from a decision.
 */
export function InlineEdit({
  value,
  onValueChange,
  placeholder = "Empty",
  label,
  disabled,
  validate,
  variant = "default",
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
  /** "title": heading text that edits in place, for a page or document name. */
  variant?: "default" | "title";
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

  // The same box in both states -- padding, border, radius, type -- so the
  // input lands exactly where the text was.
  const titleBox =
    "rounded-md border px-1.5 py-0.5 text-[length:inherit] leading-[inherit] font-[inherit] tracking-[inherit]";

  if (variant === "title") {
    if (!editing)
      return (
        <div
          data-slot="inline-edit"
          data-variant="title"
          className={cn("flex min-w-0 -mx-1.5", className)}
          {...props}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={open}
            // A description, not part of the name: the button sits in a
            // heading, whose name should be the title alone.
            title={label ? `Rename ${label}` : "Rename"}
            className={cn(
              titleBox,
              "group hover:bg-muted focus-visible:ring-ring inline-flex max-w-full cursor-text items-center gap-2 border-transparent text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none",
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <PencilLine
              aria-hidden
              className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
        </div>
      );
    return (
      <div
        data-slot="inline-edit"
        data-variant="title"
        className={cn(
          // items-start, so the input keeps the width of its text.
          "-mx-1.5 flex min-w-0 flex-col items-start gap-1",
          className,
        )}
        {...props}
      >
        {/* Sized to the text: an invisible copy of it sets the width, and the
            input sits in the same grid cell on top. */}
        <span
          data-value={draft || placeholder}
          className={cn(
            "inline-grid max-w-full text-[length:inherit] leading-[inherit] font-[inherit] tracking-[inherit]",
            // The copy has the input's padding and border, plus room for the caret.
            "after:invisible after:col-start-1 after:row-start-1 after:min-w-24 after:overflow-hidden after:rounded-md after:border after:border-transparent after:py-0.5 after:pr-2.5 after:pl-1.5 after:whitespace-pre after:content-[attr(data-value)]",
          )}
        >
          <input
            ref={inputRef}
            autoFocus
            aria-label={label}
            aria-invalid={error ? true : undefined}
            value={draft}
            placeholder={placeholder}
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
              titleBox,
              "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 col-start-1 row-start-1 w-full min-w-0 shadow-xs focus-visible:ring-3 focus-visible:outline-none",
              error && "border-destructive focus-visible:border-destructive",
            )}
          />
        </span>
        {error ? (
          <p className="text-destructive px-1.5 text-xs">{error}</p>
        ) : null}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        data-slot="inline-edit"
        className={cn("inline-flex", className)}
        {...props}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className="group hover:bg-muted focus-visible:ring-ring inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <span
            className={cn("truncate", !value && "text-muted-foreground italic")}
          >
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
    <div
      data-slot="inline-edit"
      className={cn("inline-flex flex-col gap-1", className)}
      {...props}
    >
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
