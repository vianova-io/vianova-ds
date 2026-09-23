import { Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Input } from "@/registry/vianova/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Toggle } from "@/registry/vianova/ui/toggle";

/**
 * The control-height ladder, shown at every step.
 *
 * Every control in a row is the same height by contract, so a toolbar or a
 * form row lines up without anyone nudging a margin. e2e/control-size.spec.ts
 * measures this page and fails if any control drifts from its row.
 */
const ROWS = [
  { size: "sm", px: 32 },
  { size: "default", px: 36 },
  { size: "lg", px: 40 },
] as const;

export default function ButtonControlLadder() {
  return (
    <div className="w-full space-y-4">
      {ROWS.map(({ size, px }) => (
        <div key={size} className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            <code className="text-foreground">{size}</code> — {px}px
          </p>
          <div
            data-testid={`ladder-${size}`}
            data-expected={px}
            className="flex flex-wrap items-center gap-2"
          >
            <Button size={size}>Export report</Button>
            <Button size={size} variant="outline">
              Cancel
            </Button>
            <Button size={size === "default" ? "icon" : `icon-${size}`} aria-label="Add layer">
              <Plus />
            </Button>
            <Toggle size={size} aria-label="Toggle grid">
              Grid
            </Toggle>
            <Input size={size} className="w-40" placeholder="Search data" aria-label="Search data" />
            <Select>
              <SelectTrigger size={size} aria-label="Data type">
                <SelectValue placeholder="Trips" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trips">Trips</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
