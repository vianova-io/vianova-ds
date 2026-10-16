"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";
import { Button } from "@/registry/vianova/ui/button";
import { Spinner } from "@/registry/vianova/ui/spinner";

/**
 * The footer of an editor panel that says whether there is anything to save.
 *
 * Always rendered, clean or not. A bar that appears on the first keystroke
 * shoves the panel's content up under the cursor, and one that disappears
 * after saving takes the focused Save button with it, dropping keyboard focus
 * to the top of the document. Kept, it just changes what it says.
 *
 * Stateless on purpose: the panel owns dirty, saving and error, because only
 * it knows what was changed and what the server said. There is no transient
 * "Saved" flash; "All changes saved" is the resting clean state and says the
 * same thing for as long as it is true.
 */
export function SaveBar({
  dirty,
  saving = false,
  error,
  onSave,
  onDiscard,
  message,
  saveLabel = "Save",
  className,
}: {
  dirty: boolean;
  saving?: boolean;
  /** Replaces the message, in the destructive colour, until cleared. */
  error?: string | null;
  onSave: () => void;
  /** Omit to hide Discard, for an editor whose changes cannot be reverted. */
  onDiscard?: () => void;
  /** Shown while dirty. Defaults to "Unsaved changes". */
  message?: string;
  saveLabel?: string;
  className?: string;
}) {
  const text = error
    ? error
    : saving
      ? "Saving changes"
      : dirty
        ? (message ?? "Unsaved changes")
        : "All changes saved";

  return (
    <div
      role="region"
      aria-label="Save changes"
      data-slot="save-bar"
      data-state={error ? "error" : saving ? "saving" : dirty ? "dirty" : "clean"}
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 flex items-center gap-3 border-t px-4 py-3 backdrop-blur",
        className,
      )}
    >
      <p
        aria-live="polite"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-sm",
          error ? "text-destructive" : dirty || saving ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {dirty && !error ? (
          <span aria-hidden className="bg-primary size-2 shrink-0 rounded-full" />
        ) : null}
        <span className="truncate">{text}</span>
      </p>

      {onDiscard && dirty ? (
        <Button variant="ghost" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
      ) : null}
      <Button disabled={!dirty || saving} onClick={onSave}>
        {saving ? (
          <>
            <Spinner aria-hidden role={undefined} aria-label={undefined} />
            Saving…
          </>
        ) : (
          saveLabel
        )}
      </Button>
    </div>
  );
}
