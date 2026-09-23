/**
 * Converts the read-only the Figma library extract into DTCG token sources.
 *
 * Run with `pnpm --filter @vianova/tokens import`. Like the seeder, this is a
 * bootstrap step, not part of `build`. Re-run it only after re-capturing
 * figma-ground-truth.json from Figma.
 *
 * The naming decision that matters: Figma groups semantic tokens by role
 * (`surface/background`), but shadcn's CSS variable contract is flat
 * (`--background`) and is NOT negotiable -- rename it and `shadcn add` of any
 * upstream component stops being themeable. So each token carries BOTH: the
 * Figma path for library parity, and the shadcn CSS name for the stylesheet.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const GT = JSON.parse(readFileSync(join(ROOT, "figma-ground-truth.json"), "utf8"));
const PRESET = JSON.parse(readFileSync(join(ROOT, "preset-b5cRaL9Zg.json"), "utf8"));

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const MODES = ["light", "dark", "darkStone", "darkSlate", "fuchsia", "gray"] as const;

/** Figma semantic path -> shadcn CSS variable name. */
const SHADCN_NAME: Record<string, string> = {
  "surface/background": "background",
  "text/foreground": "foreground",
  "surface/card": "card",
  "text/card-foreground": "card-foreground",
  "surface/popover": "popover",
  "text/popover-foreground": "popover-foreground",
  "action/primary": "primary",
  "action/primary-foreground": "primary-foreground",
  "action/secondary": "secondary",
  "action/secondary-foreground": "secondary-foreground",
  "surface/muted": "muted",
  "text/muted-foreground": "muted-foreground",
  "surface/accent": "accent",
  "text/accent-foreground": "accent-foreground",
  "feedback/destructive": "destructive",
  "feedback/destructive-foreground": "destructive-foreground",
  "border/border": "border",
  "border/input": "input",
  "border/ring": "ring",
};

/** Everything else keeps a flattened name derived from its Figma path. */
function cssNameFor(figmaPath: string): string {
  if (SHADCN_NAME[figmaPath]) return SHADCN_NAME[figmaPath]!;
  const [group, leaf] = figmaPath.split("/") as [string, string];
  // text/* and surface/* and feedback/* read fine unprefixed; syntax/* does not.
  return group === "syntax" ? `syntax-${leaf}` : leaf;
}

// --- Primitives --------------------------------------------------------------

const primitives: Record<string, unknown> = {};
for (const [family, value] of Object.entries(GT.palette)) {
  if (typeof value === "string") {
    primitives[family] = { $value: value, $type: "color" };
  } else {
    const ramp: Record<string, unknown> = {};
    (value as string[]).forEach((hex, i) => {
      ramp[String(STEPS[i])] = { $value: hex, $type: "color" };
    });
    primitives[family] = ramp;
  }
}

// --- Semantic ----------------------------------------------------------------

/**
 * `@fg/cc` means "the mode's own foreground at alpha cc". Figma stores these as
 * literal colours rather than aliases, so they are expanded here against the
 * base token of the same mode -- which keeps the six themes correct without
 * hand-writing 30 alpha values per mode.
 */
const ALPHA_BASE: Record<string, string> = { fg: "text/foreground", mfg: "text/muted-foreground", muted: "surface/muted" };

const rows: string[][] = GT.semantic;
const byName = new Map(rows.map((r) => [r[0]!, r]));

function refFor(row: string[], modeIndex: number): string {
  const raw = row[modeIndex + 1]!;
  if (!raw.startsWith("@")) return `{tw.${raw.replace("/", ".")}}`;
  const [, key, alpha] = raw.match(/^@(\w+)\/(\w+)$/)!;
  const baseRow = byName.get(ALPHA_BASE[key!]!)!;
  const baseRaw = baseRow[modeIndex + 1]!;
  return `{tw.${baseRaw.replace("/", ".")}}${alpha}`;
}

const semantic: Record<string, Record<string, unknown>> = {};
for (const mode of MODES) semantic[mode] = {};

rows.forEach((row) => {
  const figmaPath = row[0]!;
  const name = cssNameFor(figmaPath);
  MODES.forEach((mode, i) => {
    semantic[mode]![name] = {
      $value: refFor(row, i),
      $type: "color",
      $extensions: { "io.vianova.tokens": { figma: figmaPath, cssVar: `--${name}` } },
    };
  });
});

