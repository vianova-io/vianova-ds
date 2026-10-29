"use client";

import * as React from "react";
import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from "maplibre-gl";

import type { CategoryStyle } from "@/registry/vianova/lib/category-style";

/** The outline width the areas were hardcoded to. */
const DEFAULT_WIDTH = 1.5;

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
  width = DEFAULT_WIDTH,
  id = "category-shapes",
}: {
  map: MapLibreMap | null;
  enabled: boolean;
  shapes: CategoryShape[];
  /** Keyed by category value. Keep this referentially stable between renders. */
  styles: Record<string, CategoryStyle>;
  /**
   * The outline width in px. The only size a filled polygon has -- a fill has
   * no radius and no thickness, so this is what the Size panel drives for an
   * area layer.
   */
  width?: number | DataDrivenPropertyValueSpecification<number>;
  id?: string;
}) {
  const lineId = `${id}-line`;

  /* Read by build(), which runs again on style.load long after the effect
     closed over its props. */
  const widthRef = React.useRef(width);
  widthRef.current = width;

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
        paint: { "line-color": colour, "line-width": widthRef.current },
      });
    };

    build();
    // setStyle discards every custom layer, so rebuild when the new one lands.
    map.on("style.load", build);
    return () => {
      map.off("style.load", build);
      remove();
    };
    // No width here: this effect rebuilds source and layers, which is too much
    // for a slider. It reaches build() through widthRef, and the live layer
    // through the effect below.
  }, [map, enabled, shapes, styles, id]);

  /** A width change repaints the outline; it does not rebuild the layer. */
  React.useEffect(() => {
    if (!map) return;
    try {
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, "line-width", width);
      }
    } catch {
      /* the map is gone */
    }
  }, [map, lineId, width]);
}
