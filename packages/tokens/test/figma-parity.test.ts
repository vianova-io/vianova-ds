import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { converter, formatHex, formatHex8 } from "culori";

import { themes, mapRampsHex } from "../dist/tokens.js";
import { provenanceOf, type Provenance } from "./provenance.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GT = JSON.parse(readFileSync(join(ROOT, "figma-ground-truth.json"), "utf8"));
const TOKENS = JSON.parse(readFileSync(join(ROOT, "dist", "tokens.json"), "utf8"));

const toRgb = converter("rgb");
const hex = (v: string) => {
  const c = toRgb(v)!;
  return (c.alpha !== undefined && c.alpha < 1 ? formatHex8(c) : formatHex(c))!.toLowerCase();
};

const MODES = ["light", "dark", "darkStone", "darkSlate", "fuchsia", "gray"] as const;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Independently recomputes what each Figma-sourced token SHOULD resolve to,
 * straight from the extract, and compares against the built output. This is the
 * check that would have caught the original defect -- a token set built on
 * #5E59E8 when the design file says #0f766e.
 */
function expected(raw: string, modeIndex: number): string {
  if (raw.startsWith("@")) {
    const [, key, alpha] = raw.match(/^@(\w+)\/(\w+)$/)!;
    const baseName = { fg: "text/foreground", mfg: "text/muted-foreground", muted: "surface/muted" }[key!]!;
    const baseRow = (GT.semantic as string[][]).find((r) => r[0] === baseName)!;
    return expected(baseRow[modeIndex + 1]!, modeIndex) + alpha;
  }
  const [family, step] = raw.split("/") as [string, string];
  const fam = GT.palette[family];
  if (typeof fam === "string") return fam.toLowerCase();
  return (fam as string[])[STEPS.indexOf(Number(step))]!.toLowerCase();
}

/** Figma semantic path -> the CSS name the build assigns it. */
const CSS_NAME: Record<string, string> = {
  "surface/background": "background", "text/foreground": "foreground",
  "surface/card": "card", "text/card-foreground": "card-foreground",
  "surface/popover": "popover", "text/popover-foreground": "popover-foreground",
  "action/primary": "primary", "action/primary-foreground": "primary-foreground",
  "action/secondary": "secondary", "action/secondary-foreground": "secondary-foreground",
  "surface/muted": "muted", "text/muted-foreground": "muted-foreground",
  "surface/accent": "accent", "text/accent-foreground": "accent-foreground",
  "feedback/destructive": "destructive", "feedback/destructive-foreground": "destructive-foreground",
  "border/border": "border", "border/input": "input", "border/ring": "ring",
};
const cssNameFor = (p: string) => {
  if (CSS_NAME[p]) return CSS_NAME[p]!;
  const [group, leaf] = p.split("/") as [string, string];
  return group === "syntax" ? `syntax-${leaf}` : leaf;
};

test("every still-Figma-sourced token matches the Figma library in all six modes", () => {
  // Tokens the shadcn preset overlaid are deliberately no longer Figma's, so
  // they are skipped here rather than asserted against a value we chose to
  // replace. provenanceOf is the single source of that decision.
  const failures: string[] = [];
  for (const row of GT.semantic as string[][]) {
    const name = cssNameFor(row[0]!);
    if (provenanceOf(name) !== "figma") continue;
    MODES.forEach((mode, i) => {
      // Checked per mode, not once: primary is re-picked only in the dark
      // themes, so a light-only check would skip nothing and then fail on dark.
      if (TOKENS[`semantic.${mode}.${name}`]?.a11yFix) return;
      const got = hex(themes[mode][name as keyof (typeof themes)[typeof mode]]!);
      const want = expected(row[i + 1]!, i);
      if (got !== want) failures.push(`  ${row[0]} [${mode}] got ${got}, Figma says ${want}`);
    });
  }
  assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
});