// --- Code-only extensions ----------------------------------------------------

/**
 * Tokens the components need that the Figma library does NOT define. Kept in a
 * separate file, and every one is stamped `figma: null`, so the drift checker
 * can tell "we invented this" apart from "this came from the library".
 *
 * These are the candidates to push INTO Figma when the library is created --
 * at which point they should move into color.tokens.json and lose the flag.
 */
const NEUTRAL_OF: Record<string, string> = {
  light: "zinc",
  dark: "zinc",
  darkStone: "stone",
  darkSlate: "slate",
  fuchsia: "zinc",
  gray: "gray",
};
const IS_LIGHT = (m: string) => m === "light";

/**
 * Categorical chart palettes, chosen by exhaustively searching the Tailwind
 * palette against three constraints simultaneously: >=3:1 against that mode's
 * own background, CIEDE2000 >=20 between every pair, and >=12 under BOTH
 * deuteranopia and protanopia simulation. Picking these by eye does not work --
 * the obvious teal/violet/amber/rose/sky set collapses under deuteranopia.
 *
 * Light needs mixed steps; no single-step combination satisfies all three.
 */
const CHARTS: Record<string, string[]> = {
  light: ["emerald.600", "fuchsia.500", "amber.600", "sky.800", "rose.800"],
  dark: ["green.400", "pink.400", "orange.400", "sky.400", "yellow.400"],
  darkStone: ["green.400", "pink.400", "orange.400", "sky.400", "yellow.400"],
  darkSlate: ["emerald.500", "pink.500", "orange.500", "sky.500", "yellow.500"],
  fuchsia: ["green.400", "pink.400", "orange.400", "sky.400", "yellow.400"],
  gray: ["emerald.500", "pink.500", "orange.500", "sky.500", "yellow.500"],
};

const extensions: Record<string, Record<string, unknown>> = {};
for (const mode of MODES) {
  const n = NEUTRAL_OF[mode]!;
  const lite = IS_LIGHT(mode);
  const on = lite ? "{tw.zinc.50}" : "{tw.zinc.950}";
  const pair = (base: string, lightStep: number, darkStep: number) =>
    `{tw.${base}.${lite ? lightStep : darkStep}}`;

  extensions[mode] = {
    // Light steps are 700, not 600: at 600 the white foreground only reaches
    // 3.16:1 and 3.05:1, which fails AA for normal text.
    success: pair("green", 700, 400),
    "success-foreground": on,
    info: pair("sky", 700, 400),
    "info-foreground": on,

    "surface-raised": lite ? "{tw.white}" : `{tw.${n}.700}`,
    "surface-sunken": lite ? `{tw.${n}.100}` : `{tw.${n}.900}`,
    overlay: "{tw.black}a6",

    // OD roles. Colour IS the role on a map, so these must stay distinct from
    // primary and from each other in every theme.
    origin: pair("teal", 700, 400),
    "origin-foreground": on,
    destination: pair("amber", 700, 400),
    "destination-foreground": on,
    selected: `{semantic.${mode}.primary}`,
    dimmed: pair(n, 400, 600),

    // shadcn's sidebar contract, mapped onto the imported semantic tier.
    sidebar: `{semantic.${mode}.card}`,
    "sidebar-foreground": `{semantic.${mode}.foreground}`,
    "sidebar-primary": `{semantic.${mode}.primary}`,
    "sidebar-primary-foreground": `{semantic.${mode}.primary-foreground}`,
    "sidebar-accent": `{semantic.${mode}.accent}`,
    "sidebar-accent-foreground": `{semantic.${mode}.accent-foreground}`,
    "sidebar-border": `{semantic.${mode}.border}`,
    "sidebar-ring": `{semantic.${mode}.ring}`,

    ...Object.fromEntries(
      CHARTS[mode]!.map((ref, i) => [`chart-${i + 1}`, `{tw.${ref}}`]),
    ),
  };
}

