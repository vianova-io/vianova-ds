import * as React from "react";

import {
  STATUS_TONE_DOT,
  type StatusTone,
} from "@/registry/vianova/patterns/status-badge";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * A vertical list of events, each a dot on a rail: incident updates, a
 * request's history, an audit log.
 *
 * Order is the caller's. For something still unfolding, put the newest first
 * so the current state is the first thing read.
 */
export function Timeline({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="timeline" className={cn("flex flex-col", className)} {...props} />;
}

export function TimelineItem({
  tone = "neutral",
  title,
  time,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"li">, "title"> & {
  /** The dot's colour. Shares its tones with StatusBadge. */
  tone?: StatusTone;
  title: React.ReactNode;
  /** Usually a `<time>`. Shown under the body, in muted text. */
  time?: React.ReactNode;
}) {
  return (
    <li
      data-slot="timeline-item"
      data-tone={tone}
      className={cn("group/timeline-item relative flex gap-3 pb-4 last:pb-0", className)}
      {...props}
    >
      {/* The rail: hidden on the last item, so the line never trails off. */}
      <span
        aria-hidden
        className="bg-border absolute top-4 bottom-0 left-[3px] w-px group-last/timeline-item:hidden"
      />
      <span
        aria-hidden
        className={cn("mt-1.5 size-[7px] shrink-0 rounded-full", STATUS_TONE_DOT[tone])}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="text-sm">{children}</div> : null}
        {time ? <p className="text-muted-foreground text-xs">{time}</p> : null}
      </div>
    </li>
  );
}
