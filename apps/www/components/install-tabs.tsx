"use client";

import * as React from "react";

import { CopyButton } from "@/components/copy-button";
import { cn } from "@/registry/vianova/lib/utils";

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
type Manager = (typeof MANAGERS)[number];

const RUNNER: Record<Manager, string> = {
  pnpm: "pnpm dlx",
  npm: "npx",
  yarn: "yarn dlx",
  bun: "bunx --bun",
};

export function InstallTabs({ name }: { name: string }) {
  const [manager, setManager] = React.useState<Manager>("pnpm");
  const command = `${RUNNER[manager]} shadcn@latest add @vianova/${name}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 w-fit">
        {MANAGERS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setManager(m)}
            aria-pressed={manager === m}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
              manager === m && "bg-accent text-accent-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="relative">
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-sunken px-4 py-3 pr-12 text-[13px]">
          <code>{command}</code>
        </pre>
        <CopyButton
          value={command}
          label="Copy install command"
          className="absolute top-2.5 right-2"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Requires the <code className="text-foreground">@vianova</code> namespace
        in your <code className="text-foreground">components.json</code>. You can
        also install directly from the URL without any configuration.
      </p>
    </div>
  );
}
