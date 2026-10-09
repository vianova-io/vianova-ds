"use client";

import * as React from "react";
import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from "maplibre-gl";

import type { CategoryStyle } from "@/registry/vianova/lib/category-style";

export type CategoryShape = {
  /** The outer ring, as [longitude, latitude] pairs. */
  ring: [number, number][];
  category: string;
};

/**
 * Draws areas on a map by category: each polygon filled and outlined in its
 * category's colour.
 *
 * The companion to useCategoryPointLayer for data whose geometry is polygons --
 * zones, districts, the areas a regulation covers. Areas have no logo to swap
 * in, so there is a single layer pair and no zoom hand-over.
 */
export function useCategoryShapeLayer({
  map,
  enabled,
  shapes,
  styles,
  id = "category-shapes",
}: {
  map: MapLibreMap | null;
  enabled: boolean;
  shapes: CategoryShape[];
  /** Keyed by category value. Keep this referentially stable between renders. */
  styles: Record<string, CategoryStyle>;
  id?: string;
}) {
  React.useEffect(() => {
    if (!map || !enabled || shapes.length === 0) return;
    const entries = Object.entries(styles);
    if (entries.length === 0) return;

    const fill = `${id}-fill`;
    const line = `${id}-line`;

    const remove = () => {
      // A map that is being torn down throws on any of these.
      try {
        for (const layer of [line, fill]) if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(id)) map.removeSource(id);
      } catch {
        /* the map is gone */
      }
    };

    // getStyle() throws until a style exists; isStyleLoaded() is false whenever
    // any tile is still arriving, which would stop this ever drawing.
    const hasStyle = () => {
      try {
        return !!map.getStyle();
      } catch {
        return false;
      }
    };

    const build = () => {
      if (!hasStyle()) return;
      remove();
      map.addSource(id, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: shapes.map((s) => ({
            type: "Feature" as const,
            properties: { category: s.category },
            geometry: { type: "Polygon" as const, coordinates: [s.ring] },
          })),
        },
      });
      const colour = [
        "match",
        ["get", "category"],
        ...entries.flatMap(([value, style]) => [value, style.color]),
        "#888888",
        // `match` takes an open-ended list of label/output pairs, which
        // MapLibre's tuple types cannot express with a spread.
      ] as unknown as DataDrivenPropertyValueSpecification<string>;
      map.addLayer({
        id: fill,
        type: "fill",
        source: id,
        paint: { "fill-color": colour, "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: line,
        type: "line",
        source: id,
        paint: { "line-color": colour, "line-width": 1.5 },
      });
    };

    build();
    // setStyle discards every custom layer, so rebuild when the new one lands.
    map.on("style.load", build);
    return () => {
      map.off("style.load", build);
      remove();
    };
  }, [map, enabled, shapes, styles, id]);
}
