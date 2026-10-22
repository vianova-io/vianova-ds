"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * A panel that docks to the bottom of its container and is dragged between
 * three heights.
 *
 * For a phone, where a docked panel at a fixed height is a permanent hole in
 * whatever is behind it. The map workspace's panels sat at 55% of the block
 * and could not be dismissed, so a phone saw 39% of its map and no gesture
 * changed that.
 *
 * It positions and sizes; it does not draw a surface. The child brings its
 * own, because the surfaces that want this are already components -- a
 * FloatingPanel here, a card elsewhere -- and a tray with its own border
 * around one of those is two boxes where the reader sees one. The grabber is
 * the only thing this draws, and it sits over the child's top edge.
 *
 * `lg:contents` is how it gets out of the way. Above the breakpoint the
 * wrapper has no box at all, so the child's own absolute positioning resolves
 * against the block exactly as it did before this existed -- no duplicate
 * mount, no second copy of the panel's state.
 */

export type TraySnap = "peek" | "half" | "full";

/**
 * Heights as a share of the container.
 *
 * peek is a header and the top of a row -- enough to say what the tray is and
 * to grab it. full stops short of the top so the thing behind is never
 * completely gone, which is what tells you it is a tray and not a page.
 */
export const TRAY_SNAPS: Record<TraySnap, number> = {
  peek: 0.15,
  half: 0.55,
  full: 0.9,
};

const ORDER: TraySnap[] = ["peek", "half", "full"];

export function BottomTray({
  open,
  onOpenChange,
  snap,
  onSnapChange,
  label,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onDrag"> & {
  open: boolean;
  /** Dragged below peek, or closed by whatever opened it. */
  onOpenChange?: (open: boolean) => void;
  snap: TraySnap;
  onSnapChange: (snap: TraySnap) => void;
  /** Names the grabber for assistive tech: "Data layers", not "panel". */
  label: string;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  /** The height under the pointer, in px, while a drag is in progress. */
  const [dragging, setDragging] = React.useState<number | null>(null);

  const containerHeight = () =>
    root.current?.parentElement?.getBoundingClientRect().height ?? 0;

  const settle = (px: number) => {
    const height = containerHeight();
    if (!height) return;
    const fraction = px / height;
    // Below half of peek it is a dismissal, not a resize. Judged against the
    // smallest snap rather than against zero, so letting go anywhere in the
    // bottom sliver closes rather than leaving a sliver of tray.
    if (fraction < TRAY_SNAPS.peek / 2) {
      onOpenChange?.(false);
      // Left at peek, so reopening does not start at a height nobody chose.
      onSnapChange("peek");
      return;
    }
    const nearest = ORDER.reduce((best, key) =>
      Math.abs(TRAY_SNAPS[key] - fraction) < Math.abs(TRAY_SNAPS[best] - fraction)
        ? key
        : best,
    );
    onSnapChange(nearest);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Pointer events, not touch: the same handler drives a mouse, a pen and a
    // thumb, and setPointerCapture keeps the drag alive when the finger
    // leaves the grabber -- which it will, because the grabber moves.
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const bottom = root.current?.getBoundingClientRect().bottom ?? 0;
    const start = bottom - event.clientY;

    const move = (e: PointerEvent) => setDragging(Math.max(0, bottom - e.clientY));
    const end = (e: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      setDragging(null);
      settle(Math.max(0, bottom - e.clientY));
    };
    setDragging(start);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  const index = ORDER.indexOf(snap);
  const onKeyDown = (event: React.KeyboardEvent) => {
    const to = (next: number) => {
      event.preventDefault();
      onSnapChange(ORDER[Math.max(0, Math.min(ORDER.length - 1, next))]!);
    };
    if (event.key === "ArrowUp") to(index + 1);
    if (event.key === "ArrowDown") to(index - 1);
    if (event.key === "Home") to(0);
    if (event.key === "End") to(ORDER.length - 1);
  };

  return (
    <div
      ref={root}
      data-slot="bottom-tray"
      data-snap={snap}
      data-open={open}
      style={{
        height:
          dragging !== null
            ? `${dragging}px`
            : `${TRAY_SNAPS[snap] * 100}%`,
      }}
      className={cn(
        // inset-x-0 bottom-0 by default; a consumer whose surface floats
        // rather than docking to the edge overrides both, as the map does to
        // keep its 8px margins and to clear the tile attribution.
        "absolute inset-x-0 bottom-0 z-20 flex flex-col",
        // A class, not the `hidden` ATTRIBUTE. Tailwind's preflight ships
        // `[hidden]{display:none!important}`, which beats `lg:contents` -- so
        // a closed tray stayed closed at lg and took its panel with it, even
        // though the panel is supposed to be a docked column up there and the
        // tray is supposed to have stopped existing. As a class it is a plain
        // display utility that the responsive one overrides, which is the
        // behaviour the rest of this file assumes.
        !open && "hidden",
        // Snapping animates; dragging must not, or the tray lags the thumb.
        dragging === null && "transition-[height] duration-200",
        // Above lg the wrapper stops existing and the child positions itself,
        // so the child's own lg classes decide whether it shows.
        "lg:contents",
        className,
      )}
      {...props}
    >
      {/*
        The grabber.

        A slider rather than a button: it has three positions and a keyboard
        has to be able to reach all of them, which Arrow keys on a slider do
        natively. aria-valuetext says "half", not "1", because the number is
        an implementation detail of the snap list.

        touch-none so the browser does not claim the gesture for scrolling
        before the handler sees it.
      */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} height`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={ORDER.length - 1}
        aria-valuenow={index}
        aria-valuetext={snap}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex h-6 cursor-grab touch-none items-center justify-center",
          // ring-inset, because the grabber spans the tray's full width and
          // the tray sits flush inside something that clips: a ring drawn
          // outside loses 3px on each side to the nearest overflow-hidden
          // ancestor, which on a map block is the block itself.
          "focus-visible:ring-ring/50 rounded-t-xl focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:outline-none",
          "active:cursor-grabbing lg:hidden",
        )}
      >
        <span className="bg-muted-foreground/40 h-1 w-9 rounded-full" />
      </div>
      {children}
    </div>
  );
}
