/**
 * Prefixes a path to a file in `public/` with the site's basePath.
 *
 * `basePath` is not a general rewrite. Next applies it to `next/link` hrefs,
 * `next/image` and CSS-imported assets -- and to nothing else. A raw string in
 * an `<img src>` or an `<a href download>` is left exactly as written, so on a
 * project Pages site (`/vianova-ds/...`) every one of them 404s.
 *
 * This reads the SAME environment variable as `basePath` in next.config.ts,
 * which is the only reason the two cannot drift apart.
 *
 * Docs-site only. It deliberately lives in `apps/www/lib`, which is never
 * distributed -- the `lib` alias in components.json points at a different
 * directory, `@/registry/vianova/lib`. Registry components that need the same
 * prefix inline the expression instead, so that installing one never drags a
 * file into a consumer's repo whose only purpose is solving our hosting.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
