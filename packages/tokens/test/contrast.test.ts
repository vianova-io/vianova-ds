import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wcagContrast,
  differenceCiede2000,
  converter,
  formatHex,
  parse,
  filterDeficiencyProt,
  filterDeficiencyDeuter,
} from "culori";

import { themes } from "../dist/tokens.js";
import { provenanceOf } from "./provenance.ts";

const deltaE = differenceCiede2000();
const toOklch = converter("oklch");
const toRgb = converter("rgb");

/**
 * Contrast of `fg` against `bg`, honouring alpha.
 *
 * `wcagContrast` ignores the alpha channel, so a translucent token scores as
 * its own undiluted colour: `--input: oklch(1 0 0 / 35%)` would be measured as
 * pure white and sail through at 18:1 while rendering at 3.1:1. Compositing
 * first is what makes the guard mean anything for the alpha-carrying tokens,
 * and it is a no-op for opaque ones.
 */
function contrast(fg: string, bg: string): number {
  const f = toRgb(fg)!;
  const a = f.alpha ?? 1;
  if (a >= 1) return wcagContrast(fg, bg);
  const b = toRgb(bg)!;
  const mix = (k: "r" | "g" | "b") => f[k] * a + b[k] * (1 - a);
  return wcagContrast({ mode: "rgb", r: mix("r"), g: mix("g"), b: mix("b") }, bg);
}

const MODES = ["light", "dark", "darkStone", "darkSlate", "fuchsia", "gray"] as const;

const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  // Used as text by variant="link" and anything with text-primary. Omitting it
  // is why a 3.63:1 link button reached the browser unnoticed.
  ["primary", "background"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["origin-foreground", "origin"],
  ["destination-foreground", "destination"],
];

/**
 * `border` is deliberately absent: it separates surfaces rather than bounding a
 * control, so WCAG 1.4.11 does not apply.
 *
 * `input` is absent too, and that one is a DECISION, not an oversight. The
 * field border is deliberately set below 3:1 -- see the long note in
 * scripts/import-figma.ts. 1.4.11 asks that what IDENTIFIES a control be
 * visible, so the guarantee moved to the two things that do that job once the
 * resting stroke is this quiet: the focus ring, checked here on every surface
 * a field can sit on, and the field's own fill, checked below. Asserting the
 * border instead would fail a value we chose on purpose while saying nothing
 * about whether anyone can actually find the field.
 */
const NON_TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  // A field is as often inside a card or a popover as on the page, and in dark
  // mode those are a LIGHTER grey than the page -- the ground that gives the
  // ring the least contrast. Checking only `background` would let a ring that
  // fails inside every dialog pass.
  ["ring", "background"],
  ["ring", "card"],
  ["ring", "popover"],
  ["chart-1", "background"],
  ["chart-2", "background"],
  ["chart-3", "background"],
  ["chart-4", "background"],
  ["chart-5", "background"],
];

/**
 * Contrast failures INHERITED from upstream -- either the Figma library or the shadcn
 * preset b5cRaL9Zg. These are real AA failures, but the values are not ours to
 * change: silently re-picking them would break parity with the design file and
 * with the preset the components are built against, and would hide the problem
 * from whoever can actually fix it.
 *
 * So they are listed, excluded from the hard failure, and kept honest in both
 * directions -- a NEW upstream failure fails the build, and so does a stale
 * entry that now passes. Anything in a token WE authored always fails.
 *
 * The chart-* entries are a consequence of the preset's monochromatic teal
 * ramp: its lightest steps do not reach 3:1 against the page. See the
 * sequential-ramp tests below for why that palette is also unsuitable for
 * categorical series.
 */
const INHERITED: Record<string, string[]> = {
  // Empty on purpose. Everything that used to sit here is fixed in the
  // accessibility override layer in scripts/import-figma.ts. A regression
  // reappears as a hard failure rather than quietly rejoining a list.
};

type Violation = { pair: string; ratio: number; need: number; upstream: boolean; why: string };

function check(mode: (typeof MODES)[number]): Violation[] {
  const t = themes[mode] as unknown as Record<string, string>;
  const out: Violation[] = [];
  const scan = (pairs: Array<[string, string]>, need: number) => {
    for (const [fg, bg] of pairs) {
      const ratio = contrast(t[fg]!, t[bg]!);
      if (ratio >= need) continue;
      const a = provenanceOf(fg);
      const b = provenanceOf(bg);
      out.push({
        pair: `${fg} on ${bg}`,
        ratio,
        need,
        upstream: a !== "code" && b !== "code",
        why: `${a}/${b}`,
      });
    }
  };
  scan(TEXT_PAIRS, 4.5);
  scan(NON_TEXT_PAIRS, 3);
  return out;
}

