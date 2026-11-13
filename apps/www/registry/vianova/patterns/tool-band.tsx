"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * The first row of a tool: what you are looking at, and what you can do to it.
 *
 * Not a `PageHeader`. A page is read from the top, so its header can take two
 * lines and a description and then get out of the way. A tool is *worked in*,
 * and the row that names it has to survive scrolling, so it is one 56px line
 * and nothing else — the title, whatever acts on it, and the control that
 * puts the shell's navigation away.
 *
 * At rest it draws nothing at all: no fill, no rule. The workspace starts at
 * the top of the card and the band sits on it, which is why a map can run
 * under it edge to edge. It only becomes a surface once there is something
 * underneath it to separate itself from — the moment the content scrolls, it
 * takes a translucent fill, a blur and its bottom rule, and keeps them until
 * you come back to the top.
 *
 * The description does not travel here. It belongs to the first screen of a
 * tool, not to every screen of it, and a line of explanation pinned to the top
 * of a workspace for the rest of the session is an advert, not help.
 */
export function ToolBand({
  nav,
  title,
  actions,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  /**
   * The shell's own control — hiding the rail. First in the row and hard
   * left, in every tool, so it is one place rather than seven. A hairline
   * follows it: the control leaves the tool, everything after it stays
   * inside.
   */
  nav?: React.ReactNode;
  title?: React.ReactNode;
  /** Pushed to the right end of the row. */
  actions?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const scroller = scrollParent(ref.current);
    if (!scroller) return;
    const read = () =>
      setScrolled(
        (scroller instanceof Window ? window.scrollY : scroller.scrollTop) > 4,
      );
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    return () => scroller.removeEventListener("scroll", read);
  }, []);

  return (
    <header
      ref={ref}
      data-slot="tool-band"
      data-scrolled={scrolled || undefined}
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b border-transparent bg-transparent px-4 transition-[background-color,border-color,backdrop-filter] duration-200 md:px-6",
        scrolled && "bg-card/80 border-border backdrop-blur-md",
        className,
      )}
      {...props}
    >
      {nav ? (
        <>
          <div className="shrink-0">{nav}</div>
          <span aria-hidden className="bg-border mx-1 h-5 w-px shrink-0" />
        </>
      ) : null}
      {title ? (
        <h2 className="truncate text-base font-semibold tracking-tight">
          {title}
        </h2>
      ) : null}
      {children}
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/**
 * The box the band is actually stuck to. A tool scrolls inside the shell's
 * card rather than inside the window, so `window.scrollY` is always 0 and
 * there is nothing to listen to on `document`.
 */
function scrollParent(node: HTMLElement | null): HTMLElement | Window | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === "auto" || overflow === "scroll") return el;
    el = el.parentElement;
  }
  return typeof window === "undefined" ? null : window;
}
