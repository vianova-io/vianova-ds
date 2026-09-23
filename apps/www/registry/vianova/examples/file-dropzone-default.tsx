"use client";

import * as React from "react";

import { FileDropzone } from "@/registry/vianova/patterns/file-dropzone";

export default function FileDropzoneDefault() {
  const [files, setFiles] = React.useState<string[]>([]);

  return (
    <div className="w-full max-w-md space-y-3">
      <FileDropzone
        multiple
        accept=".geojson,.csv,.json"
        label="Drop GeoJSON or CSV here"
        hint="or click to browse — up to 50 MB"
        onFiles={(dropped) => setFiles(dropped.map((f) => f.name))}
      />
      {files.length ? (
        <ul className="text-muted-foreground space-y-1 text-sm">
          {files.map((name) => (
            <li key={name} className="truncate">
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
