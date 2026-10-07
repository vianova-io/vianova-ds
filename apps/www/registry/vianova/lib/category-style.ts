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
  /** Any CSS colour; the badge and the dot both use it. */
  color: string;
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
 * What to tell someone about the logo they have put on this colour.
 *
 * Only a transparent logo can vanish into its badge: a solid one covers it. So
 * a transparent logo is explained, and compared with the colour behind it.
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
      message: "This logo is transparent, so it sits on the colour. Pick a colour it stands out against.",
    },
  ];

  const rgb = parseHex(style.color);
  if (!rgb || style.logoLuminance === undefined) return advice;

  const behind = luminance(rgb);
  if (contrastBetween(style.logoLuminance, behind) >= MIN_LOGO_CONTRAST) return advice;

  const best = [LIGHT, DARK]
    .map((hex) => ({ hex, ratio: contrastBetween(style.logoLuminance!, luminance(parseHex(hex)!)) }))
    .sort((a, b) => b.ratio - a.ratio)[0]!;
  const tone = style.logoLuminance < 0.4 ? "dark" : "light";
  advice.push({
    kind: "warning",
    message: `This logo is mostly ${tone} and so is the colour behind it, so it will be hard to read.`,
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

/** Share of pixels that must be see-through before a logo counts as transparent. */
const TRANSPARENT_SHARE = 0.02;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

/**
 * Turns an uploaded image into the one shape a map can draw: a small square PNG.
 *
 * Everything is rasterised, SVG included, because a map symbol is a bitmap and
 * because a PNG also tells us whether the image is transparent, which the
 * original file format cannot say reliably (a PNG may or may not have alpha, an
 * SVG may or may not paint its background). It is also what keeps five logos
 * inside a browser's storage quota.
 */
export async function prepareLogo(file: File, size = LOGO_SIZE): Promise<
  Required<Pick<CategoryStyle, "logo" | "logoKind" | "logoLuminance">>
> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    // Contain, never crop: a logo cut off at the edge is a different logo.
    const scale = Math.min(size / w, size / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser cannot process images.");
    ctx.drawImage(img, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);

    const { data } = ctx.getImageData(0, 0, size, size);
    let seeThrough = 0;
    let visible = 0;
    let lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]!;
      if (alpha < 250) seeThrough++;
      if (alpha >= 128) {
        visible++;
        lum += luminance([data[i]!, data[i + 1]!, data[i + 2]!]);
      }
    }

    // A logo that is not square is letterboxed by the contain above, which adds
    // transparent margin. Judge transparency inside the image's own box, or
    // every wide logo would read as transparent.
    const boxPixels = dw * dh;
    const marginPixels = size * size - boxPixels;
    const inside = Math.max(0, seeThrough - marginPixels);
    const kind: LogoKind = inside / boxPixels > TRANSPARENT_SHARE ? "transparent" : "solid";

    return {
      logo: canvas.toDataURL("image/png"),
      logoKind: kind,
      logoLuminance: visible ? lum / visible : 0.5,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The badge a map symbol uses: the colour as a disc with a white ring, and the
 * logo on it. Drawn once per value, not per feature.
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
  ctx.fillStyle = style.color;
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
