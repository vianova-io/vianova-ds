/**
 * Resolves a CSS custom property to a colour MapLibre can paint with.
 *
 * Tokens like `--border` are written in whatever notation the theme likes --
 * oklch, a hex, a percentage of white -- and a map paints with a plain string
 * it parses itself, which only understands the old notations. A canvas is the
 * one place a browser will turn any colour it knows into pixels, so the colour
 * is painted onto a single pixel and read back as rgb or rgba.
 *
 * `scheme` asks for the token as it is in a theme that is not on screen, for a
 * map drawn in the other one. The root's `dark` class is switched, the token
 * read and the class put back in the same synchronous run, so the browser never
 * paints the other theme.
 *
 * Returns null where there is no document, or the token is not set or not a
 * colour.
 */
export function resolveCssColor(variable: string, scheme?: "light" | "dark"): string | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  const swap = scheme !== undefined && wasDark !== (scheme === "dark");

  let raw: string;
  if (swap) root.classList.toggle("dark", scheme === "dark");
  try {
    raw = getComputedStyle(root).getPropertyValue(variable).trim();
  } finally {
    if (swap) root.classList.toggle("dark", wasDark);
  }
  if (!raw) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // An unrecognised colour leaves fillStyle as it was, so start from a marker
  // no real token would parse to and see whether it moved.
  ctx.fillStyle = "#010203";
  ctx.fillStyle = raw;
  if (ctx.fillStyle === "#010203" && raw !== "#010203") return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a! / 255) * 1000) / 1000})`;
}
