import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const TOKENS: Record<
  string,
  {
    value: string;
    type: string;
    cssVar: string;
    figma?: string | null;
    preset?: string | null;
    aliasOf?: string | null;
    a11yFix?: boolean;
  }
> = JSON.parse(readFileSync(join(ROOT, "dist", "tokens.json"), "utf8"));

export type Provenance = "figma" | "preset" | "code" | "a11yFix";

/**
 * Where a semantic token's VALUE ultimately comes from.
 *
 * Four sources now, and the distinction drives whether a failing check is our
 * bug or an upstream one:
 *   figma   - the Figma library, the design file
 *   preset  - the shadcn preset b5cRaL9Zg (base-nova / zinc / teal)
 *   code    - we invented it
 *   a11yFix - upstream gave us a value that failed WCAG AA and we re-picked it
 *
 * a11yFix wins over the recorded figma/preset origin, which those tokens keep
 * so the divergence stays auditable. Provenance answers "who chose the value
 * that is in the build", and for these that is us -- reporting `preset` here
 * would blame upstream for a contrast defect we would have introduced.
 *
 * Follows `aliasOf`, because a code-only NAME wrapping an upstream VALUE
 * (sidebar-primary -> primary) inherits that value's provenance.
 */
export function provenanceOf(name: string, depth = 0): Provenance {
  if (depth > 8) return "code";
  const t = TOKENS[`semantic.light.${name}`];
  if (!t) return "code";
  if (t.a11yFix) return "a11yFix";
  if (t.figma) return "figma";
  if (t.preset) return "preset";
  return t.aliasOf ? provenanceOf(t.aliasOf, depth + 1) : "code";
}

/** True when we own the value and therefore own any defect in it. */
export const isOurs = (name: string) =>
  ["code", "a11yFix"].includes(provenanceOf(name));
