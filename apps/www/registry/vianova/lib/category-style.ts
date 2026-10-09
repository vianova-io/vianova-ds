/**
 * How one value of a category column looks on a map: a colour, and optionally a
 * logo. Zoomed out the value is a dot in its colour; zoomed in it is a badge
 * with the logo on that colour.
 *
 * This file is the contract between whatever lets you set those looks (a data
 * hub) and whatever draws them (a map). Both read and write through here, so
 * neither has to know how the other stores or renders a style.
 */

export type LogoKind =
  /** Has see-through areas: it needs the colour behind it to be read. */
  | "transparent"
  /** Fills its own box: it covers the badge, and the colour shows as a ring. */
  | "solid";

export type CategoryStyle = {
  /** Any CSS colour. The dot a map draws zoomed out, and by default the badge too. */
  color: string;
  /**
   * The disc a logo sits on, when it should not be `color`.
   *
   * Separate because the two jobs pull apart: the dot has to tell categories
   * apart at a glance, while the badge has to make one particular logo legible,
   * and a brand's own colour is often exactly what its logo is drawn in. Unset,
   * the badge is `color`, which is how every style saved before this existed
   * keeps looking the same.
   */
  badge?: string;
  /** A small PNG data URL, see `prepareLogo`. */
  logo?: string;
  logoKind?: LogoKind;
  /** Mean relative luminance, 0 to 1, of the logo's visible pixels. */
  logoLuminance?: number;
};

export type CategoryStyleSet = {
  /** The map switches from dots to logos at this zoom. */
  logoZoom: number;
  /** Keyed by category value. */
  values: Record<string, CategoryStyle>;
};

export const DEFAULT_LOGO_ZOOM = 14;

/** What the badge is filled with: its own colour if it has one, else the dot's. */
export const badgeColor = (style: CategoryStyle): string => style.badge ?? style.color;

/**
 * Distinct from one another rather than from a theme: a category's colour is
 * data the author assigns and the map paints with, not UI chrome. The first
 * stop is the product primary.
 */
export const CATEGORY_PALETTE = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#65a30d",
  "#dc2626",
  "#0891b2",
] as const;

/**
 * A style for every value, falling back to the palette in value order.
 *
 * Both sides call this with the same ordered values, so an unstyled value is
 * the same colour in the data hub and on the map without either storing it.
 */
export function resolveStyles(
  values: string[],
  stored?: Partial<CategoryStyleSet>,
): Record<string, CategoryStyle> {
  const out: Record<string, CategoryStyle> = {};
  values.forEach((value, i) => {
    out[value] = stored?.values?.[value] ?? {
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] ?? CATEGORY_PALETTE[0],
    };
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Colour maths                                                                */
/* -------------------------------------------------------------------------- */

/** #rgb or #rrggbb only: a category colour that is not a hex has no luminance to compare. */
export function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** WCAG contrast ratio between two luminances, 1 to 21. */
export function contrastBetween(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* -------------------------------------------------------------------------- */
/* Advice                                                                      */
/* -------------------------------------------------------------------------- */

export type LogoAdvice = {
  kind: "info" | "warning";
  message: string;
  /** A badge colour that would read better. */
  suggestion?: string;
};

/** Below this a logo is hard to pick out of its badge; WCAG's bar for graphics. */
export const MIN_LOGO_CONTRAST = 3;

const LIGHT = "#ffffff";
const DARK = "#111827";

/**
 * What to tell someone about the logo they have put on this badge.
 *
 * Only a transparent logo can vanish into its badge: a solid one covers it. So
 * a transparent logo is explained, and compared with the badge behind it -- not
 * the dot, which it never sits on.
 */
export function adviseLogo(style: CategoryStyle): LogoAdvice[] {
  if (!style.logo) return [];
  if (style.logoKind === "solid") {
    return [
      {
        kind: "info",
        message: "This logo has its own background, so it fills the badge and the colour shows as a ring.",
      },
    ];
  }

  const advice: LogoAdvice[] = [
    {
      kind: "info",
      message: "This logo is transparent, so it sits on the badge colour. Pick one it stands out against.",
    },
  ];

  const rgb = parseHex(badgeColor(style));
  if (!rgb || style.logoLuminance === undefined) return advice;

  const behind = luminance(rgb);
  if (contrastBetween(style.logoLuminance, behind) >= MIN_LOGO_CONTRAST) return advice;

  const best = [LIGHT, DARK]
    .map((hex) => ({ hex, ratio: contrastBetween(style.logoLuminance!, luminance(parseHex(hex)!)) }))
    .sort((a, b) => b.ratio - a.ratio)[0]!;
  advice.push({
    kind: "warning",
    // Not "this logo is dark": what makes it unreadable is that the two are
    // close in tone, whichever way round, and a mid-tone logo is neither.
    message: "This logo and its badge are too close in tone, so the logo will be hard to read.",
    suggestion: best.hex,
  });
  return advice;
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "vianova:category-styles:v1";

type Store = Pick<Storage, "getItem" | "setItem">;
type Saved = Record<string, CategoryStyleSet>;

function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Reading localStorage throws, rather than returning null, when site data is blocked.
    return null;
  }
}

const slot = (dataset: string, column: string) => `${dataset}::${column}`;

function readAll(store: Store | null): Saved {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Saved) : {};
  } catch {
    return {};
  }
}

