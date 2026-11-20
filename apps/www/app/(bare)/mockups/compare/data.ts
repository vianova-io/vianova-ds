/**
 * Two periods of synthetic data, for the compare-date proposal.
 *
 * TEMPORARY. This whole directory is a deliverable to argue with, not a thing
 * to ship -- it is deleted in the commit that implements whichever treatment
 * wins. It lives under `app/(bare)/` rather than in
 * `registry/vianova/examples/`, which `scripts/build-registry.ts` scans: a file
 * dropped there auto-enrols into /preview, the axe crawl and the visual suite,
 * which is two committed baselines per frame for something disposable.
 *
 * Everything here is DETERMINISTIC. A seeded generator rather than
 * `Math.random()`, so the same page renders the same numbers on every reload
 * and a screenshot taken today can be compared with one taken next week. A
 * mockup whose data moves underneath you cannot settle an argument about
 * whether a treatment reads.
 *
 * The previous period is not noise around the current one. It is shaped to
 * contain the cases a compare treatment has to survive:
 *   - a metric that rose, and one that fell,
 *   - a barlist whose ORDER changed between periods, which is the case that
 *     breaks a naive side-by-side,
 *   - a heatmap whose peak MOVED rather than merely intensified,
 *   - a sankey that gained a destination it did not have before.
 */

export type Period = "current" | "previous";

export const PERIODS: Record<Period, { label: string; range: string }> = {
  current: { label: "This period", range: "1 – 31 Oct 2026" },
  previous: { label: "Previous period", range: "1 – 30 Sep 2026" },
};

/** Mulberry32. Small, fast, and the same everywhere -- which is the point. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------- series --- */

export type SeriesPoint = { day: string; current: number; previous: number };

/**
 * 30 daily points. The current period runs ~12% above the previous one, with
 * a dip in the third week so the two lines CROSS -- a comparison where one
 * series is simply above the other the whole way is the easy case, and proves
 * nothing about whether the treatment is readable when they tangle.
 */
export const series: SeriesPoint[] = (() => {
  const rand = seeded(20261001);
  return Array.from({ length: 30 }, (_, i) => {
    const base = 1800 + Math.sin(i / 4.5) * 260 + i * 12;
    const dip = i > 15 && i < 22 ? 420 : 0;
    return {
      day: String(i + 1),
      previous: Math.round(base + rand() * 160 - 80),
      current: Math.round(base * 1.12 - dip + rand() * 160 - 80),
    };
  });
})();

/* ----------------------------------------------------------------- kpi --- */

export const kpis = [
  { id: "trips", label: "Total trips", current: 58380, previous: 51920, unit: "trips" },
  { id: "vehicles", label: "Vehicles in use", current: 1247, previous: 1388, unit: "vehicles" },
  { id: "distance", label: "Average trip distance", current: 2.4, previous: 2.35, unit: "km" },
] as const;

/* ------------------------------------------------------------- barlist --- */

export type BarRow = { label: string; current: number; previous: number };

/**
 * Operators. Note Dott and Tier SWAP rank between the periods, and Voi is new
 * in the current one with no previous value at all. Both are the cases that
 * decide whether a barlist treatment works: a row whose position moved, and a
 * row that has nothing to compare against.
 */
export const barlist: BarRow[] = [
  { label: "Lime", current: 18420, previous: 16100 },
  { label: "Dott", current: 12880, previous: 9400 },
  { label: "Tier", current: 11120, previous: 12650 },
  { label: "Bolt", current: 8640, previous: 8210 },
  { label: "Voi", current: 4210, previous: 0 },
];

/* --------------------------------------------------------------- donut --- */

export const donut: BarRow[] = [
  { label: "Scooter", current: 31200, previous: 25400 },
  { label: "Bike", current: 18640, previous: 19800 },
  { label: "Moped", current: 6120, previous: 4900 },
  { label: "Car", current: 2420, previous: 1820 },
];

/* ---------------------------------------------------------- matrix/heat --- */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, "0"),
);