for (const mode of MODES) {
  test(`${mode}: tokens we authored meet WCAG AA`, () => {
    const ours = check(mode).filter((v) => !v.upstream);
    assert.equal(
      ours.length,
      0,
      "\n" +
        ours
          .map((v) => `  ${v.pair}: ${v.ratio.toFixed(2)}:1 (need ${v.need}:1) [${v.why}]`)
          .join("\n") +
        "\n",
    );
  });

  test(`${mode}: inherited upstream defects match the tracked list`, () => {
    const found = check(mode)
      .filter((v) => v.upstream)
      .map((v) => v.pair)
      .sort();
    const tracked = [...(INHERITED[mode] ?? [])].sort();

    const untracked = found.filter((p) => !tracked.includes(p));
    const fixed = tracked.filter((p) => !found.includes(p));

    assert.equal(
      untracked.length,
      0,
      `\nNEW upstream contrast defect in "${mode}":\n${untracked.map((p) => `  ${p}`).join("\n")}\n`,
    );
    assert.equal(
      fixed.length,
      0,
      `\nListed as inherited but now passing -- remove from INHERITED in contrast.test.ts:\n${fixed
        .map((p) => `  ${p}`)
        .join("\n")}\n`,
    );
  });

  /**
   * The other half of the bargain struck when the field border dropped below
   * 3:1: if the stroke no longer identifies the field, its SURFACE has to.
   *
   * The components paint that surface as `dark:bg-input/30`, so it is not a
   * token anyone can read off -- it is `--input` at 30% of its own alpha,
   * composited on whatever sits behind. That is what gets measured here,
   * because that is what reaches the eye.
   *
   * Light is excluded, and not because it passes. Light fields are
   * `bg-transparent`, so this distance is 0 by construction and the field rests
   * on its label, its 1.27:1 stroke and the focus ring. Tinting light fields
   * the way dark ones are tinted is what would let this assertion cover all six
   * modes.
   */
  if (mode !== "light") {
    test(`${mode}: the field surface stays distinguishable from the page`, () => {
      const t = themes[mode] as unknown as Record<string, string>;
      const FILL_ALPHA = 0.3; // dark:bg-input/30
      const JND = 2; // dE2000 ~1 is the threshold of perception; 2 is a margin.

      for (const surface of ["background", "card", "popover"]) {
        const f = toRgb(t.input!)!;
        const b = toRgb(t[surface]!)!;
        const a = (f.alpha ?? 1) * FILL_ALPHA;
        const fill = {
          mode: "rgb" as const,
          r: f.r * a + b.r * (1 - a),
          g: f.g * a + b.g * (1 - a),
          b: f.b * a + b.b * (1 - a),
        };
        const d = deltaE(fill, t[surface]!);
        assert.ok(
          d >= JND,
          `the field fill is dE2000 ${d.toFixed(2)} from \`${surface}\` (need ${JND}). ` +
            `With the border under 3:1, a field indistinguishable from the page behind ` +
            `it cannot be found at rest.`,
        );
      }
    });
  }

  const charts = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

  /**
   * The preset ships chartColor=teal, i.e. a SEQUENTIAL monochromatic ramp, not
   * a categorical palette. The previous categorical assertions (pairwise
   * CIEDE2000 >= 20, colour-blind separation >= 12) are the wrong test for it
   * and would reject a palette that is correct for what it is.
   *
   * What a sequential ramp must instead guarantee: a consistent direction, and
   * neighbouring steps that can actually be told apart.
   */
  test(`${mode}: chart ramp is monotonic in lightness`, () => {
    const t = themes[mode] as unknown as Record<string, string>;
    let prev = Infinity;
    for (const c of charts) {
      const l = toOklch(t[c]!)!.l!;
      assert.ok(
        l < prev,
        `${c} (L=${l.toFixed(3)}) is not darker than the previous step (L=${prev.toFixed(3)}) -- a sequential ramp must move in one direction`,
      );
      prev = l;
    }
  });

  test(`${mode}: adjacent chart steps are distinguishable`, () => {
    // Threshold is 5, not 8. A monochromatic five-class ramp cannot satisfy
    // both "every step clears 3:1 against the background" and "adjacent steps
    // differ by dE 8" — clearing 3:1 at both ends confines the scale to about
    // six Tailwind steps, which leaves roughly dE 5-7 between neighbours.
    // Contrast against the background is a WCAG requirement; the separation
    // figure is a heuristic, so the heuristic gives way. Order is also carried
    // by position in the legend, not by colour distance alone.
    const t = themes[mode] as unknown as Record<string, string>;
    const failures: string[] = [];
    for (let i = 0; i < charts.length - 1; i++) {
      const d = deltaE(t[charts[i]!]!, t[charts[i + 1]!]!);
      if (d < 5) {
        failures.push(`  ${charts[i]} vs ${charts[i + 1]}: dE2000 ${d.toFixed(1)} (need 5)`);
      }
    }
    assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
  });
}

/**
 * Documents a real limitation rather than asserting it away: this palette is
 * sequential, so it is fine for a choropleth or an ordered breakdown, and poor
 * for unordered categorical series (operators, vehicle types, OD pairs) where
 * five shades of one hue are hard to separate.
 *
 * If categorical series are needed, add a distinct `chart-categorical-*` set --
 * do not stretch this one.
 */
