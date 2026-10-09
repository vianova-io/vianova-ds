"use client";

import * as React from "react";
import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";

export type RampFeature = {
  /** A point's position, or a polygon's outer ring. */
  geometry: [number, number] | [number, number][];
  /** What the colour encodes. Non-finite values fall to the ramp's first band. */
  value: number;
};

/**
 * Draws points or areas coloured by a measure rather than by a category.
 *
 * The companion to useCategoryPointLayer and useCategoryShapeLayer, which paint
 * by `match` on a string. A measure has order, so the colours come from a
 * `step` expression over band edges: one colour per band, the first below the
 * first edge.
 *
 * Edges are supplied rather than computed here. They belong to whatever is
 * showing the legend -- the two have to agree about the domain or the legend
 * mislabels every swatch, and that is much easier to guarantee when one place
 * works it out.
 */
export function useRampLayer({
  map,
  enabled,
  features,
  colors,
  edges,
  opacity = 1,
  id = "ramp-layer",
}: {
  map: MapLibreMap | null;
  enabled: boolean;
  features: RampFeature[];
  /** One colour per band, low to high. */
  colors: readonly string[];
  /** Ascending band edges; `colors.length - 1` of them is the natural count. */
  edges: readonly number[];
  opacity?: number;
  id?: string;
}) {
  React.useEffect(() => {
    if (!map || !enabled || features.length === 0) return;
    if (colors.length === 0) return;

    const areas = Array.isArray(features[0]!.geometry[0]);
    const layerId = `${id}-${areas ? "fill" : "circle"}`;
    const outlineId = `${id}-outline`;

    const remove = () => {
      // A map being torn down throws on any of these.
      try {
        for (const layer of [outlineId, layerId])
          if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(id)) map.removeSource(id);
      } catch {
        /* the map is gone */
      }
    };

    // Not isStyleLoaded(): that is false while any source is still fetching
    // tiles, which is most of the time just after a fly-to. All that matters is
    // that there is a style to add to, and getStyle() throws until there is.
    const hasStyle = () => {
      try {
        return !!map.getStyle();
      } catch {
        return false;
      }
    };

    const paint = (): DataDrivenPropertyValueSpecification<string> => {
      if (colors.length < 2 || edges.length < 1) return colors[0] ?? "#888888";
      // A heterogeneous array the spec's tuple types cannot describe pair by
      // pair, which is why it is built loose and cast once at the end.
      const step: unknown[] = ["step", ["get", "value"], colors[0]];
      for (let i = 0; i < edges.length; i++) {
        const colour =
          colors[Math.round(((colors.length - 1) * (i + 1)) / edges.length)] ??
          colors[colors.length - 1]!;
        step.push(edges[i], colour);
      }
      return step as DataDrivenPropertyValueSpecification<string>;
    };

    const build = () => {
      if (!hasStyle()) return;
      remove();

      map.addSource(id, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: features.map((f) => ({
            type: "Feature" as const,
            // Non-finite values would make `step` fall through to the default
            // band silently; -Infinity puts them in the first band on purpose,
            // which at least matches "no reading" rather than "the highest".
            properties: { value: Number.isFinite(f.value) ? f.value : -Infinity },
            geometry: areas
              ? {
                  type: "Polygon" as const,
                  coordinates: [f.geometry as [number, number][]],
                }
              : {
                  type: "Point" as const,
                  coordinates: f.geometry as [number, number],
                },
          })),
        },
      });

      if (areas) {
        map.addLayer({
          id: layerId,
          type: "fill",
          source: id,
          paint: { "fill-color": paint(), "fill-opacity": 0.65 * opacity },
        });
        // Areas overlap; without an edge a cluster of zones reads as one blob.
        map.addLayer({
          id: outlineId,
          type: "line",
          source: id,
          paint: {
            "line-color": paint(),
            "line-width": 1,
            "line-opacity": 0.9 * opacity,
          },
        });
        return;
      }

      map.addLayer({
        id: layerId,
        type: "circle",
        source: id,
        paint: {
          "circle-color": paint(),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 16, 9],
          "circle-opacity": 0.9 * opacity,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
    };

    build();
    // setStyle discards every custom layer, so rebuild when a new one lands.
    const rebuild = () => build();
    map.on("style.load", rebuild);

    return () => {
      map.off("style.load", rebuild);
      remove();
    };
  }, [map, enabled, features, colors, edges, opacity, id]);
}
