"use client";

import * as React from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type RequestTransformFunction,
  type StyleSpecification,
} from "maplibre-gl";

import { useColorScheme } from "@/registry/vianova/hooks/use-color-scheme";
import { cn } from "@/registry/vianova/lib/utils";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Real vector basemap that follows the active colour scheme.
 *
 * Renders with MapLibre GL (BSD-3) rather than mapbox-gl. mapbox-gl v2+ is
 * BSL-licensed and bills per map load, which is a poor default for a component
 * other teams install from a registry. Mapbox is still first-class: pass
 * `mapboxToken` and you get the genuine Mapbox Dark/Light styles, with the
 * token appended to every Mapbox request via transformRequest.
 *
 * Without a token it uses CARTO Dark Matter / Positron — free, no account, and
 * the same visual language.
 */

export const BASEMAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

export const MAPBOX_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
} as const;

type StyleLike = string | StyleSpecification;

export type MapCanvasProps = Omit<React.ComponentProps<"div">, "onLoad"> & {
  /** One style for both schemes, or one per scheme. Defaults follow the theme. */
  mapStyle?: StyleLike | { light: StyleLike; dark: StyleLike };
  /** Required only for `mapbox://` styles and tiles. */
  mapboxToken?: string;
  /** Overrides theme detection. Omit to follow the `dark` class on <html>. */
  colorScheme?: "light" | "dark";
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  /**
   * Self-hosted URL for maplibre-gl-worker.mjs. Required on bundlers that
   * cannot resolve the worker themselves; the file must sit next to a copy of
   * maplibre-gl-shared.mjs, which it imports relatively.
   */
  workerUrl?: string;
  /** Rendered instead of the map if WebGL is unavailable or the style fails. */
  fallback?: React.ReactNode;
  onLoad?: (map: MapLibreMap) => void;
};

export function MapCanvas({
  mapStyle,
  mapboxToken,
  colorScheme,
  center = [-1.6778, 48.1173], // Rennes, matching the design
  zoom = 11.5,
  interactive = true,
  workerUrl,
  fallback,
  onLoad,
  className,
  ...props
}: MapCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const onLoadRef = React.useRef(onLoad);
  onLoadRef.current = onLoad;

  const [failed, setFailed] = React.useState(false);
  // Tracks the style the map is already showing, so the swap effect does not
  // re-apply the one the map was just created with.
  const appliedStyleRef = React.useRef<StyleLike | null>(null);

  const detected = useColorScheme();
  const scheme = colorScheme ?? detected ?? "dark";

  // Hold off creating the map until the scheme is known. Guessing would load
  // the wrong basemap first and then swap it — a wasted style fetch and a
  // visible flash of the wrong theme. Flips false -> true exactly once, so it
  // gates creation without causing a rebuild on later theme changes.
  const canInit = colorScheme !== undefined || detected !== null;

  const style = React.useMemo<StyleLike>(() => {
    if (mapStyle && typeof mapStyle === "object" && "light" in mapStyle && "dark" in mapStyle) {
      return mapStyle[scheme];
    }
    if (mapStyle) return mapStyle;
    return mapboxToken ? MAPBOX_STYLES[scheme] : BASEMAP_STYLES[scheme];
  }, [mapStyle, mapboxToken, scheme]);

  // MapLibre v6 loads its worker from a sibling ESM file. Some bundlers
  // (notably Next's webpack dev server) fail to resolve that URL and serve an
  // HTML 404 instead, which the worker cannot parse — the style then never
  // finishes loading and the map requests no tiles, with no visible error.
  if (typeof window !== "undefined" && workerUrl) setWorkerUrl(workerUrl);

  // Create the map once. Style changes are applied separately so switching
  // theme keeps the user's camera instead of snapping back to the default.
  React.useEffect(() => {
    if (!containerRef.current || !canInit) return;

    // WebGL is unavailable in some sandboxes and CI browsers. v6 removed the
    // old `supported()` helper, so probe for a context directly and fail soft
    // rather than throwing on mount.
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) {
      setFailed(true);
      return;
    }

    const transformRequest: RequestTransformFunction | undefined = mapboxToken
      ? (url) => {
          if (!url.startsWith("mapbox://") && !url.includes("api.mapbox.com")) {
            return { url };
          }
          const resolved = url.startsWith("mapbox://")
            ? url.replace("mapbox://", "https://api.mapbox.com/")
            : url;
          return {
            url: `${resolved}${resolved.includes("?") ? "&" : "?"}access_token=${mapboxToken}`,
          };
        }
      : undefined;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style,
        center,
        zoom,
        interactive,
        attributionControl: { compact: true },
        transformRequest,
      });
    } catch {
      setFailed(true);
      return;
    }

    mapRef.current = map;
    appliedStyleRef.current = style;
    map.on("load", () => onLoadRef.current?.(map));
    map.on("error", (e) => {
      if ((e as { error?: { status?: number } }).error?.status === 401) setFailed(true);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // `style` is intentionally omitted — see the setStyle effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken, interactive, canInit]);

  // Swap the basemap in place when the theme changes, keeping the camera.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === style) return;
    appliedStyleRef.current = style;
    map.setStyle(style as string);
  }, [style]);

  return (
    <div
      data-slot="map-canvas"
      data-color-scheme={scheme}
      className={cn("relative size-full bg-surface-sunken", className)}
      {...props}
    >
      <div ref={containerRef} className="size-full" />
      {failed && fallback ? <div className="absolute inset-0">{fallback}</div> : null}
    </div>
  );
}
