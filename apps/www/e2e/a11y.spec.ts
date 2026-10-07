import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { BLOCKS, EXAMPLES, NON_MAP_BLOCKS, settle } from "./examples";

/**
 * Accessibility crawl over every example, using the chrome-less /preview route
 * so each component is judged on its own markup rather than the docs shell.
 *
 * Fails on serious and critical only. Minor and moderate findings are reported
 * but do not block: at this scale a zero-tolerance gate gets disabled within a
 * week, and the severe findings are the ones that actually stop someone using
 * the product.
 */
const BLOCKING = new Set(["serious", "critical"]);

/**
 * Violations that come from upstream markup we do not own, kept visible rather
 * than silenced — the same treatment the token suite gives inherited contrast
 * defects.
 *
 * An unlisted violation fails, and so does a listed one that no longer occurs,
 * so the list cannot rot into a blanket mute.
 */
const KNOWN_UPSTREAM: Record<string, { rules: string[]; why: string }> = {
  "combobox-default": {
    rules: ["button-name"],
    why: "Base UI's ComboboxInput renders its own icon-only trigger button with no accessible name. Not reachable from our markup without forking the stock component.",
  },
  "command-default": {
    rules: ["aria-required-children"],
    why: "Stock command puts a [role=separator] inside the listbox, which ARIA disallows.",
  },
  "item-default": {
    rules: ["aria-required-children"],
    why: "Stock ItemGroup is role=list but its children are not listitem.",
  },
  // The two color-contrast entries that were here are gone: --primary as text
  // was 3.63:1 in dark and is now fixed in the token override layer, so the
  // stale-entry guard correctly demanded their removal.
};

test.describe("accessibility", () => {
  for (const { component, example } of EXAMPLES) {
    test(`${example} has no serious or critical violations`, async ({ page }) => {
      await page.goto(`/preview/${example}`);
      await settle(page);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const allowed = KNOWN_UPSTREAM[example]?.rules ?? [];
      const all = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
      const blocking = all.filter((v) => !allowed.includes(v.id));

      // A stale entry is as misleading as a missing one.
      const goneButListed = allowed.filter((r) => !all.some((v) => v.id === r));
      expect(
        goneButListed,
        `${example}: listed as a known upstream violation but now passing — remove it from KNOWN_UPSTREAM`,
      ).toEqual([]);
      const advisory = results.violations.filter((v) => !BLOCKING.has(v.impact ?? ""));

      if (advisory.length) {
        console.log(
          `[${example}] advisory: ${advisory.map((v) => `${v.id}(${v.impact})`).join(", ")}`,
        );
      }

      expect(
        blocking.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => ({
            html: n.html.slice(0, 160),
            // Carries the concrete reason — for contrast, the actual ratio and
            // the two colours involved.
            why: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 240),
          })),
        })),
        `${component}/${example}`,
      ).toEqual([]);
    });
  }

  /**
   * The blocks, at a phone width.
   *
   * They had no accessibility coverage at all until now: this suite walks
   * /preview, which only exists for examples, so the one place the library's
   * primitives are composed into something real went unchecked. The phone
   * viewport is the one that matters most here -- below lg the blocks grow a
   * panel switcher that exists at no other width, and its aria-expanded /
   * aria-controls wiring is exactly the kind of thing that looks right in a
   * screenshot and is wrong to a screen reader.
   *
   * Scoped to the block with .include() so the docs shell's own markup -- nav,
   * theme switcher, code samples -- is not attributed to the block.
   */
  test.describe("blocks on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    for (const block of BLOCKS) {
      test(`block ${block} has no serious or critical violations`, async ({ page }) => {
        await page.goto(`/blocks/${block}`);
        await settle(page);

        // Map blocks are scoped to their toolbar and panels; a block with no
        // map is scoped to its own root. axe throws, rather than passing, when
        // an .include() matches nothing -- so the selectors must exist.
        const scoped = new AxeBuilder({ page });
        if (NON_MAP_BLOCKS.includes(block)) {
          scoped.include(`[data-slot=${block}]`);
        } else {
          scoped.include("[data-slot=map-toolbar]").include("[data-slot=floating-panel]");
        }
        const results = await scoped
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
        const advisory = results.violations.filter((v) => !BLOCKING.has(v.impact ?? ""));
        if (advisory.length) {
          console.log(
            `[block ${block}] advisory: ${advisory.map((v) => `${v.id}(${v.impact})`).join(", ")}`,
          );
        }

        expect(
          blocking.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 3).map((n) => ({
              html: n.html.slice(0, 160),
              why: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 240),
            })),
          })),
          `block ${block} at 390px`,
        ).toEqual([]);
      });
    }
  });
});
