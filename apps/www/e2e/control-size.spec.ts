import { test, expect } from "@playwright/test";

import { settle } from "./examples";

/**
 * Every control on a row of a toolbar or a form must be the same height.
 *
 * This is the kind of agreement that holds for exactly as long as nobody
 * touches it. The heights live in five separate class strings across five
 * files, so a tweak to one -- a taller button for a marketing page, a denser
 * select for a grid -- silently breaks alignment everywhere else, and the
 * damage shows up as a toolbar that looks slightly wrong rather than as
 * anything that fails.
 *
 * So the ladder is asserted rather than documented: `button-control-ladder`
 * renders a button, an outline button, an icon button, a toggle, an input and
 * a select at each step, and every one is measured against the step's declared
 * height.
 *
 * Rendered, not read off the class strings. The class says `h-9`; what matters
 * is that the box is 36px after borders, line-height and any `min-h` a parent
 * imposes have had their say.
 */

/** The ladder, and the reason for each step being where it is. */
const LADDER = [
  { size: "sm", px: 32 },
  { size: "default", px: 36 },
  { size: "lg", px: 40 },
] as const;

test.describe("control sizes", () => {
  for (const { size, px } of LADDER) {
    test(`every control at size "${size}" is ${px}px tall`, async ({ page }) => {
      await page.goto("/preview/button-control-ladder");
      await settle(page);

      const row = page.getByTestId(`ladder-${size}`);
      await expect(row).toBeVisible();

      const measured = await row.evaluate((el) =>
        [...el.children]
          // Base UI renders a hidden form input inside Select for submission.
          // Excluded on `aria-hidden`, not on being small: filtering by size
          // would also hide the regression this test exists to catch, a real
          // control collapsing.
          .filter((c) => c.getAttribute("aria-hidden") !== "true")
          .map((c) => ({
            what: c.getAttribute("data-slot") ?? (c as HTMLElement).tagName.toLowerCase(),
            label:
              (c.textContent ?? "").trim().slice(0, 18) || (c.getAttribute("aria-label") ?? ""),
            height: Math.round(c.getBoundingClientRect().height * 10) / 10,
          })),
      );

      expect(measured.length, "the ladder row rendered no controls").toBeGreaterThan(4);

      const wrong = measured.filter((m) => m.height !== px);
      expect(
        wrong,
        wrong.length
          ? `\n  size "${size}" should be ${px}px:\n` +
              wrong.map((m) => `    ${m.what} (${m.label}) is ${m.height}px`).join("\n") +
              "\n"
          : "",
      ).toEqual([]);
    });
  }

  /**
   * The steps must also stay distinct and in order. A ladder whose rungs have
   * quietly converged passes every check above while doing nothing useful.
   */
  test("the ladder steps are distinct and ascending", async ({ page }) => {
    await page.goto("/preview/button-control-ladder");
    await settle(page);

    const heights: number[] = [];
    for (const { size } of LADDER) {
      const h = await page
        .getByTestId(`ladder-${size}`)
        .locator("button")
        .first()
        .evaluate((el) => el.getBoundingClientRect().height);
      heights.push(Math.round(h));
    }

    expect(heights, `expected ascending, got ${heights.join(" < ")}`).toEqual(
      [...heights].sort((a, b) => a - b),
    );
    expect(new Set(heights).size, `steps collapsed: ${heights.join(", ")}`).toBe(heights.length);
  });
});
