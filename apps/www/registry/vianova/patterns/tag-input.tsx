"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Free-text tags: type, press Enter, get a chip.
 *
 * Distinct from a multi-select combobox, which picks from a known list. Use
 * this only when the values are genuinely open-ended -- if there is a list,
 * the combobox gives filtering and prevents typos, both of which this cannot.
 *
 * Backspace on an empty field removes the last tag, which is the behaviour
 * every mail client has trained people to expect.
 */
export function TagInput({
  value,
  defaultValue = [],
  onValueChange,
  placeholder = "Add a tag…",
  max,
  /** Characters that commit the current draft, alongside Enter. */
  separators = [",", "Enter"],
  disabled,
  id,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> & {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  separators?: string[];
  disabled?: boolean;
  id?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const tags = value ?? internal;

  const commit = (next: string[]) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const add = (raw: string) => {
    const tag = raw.trim();
    // Silently ignore duplicates and overflow rather than showing an error for
    // something the user cannot see they did wrong.
    if (!tag || tags.includes(tag) || (max !== undefined && tags.length >= max)) return;
    commit([...tags, tag]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (separators.includes(event.key)) {
      event.preventDefault();
      add(draft);
      setDraft("");
      return;
    }
    if (event.key === "Backspace" && !draft && tags.length) {
      commit(tags.slice(0, -1));
    }
  };

  return (
    <div
      data-slot="tag-input"
      data-disabled={disabled || undefined}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border bg-transparent px-1.5 py-1 text-sm transition-colors focus-within:ring-3",
        "dark:bg-input/30",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          data-slot="tag-input-chip"
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              commit(tags.filter((t) => t !== tag));
            }}
            className="hover:bg-muted-foreground/20 focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        disabled={disabled || (max !== undefined && tags.length >= max)}
        placeholder={tags.length ? "" : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // Committing on blur stops a typed-but-unsubmitted tag being lost when
        // the user tabs straight to Save.
        onBlur={() => {
          add(draft);
          setDraft("");
        }}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 outline-none"
      />
    </div>
  );
}
