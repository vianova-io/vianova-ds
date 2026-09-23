"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * Drag-and-drop file target with a keyboard-reachable fallback.
 *
 * The visible surface is a label wrapping a real `<input type="file">` rather
 * than a div with a click handler. Drag-and-drop is unreachable by keyboard
 * and invisible to screen readers, so it can only ever be an enhancement over
 * a working file input -- never the only way in.
 *
 * `dragDepth` is counted rather than toggled: dragenter/dragleave also fire
 * when the pointer crosses a child element, so a boolean flickers off mid-drag.
 */
export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  disabled,
  label = "Drop files here",
  hint,
  id,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onDrop" | "children"> & {
  onFiles?: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  children?: React.ReactNode;
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [dragDepth, setDragDepth] = React.useState(0);
  const dragging = dragDepth > 0;

  const emit = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles?.(multiple ? Array.from(list) : [list[0]!]);
  };

  return (
    <div
      data-slot="file-dropzone"
      data-dragging={dragging || undefined}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragDepth((d) => d + 1);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDrop={(e) => {
        e.preventDefault();
        setDragDepth(0);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-input",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      <label
        htmlFor={inputId}
        className="focus-within:ring-ring/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg px-6 py-8 text-center focus-within:ring-3"
      >
        <UploadCloud
          aria-hidden
          className={cn("size-6", dragging ? "text-primary" : "text-muted-foreground")}
        />
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            emit(e.target.files);
            // Reset so re-picking the same file fires change again.
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      {children}
    </div>
  );
}
