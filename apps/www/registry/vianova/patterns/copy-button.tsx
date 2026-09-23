"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Copies a string to the clipboard and confirms it happened.
 *
 * The value is a prop, never scraped from the DOM. Reading `innerText` off a
 * rendered code block is the classic version of this component and it silently
 * copies syntax-highlighting artefacts, soft-wrap breaks and zero-width
 * characters.
 *
 * The confirmation is announced in a live region, not just shown as a tick --
 * a purely visual state change tells a screen-reader user nothing.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  timeout = 2000,
  variant = "ghost",
  size = "icon",
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "value" | "children"> & {
  value: string;
  label?: string;
  copiedLabel?: string;
  timeout?: number;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={copied ? copiedLabel : label}
        data-slot="copy-button"
        data-copied={copied || undefined}
        className={cn(className)}
        onClick={async (event) => {
          onClick?.(event);
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Denied permission or an insecure origin. Nothing useful to do but
            // leave the button in its resting state rather than lying about it.
            return;
          }
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), timeout);
        }}
        {...props}
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
        {size !== "icon" ? <span>{copied ? copiedLabel : label}</span> : null}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
