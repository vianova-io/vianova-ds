/**
 * agent-digest.ts — condense dist/tokens.json into two markdown files an AI
 * agent can read cheaply and correctly.
 *
 * Why this exists:
 *   1. Most semantic values are oklch(), not hex. An agent computing a contrast
 *      ratio needs resolved hex; asking it to convert oklch by hand is how wrong
 *      accessibility numbers get reported. We resolve here, once.
 *   2. dist/ is gitignored and this repo is iCloud-synced, so a fresh clone has
 *      no tokens.json until someone runs a 15-25 minute build. The digest is
 *      committed OUTSIDE dist/ so it is always present and reviewable in PRs.
 *
 * Outputs (both committed, both generated — never edit by hand):
 *   agent-digest.md       everyday: light + dark, foundations, components, ramps
 *   agent-digest.full.md  the four white-label modes (diff-only) + primitives
 *
 * Usage:
 *   tsx scripts/agent-digest.ts            write both files
 *   tsx scripts/agent-digest.ts --check    regenerate in memory, exit 1 on drift
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { converter, formatHex, formatHex8 } from "culori";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const INPUT = join(PKG, "dist", "tokens.json");
const OUT_MAIN = join(PKG, "agent-digest.md");
const OUT_FULL = join(PKG, "agent-digest.full.md");

const toRgb = converter("rgb");

/** Same resolution rule as build.ts: 8-digit hex when the colour has alpha. */
function hexOf(value: string): string {
  const c = toRgb(value);
  if (!c) return value; // not a parseable colour — pass through verbatim
  return (c.alpha !== undefined && c.alpha < 1 ? formatHex8(c) : formatHex(c))!;
}

type Token = {
  value: string;
  type: string;
  cssVar: string;
  figma?: string | null;
  preset?: string | null;
  a11yFix?: boolean;
  aliasOf?: string | null;
  description?: string;
};

const tokens = JSON.parse(readFileSync(INPUT, "utf8")) as Record<string, Token>;
const rawInput = readFileSync(INPUT);
const inputHash = createHash("sha256").update(rawInput).digest("hex");

function gitInfo(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: PKG }).toString().trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: PKG }).toString().trim();
    return `${sha} (${branch})`;
  } catch {
    return "unknown";
  }
}

const MODES = ["light", "dark", "darkStone", "darkSlate", "fuchsia", "gray"] as const;
const WHITE_LABEL = ["darkStone", "darkSlate", "fuchsia", "gray"] as const;

/** Every semantic role name, in the order tokens.json lists them for `light`. */
const roles = Object.keys(tokens)
  .filter((k) => k.startsWith("semantic.light."))
  .map((k) => k.slice("semantic.light.".length));

function sem(mode: string, role: string): Token | undefined {
  return tokens[`semantic.${mode}.${role}`];
}

/**
 * F = from the Figma library · C = code-only (figma: null)
 * p = value originates in the shadcn preset · ! = a11yFix applied
 * These combine, e.g. "Cp" (came with the preset) or "F!" (from Figma, then altered).
 */
function provenance(t: Token): string {
  let s = t.figma ? "F" : "C";
  if (t.preset) s += "p";
  if (t.a11yFix) s += "!";
  return s;
}

function displayValue(t: Token): string {
  return t.type === "color" ? hexOf(t.value) : t.value;
}

function byPrefix(prefix: string): [string, Token][] {
  return Object.entries(tokens).filter(([k]) => k.startsWith(prefix));
}

