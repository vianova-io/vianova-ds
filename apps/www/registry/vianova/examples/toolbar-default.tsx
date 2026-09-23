import {
  Hand,
  Minus,
  MousePointer2,
  Pentagon,
  Plus,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { Toolbar, ToolbarSeparator, ToolbarSpacer } from "@/registry/vianova/patterns/toolbar";

export default function ToolbarDefault() {
  return (
    <Toolbar aria-label="Map drawing tools" className="w-full max-w-xl">
      <Button variant="secondary" size="icon" aria-label="Select" aria-pressed>
        <MousePointer2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Pan">
        <Hand />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Draw polygon">
        <Pentagon />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Measure">
        <Ruler />
      </Button>

      <ToolbarSeparator />

      <Button variant="ghost" size="icon" aria-label="Zoom in">
        <Plus />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Zoom out">
        <Minus />
      </Button>

      <ToolbarSpacer />

      <Button variant="ghost" size="icon" aria-label="Undo">
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Redo">
        <Redo2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Delete selection">
        <Trash2 />
      </Button>
    </Toolbar>
  );
}