/**
 * Weekday x hour.
 *
 * ## One scale across both periods, never two
 *
 * The first version of this divided EACH period by its own maximum. That is
 * the standard heatmap-comparison lie: "dark" then means a different number in
 * each grid, so a period whose traffic halved can come out looking identical
 * to the one before it, and a reader comparing two grids is comparing two
 * rulers. Both periods are now normalised against the SAME maximum -- the
 * larger of the two -- so a colour means one quantity on this card, and the
 * September grid is legitimately paler overall because September was quieter.
 *
 * This is the whole answer to "two series, two colour ranges?". There is one
 * range. It is computed over both periods together, drawn once in the legend,
 * and the comparison is carried by POSITION -- two grids, or one grid wiped --
 * not by a second ramp.
 *
 * The two periods also differ in WHERE the peak sits, not just how hot it is:
 * September peaks at the 08:00 commute, October at 17:00.
 */
function heatCounts(
  seed: number,
  peakHour: number,
  weekendLift: number,
  scale: number,
) {
  const rand = seeded(seed);
  return WEEKDAYS.map((_, d) =>
    HOURS.map((_, h) => {
      // One dominant peak and a much weaker secondary. At 0.55 the secondary
      // was nearly as strong as the primary, so BOTH periods came out as
      // twin-peaked grids that looked alike -- the mockup claimed the peak
      // moved and then showed two near-identical heatmaps. 0.22 keeps the
      // secondary visible as texture without competing.
      const other = peakHour === 8 ? 17 : 8;
      const commute =
        Math.exp(-((h - peakHour) ** 2) / 5) +
        0.22 * Math.exp(-((h - other) ** 2) / 7);
      const weekend = d >= 5 ? weekendLift : 1;
      return Math.round(Math.max(0, commute * weekend + rand() * 0.12) * scale);
    }),
  );
}

/** Real figures, so the tooltip can report a count rather than "% of peak". */
export const matrixCounts: Record<Period, number[][]> = {
  previous: heatCounts(7312, 8, 0.6, 520),
  current: heatCounts(9914, 17, 0.95, 680),
};

/** The shared ruler. Both grids and the legend are scaled by this one number. */
export const matrixMax = Math.max(
  ...matrixCounts.previous.flat(),
  ...matrixCounts.current.flat(),
);

export const matrix: Record<Period, number[][]> = {
  previous: matrixCounts.previous.map((r) => r.map((v) => v / matrixMax)),
  current: matrixCounts.current.map((r) => r.map((v) => v / matrixMax)),
};

/**
 * current - previous, as a signed fraction of the shared maximum, so -1..1.
 *
 * The one place a SECOND hue is legitimate, because it encodes a sign rather
 * than an identity: a diverging ramp, neutral at zero. Everywhere else in this
 * mockup a second hue would say "a different thing" about what is the same
 * measure at a different time.
 */
export const matrixDiff: number[][] = matrixCounts.current.map((row, d) =>
  row.map((v, h) => (v - (matrixCounts.previous[d]?.[h] ?? 0)) / matrixMax),
);

/* -------------------------------------------------------------- sankey --- */

export type Flow = { source: string; target: string; value: number };

/**
 * Origin -> destination. "Airport" appears only in the current period, which
 * is the case a side-by-side has to make visible and a wipe-reveal tends to
 * hide: a ribbon that is not merely thinner but absent.
 */
export const sankeyNodes = [
  { id: "centre", label: "City centre" },
  { id: "north", label: "North" },
  { id: "south", label: "South" },
  { id: "station", label: "Station" },
  { id: "campus", label: "Campus" },
  { id: "park", label: "Park" },
  { id: "airport", label: "Airport" },
];

export const sankey: Record<Period, Flow[]> = {
  previous: [
    { source: "centre", target: "station", value: 5200 },
    { source: "centre", target: "campus", value: 3100 },
    { source: "north", target: "station", value: 2400 },
    { source: "north", target: "park", value: 1800 },
    { source: "south", target: "campus", value: 2900 },
    { source: "south", target: "park", value: 1200 },
  ],
  current: [
    { source: "centre", target: "station", value: 6100 },
    { source: "centre", target: "campus", value: 2600 },
    { source: "centre", target: "airport", value: 2200 },
    { source: "north", target: "station", value: 3300 },
    { source: "north", target: "park", value: 1500 },
    { source: "south", target: "campus", value: 3400 },
    { source: "south", target: "park", value: 1600 },
  ],
};

/* --------------------------------------------------------------- table --- */

export const table = barlist;

/* ------------------------------------------------------------ formatting -- */

export const fmt = (n: number) => n.toLocaleString("en-GB");

/** Signed percentage change, or null when there is nothing to compare to. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

export const fmtDelta = (d: number) =>
  `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}%`;