function header(title: string, note: string): string {
  const codeOnlyLight = roles.filter((r) => sem("light", r)?.figma == null).length;
  const a11yFixed = Object.entries(tokens).filter(([, t]) => t.a11yFix).length;
  return [
    `# ${title}`,
    "",
    "> **GENERATED** by `packages/tokens/scripts/agent-digest.ts` — do not edit by hand.",
    `> Regenerate with \`pnpm --filter @vianova/tokens digest\`.`,
    "",
    `| | |`,
    `|---|---|`,
    `| Generated | ${new Date().toISOString().slice(0, 10)} |`,
    `| DS repo | \`${gitInfo()}\` |`,
    `| Input | \`dist/tokens.json\`, sha256 \`${inputHash.slice(0, 16)}…\` |`,
    `| Observed | ${roles.length} semantic roles × ${MODES.length} modes · ${codeOnlyLight} of ${roles.length} light roles are code-only · ${a11yFixed} tokens carry \`a11yFix\` |`,
    "",
    note,
    "",
    "**Provenance glyphs** (they combine — `Cp`, `F!`): `F` from the Figma library ·",
    "`C` code-only (`figma: null`, exists nowhere in Figma) · `p` the value originates in",
    "the shadcn preset rather than a Vianova choice · `!` deliberately altered to pass",
    "contrast, so it no longer matches Figma.",
    "",
    "Colour values below are **resolved to hex**. The source is often `oklch()`; if you",
    "need the original, read `dist/theme.css`. Alpha renders as 8-digit hex.",
    "",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────── main digest

function buildMain(): string {
  const out: string[] = [];

  out.push(
    header(
      "Vianova DS — token digest",
      "Light and dark, which is what nearly every task needs. The four white-label\n" +
        "themes and the primitive index are in `agent-digest.full.md`.",
    ),
  );

  out.push("## Semantic colours\n");
  out.push("| Role | CSS var | Light | Dark | Prov | Figma variable |");
  out.push("|---|---|---|---|---|---|");
  for (const role of roles) {
    const l = sem("light", role);
    const d = sem("dark", role);
    if (!l) continue;
    const figma = l.figma ?? d?.figma ?? "—";
    out.push(
      `| \`${role}\` | \`--${role}\` | \`${displayValue(l)}\` | ` +
        `${d ? `\`${displayValue(d)}\`` : "—"} | ${provenance(l)} | ${figma === "—" ? "—" : `\`${figma}\``} |`,
    );
  }
  out.push("");

  out.push("## Foundations\n");
  for (const [label, prefix] of [
    ["Type", "font."],
    ["Spacing", "spacing."],
    ["Radius", "radius."],
    ["Motion", "motion."],
  ] as const) {
    const rows = byPrefix(prefix);
    if (!rows.length) continue;
    out.push(`### ${label}\n`);
    out.push("| Token | CSS var | Value | Notes |");
    out.push("|---|---|---|---|");
    for (const [k, t] of rows) {
      out.push(
        `| \`${k}\` | \`${t.cssVar}\` | \`${displayValue(t)}\` | ${t.description ?? ""} |`,
      );
    }
    out.push("");
  }

  out.push("## Component tokens\n");
  out.push("Components never reference a primitive directly — they go through semantics.\n");
  out.push("| Token | CSS var | Value |");
  out.push("|---|---|---|");
  for (const [k, t] of byPrefix("component.")) {
    out.push(`| \`${k}\` | \`${t.cssVar}\` | \`${displayValue(t)}\` |`);
  }
  out.push("");

  out.push("## Brand gradient — expression only\n");
  out.push(
    "**Never use these as product UI colour.** They are the logo and marketing",
    "gradient. Stop order left→right as listed.\n",
  );
  out.push("| Stop | CSS var | Hex | Notes |");
  out.push("|---|---|---|---|");
  for (const [k, t] of byPrefix("brand.")) {
    out.push(
      `| \`${k.replace("brand.", "")}\` | \`${t.cssVar}\` | \`${displayValue(t)}\` | ${t.description ?? ""} |`,
    );
  }
  out.push("");
  out.push(
    "The four-stop set `#FC01B4 #FE4765 #1804E4 #02D98F` describes the **logo's**",
    "internal two-pass `soft-light` construction. It is not an alternative to the",
    "stops above — both are true at different layers.\n",
  );

  out.push("## Map ramps\n");
  out.push(
    "A second axis, independent of theme — selected by `data-map-scheme`. Eleven",
    "stops each, 0→100.\n",
  );
  const schemes = [...new Set(byPrefix("map.ramp.").map(([k]) => k.split(".")[2]))];
  for (const s of schemes) {
    const stops = byPrefix(`map.ramp.${s}.`)
      .sort(([a], [b]) => Number(a.split(".").pop()) - Number(b.split(".").pop()))
      .map(([, t]) => displayValue(t));
    out.push(`- **${s}** — ${stops.map((h) => `\`${h}\``).join(" ")}`);
  }
  const layer = tokens["map.layer-color"];
  if (layer) {
    out.push(
      "",
      `- **layer-color** — \`${displayValue(layer)}\`. ⚠️ This is a *map layer* colour in`,
      "  the Brand scheme only. It is **not** the Vianova brand and not a product accent.",
    );
  }
  out.push("");

  out.push("## Primitives\n");
  out.push(
    "Stock Tailwind v4, captured verbatim from the Figma `Tailwind` collection —",
    `${byPrefix("tw.").length} of them. You already know \`teal-600\`; the full index is in`,
    "`agent-digest.full.md`. What matters is which primitive a semantic resolves to:\n",
  );
  const aliased = roles
    .map((r) => [r, sem("light", r)] as const)
    .filter(([, t]) => t?.aliasOf)
    .map(([r, t]) => `| \`${r}\` | \`${t!.aliasOf}\` |`);
  if (aliased.length) {
    out.push("| Semantic role (light) | Resolves to |");
    out.push("|---|---|");
    out.push(...aliased);
  } else {
    out.push("No semantic role in `light` carries an explicit `aliasOf`.");
  }
  out.push("");

  return out.join("\n");
}

