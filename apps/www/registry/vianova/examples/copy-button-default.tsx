"use client";

import { CopyButton } from "@/registry/vianova/patterns/copy-button";

const SNIPPET = "npx shadcn@latest add https://vianova-ds.vercel.app/r/stat-tile.json";

export default function CopyButtonDefault() {
  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{SNIPPET}</code>
        <CopyButton value={SNIPPET} label="Copy install command" />
      </div>
      <CopyButton value="45.7640, 4.8357" size="sm" variant="outline" label="Copy coordinates" />
    </div>
  );
}
