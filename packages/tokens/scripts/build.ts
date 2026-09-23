/**
 * Token build. Emits five artefacts from one DTCG source of truth:
 *
 *   dist/theme.css            Tailwind v4 @theme inline + :root + 6 theme blocks
 *   dist/tokens.js/.d.ts      typed runtime values, incl. map ramps as rgb tuples
 *   dist/figma.variables.json payload shape for the Figma Variables REST API
 *   dist/registry-theme.json  one shadcn registry:theme item per mode
 *   dist/tokens.json          flat map, consumed by docs pages and the adherence checker
 *
 * Modes mirror the Figma library's Semantic collection: light, dark, and the four
 * white-label variants. Light/dark is the `.dark` class axis; the white-label
 * themes are `[data-theme]`; map scheme is a THIRD, independent axis.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { converter, formatHex, formatHex8 } from "culori";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const toRgb = converter("rgb");

// ---------------------------------------------------------------------------
// Load + resolve
// ---------------------------------------------------------------------------

type Leaf = { $value: string; $type: string; $extensions?: Record<string, any> };
type Tree = { [k: string]: Tree | Leaf };

const isLeaf = (n: unknown): n is Leaf =>
  typeof n === "object" && n !== null && "$value" in (n as object);

function deepMerge(target: any, src: any) {
  for (const [k, v] of Object.entries(src)) {
    if (k.startsWith("$") && !isLeaf(src)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !isLeaf(v)) {
      target[k] ??= {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function loadAll(): Tree {
  const out: Tree = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tokens.json")) deepMerge(out, JSON.parse(readFileSync(p, "utf8")));
    }
  };
  walk(SRC);
  return out;
}

function flatten(tree: Tree, prefix: string[] = [], out: Record<string, Leaf> = {}) {
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith("$")) continue;
    if (isLeaf(v)) out[[...prefix, k].join(".")] = v;
    else flatten(v as Tree, [...prefix, k], out);
  }
  return out;
}

/** Resolve `{a.b.c}` aliases (with optional trailing alpha hex), cycle-safe. */
function resolve(flat: Record<string, Leaf>): Record<string, Leaf> {
  const done: Record<string, Leaf> = {};
  const active = new Set<string>();

  const get = (key: string): string => {
    const leaf = flat[key];
    if (!leaf) throw new Error(`Token alias points at a missing token: {${key}}`);
    if (done[key]) return done[key]!.$value;
    if (active.has(key)) throw new Error(`Circular token alias detected at {${key}}`);
    active.add(key);
    const value = String(leaf.$value).replace(/\{([^}]+)\}/g, (_, ref) => get(ref));
    active.delete(key);
    done[key] = { ...leaf, $value: value };
    return value;
  };

  for (const key of Object.keys(flat)) get(key);
  return done;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

const SHADCN_CONTRACT = [
  "background", "foreground",
  "card", "card-foreground",
  "popover", "popover-foreground",
  "primary", "primary-foreground",
  "secondary", "secondary-foreground",
  "muted", "muted-foreground",
  "accent", "accent-foreground",
  "destructive", "destructive-foreground",
  "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground",
  "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-border", "sidebar-ring",
] as const;

/** Mirrors the Figma library Semantic collection modes. */
export const MODES = [
  { key: "light", figmaMode: "Light", selector: ":root", isDark: false },
  { key: "dark", figmaMode: "Dark", selector: ".dark", isDark: true },
  { key: "darkStone", figmaMode: "Dark Stone", selector: '.dark[data-theme="stone"]', isDark: true },
  { key: "darkSlate", figmaMode: "Dark Slate", selector: '.dark[data-theme="slate"]', isDark: true },
  { key: "fuchsia", figmaMode: "Fuchsia", selector: '.dark[data-theme="fuchsia"]', isDark: true },
  { key: "gray", figmaMode: "Gray", selector: '.dark[data-theme="gray"]', isDark: true },
] as const;

const MAP_SCHEMES = ["brand", "warm", "viridis", "blue"] as const;
const DEFAULT_MAP_SCHEME = "brand";
const RAMP_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

function hexOf(value: string): string {
  const c = toRgb(value);
  if (!c) throw new Error(`Could not parse colour: ${value}`);
  return (c.alpha !== undefined && c.alpha < 1 ? formatHex8(c) : formatHex(c))!;
}

function rgbTuple(value: string): [number, number, number, number] {
  const c = toRgb(value);
  if (!c) throw new Error(`Could not parse colour: ${value}`);
  const b = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255);
  return [b(c.r), b(c.g), b(c.b), Math.round((c.alpha ?? 1) * 255)];
}

