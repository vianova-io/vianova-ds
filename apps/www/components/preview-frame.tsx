"use client";

import * as React from "react";
import { Code2, Eye, Monitor, Smartphone, Tablet } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

const VIEWPORTS = [
  { id: "full", label: "Full width", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "375px" },
] as const;

/**
 * Preview/code tabs plus viewport presets.
 *
 * `code` is passed as a rendered node rather than a string because Shiki
 * highlighting happens on the server; this component only toggles visibility.
 * Both panes stay mounted so switching tabs does not remount the demo and lose
 * its state.
 */
export function PreviewFrame({
  title,
  code,
  children,
}: {
  title: string;
  code: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<"preview" | "code">("preview");
  const [viewport, setViewport] = React.useState<string>("full");
  const width = VIEWPORTS.find((v) => v.id === viewport)?.width ?? "100%";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>

        <div className="flex items-center gap-2">
          {tab === "preview" ? (
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewport(v.id)}
                  aria-label={v.label}
                  aria-pressed={viewport === v.id}
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground",
                    viewport === v.id && "bg-accent text-accent-foreground",
                  )}
                >
                  <v.icon className="size-3.5" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(
              [
                { id: "preview", label: "Preview", icon: Eye },
                { id: "code", label: "Code", icon: Code2 },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                  tab === t.id && "bg-accent text-accent-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(tab === "preview" ? "block" : "hidden")}>
        <div className="flex justify-center overflow-x-auto rounded-lg border border-border bg-card p-6">
          <div
            style={{ width, maxWidth: "100%" }}
            className="flex min-h-24 items-center justify-center transition-[width] duration-200"
          >
            {children}
          </div>
        </div>
      </div>

      <div className={cn(tab === "code" ? "block" : "hidden")}>{code}</div>
    </section>
  );
}
