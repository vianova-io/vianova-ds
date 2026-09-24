import { MapCanvas } from "@/registry/vianova/product/map-canvas";

/**
 * The maplibre worker is served from the app's own `public/`, so it has to
 * carry whatever basePath that app is deployed under. `basePath` does not
 * rewrite a raw string like this one, so the prefix is applied here.
 *
 * In a root-served app -- the normal case, and the one you get by installing
 * this component -- NEXT_PUBLIC_BASE_PATH is unset and this resolves to the
 * plain "/maplibre/maplibre-gl-worker.mjs" that shipped before. Set it, and a
 * sub-path deployment corrects itself.
 *
 * Worth knowing: a worker that fails to load makes the map render NOTHING and
 * report no error at all, so a wrong value here is invisible, not loud.
 */
/**
 * Declared locally so this file compiles in a project without @types/node.
 *
 * The repo's registry smoke test installs these components into a bare TS
 * project and typechecks them, and it caught a bare `process` reference here:
 * a consumer who has not installed node types gets TS2580 the moment they add
 * this block. The expression still has to read `process.env.NEXT_PUBLIC_BASE_PATH`
 * VERBATIM, because Next substitutes that exact text at build time -- routing
 * it through globalThis or an optional chain silently defeats the inlining and
 * leaves the prefix empty.
 */
declare const process: { env: Record<string, string | undefined> };

const WORKER_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/maplibre/maplibre-gl-worker.mjs`;

export default function MapCanvasDefault() {
  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
      {/* workerUrl is needed under Next's webpack dev server — see MapCanvas.
          Pass mapboxToken to swap in the genuine Mapbox Dark style. */}
      <MapCanvas
        workerUrl={WORKER_URL}
        center={[-1.6778, 48.1173]}
        zoom={11}
      />
    </div>
  );
}
