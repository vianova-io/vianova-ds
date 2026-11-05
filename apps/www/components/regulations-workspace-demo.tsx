"use client";

import * as React from "react";

import {
  RegulationsWorkspace,
  type GeocodeResult,
} from "@/registry/vianova/blocks/regulations-workspace";

/**
 * The regulations workspace with its map search wired up.
 *
 * The block takes a `geocode` prop and ships no lookup of its own, because a
 * deployment searches its own places -- depots, operator areas, the zones
 * already in the library -- and a public gazetteer knows none of them. What
 * the docs site can offer instead is a real one, so the field is something
 * you can type into rather than a dead control in a screenshot.
 *
 * OpenStreetMap's Nominatim is the one public geocoder that works from a
 * static site: it sends CORS headers, needs no key, and so survives the
 * `output: "export"` build that leaves this app with no server to proxy
 * through. In exchange it asks for about one request a second -- the field
 * debounces -- and for attribution, which the map carries bottom right.
 *
 * Nothing identifying is sent. Nominatim's policy mentions an `email`
 * parameter for heavy automated use; a docs page is neither, and the query
 * string is the search term alone.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

async function geocode(
  query: string,
  signal: AbortSignal,
  near?: {
    center: [number, number];
    bbox: [number, number, number, number];
  },
): Promise<GeocodeResult[]> {
  // `viewbox` with `bounded=0` prefers what is on screen without hiding the
  // rest: searching "Belem" over Lisbon should find Belém in Lisbon, and
  // still find Belém in Brazil for anyone who means that one.
  const view = near
    ? `&viewbox=${near.bbox.map((n) => n.toFixed(5)).join(",")}&bounded=0`
    : "";
  // Eight rather than five: the local match has to survive being outranked by
  // bigger places of the same name before it can be sorted back to the top.
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&limit=8${view}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  // Thrown rather than returned empty: the field has an error state, and
  // "nothing found" and "the lookup failed" are not the same answer.
  if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);

  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];

  const found = raw.flatMap((item): GeocodeResult[] => {
    if (typeof item !== "object" || item === null) return [];
    const r = item as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

    const display = typeof r.display_name === "string" ? r.display_name : "";
    const name =
      (typeof r.name === "string" && r.name) || display.split(",")[0] || query;

    // Nominatim's boundingbox is [south, north, west, east], as strings.
    let bbox: GeocodeResult["bbox"];
    const bb = r.boundingbox;
    if (Array.isArray(bb) && bb.length === 4) {
      const nums = bb.map(Number);
      const [south, north, west, east] = [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
      if ([south, north, west, east].every(Number.isFinite)) {
        bbox = [west, south, east, north];
      }
    }

    return [
      {
        name,
        // The headline already says the first part; the rest is the context.
        context: display.split(",").slice(1).join(",").trim() || undefined,
        center: [lon, lat],
        bbox,
      },
    ];
  });

  if (!near) return found.slice(0, 5);

  /*
   * Anything in the same region as the map goes first.
   *
   * `viewbox` only nudges Nominatim's own ranking, and the nudge loses to
   * population: over Lisbon, "Belem" still answers with Belém in Pará first
   * and Belém in Lisboa third. Ranking is the geocoder's business, but which
   * of five identically named places the reader meant is this map's.
   *
   * The test is distance from the centre, not whether the place is on screen.
   * On screen is too literal to be useful: Belém is 6km from Baixa and so is
   * off the edge at working zoom, which is exactly when you would search for
   * it. NEARBY_KM is a region rather than a view, and everything beyond it
   * keeps its order underneath -- still reachable for another city.
   */
  const NEARBY_KM = 60;
  const [lon0, lat0] = near.center;
  const kmFrom = (p: GeocodeResult) => {
    // Equirectangular: at these distances the error is metres, and the only
    // question asked of it is "same region or not".
    const x = ((p.center[0] - lon0) * Math.cos((lat0 * Math.PI) / 180) * 40075) / 360;
    const y = ((p.center[1] - lat0) * 40008) / 360;
    return Math.hypot(x, y);
  };
  const nearby = found.filter((p) => kmFrom(p) <= NEARBY_KM);
  const rest = found.filter((p) => kmFrom(p) > NEARBY_KM);
  return [...nearby.sort((a, b) => kmFrom(a) - kmFrom(b)), ...rest].slice(0, 5);
}

export function RegulationsWorkspaceDemo() {
  return <RegulationsWorkspace geocode={geocode} />;
}
