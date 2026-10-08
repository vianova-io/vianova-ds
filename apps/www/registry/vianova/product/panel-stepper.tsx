"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * A chain of panels that step sideways: opening a step leaves its parent on
 * screen and places the child beside it, so the whole path stays readable.
 *
 * The one structural idea worth knowing: **a step anchors to the previous
 * step's panel, not to the control that opened it.** Anchoring to the control
 * produces a dropdown ladder that staircases down the screen; anchoring to the
 * panel produces a cascade whose children line up with their parent.
 *
 * Non-modal throughout. Each panel stays interactive while its children are
 * open, which is the point -- you adjust a value and watch the map behind it.
 *
 * Below `lg` there is no room to cascade, so the chain docks to the bottom of
 * its container and shows one panel at a time with a Back control, matching how
 * the map blocks dock their own panels.
 */

/** Matches `lg` in the map blocks, which is the layout this sits inside. */
const LG = 1024;

type StepperContextValue = {
  /** Ids from the root down. `[]` is "nothing open". The single source of
   *  truth for the whole chain: holding it here rather than per-step is what
   *  lets the presentation change without the open state going with it. */
  openPath: string[];
  /** The state setter itself, updater form included: a step that has to decide
   *  what to do based on the CURRENT path -- see the controlled-open effect in
   *  PanelStep -- cannot read it from a stale render. */
  setOpenPath: React.Dispatch<React.SetStateAction<string[]>>;
  /** True below `lg`: panels dock instead of cascading. */
  docked: boolean;
  /** Where docked panels render. Null until the dock mounts. */
  dock: HTMLElement | null;
  /** Id of the first step's trigger. Docked, closing the chain from any depth
   *  has to return focus there, and only the root step knows it. */
  rootTriggerId: React.RefObject<string | null>;
};

type LevelContextValue = {
  /** The panel a child anchors against. Null at the root, where the first step
   *  anchors to its own trigger instead. */
  anchor: HTMLElement | null;
  /** Ancestor ids, root first. */
  prefix: string[];
  depth: number;
};

const StepperContext = React.createContext<StepperContextValue | null>(null);
const LevelContext = React.createContext<LevelContextValue>({
  anchor: null,
  prefix: [],
  depth: 0,
});

function useStepper(component: string) {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error(`${component} must be used inside a <PanelStepper>.`);
  }
  return context;
}

/**
 * Whether to dock rather than cascade.
 *
 * Starts false and resolves in an effect, which would be a flash of the wrong
 * layout anywhere else. Here it is not: at first paint the chain is closed, so
 * there is no open panel to put in the wrong place. By the time anything opens,
 * the query has resolved.
 */
function useDocked(enabled: boolean) {
  const [docked, setDocked] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setDocked(false);
      return;
    }
    const mql = window.matchMedia(`(max-width: ${LG - 1}px)`);
    const sync = () => setDocked(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [enabled]);

  return docked;
}

const samePath = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Docked, no Popover is managing focus, so closing a panel would drop it on
 * the body. Deferred a frame because the panel unmounts in the same tick.
 */
