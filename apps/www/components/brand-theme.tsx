"use client";

import * as React from "react";

/**
 * The extra themes from the Figma library's Semantic collection. These are a
 * THIRD axis, independent of light/dark and of map scheme: Stone and Slate are
 * neutral-ramp variants, Fuchsia and Gray re-accent the palette. All are
 * dark-mode variants, so selecting one also forces dark.
 */
export const BRAND_THEMES = [
  { id: "default", label: "Vianova" },
  { id: "stone", label: "Dark Stone" },
  { id: "slate", label: "Dark Slate" },
  { id: "fuchsia", label: "Dark Fuchsia" },
  { id: "gray", label: "Dark Gray" },
] as const;

const STORAGE_KEY = "vianova-brand-theme";

export function useBrandTheme(): [string, (t: string) => void] {
  const [theme, setThemeState] = React.useState("default");

  const apply = React.useCallback((t: string) => {
    const root = document.documentElement;
    if (t === "default") delete root.dataset.theme;
    else root.dataset.theme = t;
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && BRAND_THEMES.some((t) => t.id === stored)) {
      setThemeState(stored);
      apply(stored);
    }
  }, [apply]);

  const setTheme = React.useCallback(
    (t: string) => {
      setThemeState(t);
      apply(t);
      window.localStorage.setItem(STORAGE_KEY, t);
      // Every white-label variant is defined only under .dark, so a non-default
      // selection must force dark or the tokens simply do not apply.
      if (t !== "default") document.documentElement.classList.add("dark");
    },
    [apply],
  );

  return [theme, setTheme];
}