test("the brand primary is teal, not the map layer purple", () => {
  // Regression guard for the original mistake: #5E59E8 is map/layer-color in the
  // Brand scheme, NOT action/primary.
  assert.equal(hex(themes.light.primary), "#0f766e", "light keeps Figma's teal-700");
  // Dark uses a lighter teal on purpose: Figma reuses the light-mode teal in
  // dark, where it is only 3.63:1 as link text. Still teal, still not purple.
  assert.equal(hex(themes.dark.primary), "#2dd4bf");
  for (const m of MODES) assert.notEqual(hex(themes[m].primary), "#5e59e8");
});

test("white-label themes keep their distinct brand colours", () => {
  // Fuchsia stays fuchsia and Gray stays teal; only the step moved, to clear AA.
  assert.equal(hex(themes.fuchsia.primary), "#e879f9", "Fuchsia should be fuchsia-400");
  assert.equal(hex(themes.gray.primary), "#5eead4", "Gray should be teal-300");
  assert.equal(hex(themes.gray.background), "#1f2937", "Gray should sit on gray-800");
  assert.equal(hex(themes.darkStone.background), "#292524", "Dark Stone should use the stone ramp");
  assert.equal(hex(themes.darkSlate.background), "#1e293b", "Dark Slate should use the slate ramp");
});

test("map ramps match the Figma library exactly", () => {
  for (const [scheme, stops] of Object.entries(GT.mapRamps as Record<string, string[]>)) {
    assert.deepEqual(
      mapRampsHex[scheme as keyof typeof mapRampsHex].map((h) => h.toLowerCase()),
      stops.map((s) => s.toLowerCase()),
      `map ramp "${scheme}" drifted from Figma`,
    );
  }
});

test("the Tailwind primitive tier matches the imported palette", () => {
  const failures: string[] = [];
  for (const [family, value] of Object.entries(GT.palette as Record<string, unknown>)) {
    if (typeof value === "string") {
      const got = TOKENS[`tw.${family}`]?.value;
      if (!got || hex(got) !== value.toLowerCase()) failures.push(`  tw.${family}`);
      continue;
    }
    (value as string[]).forEach((want, i) => {
      const key = `tw.${family}.${STEPS[i]}`;
      const got = TOKENS[key]?.value;
      if (!got || hex(got) !== want.toLowerCase()) failures.push(`  ${key}: ${got} != ${want}`);
    });
  }
  assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
});

test("token provenance is labelled correctly across all four sources", () => {
  // Drift detection depends on this: a wrong label means an upstream defect
  // gets blamed on us, or one of our bugs gets waved through as inherited.
  const expected: Record<string, Provenance> = {
    // Kept from Figma on purpose -- the preset would have made these zinc-900.
    primary: "figma",
    "primary-foreground": "figma",
    "sidebar-primary": "figma", // aliases primary
    warning: "figma",
    "data-accent": "figma",
    // Overlaid by the shadcn preset.
    background: "preset",
    foreground: "preset",
    border: "preset",
    // Re-picked by the accessibility layer: upstream's values failed AA, so
    // the defect surface is ours now even though figma/preset origin is kept.
    ring: "a11yFix",
    "chart-1": "a11yFix",
    "chart-5": "a11yFix",
    // Ours: not in Figma, not in the preset.
    origin: "code",
    destination: "code",
    success: "code",
    info: "code",
  };
  const wrong = Object.entries(expected)
    .map(([n, want]) => [n, want, provenanceOf(n)] as const)
    .filter(([, want, got]) => want !== got)
    .map(([n, want, got]) => `  ${n}: expected ${want}, got ${got}`);
  assert.equal(wrong.length, 0, `\n${wrong.join("\n")}\n`);
});

test("the Vianova primary survived the preset overlay", () => {
  // The preset's primary is a near-black zinc. Every theme must still be teal
  // (or Fuchsia's accent) rather than a neutral.
  assert.equal(hex(themes.light.primary), "#0f766e");
  assert.equal(hex(themes.light["sidebar-primary"]), "#0f766e");
  assert.notEqual(hex(themes.light.primary), "#18181b");
  assert.notEqual(hex(themes.dark.primary), "#e4e4e7");
});
