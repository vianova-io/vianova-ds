import { cn } from "@/registry/vianova/lib/utils";

export type ThumbPoint = { position: [number, number]; category: string };
export type ThumbShape = { ring: [number, number][]; category: string };

/**
 * A stylised street grid, standing in for the map thumbnail the platform
 * renders.
 *
 * Shared because two surfaces draw it and must agree: the data hub thumbnails
 * its catalogue cards with it, and the map's data library thumbnails the same
 * datasets in its picker. The same dataset has to look like itself in both, so
 * there is one function and one seed rule rather than two that drift.
 *
 * Deterministic on purpose. A real map render would mean WebGL and tiles,
 * which costs a dozen contexts on a grid of cards and would push any example
 * that used it into NON_DETERMINISTIC, out of visual-baseline coverage -- the
 * hole `map-draw-control-default` already sits in. This is an SVG with a seeded
 * PRNG: same seed, same bytes, every run.
 */

/** Deterministic, so a card looks the same on every render and every machine. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * A stable seed from a dataset id, for catalogues whose entries carry a name
 * rather than a number. FNV-1a: short, dependency-free, and spread well enough
 * that neighbouring ids ("sample-mds-lisbon", "sample-mds-porto") do not draw
 * the same street grid.
 */
export function thumbnailSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function MapThumbnail({
  seed,
  className,
}: {
  seed: number;
  className?: string;
}) {
  const next = rng(seed);
  // Streets run roughly east-west and north-south with a little wobble, the way
  // a city grid reads from far away. One of them is the dataset's own route.
  const streets = [
    ...Array.from({ length: 4 }, (_, i) => {
      const y = 8 + i * 15 + (next() - 0.5) * 6;
      return `M-2 ${y.toFixed(1)} Q50 ${(y + (next() - 0.5) * 10).toFixed(1)} 102 ${(y + (next() - 0.5) * 8).toFixed(1)}`;
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const x = 8 + i * 17 + (next() - 0.5) * 6;
      return `M${x.toFixed(1)} -2 Q${(x + (next() - 0.5) * 10).toFixed(1)} 30 ${(x + (next() - 0.5) * 8).toFixed(1)} 62`;
    }),
  ];
  const route = `M${(next() * 20).toFixed(1)} ${(10 + next() * 40).toFixed(1)} C30 ${(next() * 60).toFixed(1)} 60 ${(next() * 60).toFixed(1)} ${(80 + next() * 20).toFixed(1)} ${(10 + next() * 40).toFixed(1)}`;
  return (
    <div
      className={cn("bg-muted relative overflow-hidden", className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        {streets.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            className="stroke-border"
            strokeWidth="1.1"
          />
        ))}
        <path
          d={route}
          fill="none"
          className="stroke-primary"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * The dataset's own geometry, drawn small: points and areas in their category
 * colours on the card's background. It needs no WebGL and no tiles, so a list
 * of a dozen of them costs nothing, and it is the data rather than a stand-in.
 *
 * Shared for the same reason the street grid is: the data hub draws it on its
 * catalogue cards and the map's library draws it on the same datasets in its
 * picker, and the same dataset has to look like itself in both. Moved here
 * from the hub unchanged -- its baselines are pixel comparisons of this
 * markup, so the geometry, the viewBox and the rounding all stay as they were.
 */
export function GeometryThumbnail({
  points,
  shapes,
  colour,
  className,
}: {
  points: ThumbPoint[];
  shapes: ThumbShape[];
  /** Category to fill colour. */
  colour: (category: string) => string;
  className?: string;
}) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const {
    position: [x, y],
  } of points)
    [w, s, e, n] = [
      Math.min(w, x),
      Math.min(s, y),
      Math.max(e, x),
      Math.max(n, y),
    ];
  for (const { ring } of shapes)
    for (const [x, y] of ring)
      [w, s, e, n] = [
        Math.min(w, x),
        Math.min(s, y),
        Math.max(e, x),
        Math.max(n, y),
      ];

  // The frame is the card's picture, about 3.7 times wider than tall. Longitude
  // degrees are shorter than latitude ones away from the equator, so the shape
  // is squared up before it is fitted into it.
  const k = Math.cos(((s + n) / 2) * (Math.PI / 180));
  const spanX = Math.max((e - w) * k, 1e-6);
  const spanY = Math.max(n - s, 1e-6);
  const scale = Math.min(94 / spanX, 24 / spanY);
  const ox = (100 - spanX * scale) / 2;
  const oy = (27 - spanY * scale) / 2;
  const px = (x: number) => ox + (x - w) * k * scale;
  const py = (y: number) => oy + (n - y) * scale;

  // A thousand dots add nothing a few hundred do not already say.
  const stride = Math.max(1, Math.ceil(points.length / 400));

  return (
    <div
      className={cn("bg-muted relative overflow-hidden", className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 27"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        {shapes.map((shape, i) => (
          <polygon
            key={i}
            points={shape.ring
              .map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`)
              .join(" ")}
            fill={colour(shape.category)}
            fillOpacity={0.4}
            stroke={colour(shape.category)}
            strokeWidth={0.3}
          />
        ))}
        {points
          .filter((_, i) => i % stride === 0)
          .map((p, i) => (
            <circle
              key={i}
              cx={px(p.position[0])}
              cy={py(p.position[1])}
              r={0.7}
              fill={colour(p.category)}
              fillOpacity={0.9}
            />
          ))}
      </svg>
    </div>
  );
}
