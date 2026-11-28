import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";
import { Avatar, AvatarFallback } from "@/registry/vianova/ui/avatar";

/** "Anja Reiter" -> "AR", "Vianova" -> "V". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

/**
 * Who made, owns or sent something, as a table cell: a mark, a name, and the
 * address under it.
 *
 * Four lists drew this four ways -- an avatar with a name and an address, a
 * small mark with a name, a name alone, and under two different headings.
 * Somebody scanning for their own rows had to learn each list again. This is
 * the one drawing, and the column over it is called **Created by**.
 *
 * The address is what tells two people apart, and a first name does not: an
 * organisation has two Thomases sooner than anyone expects. It is left out
 * only when there is none to show, which is the platform itself.
 *
 * Two shapes, the distinction every list here already drew: a round disc is a
 * person, a rounded square is an organisation. Vianova makes the monthly
 * reports and files the report rules, and a round "V" among the round people
 * would read as one more colleague.
 *
 * Initials on `muted`, not a photo and not a colour per person. No portraits
 * ship with the design system, and a tint for each author turns the column
 * into something about who rather than about what they made.
 */
export function PersonCell({
  name,
  email,
  organisation = false,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  name: string;
  /** Under the name. Omitted, the name stands alone and centres on the mark. */
  email?: string;
  /** Draws the mark square. For the platform, an operator, a team's mailbox. */
  organisation?: boolean;
}) {
  return (
    <span
      data-slot="person-cell"
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    >
      <Avatar
        size="sm"
        // The name is right beside it, so the mark is decoration. Hearing
        // "A R Anja Reiter" is worse than not hearing the mark at all.
        aria-hidden
        className={cn(organisation && "rounded-md after:rounded-md")}
      >
        <AvatarFallback className={cn(organisation && "rounded-md")}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        {email ? (
          <span className="text-muted-foreground block truncate text-xs">
            {email}
          </span>
        ) : null}
      </span>
    </span>
  );
}