const cssName = (key: string) => key.replace(/\./g, "-");

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const flat = flatten(loadAll());
const R = resolve(flat);

const modeTokens: Record<string, Record<string, string>> = {};
for (const m of MODES) {
  const prefix = `semantic.${m.key}.`;
  modeTokens[m.key] = Object.fromEntries(
    Object.entries(R)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v.$value]),
  );
}

// --- Guards ------------------------------------------------------------------

const base = Object.keys(modeTokens.light!).sort();
for (const m of MODES) {
  const missing = SHADCN_CONTRACT.filter((n) => !(n in modeTokens[m.key]!));
  if (missing.length) {
    throw new Error(
      `Mode "${m.key}" does not satisfy the shadcn CSS variable contract.\n  missing: ${missing.join(", ")}`,
    );
  }
  const keys = Object.keys(modeTokens[m.key]!).sort();
  if (keys.join("|") !== base.join("|")) {
    const only = keys.filter((k) => !base.includes(k));
    const absent = base.filter((k) => !keys.includes(k));
    throw new Error(
      `Mode "${m.key}" is not in parity with light.\n` +
        (only.length ? `  extra: ${only.join(", ")}\n` : "") +
        (absent.length ? `  missing: ${absent.join(", ")}\n` : ""),
    );
  }
}

for (const s of MAP_SCHEMES) {
  for (const stop of RAMP_STOPS) {
    if (!R[`map.ramp.${s}.${stop}`]) throw new Error(`Map ramp incomplete: map.ramp.${s}.${stop}`);
  }
}

mkdirSync(DIST, { recursive: true });

// --- 1. theme.css -------------------------------------------------------------

const NON_COLOR = ["radius.", "spacing.", "motion.", "font.", "component."];
// Map to the resolved $value, not the token object. Interpolating the Leaf
// directly emits "[object Object]" for every radius/spacing/motion/font var,
// which silently drops the whole type scale to a browser default.
const nonColor: Array<[string, string]> = Object.entries(R)
  .filter(([k]) => NON_COLOR.some((p) => k.startsWith(p)))
  .map(([k, v]) => [k, v.$value]);

/**
 * Brand colours, emitted on :root only.
 *
 * They do not vary by theme: the logo is the same magenta in light, dark and
 * every white-label mode, so putting them in the per-mode blocks would imply a
 * choice that does not exist.
 */
const brandColors: Array<[string, string]> = Object.entries(R)
  .filter(([k]) => k.startsWith("brand."))
  .map(([k, v]) => [k, v.$value as string]);

const decls = (entries: Iterable<readonly [string, string]>) =>
  [...entries].map(([k, v]) => `  --${cssName(k)}: ${v};`).join("\n");

const themeCss = `/* GENERATED by @vianova/tokens -- do not edit by hand.
 * Semantic values imported from the Figma library.
 *
 * This file does NOT import tailwindcss. The consuming app must do that BEFORE
 * importing this file. @vianova/tokens has no tailwindcss dependency, so a
 * nested @import here resolves from packages/tokens/dist and fails -- it only
 * appeared to work when the dev server happened to run with cwd=apps/www.
 */
@custom-variant dark (&:is(.dark *));

${MODES.map(
  (m) => `${m.selector} {
${decls(Object.entries(modeTokens[m.key]!))}${
      m.key === "light"
        ? `\n\n${decls(nonColor)}\n\n${decls(brandColors)}\n\n` +
          `  /* Default map ramp. Emitted on :root so --map-ramp-* always\n` +
          `     resolves; the [data-map-scheme] blocks below only override it.\n` +
          `     Without this, any consumer that has not set the attribute gets\n` +
          `     undefined custom properties and renders colourless swatches. */\n` +
          RAMP_STOPS.map(
            (st) => `  --map-ramp-${st}: ${R[`map.ramp.${DEFAULT_MAP_SCHEME}.${st}`]!.$value};`,
          ).join("\n") +
          `\n  --map-layer-color: ${R[`map.layer-color.${DEFAULT_MAP_SCHEME}`]!.$value};`
        : ""
    }
}`,
).join("\n\n")}

${MAP_SCHEMES.map(
  (s) => `[data-map-scheme="${s}"] {
${RAMP_STOPS.map((st) => `  --map-ramp-${st}: ${R[`map.ramp.${s}.${st}`]!.$value};`).join("\n")}
  --map-layer-color: ${R[`map.layer-color.${s}`]!.$value};
}`,
).join("\n\n")}

/*
 * The "inline" keyword is load-bearing. Without it Tailwind snapshots the
 * :root value at build time and the theme overrides silently stop applying.
 */
@theme inline {
${base.map((n) => `  --color-${n}: var(--${n});`).join("\n")}

  --font-sans: var(--font-family-sans);
  --font-mono: var(--font-family-mono);

/* Brand colours as utilities (bg-brand-teal, text-brand-magenta). Brand
 * expression only -- the semantic roles above are what product UI uses. */
${brandColors.map(([k]) => `  --color-${cssName(k)}: var(--${cssName(k)});`).join("\n")}

/*
 * Type scale into Tailwind's own --text-* namespace, so text-xxs exists as a
 * utility rather than only as a variable nobody can spend. The steps from xs
 * up match Tailwind's defaults, so remapping them changes nothing except which
 * file is the source of truth; xxs is the one that is genuinely ours.
 */
${Object.keys(R)
  .filter((k) => k.startsWith("font.size."))
  .map((k) => k.replace("font.size.", ""))
  .map((n) => `  --text-${n}: var(--font-size-${n});`)
  .join("\n")}

  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
}
`;
// Nothing may serialise to "[object Object]" -- that is what happens when a
// token object is interpolated instead of its $value, and it fails silently in
// the browser rather than at build time.
if (themeCss.includes("[object Object]")) {
  const bad = themeCss
    .split("\n")
    .filter((l) => l.includes("[object Object]"))
    .slice(0, 5);
  throw new Error(
    `theme.css contains unserialised token objects:\n${bad.join("\n")}`,
  );
}

