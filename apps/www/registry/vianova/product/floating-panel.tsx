"use client";

import * as React from "react";

import { useScrollActivity } from "@/registry/vianova/hooks/use-scroll-activity";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The frosted panel that floats over a map canvas.
 *
 * Deliberately not a Card: it needs a translucent, blurred surface so the map
 * stays legible behind it, and a body that scrolls independently of the page.
 */
function FloatingPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

function FloatingPanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-header"
      className={cn("flex items-center justify-between gap-2 p-2", className)}
      {...props}
    />
  );
}

function FloatingPanelTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="floating-panel-title"
      className={cn("px-1 text-sm font-medium", className)}
      {...props}
    />
  );
}

function FloatingPanelActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-actions"
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      {...props}
    />
  );
}

/** Never smaller than this, or a long list leaves a thumb too small to grab. */
const MIN_THUMB = 28;

/**
 * The scrolling region of the panel, with a scrollbar that floats OVER the
 * content instead of taking a column out of it.
 *
 * The native bar was the problem. A classic scrollbar takes its width from the
 * content box on one side only, so with even padding the cards measured a 9px
 * gap on the left and 20px on the right -- and no padding fixes that, because
 * a gutter is not padding. `scrollbar-gutter: stable both-edges` balances it,
 * but only within this element: anything pinned outside the scroll area, like
 * the chart panel's layer selector, then sits 11px further out than the cards
 * below it. One misalignment traded for another.
 *
 * So the native bar is removed from layout entirely and this draws its own.
 * Margins are symmetric, a scrolling region lines up with its non-scrolling
 * siblings, and the result is identical on a trackpad Mac and a mouse-driven
 * Windows machine rather than differing by the platform's scrollbar width.
 *
 * It stays draggable. An indicator you can only watch would be a regression
 * from the native bar it replaces.
 */
function FloatingPanelBody({
  className,
  ref: externalRef,
  ...props
}: React.ComponentProps<"div">) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const scrolling = useScrollActivity(scrollRef);
  const [hovering, setHovering] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [thumb, setThumb] = React.useState<{ top: number; height: number } | null>(null);

  // The body owns a ref because its scroll state depends on one, but a caller
  // may legitimately want its own -- to scroll a layer into view, say. Merged
  // rather than overwritten, so neither silently wins.
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      if (typeof externalRef === "function") externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  const measure = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // Nothing to scroll, nothing to draw. Drawing a full-height thumb instead
    // would claim the panel is scrollable when it is not.
    if (scrollHeight <= clientHeight + 1) {
      setThumb((prev) => (prev === null ? prev : null));
      return;
    }
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight);
    const travel = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * travel;
    // Returning the previous object when nothing moved is what makes the
    // measure-after-every-render below safe: an unconditional setState there
    // would re-render, measure, set state again, and never stop.
    setThumb((prev) =>
      prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.height - height) < 0.5
        ? prev
        : { top, height },
    );
  }, []);

  /**
   * Re-measure after every render, with no dependency list.
   *
   * The ResizeObserver below catches most changes, but not reliably: content
   * that grows once asynchronously -- a fetched layer filling in its legend --
   * was observed to leave the panel scrollable with no thumb drawn in Chrome,
   * while the same code produced one under Playwright. A render happens
   * whenever that content changes, so measuring here closes the gap without
   * having to know which mutation did it.
   */
  React.useEffect(measure);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Both the viewport AND the content can change size -- a layer card
    // expanding is not a resize of the scroller, but it does change how much
    // there is to scroll.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const onThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !thumb) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const startY = event.clientY;
    const startTop = el.scrollTop;
    const travel = el.clientHeight - thumb.height;

    const onMove = (move: PointerEvent) => {
      if (travel <= 0) return;
      const ratio = (move.clientY - startY) / travel;
      el.scrollTop = startTop + ratio * (el.scrollHeight - el.clientHeight);
      // Measured here rather than left to the scroll listener: assigning
      // scrollTop does not reliably emit a scroll event, so without this the
      // content moves under a thumb that stays where it was.
      measure();
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const shown = thumb && (scrolling || hovering || dragging);

  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div
        ref={setRef}
        data-slot="floating-panel-body"
        data-scrolling={scrolling || undefined}
        // scrollbar-none removes the native bar from layout. That is the whole
        // point: it is what frees the column the cards were being pushed out of.
        className="min-h-0 flex-1 overflow-y-auto scrollbar-none"
        {...props}
      />
      {thumb ? (
        <div
          data-slot="floating-panel-scrollbar"
          data-visible={shown || undefined}
          onPointerDown={onThumbPointerDown}
          style={{ top: thumb.top, height: thumb.height }}
          className={cn(
            "absolute right-0.5 w-1.5 cursor-default rounded-full bg-muted-foreground/40",
            "opacity-0 transition-opacity duration-200 data-visible:opacity-100",
            // Not pointer-events-none: this is a control, and it has to be
            // grabbable. It sits in the 2px gutter beside the content, so it
            // intercepts nothing the reader is trying to click.
            "touch-none",
          )}
        />
      ) : null}
    </div>
  );
}

export {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
};
