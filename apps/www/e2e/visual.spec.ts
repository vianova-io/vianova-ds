import { expect, test } from "@playwright/test";

import { EXAMPLES, NON_DETERMINISTIC , settle } from "./examples";

/**
 * Visual regression over every example.
 *
 * Baselines are platform-specific: Playwright suffixes them per OS, so a
 * macOS baseline is not used on Linux. Generate them wherever the suite will
 * run — `pnpm test:visual:update` — and commit those files.
 */
test.describe("visual", () => {
  for (const { example } of EXAMPLES) {
    test(`${example} matches its baseline`, async ({ page }) => {
      test.skip(
        NON_DETERMINISTIC.has(example),
        "renders a live WebGL map from network tiles",
      );

      await page.goto(`/preview/${example}`);
      await settle(page);
      // Web fonts shift metrics after first paint; comparing before they land
      // produces diffs that have nothing to do with the change under test.
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${example}.png`, {
        // WebGL canvases differ across GPUs and drivers even for identical
        // input, so mask any that appear inside an otherwise stable example.
        mask: [page.locator("canvas")],
        fullPage: true,
      });
    });
  }
});
