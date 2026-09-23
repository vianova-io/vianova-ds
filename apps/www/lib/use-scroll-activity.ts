"use client";

import * as React from "react";

/**
 * Reports whether an element is currently being scrolled, so a scrollbar can
 * be shown only while it is in use and hidden the rest of the time.
 *
 * There is no CSS for "is scrolling" -- `:hover` is a different question and
 * answers it wrongly, showing the bar whenever the pointer is anywhere near.
 * So a scroll listener sets a flag and a timer clears it.
 *
 * The listener is passive: this never calls `preventDefault`, and saying so
 * lets the browser keep scrolling on the compositor instead of waiting to see
 * whether the handler will block it.
 *
 * Note that state only ever changes on an EDGE here, not on every scroll
 * event. A scroll fires dozens of times a second; re-rendering the subscriber
 * that often to set a boolean that is already true would make the sidebar the
 * most expensive thing on the page.
 */
export function useScrollActivity<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { idleMs = 700 }: { idleMs?: number } = {},
) {
  const [scrolling, setScrolling] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = false;

    const onScroll = () => {
      if (!active) {
        active = true;
        setScrolling(true);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        active = false;
        setScrolling(false);
      }, idleMs);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [ref, idleMs]);

  return scrolling;
}
