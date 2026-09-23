import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds write to a separate directory. `next build` and
  // `next dev` sharing .next corrupts the dev server's chunks mid-session,
  // which surfaces as an opaque "TypeError: a[d] is not a function".
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // maplibre-gl ships ESM plus a web worker. Without transpiling it, Next's
  // dev server mis-serves the worker chunk (HTML error page, wrong MIME), the
  // worker never starts, and the map loads its style and sprite but silently
  // requests no tiles at all.
  transpilePackages: ["maplibre-gl"],
  // The registry source is read from disk at build time by ComponentSource.
  outputFileTracingIncludes: {
    "/components/**": ["./registry/**/*"],
  },
};

export default nextConfig;
