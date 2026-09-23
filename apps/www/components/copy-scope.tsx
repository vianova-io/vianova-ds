"use client";

import * as React from "react";

/**
 * Makes every `[data-copy]` element inside it copy that value on click.
 *
 * Delegated rather than per-swatch on purpose. Foundations renders 359
 * copy targets, and turning each one into its own client component -- each with a
 * `copied` boolean, an effect and a timer -- would ship a few hundred
 * subscriptions to state that is visible for one second. Here the swatches
 * stay server-rendered plain `<button>`s and React's own event delegation
 * handles all of them through this single handler.
 *
 * The confirmation therefore cannot be React state on the swatch: the swatch
 * is not React's to re-render. A `data-copied` attribute is set on the node
 * directly and CSS draws the tick, which is also why it disappears again by
 * being removed rather than by a second render.
 */

/** How long the tick stays up. Long enough to notice, short enough to not nag. */
const FLASH_MS = 1200;

export function CopyScope({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [message, setMessage] = React.useState("");
  const marked = React.useRef<HTMLElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const unmark = () => {
    marked.current?.removeAttribute("data-copied");
    marked.current = null;
  };

  const onClick = async (event: React.MouseEvent) => {
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-copy]");
    const value = el?.dataset.copy;
    if (!el || !value) return;

    try {
      // Absent outright on an insecure origin, so this is not only a rejected
      // promise to guard against.
      if (!navigator.clipboard) throw new Error("no clipboard API");
      await navigator.clipboard.writeText(value);
    } catch {
      // Say so. A tick over a clipboard that was never written is the one
      // outcome worse than no feedback at all.
      unmark();
      setMessage(`Could not copy ${value}`);
      return;
    }

    unmark();
    el.setAttribute("data-copied", "");
    marked.current = el;
    setMessage(`Copied ${value}`);

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      unmark();
      setMessage("");
    }, FLASH_MS);
  };

  return (
    // The listener sits on a container, but every target is a real <button>,
    // so Enter and Space already fire click and bubble to it. Nothing here is
    // reachable by pointer only.
    <div className={className} onClick={onClick}>
      {children}
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}
