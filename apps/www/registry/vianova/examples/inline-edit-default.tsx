"use client";

import * as React from "react";

import { InlineEdit } from "@/registry/vianova/patterns/inline-edit";

export default function InlineEditDefault() {
  const [name, setName] = React.useState("Le Havre — weekday AM peak");

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground text-sm">View name</span>
        <InlineEdit
          label="view name"
          value={name}
          onValueChange={setName}
          validate={(next) => (next.length < 3 ? "At least 3 characters." : null)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Enter commits, Escape reverts. Try clearing it to see validation.
      </p>
    </div>
  );
}
