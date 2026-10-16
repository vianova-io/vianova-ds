"use client";

import * as React from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { CheckIcon } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";
import { Badge } from "@/registry/vianova/ui/badge";

/**
 * Columns are set against the group's own width, not the viewport's.
 *
 * A choice-card group lives in sheets, dialogs and side panels far more often
 * than across a full page, and a viewport breakpoint would put two cramped
 * columns into a 400px sheet on a wide monitor. A container query asks the
 * question that matters: how much room does this group actually have.
 */
const COLUMNS = {
  1: "",
  2: "@sm/choice-card-group:grid-cols-2",
  3: "@sm/choice-card-group:grid-cols-2 @2xl/choice-card-group:grid-cols-3",
  4: "@sm/choice-card-group:grid-cols-2 @3xl/choice-card-group:grid-cols-4",
} as const;

/**
 * A radio group whose options are cards.
 *
 * Same Base UI primitives as `RadioGroup`, so the keyboard contract is the
 * native one: the group is a single tab stop and the arrow keys move the
 * selection. That is the point of building it this way rather than as a row
 * of toggle buttons, where every card would be its own tab stop and "pick one"
 * would only be enforced by the click handler.
 *
 * The grid sits on an inner div because a container cannot query itself: the
 * outer element is the container, the inner one reads its width.
 */
function ChoiceCardGroup({
  className,
  columns = 1,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive> & {
  columns?: 1 | 2 | 3 | 4;
}) {
  return (
    <RadioGroupPrimitive
      data-slot="choice-card-group"
      className={cn("@container/choice-card-group w-full", className)}
      {...props}
    >
      <div className={cn("grid grid-cols-1 gap-2", COLUMNS[columns])}>
        {children}
      </div>
    </RadioGroupPrimitive>
  );
}

/**
 * One option, and the whole card is the radio.
 *
 * Rendered as a div rather than Base UI's default span because it holds block
 * content. The radio role makes its children presentational, so the name and
 * description are wired explicitly: the title is the accessible name, and the
 * description and badge are read after it. A "Soon" badge that only showed
 * visually would leave a screen-reader user wondering why the option is dimmed.
 *
 * Disabled cards are skipped by the arrow keys and announced as unavailable.
 * They are dimmed rather than left out so people can see what is coming.
 */
function ChoiceCard({
  value,
  icon,
  title,
  description,
  badge,
  disabled,
  className,
}: {
  value: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A short status shown beside the title, e.g. "Soon". */
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = React.useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const badgeId = badge ? `${id}-badge` : undefined;
  const describedBy =
    [descriptionId, badgeId].filter(Boolean).join(" ") || undefined;

  return (
    <RadioPrimitive.Root
      value={value}
      disabled={disabled}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      render={<div />}
      data-slot="choice-card"
      className={cn(
        "group/choice-card relative flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-card-foreground transition-colors outline-none",
        "not-data-checked:not-data-disabled:hover:bg-muted/50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-checked:border-primary data-checked:bg-primary/5 dark:data-checked:bg-primary/10",
        "data-disabled:cursor-not-allowed data-disabled:opacity-60",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          data-slot="choice-card-icon"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-data-checked/choice-card:bg-primary/10 group-data-checked/choice-card:text-primary [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span id={titleId} className="text-sm leading-snug font-medium">
            {title}
          </span>
          {badge ? (
            <Badge id={badgeId} variant="outline" data-slot="choice-card-badge">
              {badge}
            </Badge>
          ) : null}
        </span>
        {description ? (
          <span
            id={descriptionId}
            className="text-sm leading-normal text-muted-foreground"
          >
            {description}
          </span>
        ) : null}
      </span>

      {/* The check is a second cue, not the only one: the border and tint
          change too, so the selection survives without colour. */}
      <span
        aria-hidden
        data-slot="choice-card-check"
        className="absolute top-3 right-3 flex size-4 items-center justify-center rounded-full border border-input transition-colors group-data-checked/choice-card:border-primary group-data-checked/choice-card:bg-primary group-data-checked/choice-card:text-primary-foreground dark:bg-input/30"
      >
        <RadioPrimitive.Indicator className="flex items-center justify-center">
          <CheckIcon className="size-3" strokeWidth={3} />
        </RadioPrimitive.Indicator>
      </span>
    </RadioPrimitive.Root>
  );
}

export { ChoiceCardGroup, ChoiceCard };