function focusAfterPaint(id: string | null) {
  if (!id) return;
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/**
 * Root of a chain. Owns the open path, and renders the dock that panels fall
 * back to below `lg`.
 *
 * The dock is absolutely positioned, so the stepper belongs inside a
 * positioned container -- in practice the map block it decorates.
 */
export function PanelStepper({
  children,
  anchor = null,
  collapse = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  /** The surface the first step cascades beside -- typically the panel the
   *  stepper decorates, which is not itself a step. Without it a root step
   *  falls back to its own trigger, which staircases instead of cascading. */
  anchor?: HTMLElement | null;
  /** Set false to keep cascading at every width. */
  collapse?: boolean;
}) {
  const [openPath, setOpenPath] = React.useState<string[]>([]);
  const [dock, setDock] = React.useState<HTMLElement | null>(null);
  const docked = useDocked(collapse);
  const rootTriggerId = React.useRef<string | null>(null);

  const value = React.useMemo<StepperContextValue>(
    () => ({ openPath, setOpenPath, docked, dock, rootTriggerId }),
    [dock, docked, openPath],
  );

  const rootLevel = React.useMemo<LevelContextValue>(
    () => ({ anchor, prefix: [], depth: 0 }),
    [anchor],
  );

  return (
    <StepperContext.Provider value={value}>
      <LevelContext.Provider value={rootLevel}>
        {children}
      </LevelContext.Provider>
      <div
        ref={setDock}
        data-slot="panel-stepper-dock"
        // Every inset is named at both tiers: tailwind-merge does not pair
        // them. bottom-10 clears MapLibre's attribution badge, which paints
        // above an overlay rather than below it -- the same 40px the map
        // blocks use for the panels they dock.
        className={cn(
          "absolute inset-x-2 bottom-10 top-auto z-50 max-h-[60%] flex-col lg:hidden",
          docked && openPath.length ? "flex" : "hidden",
          className,
        )}
        {...props}
      />
    </StepperContext.Provider>
  );
}

export function PanelStep({
  id,
  title,
  trigger,
  triggerId: triggerIdProp,
  width = 360,
  side = "inline-end",
  align = "start",
  sideOffset = 5,
  anchorTo = "parent",
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof PopoverContent>, "anchor" | "title"> & {
  /** Stable within the parent step. Identifies this step in the open path. */
  id: string;
  /** Names the panel for assistive tech as well as heading it. */
  title: React.ReactNode;
  /** A single element. Receives `aria-expanded` and `aria-controls`. Omit it
   *  for a step opened by something outside the stepper, in which case `open`
   *  has to be supplied too. */
  trigger?: React.ReactElement;
  /** Id of the control that opens this step, for a step driven by `open`
   *  rather than by `trigger`. Docked, closing the chain returns focus there;
   *  without it focus lands on the body, because an externally-triggered step
   *  has no element of its own to go back to. */
  triggerId?: string;
  width?: number;
  /** "parent" cascades beside the previous panel; "trigger" hangs off the
   *  control itself, which is what a colour swatch wants. */
  anchorTo?: "parent" | "trigger";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const stepper = useStepper("PanelStep");
  const level = React.useContext(LevelContext);
  const [panel, setPanel] = React.useState<HTMLElement | null>(null);
  const panelId = React.useId();

  const depth = level.depth + 1;
  const ownPath = React.useMemo(
    () => [...level.prefix, id],
    [id, level.prefix],
  );

  const { openPath, setOpenPath } = stepper;
  const isOpen = openProp ?? samePath(openPath.slice(0, depth), ownPath);
  /** Only the deepest open step is visible when docked. */
  const isDeepest = isOpen && openPath.length === depth;

  const setOpen = React.useCallback(
    (next: boolean) => {
      // Truncating rather than clearing is what makes a sibling replace the
      // current child, and a parent close take its descendants with it.
      if (openProp === undefined) setOpenPath(next ? ownPath : level.prefix);
      onOpenChange?.(next);
    },
    [level.prefix, onOpenChange, openProp, ownPath, setOpenPath],
  );

  /**
   * Keeps a CONTROLLED step in the stepper's path.
   *
   * `setOpen` only runs when the step itself is the thing that changed -- a
   * Popover dismissal, or the docked trigger. A step driven by `open` is opened
   * by a control outside the stepper, which just flips the caller's own state,
   * so nothing ever writes the path. Cascaded that goes unnoticed, because each
   * Popover positions itself; docked it is fatal, since the path is how the
   * chain knows which panel is deepest and every panel would render hidden.
   *
   * Written through the updater form so the result does not depend on which
   * step's effect runs first: opening never shortens a path that already runs
   * through this step -- a descendant may be open -- and closing only
   * truncates a path that actually reaches here.
   */
  React.useEffect(() => {
    if (openProp === undefined) return;
    setOpenPath((prev) => {
      const reachesHere = samePath(prev.slice(0, depth), ownPath);
      if (openProp) return reachesHere ? prev : ownPath;
      return reachesHere ? level.prefix : prev;
    });
  }, [depth, level.prefix, openProp, ownPath, setOpenPath]);

  // defaultOpen can't go to Popover.Root: the stepper owns the path, so the
  // initial value has to be written into it instead.
  const claimedDefault = React.useRef(false);
  React.useEffect(() => {
    if (claimedDefault.current || !defaultOpen || openProp !== undefined)
      return;
    claimedDefault.current = true;
    setOpenPath(ownPath);
  }, [defaultOpen, openProp, ownPath, setOpenPath]);

  const childLevel = React.useMemo<LevelContextValue>(
    () => ({ anchor: panel, prefix: ownPath, depth }),
    [depth, ownPath, panel],
  );

  const body = (
    <LevelContext.Provider value={childLevel}>{children}</LevelContext.Provider>
  );

  const panelClassName = cn(
    // w-auto: the popover's own w-72 would fight the explicit width.
    // p-0/gap-0: this panel lays out its own header and body.
    "w-auto gap-0 overflow-hidden rounded-xl border border-border bg-card/95 p-0 backdrop-blur",
    className,
  );

  if (stepper.docked) {
    // Docked there is no Popover to supply the trigger's state, so it is wired
    // by hand -- including calling through to any onClick the caller gave it.
    const triggerEl = trigger as
      React.ReactElement<React.HTMLAttributes<HTMLElement>> | undefined;
    const triggerId =
      triggerEl?.props.id ?? triggerIdProp ?? `${panelId}-trigger`;
    if (depth === 1) stepper.rootTriggerId.current = triggerId;

    const header = (
      <div
        data-slot="panel-step-header"
        className="flex items-center gap-2 border-b border-border p-2"
      >
        {depth > 1 ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Back"
            className="shrink-0"
            onClick={() => {
              setOpenPath(level.prefix);
              focusAfterPaint(triggerId);
            }}
          >
            <ChevronLeft />
          </Button>
        ) : null}
        <span className="min-w-0 truncate px-1 text-sm font-medium">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          className="ml-auto shrink-0"
          // Docked, Close dismisses the chain; Back is what steps up one.
          onClick={() => {
            setOpenPath([]);
            focusAfterPaint(stepper.rootTriggerId.current);
          }}
        >
          <X />
        </Button>
      </div>
    );

    return (
      <>
        {triggerEl
          ? React.cloneElement(triggerEl, {
              id: triggerId,
              "aria-expanded": isOpen,
              "aria-controls": isOpen ? panelId : undefined,
              onClick: (event: React.MouseEvent<HTMLElement>) => {
                triggerEl.props.onClick?.(event);
                if (!event.defaultPrevented) setOpen(!isOpen);
              },
            })
          : null}
        {isOpen && stepper.dock
          ? createPortal(
              <div
                id={panelId}
                role="dialog"
                aria-label={typeof title === "string" ? title : undefined}
                data-slot="panel-step"
                data-depth={depth}
                data-docked=""
                // Ancestors stay mounted but hidden: a nested step is declared
                // inside its parent's content, so unmounting the parent would
                // take the child's declaration with it and there would be
                // nothing to step back to.
                className={cn(
                  panelClassName,
                  "min-h-0 w-full flex-col",
                  isDeepest ? "flex" : "hidden",
                )}
              >
                {header}
                {body}
              </div>,
              stepper.dock,
            )
          : null}
      </>
    );
  }

  const anchor =
    anchorTo === "parent" && level.anchor ? level.anchor : undefined;

  return (
    <Popover
      open={isOpen}
      // No dismissal guards here, on purpose. Escape closing only the innermost
      // step, and a press inside a portalled child not reading as "outside" to
      // its parent, both fall out of Base UI's nested-popup tree. A guard for
      // each was written and then disabled to see whether a test noticed --
      // neither did, so both were dead code and came out.
      onOpenChange={(next) => setOpen(next)}
    >
      {trigger ? <PopoverTrigger render={trigger} /> : null}
      <PopoverContent
        ref={setPanel}
        data-slot="panel-step"
        data-depth={depth}
        anchor={anchor}
        side={side}
        align={align}
        sideOffset={sideOffset}
        style={{ width }}
        className={panelClassName}
        {...props}
      >
        <div
          data-slot="panel-step-header"
          className="flex items-center gap-2 border-b border-border p-2"
        >
          <PopoverTitle className="min-w-0 truncate px-1 text-sm font-medium">
            {title}
          </PopoverTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            className="ml-auto shrink-0"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        {body}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The body of a step. Separated from the header so a panel can scroll its
 * content without the title leaving with it.
 */
export function PanelStepBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-step-body"
      className={cn("min-h-0 overflow-y-auto p-2", className)}
      {...props}
    />
  );
}
