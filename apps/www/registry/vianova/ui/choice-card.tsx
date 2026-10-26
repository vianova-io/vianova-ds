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
 * Whether the group picks a value or acts on one.
 *
 * `select` is a radio group: each card is an option and something else --
 * a footer button, usually -- is the decision. `action` is a list of buttons:
 * the first click is the decision, which is how production's regulation type
 * picker behaves.
 *
 * The difference is a keyboard contract, not a coat of paint. Arrow keys
 * inside a radio group MOVE THE SELECTION, so a group that acted on every
 * change would throw a keyboard user into the second option they arrowed
 * past -- which is why this component had a confirm step to begin with.
 * Action cards are ordinary buttons instead: Tab reaches each one, Enter and
 * Space activate the one in hand, and arrowing past a card does nothing.
 * That buys the single click without the trap.
 */
type ChoiceCardMode = "select" | "action";

const ChoiceCardContext = React.createContext<{
  mode: ChoiceCardMode;
  onChoose?: (value: string) => void;
}>({ mode: "select" });

/**
 * A group of cards that is either a radio group or a row of buttons.
 *
 * Same Base UI primitives as `RadioGroup` in `select` mode, so the keyboard
 * contract is the native one: the group is a single tab stop and the arrow
 * keys move the selection. That is the point of building it this way rather
 * than as a row of toggle buttons, where every card would be its own tab stop
 * and "pick one" would only be enforced by the click handler.
 *
 * In `action` mode there is nothing to enforce -- there is no selection to
 * hold -- so the cards become plain buttons and every card is a tab stop,
 * which is the right contract for a list of things that each do something.
 *
 * The grid sits on an inner div because a container cannot query itself: the
 * outer element is the container, the inner one reads its width.
 */
function ChoiceCardGroup({
  className,
  columns = 1,
  mode = "select",
  onChoose,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive> & {
  columns?: 1 | 2 | 3 | 4;
  /** `select` (default) for a radio group, `action` for cards that act on click. */
  mode?: ChoiceCardMode;
  /** Given the card's value in `action` mode. Ignored in `select`. */
  onChoose?: (value: string) => void;
}) {
  const context = React.useMemo(() => ({ mode, onChoose }), [mode, onChoose]);

  const grid = (
    <div className={cn("grid grid-cols-1 gap-2", COLUMNS[columns])}>{children}</div>
  );

  if (mode === "action") {
    // A radio group's own props mean nothing to a div, and `value` on one is
    // a React DOM warning, so they are dropped rather than forwarded.
    const { value, defaultValue, onValueChange, ...rest } = props;
    void value;
    void defaultValue;
    void onValueChange;

    return (
      <ChoiceCardContext.Provider value={context}>
        <div
          role="group"
          data-slot="choice-card-group"
          data-mode="action"
          className={cn("@container/choice-card-group w-full", className)}
          {...(rest as React.ComponentProps<"div">)}
        >
          {grid}
        </div>
      </ChoiceCardContext.Provider>
    );
  }

  return (
    <ChoiceCardContext.Provider value={context}>
      <RadioGroupPrimitive
        data-slot="choice-card-group"
        data-mode="select"
        className={cn("@container/choice-card-group w-full", className)}
        {...props}
      >
        {grid}
      </RadioGroupPrimitive>
    </ChoiceCardContext.Provider>
  );
}

/** Shared by both modes, so an action card is not a second visual design. */
const CARD_BASE =
  "group/choice-card relative flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-card-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * One option, and the whole card is the control.
 *
 * In `select` mode it is rendered as a div rather than Base UI's default span
 * because it holds block content. The radio role makes its children
 * presentational, so the name and description are wired explicitly: the title
 * is the accessible name, and the description and badge are read after it. A
 * "Soon" badge that only showed visually would leave a screen-reader user
 * wondering why the option is dimmed.
 *
 * Disabled cards are skipped by the arrow keys and announced as unavailable.
 * They are dimmed rather than left out so people can see what is coming.
 *
 * In `action` mode it is a button, and the check mark is gone: a card that
 * acts on click is never left sitting in a checked state, so an indicator for
 * one would be a promise the card does not keep.
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
  const { mode, onChoose } = React.useContext(ChoiceCardContext);
  const id = React.useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const badgeId = badge ? `${id}-badge` : undefined;
  const describedBy =
    [descriptionId, badgeId].filter(Boolean).join(" ") || undefined;

  const body = (
    <>
      {icon ? (
        <span
          aria-hidden
          data-slot="choice-card-icon"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-data-checked/choice-card:bg-primary/10 group-data-checked/choice-card:text-primary [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
        >
          {icon}
        </span>
      ) : null}

      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5",
          // Room for the check mark, which only one mode draws.
          mode === "select" && "pr-6",
        )}
      >
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
    </>
  );

  if (mode === "action") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose?.(value)}
        // Named by its title alone, as the radio is. Without this the button
        // takes its name from everything inside it, so a screen reader reads
        // the whole description before saying which card this is.
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        data-slot="choice-card"
        className={cn(
          CARD_BASE,
          "hover:bg-muted/50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <RadioPrimitive.Root
      value={value}
      disabled={disabled}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      render={<div />}
      data-slot="choice-card"
      className={cn(
        CARD_BASE,
        "not-data-checked:not-data-disabled:hover:bg-muted/50",
        "data-checked:border-primary data-checked:bg-primary/5 dark:data-checked:bg-primary/10",
        "data-disabled:cursor-not-allowed data-disabled:opacity-60",
        className,
      )}
    >
      {body}

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
