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
 *
 * It also serves as the chip field of a picker, where the chips are things
 * chosen from a list and the text is a search over it -- the zone picker's
 * "To:" field. Three props turn that on, and none changes the default:
 * `getTagLabel` shows a name for a value (an id), `draft`/`onDraftChange`
 * hand the typed text to the host to filter with, and `onDraftCommit` takes
 * over Enter so the host picks a match instead of free text becoming a tag.
 * With `onDraftCommit` set, nothing typed is ever committed on its own --
 * not on a separator, not on blur.
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
  getTagLabel,
  draft: draftProp,
  onDraftChange,
  onDraftCommit,
  maxVisible,
  startAddon,
  inputLabel,
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
  /** What a chip says for a value, when the value is an id rather than words. */
  getTagLabel?: (value: string) => string;
  /** The typed text, controlled -- for a host that searches with it. */
  draft?: string;
  onDraftChange?: (draft: string) => void;
  /**
   * Takes over Enter: called with the typed text instead of adding it as a
   * tag. The host decides what, if anything, it adds -- say, the top match.
   */
  onDraftCommit?: (draft: string) => void;
  /**
   * Show this many chips and fold the rest into a "+N more" chip that expands
   * them. For a picker where Select all can add hundreds.
   */
  maxVisible?: number;
  /** Shown before the chips, such as a search icon. Decorative. */
  startAddon?: React.ReactNode;
  /** The input's accessible name, when no <label for> points at it. */
  inputLabel?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue);
  const [internalDraft, setInternalDraft] = React.useState("");
  const draft = draftProp ?? internalDraft;
  const setDraft = (next: string) => {
    if (draftProp === undefined) setInternalDraft(next);
    onDraftChange?.(next);
  };
  const [expanded, setExpanded] = React.useState(false);
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
    if (onDraftCommit) {
      if (event.key === "Enter") {
        event.preventDefault();
        onDraftCommit(draft);
        return;
      }
    } else if (separators.includes(event.key)) {
      event.preventDefault();
      add(draft);
      setDraft("");
      return;
    }
    if (event.key === "Backspace" && !draft && tags.length) {
      commit(tags.slice(0, -1));
    }
  };

  const label = (tag: string) => getTagLabel?.(tag) ?? tag;
  // The first picks stay in place and the rest fold, so chips do not shuffle
  // under the pointer as more are added.
  const folding = maxVisible !== undefined && !expanded && tags.length > maxVisible;
  const visible = folding ? tags.slice(0, maxVisible) : tags;
  const hidden = tags.length - visible.length;

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
      {startAddon ? (
        <span aria-hidden className="text-muted-foreground flex shrink-0 items-center pl-1.5 [&_svg]:size-4">
          {startAddon}
        </span>
      ) : null}
      {visible.map((tag) => (
        <span
          key={tag}
          data-slot="tag-input-chip"
          className="bg-secondary text-secondary-foreground inline-flex max-w-full min-w-0 items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-medium"
        >
          <span className="truncate">{label(tag)}</span>
          <button
            type="button"
            aria-label={`Remove ${label(tag)}`}
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
      {hidden > 0 || (expanded && maxVisible !== undefined && tags.length > maxVisible) ? (
        <button
          type="button"
          data-slot="tag-input-more"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((e) => !e);
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums focus-visible:ring-2 focus-visible:outline-none"
        >
          {expanded ? "Show less" : `+${hidden} more`}
        </button>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        type="text"
        aria-label={inputLabel}
        value={draft}
        disabled={disabled || (max !== undefined && tags.length >= max)}
        placeholder={tags.length ? "" : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // Committing on blur stops a typed-but-unsubmitted tag being lost when
        // the user tabs straight to Save.
        // Not when a host owns Enter: there the text is a search, and blurring
        // a half-typed search must not turn it into a tag.
        onBlur={() => {
          if (onDraftCommit) return;
          add(draft);
          setDraft("");
        }}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent px-1 py-0.5 outline-none"
      />
    </div>
  );
}