writeFileSync(join(DIST, "theme.css"), themeCss);

// --- 2. tokens.js / .d.ts ------------------------------------------------------

const mapRamps = Object.fromEntries(
  MAP_SCHEMES.map((s) => [s, RAMP_STOPS.map((st) => rgbTuple(R[`map.ramp.${s}.${st}`]!.$value))]),
);
const mapRampsHex = Object.fromEntries(
  MAP_SCHEMES.map((s) => [s, RAMP_STOPS.map((st) => hexOf(R[`map.ramp.${s}.${st}`]!.$value))]),
);

writeFileSync(
  join(DIST, "tokens.js"),
  `// GENERATED by @vianova/tokens -- do not edit by hand.
export const themes = ${JSON.stringify(modeTokens, null, 2)};

${MODES.map((m) => `export const ${m.key} = themes.${m.key};`).join("\n")}

/**
 * Map ramps as [r,g,b,a] byte tuples. deck.gl's getFillColor cannot resolve
 * CSS custom properties, so this is required, not a convenience.
 */
export const mapRamps = ${JSON.stringify(mapRamps, null, 2)};
export const mapRampsHex = ${JSON.stringify(mapRampsHex, null, 2)};
export const mapSchemes = ${JSON.stringify(MAP_SCHEMES)};
export const themeNames = ${JSON.stringify(MODES.map((m) => m.key))};
`,
);

writeFileSync(
  join(DIST, "tokens.d.ts"),
  `// GENERATED by @vianova/tokens -- do not edit by hand.
export type ThemeName = ${MODES.map((m) => `"${m.key}"`).join(" | ")};
export type MapScheme = ${MAP_SCHEMES.map((s) => `"${s}"`).join(" | ")};
export type SemanticToken =
  | ${base.map((k) => `"${k}"`).join("\n  | ")};
export type Rgba = [number, number, number, number];

export declare const themes: Record<ThemeName, Record<SemanticToken, string>>;
${MODES.map((m) => `export declare const ${m.key}: Record<SemanticToken, string>;`).join("\n")}
export declare const mapRamps: Record<MapScheme, Rgba[]>;
export declare const mapRampsHex: Record<MapScheme, string[]>;
export declare const mapSchemes: readonly MapScheme[];
export declare const themeNames: readonly ThemeName[];
`,
);

// --- 3. figma.variables.json ---------------------------------------------------

