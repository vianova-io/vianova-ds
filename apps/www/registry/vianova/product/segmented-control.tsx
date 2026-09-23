"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

export type SegmentedControlItem = {
  value: string;
  label: string;
  /** Rendered instead of the label; the label still names it for assistive tech. */
  icon?: React.ReactNode;
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
            title={item.label}
            data-state={selected ? "selected" : "default"}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:text-foreground",
              "has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
              size === "sm" ? "py-1 text-xs" : "py-1.5 text-sm",
              selected && "bg-background text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name={name ?? generatedName}
              value={item.value}
              checked={selected}
              onChange={() => select(item.value)}
              className="sr-only"
            />
            {item.icon ?? item.label}
            {item.icon ? <span className="sr-only">{item.label}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