export function readStyleSet(
  dataset: string,
  column: string,
  store: Store | null = browserStore(),
): CategoryStyleSet | undefined {
  const found = readAll(store)[slot(dataset, column)];
  if (!found || typeof found.logoZoom !== "number" || typeof found.values !== "object") return undefined;
  return found;
}

/** False when it could not be saved, e.g. the browser's quota is full. */
export function writeStyleSet(
  dataset: string,
  column: string,
  set: CategoryStyleSet,
  store: Store | null = browserStore(),
): boolean {
  if (!store) return false;
  try {
    const all = readAll(store);
    all[slot(dataset, column)] = set;
    store.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** For the `storage` event: true when this write was a style change. */
export const STYLE_STORAGE_KEY = STORAGE_KEY;

/* -------------------------------------------------------------------------- */
/* Logos (browser only)                                                        */
/* -------------------------------------------------------------------------- */

export const LOGO_SIZE = 128;

/**
 * How much of a logo's outer edge must be visible for the logo to count as
 * having its own background.
 *
 * The edge, not the whole picture: an app-icon style logo has transparent
 * corners and a circle on white has anti-aliased seams where its shapes meet,
 * and counting those would call both "transparent". What a logo with a
 * background has is an edge that is filled all the way round; a transparent one
 * leaves its edge empty, because its mark floats in the middle.
 */
export const SOLID_EDGE_SHARE = 0.9;

/**
 * The band of the downscaled logo that is judged, in pixels in from its edge.
 *
 * Starts one pixel in, not at the edge itself: a logo drawn from coordinate 1
 * in a 447-wide box (Gira's is) leaves its outermost pixel partly empty, and
 * that one hairline would otherwise outvote the rest of the edge.
 */
const EDGE_FROM = 1;
const EDGE_TO = 3;

export function kindFromEdge(visibleShare: number): LogoKind {
  return visibleShare >= SOLID_EDGE_SHARE ? "solid" : "transparent";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

/**
 * How much larger than the final logo the artwork is drawn before its empty
 * margins are measured and trimmed. Trimming scales the visible part UP to fill
 * the logo, so measuring on a canvas the final size would enlarge an already
 * rasterised bitmap and blur it; drawing larger first means it is only ever
 * scaled down.
 */
const TRIM_SCALE = 4;

/** Below this alpha a pixel is empty margin, not part of the mark. */
const MARGIN_ALPHA = 16;

/** Trimming is skipped unless it would win at least this share of the width or height. */
const MIN_TRIM = 0.03;

export type Bounds = { x: number; y: number; width: number; height: number };

/**
 * The smallest box holding every pixel that is not empty margin, or null when
 * the picture is entirely empty.
 */
export function visibleBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  minAlpha = MARGIN_ALPHA,
): Bounds | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! >= minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Turns an uploaded image into the one shape a map can draw: a small square PNG.
 *
 * Everything is rasterised, SVG included, because a map symbol is a bitmap and
 * because a PNG also tells us whether the image is transparent, which the
 * original file format cannot say reliably (a PNG may or may not have alpha, an
 * SVG may or may not paint its background). It is also what keeps five logos
 * inside a browser's storage quota.
 *
 * Empty margins are trimmed first. A logo exported on a roomy artboard (Lime's
 * is a small mark on a 1200 by 800 canvas) would otherwise sit tiny in its
 * badge, since the badge already supplies the breathing room.
 */
/** Below this saturation a pixel is white, black or grey: no one's brand colour. */
const MIN_BRAND_SATURATION = 0.25;

/**
 * The colour a logo is mostly made of, as a hex -- or null if it has none, being
 * only white, black and grey.
 *
 * Counts visible pixels into coarse colour buckets and takes the fullest, so the
 * anti-aliased fringe, which is a smear of in-between shades, never outvotes the
 * flat fill it surrounds. Greys are ignored on purpose: a logo on a white tile
 * is not "white", and a black wordmark has no colour worth painting a dot.
 * More saturated pixels count for a little more, so a vivid mark wins over a
 * pale tint of about the same size.
 */
export function dominantColor(data: Uint8ClampedArray): string | null {
  const buckets = new Map<number, { score: number; r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    if (saturation < MIN_BRAND_SATURATION) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { score: 0, r: 0, g: 0, b: 0, n: 0 };
    bucket.score += 0.5 + saturation;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  let best: { score: number; r: number; g: number; b: number; n: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.score > best.score) best = bucket;
  if (!best) return null;
  const hex = (sum: number) =>
    Math.round(sum / best!.n)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

export async function prepareLogo(file: File, size = LOGO_SIZE): Promise<
  Required<Pick<CategoryStyle, "logo" | "logoKind" | "logoLuminance">> & {
    /** The colour the logo is mostly made of, or null if it is only black, white and grey. */
    logoColor: string | null;
  }
> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;

    // Drawn large, contained, and measured, so the margins can be trimmed
    // without ever scaling a bitmap up.
    const big = size * TRIM_SCALE;
    const bigScale = Math.min(big / w, big / h);
    const bw = Math.max(1, Math.round(w * bigScale));
    const bh = Math.max(1, Math.round(h * bigScale));
    const source = document.createElement("canvas");
    source.width = big;
    source.height = big;
    const sctx = source.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("This browser cannot process images.");
    sctx.drawImage(img, Math.round((big - bw) / 2), Math.round((big - bh) / 2), bw, bh);

    const whole: Bounds = { x: Math.round((big - bw) / 2), y: Math.round((big - bh) / 2), width: bw, height: bh };
    const found = visibleBounds(sctx.getImageData(0, 0, big, big).data, big, big);
    const worthTrimming =
      found && (found.width < whole.width * (1 - MIN_TRIM) || found.height < whole.height * (1 - MIN_TRIM));
    const crop = worthTrimming ? found : whole;

    // Contain, never crop: a logo cut off at the edge is a different logo.
    const scale = Math.min(size / crop.width, size / crop.height);
    const dw = Math.max(1, Math.round(crop.width * scale));
    const dh = Math.max(1, Math.round(crop.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser cannot process images.");
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);

    const { data } = ctx.getImageData(0, 0, size, size);
    const x0 = Math.round((size - dw) / 2);
    const y0 = Math.round((size - dh) / 2);

    let visible = 0;
    let lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! >= 128) {
        visible++;
        lum += luminance([data[i]!, data[i + 1]!, data[i + 2]!]);
      }
    }

    // Judged inside the image's own box: contain letterboxes a wide logo with
    // transparent margin of our making, which says nothing about the logo.
    let edge = 0;
    let edgeVisible = 0;
    for (let y = y0; y < y0 + dh; y++) {
      for (let x = x0; x < x0 + dw; x++) {
        const depth = Math.min(x - x0, x0 + dw - 1 - x, y - y0, y0 + dh - 1 - y);
        if (depth < EDGE_FROM || depth > EDGE_TO) continue;
        edge++;
        if (data[(y * size + x) * 4 + 3]! >= 128) edgeVisible++;
      }
    }
    const kind = kindFromEdge(edge ? edgeVisible / edge : 0);

    return {
      logo: canvas.toDataURL("image/png"),
      logoKind: kind,
      logoLuminance: visible ? lum / visible : 0.5,
      logoColor: dominantColor(data),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The badge a map symbol uses: the badge colour as a disc with a white ring, and
 * the logo on it. Drawn once per value, not per feature.
 */
export async function composeBadge(style: CategoryStyle, size = 64): Promise<ImageData> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw images.");

  const ring = Math.max(2, Math.round(size / 24));
  const r = size / 2;

  ctx.beginPath();
  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(r, r, r - 1 - ring, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor(style);
  ctx.fill();

  if (style.logo) {
    const img = await loadImage(style.logo);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 1 - ring, 0, Math.PI * 2);
    ctx.clip();
    if (style.logoKind === "solid") {
      // Fills the disc; the colour survives as a thin ring around it.
      const inset = ring + 2;
      ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
    } else {
      const inner = (size - (ring + 1) * 2) * 0.64;
      ctx.drawImage(img, r - inner / 2, r - inner / 2, inner, inner);
    }
    ctx.restore();
  }

  return ctx.getImageData(0, 0, size, size);
}
