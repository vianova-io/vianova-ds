import type { DataDrivenPropertyValueSpecification } from "maplibre-gl";

/** Single: one size for the layer. By value: a graduated scale. */
export type SizeMode = "single" | "by-value";

/*
 * The zoom band every size is drawn across.
 *
 * A size that ignores zoom is half of Katell's complaint -- a 5px dot is a
 * marker at street level and a smudge over a region -- but the hardcoded
 * expressions this replaces taper by 3x or more, which is why the slider's
 * number had to mean something. Here it means the size at the middle of the
 * band, tapering a quarter either side. Close enough to the number for the
 * slider to be honest, far enough for the map to breathe.
 */
const ZOOM_FAR = 10;
const ZOOM_NEAR = 16;
const FAR_FACTOR = 0.75;
const NEAR_FACTOR = 1.25;

export type SizeExpressionOptions = {
  mode: SizeMode;
  /** The size in px. In "by-value" mode this is the fallback. */
  size: number;
  /** The feature property to scale by, in "by-value" mode. */
  property?: string;
  /** The px the graduated scale runs between, smallest first. */
  range?: [number, number];
  /** Class edges in data units, ascending -- `quantileEdges` output. */
  edges?: number[];
};

/** `["interpolate", ["linear"], ["zoom"], 10, far, 16, near]`. */
function acrossZoom(
  far: unknown,
  near: unknown,
): DataDrivenPropertyValueSpecification<number> {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    ZOOM_FAR,
    far,
    ZOOM_NEAR,
    near,
  ] as unknown as DataDrivenPropertyValueSpecification<number>;
}

/**
 * One size, or a size graduated by a value, as a MapLibre expression.
 *
 * Generalises the two idioms the Zürich flows layer already used -- a stepped
 * `line-width` and a nested `circle-radius` interpolation -- so the panel, the
 * flows layer and the feed hooks all paint from the same function. Continuous
 * rather than stepped: the class count belongs to the colour legend, and a
 * size that jumps at a class edge reads as a data boundary that is not there.
 *
 * Falls back to the plain zoom taper whenever by-value cannot work -- no
 * property, no range, or a domain with no width, which is one value repeated
 * and nothing to graduate.
 */
export function sizeExpression({
  mode,
  size,
  property,
  range,
  edges,
}: SizeExpressionOptions): DataDrivenPropertyValueSpecification<number> {
  const low = edges?.[0];
  const high = edges?.at(-1);
  const graduated =
    mode === "by-value" &&
    property &&
    range &&
    low !== undefined &&
    high !== undefined &&
    high > low;

  if (!graduated) {
    return acrossZoom(size * FAR_FACTOR, size * NEAR_FACTOR);
  }

  const byValue = (factor: number) => [
    "interpolate",
    ["linear"],
    ["get", property],
    low,
    range[0] * factor,
    high,
    range[1] * factor,
  ];

  return acrossZoom(byValue(FAR_FACTOR), byValue(NEAR_FACTOR));
}

/**
 * A short, readable summary of a size setting, for the row that opens the
 * panel. "5 px" or "Radius by Vehicle volume" -- enough to tell, without
 * opening it, whether the layer is sized at all.
 */
export function sizeSummary({
  mode,
  size,
  range,
  fieldLabel,
}: {
  mode: SizeMode;
  size: number;
  range?: [number, number];
  fieldLabel?: string;
}): string {
  if (mode === "single") return `${size} px`;
  const span = range ? `${range[0]}–${range[1]} px` : "graduated";
  return fieldLabel ? `${span} by ${fieldLabel}` : span;
}
