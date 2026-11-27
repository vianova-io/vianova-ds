"use client";

import { setMapSnapshotMode } from "@/registry/vianova/product/map-canvas";

/**
 * Turns on WebGL buffer preservation for everything in this route.
 *
 * The call is at module scope on purpose. It has to happen before the first
 * `MapCanvas` constructs its map, because maplibre reads
 * `preserveDrawingBuffer` when it creates the GL context and cannot be told
 * afterwards. An effect would run too late -- effects fire after the whole
 * tree has rendered, by which point the map already exists with a buffer that
 * clears itself, and the capture would come back blank.
 *
 * Importing this module is therefore the side effect; the component it
 * exports renders nothing and exists only to give the route something to
 * import.
 *
 * Scoped to `/workspace/[slug]`, which only the docs breakpoint frame loads.
 * Nothing a consumer installs reaches this file.
 */
setMapSnapshotMode(true);

export function EnableMapSnapshots() {
  return null;
}