const figma = {
  $comment:
    "Payload for the Figma Variables API / plugin. Mirrors the Figma library's collection and mode structure so the two can be diffed.",
  collections: [
    {
      name: "Tailwind",
      modes: ["Mode 1"],
      hidden: true,
      variables: Object.entries(R)
        .filter(([k]) => k.startsWith("tw."))
        .map(([k, v]) => ({
          name: k.replace(/^tw\./, "tw/").replace(/\./g, "/"),
          type: "COLOR",
          scopes: [],
          values: { "Mode 1": hexOf(v.$value) },
        })),
    },
    {
      name: "Semantic",
      modes: MODES.map((m) => m.figmaMode),
      variables: base.map((name) => {
        const ext = flat[`semantic.light.${name}`]?.$extensions?.["io.vianova.tokens"];
        return {
          name: (ext?.figma as string | null) ?? `extensions/${name}`,
          codeOnly: !ext?.figma,
          type: "COLOR",
          codeSyntax: { WEB: `var(--${name})` },
          values: Object.fromEntries(
            MODES.map((m) => [m.figmaMode, hexOf(modeTokens[m.key]![name]!)]),
          ),
        };
      }),
    },
    {
      name: "Map data",
      modes: ["Brand", "Warm", "Viridis", "Blue"],
      variables: [
        {
          name: "map/layer-color",
          type: "COLOR",
          codeSyntax: { WEB: "var(--map-layer-color)" },
          values: Object.fromEntries(
            MAP_SCHEMES.map((s) => [
              s[0]!.toUpperCase() + s.slice(1),
              hexOf(R[`map.layer-color.${s}`]!.$value),
            ]),
          ),
        },
        ...RAMP_STOPS.map((stop) => ({
          name: `map/ramp/${stop}`,
          type: "COLOR",
          codeSyntax: { WEB: `var(--map-ramp-${stop})` },
          values: Object.fromEntries(
            MAP_SCHEMES.map((s) => [
              s[0]!.toUpperCase() + s.slice(1),
              hexOf(R[`map.ramp.${s}.${stop}`]!.$value),
            ]),
          ),
        })),
      ],
    },
  ],
};
writeFileSync(join(DIST, "figma.variables.json"), JSON.stringify(figma, null, 2) + "\n");

// --- 4. registry-theme.json ----------------------------------------------------

writeFileSync(
  join(DIST, "registry-theme.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: "vianova-theme",
      type: "registry:theme",
      title: "Vianova",
      description:
        "Vianova brand theme imported from the Figma library. Light and dark; the Stone, Slate, Fuchsia and Gray variants ship as data-theme blocks.",
      cssVars: {
        theme: {
          "font-sans": R["font.family.sans"]!.$value,
          "font-mono": R["font.family.mono"]!.$value,
        },
        light: modeTokens.light,
        dark: modeTokens.dark,
      },
    },
    null,
    2,
  ) + "\n",
);

// --- 5. tokens.json ------------------------------------------------------------

writeFileSync(
  join(DIST, "tokens.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(R).map(([k, v]) => [
        k,
        {
          value: v.$value,
          type: v.$type,
          cssVar: `--${cssName(k)}`,
          // Carried through so the docs can state a token's intent. A scale of
          // eleven sizes with no guidance on which to use is a list, not a
          // design decision.
          ...(v.$description ? { description: v.$description } : {}),
          ...(v.$extensions?.["io.vianova.tokens"]?.figma !== undefined
            ? {
                figma: v.$extensions["io.vianova.tokens"].figma,
                preset: v.$extensions["io.vianova.tokens"].preset ?? null,
                a11yFix: v.$extensions["io.vianova.tokens"].a11yFix ?? false,
                aliasOf: v.$extensions["io.vianova.tokens"].aliasOf ?? null,
              }
            : {}),
        },
      ]),
    ),
    null,
    2,
  ) + "\n",
);

// ---------------------------------------------------------------------------

const ext = (n: string) => flat[`semantic.light.${n}`]?.$extensions?.["io.vianova.tokens"];
const a11yFixed = base.filter((n) => ext(n)?.a11yFix);
const fromFigma = base.filter((n) => ext(n)?.figma && !ext(n)?.a11yFix);
const fromPreset = base.filter((n) => !ext(n)?.figma && ext(n)?.preset && !ext(n)?.a11yFix);
const codeOnly = base.filter((n) => !ext(n)?.figma && !ext(n)?.preset && !ext(n)?.a11yFix);

console.log(`Built ${Object.keys(R).length} tokens ->`);
for (const f of ["theme.css", "tokens.js", "tokens.d.ts", "figma.variables.json", "registry-theme.json", "tokens.json"]) {
  console.log(`  dist/${f}`);
}
console.log(`  ${base.length} semantic tokens x ${MODES.length} modes (${MODES.map((m) => m.key).join(", ")})`);
console.log(`  ${MAP_SCHEMES.length} map schemes x ${RAMP_STOPS.length} stops`);
console.log(
  `  provenance: ${fromFigma.length} Figma, ${fromPreset.length} shadcn preset, ${codeOnly.length} code-only`,
);