// ─────────────────────────────────────────────────────────── full digest

function buildFull(): string {
  const out: string[] = [];

  out.push(
    header(
      "Vianova DS — token digest (full)",
      "The four white-label themes, emitted **diff-only against `dark`** because they\n" +
        "are re-accents rather than separate palettes — a dozen rows each, not 63.\n" +
        "Plus the complete primitive index.",
    ),
  );

  for (const mode of WHITE_LABEL) {
    const diffs = roles
      .map((r) => [r, sem("dark", r), sem(mode, r)] as const)
      .filter(([, d, m]) => d && m && d.value !== m.value);
    out.push(`## ${mode} — differs from \`dark\` in ${diffs.length} of ${roles.length} roles\n`);
    if (!diffs.length) {
      out.push("_Identical to `dark`._\n");
      continue;
    }
    out.push("| Role | dark | " + mode + " | P |");
    out.push("|---|---|---|---|");
    for (const [r, d, m] of diffs) {
      out.push(`| \`${r}\` | \`${displayValue(d!)}\` | \`${displayValue(m!)}\` | ${provenance(m!)} |`);
    }
    out.push("");
  }

  out.push("## Primitive index\n");
  out.push("| Token | Hex |");
  out.push("|---|---|");
  for (const [k, t] of byPrefix("tw.")) {
    out.push(`| \`${k.replace("tw.", "")}\` | \`${displayValue(t)}\` |`);
  }
  out.push("");

  return out.join("\n");
}

// ─────────────────────────────────────────────────────────── run

/** The header carries a timestamp and a git SHA, so compare everything below it. */
function body(md: string): string {
  const i = md.indexOf("## ");
  return i === -1 ? md : md.slice(i);
}

const main = buildMain();
const full = buildFull();

if (process.argv.includes("--check")) {
  const stale: string[] = [];
  for (const [path, fresh] of [
    [OUT_MAIN, main],
    [OUT_FULL, full],
  ] as const) {
    let existing = "";
    try {
      existing = readFileSync(path, "utf8");
    } catch {
      stale.push(`${path} — missing`);
      continue;
    }
    if (body(existing) !== body(fresh)) stale.push(`${path} — content differs`);
  }
  if (stale.length) {
    console.error("Token digest is stale:");
    for (const s of stale) console.error(`  ${s}`);
    console.error("\nRun: pnpm --filter @vianova/tokens digest");
    process.exit(1);
  }
  console.log("Token digest is current.");
} else {
  writeFileSync(OUT_MAIN, main);
  writeFileSync(OUT_FULL, full);
  console.log(`Wrote ${OUT_MAIN} (${main.length} bytes)`);
  console.log(`Wrote ${OUT_FULL} (${full.length} bytes)`);
}
