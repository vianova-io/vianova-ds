"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

export type SegmentedControlItem = {
  value: string;
  label: string;
  /** Rendered instead of the label; the label still names it for assistive tech. */
  icon?: React.ReactNode;
  /** Offered but not selectable, e.g. an option this data cannot support. */
  disabled?: boolean;
  /** Overrides the hover title, which otherwise repeats the label. Use it to
   *  say WHY a disabled option is disabled -- a greyed control with no reason
   *  reads as a bug. */
  title?: string;
};

/**
 * Equal-width segmented control.
 *
 * Radios rather than buttons or a toggle group: exactly one segment is always
 * active, which a toggle group cannot express since it permits none or many.
 * Radio semantics also give roving focus and arrow-key navigation for free.
 */
export function SegmentedControl({
  items,
  value,
  defaultValue,
  onValueChange,
  name,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> & {
  items: SegmentedControlItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  size?: "sm" | "default";
}) {
  const generatedName = React.useId();
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value ?? "");
  const active = value ?? internal;

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <div
      role="radiogroup"
      data-slot="segmented-control"
      className={cn(
        "flex w-full items-center rounded-lg bg-muted/60 p-1",
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const selected = active === item.value;
        return (
          <label
            key={item.value}
            title={item.title ?? item.label}
            data-state={selected ? "selected" : "default"}
            data-disabled={item.disabled || undefined}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md transition-colors",
              "text-muted-foreground",
              "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
              size === "sm" ? "py-1 text-xs" : "py-1.5 text-sm",
              item.disabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:text-foreground",
              selected && "bg-background text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name ?? generatedName}
              value={item.value}
              checked={selected}
              disabled={item.disabled}
              onChange={() => select(item.value)}
              // outline-none: the visible ring is the label's, via
              // has-[input:focus-visible]. The browser also draws its own
              // outline on this input, which sr-only clips away to nothing --
              // invisible, but still a real focus indicator geometrically, and
              // the focus-ring audit measures it escaping whatever panel the
              // control sits in. Dropping it costs no indication at all.
              className="sr-only outline-none"
            />
            {item.icon ?? item.label}
            {item.icon ? <span className="sr-only">{item.label}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
