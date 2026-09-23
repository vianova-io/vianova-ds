"use client";

import * as React from "react";

import { Label } from "@/registry/vianova/ui/label";
import { TagInput } from "@/registry/vianova/patterns/tag-input";

export default function TagInputDefault() {
  const [tags, setTags] = React.useState(["congestion", "peak-hour"]);

  return (
    <div className="w-full max-w-sm space-y-2">
      <Label htmlFor="study-tags">Study tags</Label>
      <TagInput id="study-tags" value={tags} onValueChange={setTags} max={6} />
      <p className="text-muted-foreground text-xs">
        Enter or comma to add, Backspace to remove the last. Up to 6.
      </p>
    </div>
  );
}