for (const mode of MODES) {
  for (const [name, value] of Object.entries(extensions[mode]!)) {
    // A code-only token that is a pure alias of an imported one inherits that
    // token's provenance. Without recording this, the contrast test blames us
    // for e.g. sidebar-primary, which is just action/primary under another name.
    const alias = String(value).match(/^\{semantic\.\w+\.([a-z0-9-]+)\}$/);
    extensions[mode]![name] = {
      $value: value,
      $type: "color",
      $extensions: {
        "io.vianova.tokens": {
          figma: null,
          aliasOf: alias ? alias[1] : null,
          cssVar: `--${name}`,
        },
      },
    };
  }
}

// --- shadcn preset overlay ---------------------------------------------------

/**
 * Overlay the shadcn preset (b5cRaL9Zg: base-nova / zinc / teal) onto the LIGHT
 * and DARK modes.
 *
 * Everything the preset defines wins EXCEPT `primary` and `primary-foreground`.
 * The preset's primary is a near-black zinc-900; the Figma library says the Vianova
 * primary is teal #0f766e, and that is the deliberate brand decision, so it is
 * preserved here. `sidebar-primary` follows because it aliases `primary`.
 *
 * The four extra dark modes (Stone, Slate, Fuchsia, Gray) are NOT overlaid --
 * they are distinct customer themes with their own neutral families and
 * primaries, and the preset has no equivalent.
 */
const PRESET_KEEP_FROM_FIGMA = new Set([
  "primary",
  "primary-foreground",
  // These alias primary. Letting the preset overwrite them with its literal
  // zinc-900 would silently desync the sidebar from the brand colour.
  "sidebar-primary",
  "sidebar-primary-foreground",
]);

for (const mode of MODES) {
  // Light/dark take the preset wholesale. The four white-label themes keep
  // their own neutrals and primaries, but DO take the preset's chart ramp --
  // otherwise charts would be monochrome teal on Vianova and categorical on
  // Fuchsia, which is incoherent for the same product.
  const isBase = mode === "light" || mode === "dark";
  const presetMode = isBase ? mode : (mode === "light" ? "light" : "dark");
  for (const [name, value] of Object.entries(PRESET[presetMode] as Record<string, string>)) {
    if (!isBase && !name.startsWith("chart-")) continue;
    if (name === "radius") continue; // handled in the foundations tier
    if (PRESET_KEEP_FROM_FIGMA.has(name)) continue;

    const target = semantic[mode]![name] ? semantic[mode]! : extensions[mode]!;
    if (!target[name]) continue; // preset key we do not model; skip rather than invent

    const prev = (target[name] as any).$extensions?.["io.vianova.tokens"] ?? {};
    target[name] = {
      $value: value,
      $type: "color",
      $extensions: {
        "io.vianova.tokens": {
          ...prev,
          figma: null,
          preset: PRESET.code,
          cssVar: `--${name}`,
        },
      },
    };
  }
}

// --- Accessibility overrides -------------------------------------------------

/**
 * Deliberate divergences from Figma and the shadcn preset, each one fixing a
 * WCAG AA failure that the upstream value cannot satisfy.
 *
 * Stamped `a11yFix` so provenance stays honest: these are neither Figma's nor
 * the preset's values, and the design file should be updated to match.
 *
 * Chosen by rule, not by "nearest colour that passes" — that search produced
 * things like a dark red foreground becoming cyan-950. The rules are: prefer a
 * step within the same family so hue intent survives; where a foreground sits
 * on a saturated fill, flip it to the opposite end rather than shift its hue;
 * and re-range the chart scale as a whole instead of nudging single stops,
 * which would collapse neighbours onto the same colour.
 */

/**
 * A monochromatic sequential ramp cannot clear 3:1 at both ends — its light end
 * disappears on white and its dark end on black. Each scheme therefore uses the
 * sub-range of teal that stays above the threshold on its own background, which
 * keeps the ramp monotonic and readable.
 */
const CHART_RANGE: Record<string, number[]> = {
  light: [600, 700, 800, 900, 950],
  dark: [200, 300, 400, 500, 600],
  darkStone: [200, 300, 400, 500, 600],
  darkSlate: [200, 300, 400, 500, 600],
  fuchsia: [200, 300, 400, 500, 600],
  gray: [200, 300, 400, 500, 600],
};

