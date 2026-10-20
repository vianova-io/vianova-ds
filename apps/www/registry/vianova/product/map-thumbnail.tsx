import { cn } from "@/registry/vianova/lib/utils";

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
