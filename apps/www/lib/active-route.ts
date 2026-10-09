/**
 * Is this href the page we are on?
 *
 * Exists because the obvious `pathname === href` is wrong in this app and
 * fails silently. `next.config.ts` sets `trailingSlash: true`, so
 * `usePathname()` returns "/components/button/" while every href written in a
 * rail is "/components/button" -- the two are never equal, and the only
 * symptom is that nothing is ever highlighted. The component rail shipped that
 * way: measured on the built export, both rails had exactly 0 elements
 * carrying `aria-current`, which is also an accessibility defect and not only
 * a visual one.
 *
 * Normalising both sides is the whole fix. The root path is left alone, since
 * stripping its slash would leave an empty string.
 */
const normalise = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;

export function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return normalise(pathname) === normalise(href);
}