/**
 * The field border is a DELIBERATE, documented departure from WCAG 1.4.11.
 *
 * These are shadcn's own neutral values, 1.27:1 in light and 1.47:1 in dark,
 * chosen after seeing the alternatives side by side: a stroke that clears 3:1
 * turns every field into an outlined box, which is not the visual language
 * this product wants. The intermediate steps were worse than either end --
 * they take the same standards hit for less of the payoff.
 *
 * What makes that trade defensible is that 1.4.11 asks for the information
 * REQUIRED TO IDENTIFY a control to be visible, not for every border to be
 * 3:1. So identification is carried by two things that ARE held to the bar,
 * and the contrast test enforces both rather than the resting stroke:
 *
 *   - the focus ring, which clears 3:1 on background, card and popover in all
 *     six modes (3.67:1 at worst, dark on card)
 *   - the field's own surface, `dark:bg-input/30`, which stays 2.4-3.1 dE2000
 *     off the page behind it
 *
 * The gap that leaves, stated rather than hidden: in LIGHT mode the field has
 * no fill at all (`bg-transparent`), so at rest it is identified by its label
 * and this 1.27:1 stroke alone. Giving light fields a tint the way dark ones
 * have one would close it.
 */
const INPUT_DARK = "oklch(1 0 0 / 15%)";

const A11Y_OVERRIDES: Record<string, Record<string, string>> = {
  light: {
    // 4.39:1 on muted; one step darker clears it.
    "muted-foreground": "{tw.zinc.600}",
    // 1.27:1. See INPUT_DARK above for why this one is chosen, not inherited.
    input: "{tw.zinc.200}",
    // 2.6:1 — a focus ring is the one thing a keyboard user must be able to
    // see, and now the thing that identifies the field at all. Deliberately
    // NOT softened alongside the border.
    ring: "{tw.zinc.500}",
  },
  dark: {
    // Figma reuses the light-mode teal-700 in dark, so primary was 3.63:1 as
    // link text. Going lighter fixes that AND the white-on-primary pair, and
    // matches how the preset and the HERE theme treat dark primaries.
    primary: "{tw.teal.400}",
    "primary-foreground": "{tw.zinc.950}",
    // The preset's dark destructive is a bright red; light grey on it was
    // 1.94:1. The foreground flips rather than the fill.
    "destructive-foreground": "{tw.zinc.950}",
    input: INPUT_DARK,
  },
  darkStone: {
    primary: "{tw.teal.400}",
    "primary-foreground": "{tw.zinc.950}",
    "muted-foreground": "{tw.stone.300}",
    input: INPUT_DARK,
  },
  darkSlate: {
    primary: "{tw.teal.400}",
    "primary-foreground": "{tw.zinc.950}",
    "muted-foreground": "{tw.slate.300}",
    input: INPUT_DARK,
  },
  fuchsia: {
    // The fuchsia theme's fuchsia-500 was 4.31:1 as text and only 2.34:1 under light grey.
    primary: "{tw.fuchsia.400}",
    "primary-foreground": "{tw.zinc.950}",
    "muted-foreground": "{tw.zinc.300}",
    input: INPUT_DARK,
  },
  gray: {
    "muted-foreground": "{tw.gray.300}",
    input: INPUT_DARK,
  },
};

/**
 * Which semantic tokens are "<base> at alpha xx", by base css name.
 *
 * `muted-foreground-60` is expanded from Figma's literal at import time, so
 * re-picking `muted-foreground` below would otherwise leave the -80/-60/-40
 * variants pointing at the colour we just rejected -- three tokens whose names
 * promise a relationship they no longer have.
 */
const ALPHA_DEPENDENTS: Record<string, { name: string; alpha: string }[]> = {};
rows.forEach((row) => {
  const raw = row[1];
  const m = raw?.match(/^@(\w+)\/(\w+)$/);
  if (!m) return;
  const base = cssNameFor(ALPHA_BASE[m[1]!]!);
  (ALPHA_DEPENDENTS[base] ??= []).push({ name: cssNameFor(row[0]!), alpha: m[2]! });
});

