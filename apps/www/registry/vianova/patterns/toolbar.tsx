"use client";

import * as React from "react";

import { Separator } from "@/registry/vianova/ui/separator";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * A horizontal band of controls with roving focus.
 *
 * `role="toolbar"` is a single tab stop: Tab moves past the whole band and the
 * arrow keys move within it, which is what stops a map view with thirty
 * controls from costing thirty presses to escape. That contract only holds if
 * focus is actually managed, so this manages it rather than just setting the
 * role -- a bare role="toolbar" is worse than no role at all.
 */
export function Toolbar({
  orientation = "horizontal",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onKeyDown"> & {
  orientation?: "horizontal" | "vertical";
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const focusables = () =>
    Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

  // Only the active control is tabbable; the rest are reachable by arrow key.
  React.useEffect(() => {
    const items = focusables();
    items.forEach((el, i) => (el.tabIndex = i === 0 ? 0 : -1));
  }, [children]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    if (!["Home", "End", next, prev].includes(event.key)) return;

    const items = focusables();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);

    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === next
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;

    event.preventDefault();
    items.forEach((el) => (el.tabIndex = -1));
    const target = items[index]!;
    target.tabIndex = 0;
    target.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-orientation={orientation}
      data-slot="toolbar"
      onKeyDown={onKeyDown}
      className={cn(
        "bg-card flex items-center gap-1 rounded-lg border p-1",
        orientation === "vertical" && "w-fit flex-col",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Visually groups related controls. Purely decorative -- focus order ignores it. */
export function ToolbarSeparator({
  orientation = "vertical",
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="toolbar-separator"
      orientation={orientation}
      className={cn(orientation === "vertical" ? "mx-1 h-5" : "my-1 w-full", className)}
      {...props}
    />
  );
}

/** Pushes everything after it to the far end of the toolbar. */
export function ToolbarSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden data-slot="toolbar-spacer" className={cn("flex-1", className)} {...props} />;
}
