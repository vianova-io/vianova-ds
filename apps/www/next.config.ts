import type { NextConfig } from "next";

/**
 * The sub-path the site is served from, or "" when it is served from a domain
 * root. GitHub Pages publishes this project at
 * https://vianova-io.github.io/vianova-ds/, so the deploy sets it to
 * "/vianova-ds"; dev and the ordinary CI build leave it unset.
 *
 * `next.config.ts` and `lib/asset.ts` read the SAME variable, which is the only
 * reason they cannot drift. `basePath` prefixes `next/link`, `next/image` and
 * CSS-imported assets; it does nothing to a raw string in a `src` or `href`,
 * and `asset()` exists to cover exactly that gap.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  /**
   * A static export: the whole site is HTML, JS and JSON on disk, with no Node
   * server at runtime. That is what lets GitHub Pages serve it, and what lets
   * the shadcn registry under public/r be fetched as plain files.
   *
   * Kept on unconditionally rather than gated behind the deploy, because this
   * is where the STRUCTURAL risks live -- a new route without
   * generateStaticParams, a stray route handler, an accidental cookies() call.
   * All three are hard build failures, so every build catches them for free.
   * Gating it would leave that entire class unexercised until deploy time.
   */
  output: "export",

  /**
   * Emit out/preview/x/index.html rather than out/preview/x.html.
   *
   * Load-bearing, not cosmetic: it makes the export servable by any dumb static
   * file server instead of relying on a host that silently tries an .html
   * suffix. GitHub Pages happens to do that; `python3 -m http.server`, which
   * the registry smoke test uses, does not.
   */
  trailingSlash: true,

  ...(basePath ? { basePath } : {}),

  /**
   * Production builds write to a separate directory. `next build` and
   * `next dev` sharing .next corrupts the dev server's chunks mid-session,
   * which surfaces as an opaque "TypeError: a[d] is not a function".
   *
   * DEV is the process that gets the private directory, and it has to be this
   * way round. Next treats a non-".next" distDir under `output: "export"` as
   * the EXPORT destination and moves build scratch back into .next
   * (hasCustomExportOutput, next/dist/build/index.js) -- so pointing the build
   * elsewhere would write the site to the wrong place AND reintroduce the very
   * corruption this setting exists to prevent.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  /**
   * maplibre-gl ships ESM plus a web worker. Without transpiling it, Next's
   * dev server mis-serves the worker chunk (HTML error page, wrong MIME), the
   * worker never starts, and the map loads its style and sprite but silently
   * requests no tiles at all.
   */
  transpilePackages: ["maplibre-gl"],

  // `outputFileTracingIncludes` for the registry was dropped here: it shipped
  // registry/** into a serverless bundle, and under `output: "export"` there is
  // no server bundle. lib/source.ts reads those files at build time instead.
};

export default nextConfig;
