"use client";

import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/registry/vianova/ui/collapsible";

export default function CollapsibleDefault() {
  return (
    <Collapsible className="w-full max-w-sm space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Advanced filters</span>
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Toggle">
              <ChevronsUpDown />
            </Button>
          }
        />
      </div>
      <CollapsibleContent className="space-y-2 text-sm text-muted-foreground">
        <div className="rounded-md border border-border px-3 py-2">Vehicle type is bike</div>
        <div className="rounded-md border border-border px-3 py-2">Duration between 5 and 45 min</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
