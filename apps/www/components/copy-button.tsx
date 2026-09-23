"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Receives the RAW string as a prop. Never scrape textContent off the
 * highlighted DOM -- Shiki's line and token spans corrupt whitespace, and
 * copied code then fails to compile.
 */
export function CopyButton({
  value,
  className,
  label = "Copy code",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
