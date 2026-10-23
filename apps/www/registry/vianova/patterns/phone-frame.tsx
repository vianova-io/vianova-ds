import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * A phone-sized shell for surfaces that only ever exist on a phone.
 *
 * Every other workspace in this registry is a desktop surface and fills the
 * block area. The citizen reporting app is the exception: it is handed to
 * residents on the street, caps itself at `max-w-md`, and shown full-bleed it
 * reads as a broken desktop page rather than as the phone screen it is.
 *
 * Deliberately a neutral shell rather than a photoreal handset. A black bezel
 * would need primitive colours and would invert badly in dark mode; a bordered
 * `muted` body states "this is phone-width" in both themes without pretending
 * to be a product shot. The speaker pill and home indicator are the only
 * skeuomorphic notes, and they are decorative -- `aria-hidden`, so a screen
 * reader meets the screen's content and nothing else.
 */
export function PhoneFrame({
  label,
  className,
  screenClassName,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** Accessible name for the screen region. */
  label?: string;
  screenClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="phone-frame"
      className={cn("flex h-full w-full items-center justify-center", className)}
      {...props}
    >
      <div className="bg-muted flex h-full max-h-[812px] w-full max-w-[390px] flex-col rounded-[2rem] border p-2 shadow-lg">
        <div
          aria-hidden
          className="bg-foreground/20 mx-auto mb-2 h-1 w-12 shrink-0 rounded-full"
        />
        <div
          role="region"
          aria-label={label}
          className={cn(
            "bg-background relative flex-1 overflow-y-auto overscroll-contain rounded-[1.25rem]",
            screenClassName,
          )}
        >
          {children}
        </div>
        <div
          aria-hidden
          className="bg-foreground/20 mx-auto mt-2 h-1 w-24 shrink-0 rounded-full"
        />
      </div>
    </div>
  );
}
