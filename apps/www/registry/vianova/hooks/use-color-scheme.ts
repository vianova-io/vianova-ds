"use client";

import * as React from "react";

/**
 * Whether the document is currently in dark mode.
 *
 * Reads the `dark` class on <html> and watches it, rather than depending on
 * next-themes or any other provider — a registry component should work in
 * whatever theming setup the consumer already has, and every common one
 * (next-themes included) toggles that class.
 *
 * Returns null until mounted. The server cannot know the resolved scheme, so
 * anything that renders differently per scheme must wait rather than guess and
 * hydration-mismatch.
 */
export function useColorScheme(): "light" | "dark" | null {
  const [scheme, setScheme] = React.useState<"light" | "dark" | null>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setScheme(root.classList.contains("dark") ? "dark" : "light");

    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return scheme;
}
