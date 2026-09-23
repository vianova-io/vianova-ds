"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { BRAND_THEMES, useBrandTheme } from "@/components/brand-theme";
import { Button } from "@/registry/vianova/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";

/**
 * Both controls here were hand-rolled: a native `<select>` and a `<button>`
 * carrying their own borders, sizes and focus rings. A design system's own site
 * shipping chrome the system does not describe is the clearest possible signal
 * that the components are not sufficient -- and in practice it meant the
 * dropdown rendered as an OS menu that ignored every token on the page.
 *
 * Both are now the registry components, on the `sm` rung so the header keeps
 * its current height.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [brand, setBrand] = useBrandTheme();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={brand}
        // Base UI hands back `string | null`; null means "cleared", which this
        // select cannot express, so it is ignored rather than coerced into a
        // theme id that would not resolve.
        onValueChange={(value: string | null) => {
          if (value) setBrand(value);
        }}
      >
        <SelectTrigger size="sm" aria-label="White-label theme" className="w-[7.5rem]">
          <SelectValue>
            {(v: string) => BRAND_THEMES.find((t) => t.id === v)?.label ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {BRAND_THEMES.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Toggle colour mode"
      >
        {/* Rendered only after mount: the server does not know the resolved
            theme, and guessing produces a hydration mismatch. */}
        {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </div>
  );
}