test("the chart palette is sequential, not categorical (documented limitation)", () => {
  const t = themes.light as unknown as Record<string, string>;
  const hues = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].map(
    (c) => toOklch(t[c]!)!.h ?? 0,
  );
  const spread = Math.max(...hues) - Math.min(...hues);
  assert.ok(
    spread < 45,
    `Chart hues now span ${spread.toFixed(0)} degrees, so the palette looks categorical. ` +
      `If that is intentional, restore the categorical assertions (pairwise dE >= 20 plus ` +
      `deuteranopia/protanopia >= 12) instead of this test.`,
  );
});


/**
 * The categorical series, which is the set the sequential ramp above says to
 * add rather than stretch: `chart-categorical-1..8`, shared by charts and by
 * the map's category styles so one district is one colour on both.
 *
 * Thresholds are the DIRECTLY-LABELLED ones -- normal dE2000 >= 15, colour
 * deficiency >= 8 -- not the >= 20 / >= 12 a colour-only legend needs. Every
 * surface that spends this palette puts the name beside the mark (a Sankey
 * node, a legend row, a map badge), so colour traces a flow and the label
 * carries the identity. That is the documented "secondary encoding" case.
 *
 * Both simulation models, deliberately. They disagree, and not by a little:
 * for green vs red, Machado (culori's) scored 8+ while Vienot scored 3.2 --
 * the canonical deuteranopia confusion, called safe by one model and unusable
 * by the other. A safety property must not depend on which one someone picks,
 * so a pair counts as separable only when BOTH agree. Deriving the palette
 * under Machado alone kept a vivid lime that Vienot rejects.
 */
const CATEGORICAL = Array.from({ length: 8 }, (_, i) => `chart-categorical-${i + 1}`);

/** Vienot 1999 dichromat simulation; culori ships Machado, not this one. */
function vienot(hex: string, kind: "protan" | "deutan"): string {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const unlin = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const RGB2LMS = [
    [0.31399022, 0.63951294, 0.04649755],
    [0.15537241, 0.75789446, 0.08670142],
    [0.01775239, 0.10944209, 0.87256922],
  ];
  const LMS2RGB = [
    [5.47221206, -4.6419601, 0.16963708],
    [-1.1252419, 2.29317094, -0.1678952],
    [0.02980165, -0.19318073, 1.16364789],
  ];
  const PLANES = {
    protan: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
    deutan: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
  } as const;
  const mul = (M: readonly (readonly number[])[], v: number[]) =>
    M.map((r) => r[0]! * v[0]! + r[1]! * v[1]! + r[2]! * v[2]!);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const rgb = converter("rgb")(parse(hex)!)!;
  const out = mul(LMS2RGB, mul(PLANES[kind], mul(RGB2LMS, [lin(rgb.r), lin(rgb.g), lin(rgb.b)])));
  return formatHex({ mode: "rgb", r: clamp(unlin(out[0]!)), g: clamp(unlin(out[1]!)), b: clamp(unlin(out[2]!)) });
}

const machadoProt = filterDeficiencyProt(1);
const machadoDeut = filterDeficiencyDeuter(1);
const deficiencyGap = (a: string, b: string) =>
  Math.min(
    deltaE(formatHex(machadoProt(a)), formatHex(machadoProt(b))),
    deltaE(formatHex(machadoDeut(a)), formatHex(machadoDeut(b))),
    deltaE(vienot(a, "protan"), vienot(b, "protan")),
    deltaE(vienot(a, "deutan"), vienot(b, "deutan")),
  );

for (const mode of MODES) {
  test(`${mode}: every categorical pair is separable, to both CVD models`, () => {
    const t = themes[mode] as unknown as Record<string, string>;
    const failures: string[] = [];
    for (let i = 0; i < CATEGORICAL.length; i++) {
      for (let j = i + 1; j < CATEGORICAL.length; j++) {
        const a = t[CATEGORICAL[i]!]!;
        const b = t[CATEGORICAL[j]!]!;
        const normal = deltaE(a, b);
        const cvd = deficiencyGap(a, b);
        if (normal < 15)
          failures.push(`  ${CATEGORICAL[i]} vs ${CATEGORICAL[j]}: dE2000 ${normal.toFixed(1)} (need 15)`);
        if (cvd < 8)
          failures.push(`  ${CATEGORICAL[i]} vs ${CATEGORICAL[j]}: colour-deficient dE2000 ${cvd.toFixed(1)} (need 8)`);
      }
    }
    assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
  });

  test(`${mode}: every categorical stop clears 3:1 on the page`, () => {
    const t = themes[mode] as unknown as Record<string, string>;
    const failures: string[] = [];
    for (const name of CATEGORICAL) {
      const ratio = wcagContrast(t[name]!, t.background!);
      // 3:1 is the WCAG 1.4.11 bar for a graphical object, which is what a
      // Sankey node or a map dot is.
      if (ratio < 3) failures.push(`  ${name}: ${ratio.toFixed(2)}:1 on background (need 3)`);
    }
    assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
  });
}

/** The first stop is the product primary, and that is a promise, not a default. */
test("categorical stop 1 is the product primary", () => {
  const t = themes.light as unknown as Record<string, string>;
  assert.equal(t["chart-categorical-1"]!.toLowerCase(), "#0f766e");
});
