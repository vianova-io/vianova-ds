import { parseHex } from "@/registry/vianova/lib/category-style";

/**
 * The palettes a map layer can be coloured with, and the maths that turns a
 * handful of editable stops into one colour per band.
 *
 * Here rather than in a component because two things need the same answer: the
 * layer that paints the map and the legend that explains it. A legend reading
 * one ramp beside a layer painted with another is the bug this exists to make
 * impossible.
 */

export type Palette = {
  name: string;
  family: string;
  colors: string[];
  /** Survives the common forms of colour vision deficiency. */
  colorBlindSafe?: boolean;
};

export type Stop = {
  /** 0 to 100, across the ramp. */
  position: number;
  color: string;
  opacity?: number;
};

/**
 * Sets for a categorical colouring: values with no order.
 *
 * Kept apart from the sequential ramps rather than filtered out of one list. A
 * sequential ramp over road types or operators implies that one outranks
 * another, and an unordered set over a measure throws away the order that is
 * the entire point. Offering either for the wrong field type is a mistake
 * waiting to be made, so each branch is only ever handed the half that applies.
 */
export const CATEGORICAL_PALETTES: Palette[] = [
  {
    name: "Spectrum",
    family: "Categorical",
    colors: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"],
  },
  {
    name: "Accessible",
    family: "Categorical",
    colorBlindSafe: true,
    colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"],
  },
  {
    name: "Tableau",
    family: "Categorical",
    colorBlindSafe: true,
    colors: ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#76b7b2", "#edc948", "#9c755f"],
  },
  {
    name: "Pastel",
    family: "Categorical",
    colors: ["#93c5fd", "#fca5a5", "#86efac", "#fcd34d", "#d8b4fe", "#67e8f9", "#f9a8d4", "#bef264"],
  },
  {
    name: "Deep 700",
    family: "Categorical",
    colors: ["#1d4ed8", "#15803d", "#c2410c", "#be185d", "#6d28d9", "#0e7490", "#b91c1c", "#4d7c0f"],
  },
];

/** Ramps for a numeric colouring: values with order. */
export const SEQUENTIAL_PALETTES: Palette[] = [
  {
    name: "Viridis",
    family: "Sequential",
    colorBlindSafe: true,
    colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  },
  {
    name: "Blues",
    family: "Sequential",
    colors: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"],
  },
  {
    name: "Heat",
    family: "Sequential",
    colors: ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"],
  },
  {
    name: "Teal",
    family: "Sequential",
    colors: ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0f766e", "#134e4a"],
  },
  {
    name: "Red–Blue",
    family: "Diverging",
    colorBlindSafe: true,
    colors: ["#b2182b", "#ef8a62", "#f7f7f7", "#67a9cf", "#2166ac"],
  },
  {
    name: "Brown–Teal",
    family: "Diverging",
    colorBlindSafe: true,
    colors: ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"],
  },
];

const hex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

const byPosition = (stops: Stop[]) => [...stops].sort((a, b) => a.position - b.position);

/**
 * Spreads a handful of editable stops into one colour per band.
 *
 * The panel gives a few anchors; the map and the legend both want a colour for
 * every band, so the gaps are filled by interpolating between the surrounding
 * pair. sRGB on purpose rather than a perceptual space: these are the exact
 * colours someone picked, and bending them through Lab hands back shades they
 * did not choose.
 */
export function rampFromStops(stops: Stop[], count: number): string[] {
  const sorted = byPosition(stops).filter((s) => parseHex(s.color));
  if (!sorted.length || count < 1) return [];
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (count === 1) return [hex(parseHex(first.color)!)];

  return Array.from({ length: count }, (_, i) => {
    const at = (i / (count - 1)) * 100;
    // Clamped rather than extrapolated: a stop list starting at 20% means
    // everything below 20% is that colour, not a colour nobody chose.
    if (at <= first.position) return hex(parseHex(first.color)!);
    if (at >= last.position) return hex(parseHex(last.color)!);

    let lo = first;
    let hi = last;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (at >= sorted[j]!.position && at <= sorted[j + 1]!.position) {
        lo = sorted[j]!;
        hi = sorted[j + 1]!;
        break;
      }
    }
    const span = hi.position - lo.position;
    const t = span > 0 ? (at - lo.position) / span : 0;
    const a = parseHex(lo.color)!;
    const b = parseHex(hi.color)!;
    return hex(a.map((v, k) => v + (b[k]! - v) * t));
  });
}

/** Five editable anchors sampled out of a full ramp. */
export function stopsFromRamp(ramp: readonly string[]): Stop[] {
  if (ramp.length < 2) return [];
  return [0, 25, 50, 75, 100].map((position) => ({
    position,
    color: ramp[Math.round(((ramp.length - 1) * position) / 100)]!,
    opacity: 100,
  }));
}

/**
 * Band edges that split `values` into `bands` groups of equal count.
 *
 * Quantiles rather than equal intervals: mobility data is long-tailed -- a
 * handful of busy streets, thousands of quiet ones -- and equal intervals put
 * almost every feature in the first band and leave the rest of the ramp for
 * the few outliers.
 */
export function quantileEdges(values: number[], bands: number): number[] {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0 || bands < 2) return [];
  const edges: number[] = [];
  for (let i = 0; i < bands; i++) {
    const v = sorted[Math.floor(((sorted.length - 1) * i) / (bands - 1))]!;
    // Duplicates would make an empty band, and MapLibre rejects a `step`
    // expression whose stops do not strictly ascend.
    if (!edges.length || v > edges[edges.length - 1]!) edges.push(v);
  }
  return edges;
}
