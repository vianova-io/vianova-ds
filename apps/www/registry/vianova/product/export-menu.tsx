"use client";

import * as React from "react";
import { Download, FileJson, Sheet } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import { cn } from "@/registry/vianova/lib/utils";

export type ExportFormat = "csv" | "json";

/**
 * Escapes one CSV field.
 *
 * Quoting is not optional here. District names contain commas, operator names
 * contain apostrophes and quotes, and a naive join produces a file that opens
 * misaligned in Excel with no error — the worst kind of failure, because it
 * looks like data.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: { id: string; label: string }[]) {
  const head = columns.map((c) => csvField(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => csvField(row[c.id])).join(","));
  // CRLF and a BOM: without them Excel on Windows mangles accented characters,
  // and Le Havre's district names are full of them.
  return "﻿" + [head, ...body].join("\r\n");
}

/** Hands the browser a file. Returns false when the environment has no DOM. */
export function downloadFile(contents: string, filename: string, mime: string) {
  if (typeof document === "undefined") return false;
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking immediately can cancel the download in some browsers; one frame
  // is enough for the click to be handled.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
  return true;
}

/**
 * Export control for a grid or chart.
 *
 * Exports what the caller passes, which should be the *filtered and sorted*
 * rows rather than the raw dataset. Someone who filtered to three districts
 * and then exported 54 will not notice until the numbers are in a report.
 */
export function ExportMenu({
  rows,
  columns,
  filename = "export",
  formats = ["csv", "json"],
  onExport,
  label = "Export",
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onError"> & {
  rows: Record<string, unknown>[];
  columns: { id: string; label: string }[];
  /** Without extension. */
  filename?: string;
  formats?: ExportFormat[];
  /** Intercept to export server-side instead; return true to skip the download. */
  onExport?: (format: ExportFormat, rows: Record<string, unknown>[]) => boolean | void;
  label?: string;
}) {
  const run = (format: ExportFormat) => {
    if (onExport?.(format, rows)) return;
    if (format === "csv") {
      downloadFile(toCsv(rows, columns), `${filename}.csv`, "text/csv;charset=utf-8");
    } else {
      downloadFile(JSON.stringify(rows, null, 2), `${filename}.json`, "application/json");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || rows.length === 0}
            data-slot="export-menu"
            className={cn(className)}
            {...props}
          >
            <Download />
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          {rows.length.toLocaleString("en-GB")} row{rows.length === 1 ? "" : "s"}, as shown
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {formats.includes("csv") ? (
            <DropdownMenuItem onClick={() => run("csv")}>
              <Sheet /> CSV
            </DropdownMenuItem>
          ) : null}
          {formats.includes("json") ? (
            <DropdownMenuItem onClick={() => run("json")}>
              <FileJson /> JSON
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
