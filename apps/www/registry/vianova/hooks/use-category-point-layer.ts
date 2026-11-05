"use client";

import * as React from "react";
import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from "maplibre-gl";

import {
  composeBadge,
  type CategoryStyle,
} from "@/registry/vianova/lib/category-style";
import { resolveCssColor } from "@/registry/vianova/lib/css-color";

/** The radius the dots were hardcoded to, and what icon-size was tuned against. */
const DEFAULT_RADIUS = 9;

export type CategoryPoint = {
  /** [longitude, latitude] */
  position: [number, number];
  category: string;
};

/**
 * Draws points on a map by category: a colour dot zoomed out, and the
 * category's logo on its colour zoomed in.
 *
 * Two layers rather than one expression because a circle layer cannot draw an
 * image and a symbol layer cannot be told "dot below zoom 14" without a layer
 * of its own. They hand over at `logoZoom` by `maxzoom` and `minzoom`, so the
 * map never draws both and there is no per-frame work to do the switch.
 *
 * Every value gets a badge image, logo or not -- a value with no logo is simply
 * its colour disc -- so a symbol never falls back to MapLibre's missing-image
 * blank.
 */
export function useCategoryPointLayer({
  map,
  enabled,
  points,
  styles,
  logoZoom,
  strokeColor,
  radius = DEFAULT_RADIUS,
  id = "category-points",
}: {
  map: MapLibreMap | null;
  enabled: boolean;
  points: CategoryPoint[];
  /** Keyed by category value. Keep this referentially stable between renders. */
  styles: Record<string, CategoryStyle>;
  logoZoom: number;
  /**
   * The outline round each dot. Defaults to the theme's `--border`, read each
   * time the layer is built, so it follows a light/dark switch. Pass a colour
   * for a map that is drawn in a theme other than the one on screen.
   */
  strokeColor?: string;
  /**
   * The dot radius in px, at the zoom where the badge takes over.
   *
   * A number rather than an expression, unlike the ramp layer: the dots carry
   * a category and no measure, so there is nothing on this layer to graduate
   * by -- and icon-size has to be scaled to match, which cannot be done
   * against an expression that already interpolates on zoom (MapLibre refuses
   * to nest one zoom expression inside another).
   */
  radius?: number;
  id?: string;
}) {
  const dotsId = `${id}-dots`;

  /* Read by build(), which runs again on style.load long after the effect
     closed over its props. */
  const radiusRef = React.useRef(radius);
  radiusRef.current = radius;

  React.useEffect(() => {
    if (!map || !enabled || points.length === 0) return;
    const entries = Object.entries(styles);
    if (entries.length === 0) return;

    const dots = `${id}-dots`;
    const logos = `${id}-logos`;
    const imageId = (value: string) => `${id}:${value}`;
    let cancelled = false;

    const remove = () => {
      // A map that is being torn down throws on any of these.
      try {
        for (const layer of [logos, dots]) if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(id)) map.removeSource(id);
        for (const [value] of entries) if (map.hasImage(imageId(value))) map.removeImage(imageId(value));
      } catch {
        /* the map is gone */
      }
    };

    // Not `map.isStyleLoaded()`: that is false whenever ANY source is still
    // fetching tiles, which is nearly always right after a fly-to, and nothing
    // would call build again. All that matters here is that a style exists to
    // add layers to, and getStyle() throws until one does.
    const hasStyle = () => {
      try {
        return !!map.getStyle();
      } catch {
        return false;
      }
    };

    const build = async () => {
      if (!hasStyle()) return;
      // The dots' outline and the badges' ring are one colour, so a category
      // looks the same at either zoom. Read now, not once: a theme switch
      // rebuilds this, and the border is a different colour in the new theme.
      const stroke = strokeColor ?? resolveCssColor("--border") ?? "#ffffff";
      const badges = await Promise.all(
        entries.map(async ([value, style]) => [value, await composeBadge(style, 64, stroke)] as const),
      );
      // Superseded while the logos were decoding: a newer build owns the map.
      if (cancelled || !hasStyle()) return;

      remove();
      for (const [value, image] of badges) map.addImage(imageId(value), image, { pixelRatio: 2 });

      map.addSource(id, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: points.map((p) => ({
            type: "Feature" as const,
            properties: { category: p.category },
            geometry: { type: "Point" as const, coordinates: p.position },
          })),
        },
      });

      const fallback = "#888888";
      map.addLayer({
        id: dots,
        type: "circle",
        source: id,
        maxzoom: logoZoom,
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            ...entries.flatMap(([value, style]) => [value, style.color]),
            fallback,
            // `match` takes an open-ended list of label/output pairs, which
            // MapLibre's tuple types cannot express with a spread.
          ] as unknown as DataDrivenPropertyValueSpecification<string>,
          // Grows towards the hand-over so the dot and the badge that replaces
          // it are close in size and the switch does not read as a jump.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            radiusRef.current / 3,
            Math.max(9, logoZoom),
            radiusRef.current,
          ],
          "circle-stroke-color": stroke,
          "circle-stroke-width": 1.25,
        },
      });

      map.addLayer({
        id: logos,
        type: "symbol",
        source: id,
        minzoom: logoZoom,
        layout: {
          "icon-image": [
            "match",
            ["get", "category"],
            ...entries.flatMap(([value]) => [value, imageId(value)]),
            imageId(entries[0]![0]),
          ] as unknown as DataDrivenPropertyValueSpecification<string>,
          // 0.7 of a 32px badge is about the dot it replaces, so the hand-over
          // does not jump; then it grows, because a logo needs room to be read
          // and a close-up map has plenty.
          // Scaled with the dot it replaces, not fixed: 0.7 was tuned against a
          // 9px radius, so a bigger dot needs a bigger badge or the hand-over
          // becomes the jump the tuning existed to avoid.
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            logoZoom,
            (0.7 * radiusRef.current) / DEFAULT_RADIUS,
            logoZoom + 3,
            (1.3 * radiusRef.current) / DEFAULT_RADIUS,
          ],
          // Vehicles bunch up; hiding the ones that collide would make a busy
          // street look empty, which is the opposite of what the data says.
          "icon-allow-overlap": true,
        },
      });
    };

    void build();
    // setStyle discards every custom layer and image, so rebuild when it lands.
    const rebuild = () => void build();
    map.on("style.load", rebuild);

    return () => {
      cancelled = true;
      map.off("style.load", rebuild);
      remove();
    };
    // No radius here: this effect rebuilds the source, re-renders every badge
    // and re-adds the images, which is far too much for a slider. It reaches
    // build() through radiusRef and the live layer through the effect below.
  }, [map, enabled, points, styles, logoZoom, strokeColor, id]);

  /** A radius change repaints the dots; it does not re-render the badges. */
  React.useEffect(() => {
    if (!map) return;
    try {
      if (!map.getLayer(dotsId)) return;
      map.setPaintProperty(dotsId, "circle-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        radius / 3,
        Math.max(9, logoZoom),
        radius,
      ]);
      // The badge layer is layout, not paint, so it takes setLayoutProperty.
      // Left in step with the dots for the reason given at build time.
      if (!map.getLayer(`${id}-logos`)) return;
      map.setLayoutProperty(`${id}-logos`, "icon-size", [
        "interpolate",
        ["linear"],
        ["zoom"],
        logoZoom,
        (0.7 * radius) / DEFAULT_RADIUS,
        logoZoom + 3,
        (1.3 * radius) / DEFAULT_RADIUS,
      ]);
    } catch {
      /* the map is gone */
    }
  }, [map, dotsId, id, logoZoom, radius]);
}