for (const mode of MODES) {
  const overrides = { ...(A11Y_OVERRIDES[mode] ?? {}) };
  CHART_RANGE[mode]?.forEach((step, i) => {
    overrides[`chart-${i + 1}`] = `{tw.teal.${step}}`;
  });

  for (const [base, deps] of Object.entries(ALPHA_DEPENDENTS)) {
    const rebased = overrides[base];
    if (rebased) for (const d of deps) overrides[d.name] = `${rebased}${d.alpha}`;
  }

  for (const [name, value] of Object.entries(overrides)) {
    const target = semantic[mode]![name] ? semantic[mode]! : extensions[mode]!;
    if (!target[name]) continue;
    const prev = (target[name] as any).$extensions?.["io.vianova.tokens"] ?? {};
    target[name] = {
      $value: value,
      $type: "color",
      $extensions: {
        "io.vianova.tokens": { ...prev, a11yFix: true, cssVar: `--${name}` },
      },
    };
  }
}

// --- Foundations / component / map -------------------------------------------

const px = (n: number) => ({ $value: `${n}px`, $type: "dimension" });
const rem = (n: number) => ({ $value: `${n / 16}rem`, $type: "dimension" });

const foundations = {
  $description: "Imported from the Figma library's Foundations collection.",
  /**
   * Radius comes from the shadcn preset, not Figma: the preset sets a single
   * --radius (0.625rem) and nova derives the scale from it. Figma's absolute
   * 4/6/8/12 values are superseded so components pulled from the shadcn
   * registry match the docs site they are shown in.
   */
  radius: {
    DEFAULT: { $value: PRESET.light.radius as string, $type: "dimension" },
    sm: { $value: `calc(${PRESET.light.radius} - 4px)`, $type: "dimension" },
    md: { $value: `calc(${PRESET.light.radius} - 2px)`, $type: "dimension" },
    lg: { $value: PRESET.light.radius as string, $type: "dimension" },
    xl: { $value: `calc(${PRESET.light.radius} + 4px)`, $type: "dimension" },
    full: { $value: "9999px", $type: "dimension" },
  },
  spacing: Object.fromEntries(
    Object.entries(GT.foundations.spacing).map(([k, v]) => [k, rem(v as number)]),
  ),
  motion: {
    duration: Object.fromEntries(
      Object.entries(GT.foundations.motion.duration).map(([k, v]) => [
        k,
        { $value: `${v}ms`, $type: "duration" },
      ]),
    ),
    easing: Object.fromEntries(
      Object.entries(GT.foundations.motion.easing).map(([k, v]) => [
        k,
        { $value: v as string, $type: "cubicBezier" },
      ]),
    ),
  },
  font: {
    family: {
      sans: { $value: GT.foundations.fontFamily.sans, $type: "fontFamily" },
      mono: {
        $value: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
        $type: "fontFamily",
        $description:
          "CODE-ONLY: not in Figma. Geist Mono over JetBrains Mono for its disambiguated 0/1/l/I, which is what the mono is actually used for here -- hex codes, token names and commit SHAs at 11-13px, not long-form code.",
      },
    },
    weight: Object.fromEntries(
      Object.entries(GT.foundations.fontWeight).map(([k, v]) => [k, { $value: v, $type: "number" }]),
    ),
    /**
     * Type scale, read off the Figma library Foundations board.
     *
     * Matches Tailwind's default from `xs` up, so nothing here fights the
     * framework -- except `xxs`, which is Vianova's own and is the reason this
     * lives in tokens at all. A 10px step is indefensible for prose and
     * necessary for a dense grid's unit suffixes and metric labels.
     *
     * The descriptions are the design intent from the board, kept because a
     * bare list of sizes tells nobody which one to reach for.
     */
    size: Object.fromEntries(
      (
        [
          ["xxs", 10, "Dense labels, metric units"],
          ["xs", 12, "Captions, table cells"],
          ["sm", 14, "Body default in compact UI"],
          ["base", 16, "Body default in marketing"],
          ["lg", 18, "Lead paragraphs"],
          ["xl", 20, "Section subheads"],
          ["2xl", 24, "H4"],
          ["3xl", 30, "H3"],
          ["4xl", 36, "H2"],
          ["5xl", 48, "H1"],
          ["6xl", 60, "Hero headlines"],
        ] as const
      ).map(([name, px, usage]) => [
        name,
        { ...rem(px), $description: `${px}px — ${usage}` },
      ]),
    ),
  },
};

