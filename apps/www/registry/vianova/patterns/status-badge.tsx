import * as React from "react";

import { Badge } from "@/registry/vianova/ui/badge";
import { cn } from "@/registry/vianova/lib/utils";

export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral";

/**
 * The dot colour for each tone, from the feedback tokens.
 *
 * Exported so anything else that marks a state with a dot -- a timeline, a
 * legend -- draws the same colour for the same tone. Fills only: `--warning`
 * fails contrast as text on a light surface, which is why the badge keeps its
 * label in the foreground colour and lets the dot carry the state.
 */
export const STATUS_TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

/**
 * A state as a quiet outline badge: a dot in the tone's colour and a plain
 * label. The house way to say "active", "pending", "rejected" in a list --
 * colour alone is never the signal, so the label always says it in words.
 */
export function StatusBadge({
  tone,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant"> & {
  tone: StatusTone;
}) {
  return (
    <Badge
      data-slot="status-badge"
      data-tone={tone}
      variant="outline"
      className={className}
      {...props}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_TONE_DOT[tone])} />
      {children}
    </Badge>
  );
}