const flattenComponent = (obj: Record<string, unknown>, prefix: string[] = []): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") out[k] = px(v);
    else out[k] = flattenComponent(v as Record<string, unknown>, [...prefix, k]);
  }
  return out;
};

const component = {
  $description: "Imported from the Figma library's Component collection.",
  component: flattenComponent(GT.component),
};

const RAMP_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const map = {
  $description:
    "Imported from the Figma library's 'Map data' collection. A SECOND axis, independent of theme -- a user on the Gray theme can still pick Viridis.",
  map: {
    ramp: Object.fromEntries(
      Object.entries(GT.mapRamps).map(([scheme, stops]) => [
        scheme,
        Object.fromEntries(
          (stops as string[]).map((hex, i) => [String(RAMP_STOPS[i]), { $value: hex, $type: "color" }]),
        ),
      ]),
    ),
    "layer-color": Object.fromEntries(
      Object.entries(GT.mapLayerColor).map(([scheme, hex]) => [
        scheme,
        { $value: hex as string, $type: "color" },
      ]),
    ),
  },
};

// --- Write -------------------------------------------------------------------

// Remove the pre-Figma guesses so nothing stale survives the re-seed.
for (const stale of ["primitive/neutral.tokens.json", "primitive/accent.tokens.json", "semantic/color.light.tokens.json", "semantic/color.dark.tokens.json", "primitive/marketing.tokens.json", "semantic/foundation.tokens.json", "map/ramp.tokens.json", "component/component.tokens.json"]) {
  const p = join(SRC, stale);
  if (existsSync(p)) rmSync(p);
}

const write = (rel: string, body: unknown) => {
  const p = join(SRC, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(body, null, 2) + "\n");
  console.log(`  ${rel}`);
};

/**
 * The five brand colours, from the Figma library brand board.
 *
 * These are the logo gradient, not the product palette. They are deliberately
 * NOT wired into any semantic token: `primary` is teal-700, and if
 * `brand.red-pink` were reachable as a semantic role somebody would reasonably
 * reach for #FC0061 as a destructive colour, which is a brand mark rather than
 * a UI signal. Marketing surfaces and the logo use these; product UI does not.
 */
const BRAND: [string, string, string][] = [
  ["red-pink", "#FC0061", "Gradient start"],
  ["magenta", "#BA00C7", "Gradient"],
  ["violet", "#6000F3", "Gradient"],
  ["blue", "#004BD9", "Gradient"],
  ["teal", "#00DC96", "Gradient end"],
];

console.log("Importing Figma ground truth:");
write("primitive/brand.tokens.json", {
  $description:
    "Vianova brand colours from the Figma library brand board. Brand expression only -- see the note in scripts/import-figma.ts before reaching for these in product UI.",
  brand: Object.fromEntries(
    BRAND.map(([name, hex, role]) => [
      name,
      { $value: hex, $type: "color", $description: role },
    ]),
  ),
});
write("primitive/tailwind.tokens.json", {
  $description: "Tailwind palette, imported verbatim from the Figma library's 'Tailwind' collection. This is the primitive tier -- do not regenerate.",
  tw: primitives,
});
write("semantic/color.tokens.json", {
  $description:
    "Semantic colour across all six Figma library modes. Names are shadcn's CSS variable contract; each token records its Figma path in $extensions.",
  semantic: semantic,
});
write("semantic/extensions.tokens.json", {
  $description:
    "CODE-ONLY semantic tokens. These do NOT exist in the Figma library -- they are required by shadcn (sidebar-*, chart-*) or by the OD surfaces (origin/destination/selected/dimmed). Every entry is stamped figma:null. Push these into the Figma library and then fold them into color.tokens.json.",
  semantic: extensions,
});
write("semantic/foundation.tokens.json", foundations);
write("component/component.tokens.json", component);
write("map/ramp.tokens.json", map);

console.log(
  `\n${rows.length} semantic tokens x ${MODES.length} modes; ${Object.keys(GT.palette).length} primitive families.`,
);
