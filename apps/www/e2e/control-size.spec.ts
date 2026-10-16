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

/**
 * The same agreement, measured where it is actually made.
 *
 * Everything above reads one page, `/preview/button-control-ladder`, which is
 * a page built to pass it. That is why a 32px "Export report" sat on a row of
 * 36px icon buttons in the map workspace through several redesigns: the spec
 * whose own premise is "every control on a row of a toolbar must be the same
 * height" never looked at a toolbar. Two of them were wrong at once -- Export
 * report at `size="sm"`, and MapDrawControl, which hardcodes `size-8` because
 * it was built to float in the map corner.
 *
 * So this measures the real bar, at every width it changes shape, and asserts
 * one height across it rather than a number per control. A bar whose controls
 * agree on 40px would be a decision; a bar holding both 32 and 36 is a bug.
 */
const TOOLBAR_WIDTHS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "laptop", width: 1280, height: 800 },
  { label: "tablet", width: 820, height: 1180 },
  { label: "phone", width: 390, height: 844 },
] as const;

/**
 * Buttons and fields inside the bar, excluding the map title: InlineEdit's
 * title variant is text that edits in place, deliberately sized to its type
 * and not to the control ladder. Measured from rendered rects, and filtered on
 * having one -- the bar holds controls for every width at once and hides the
 * rest with `display: none`.
 */
function readBarControls(bar: Element) {
  return [...bar.querySelectorAll("button, [data-slot=input-group]")]
    .filter((el) => !el.closest("[data-slot=inline-edit]"))
    .map((el) => ({
      what: el.getAttribute("data-slot") ?? el.tagName.toLowerCase(),
      label: (el.getAttribute("aria-label") || (el.textContent ?? "").trim()).slice(0, 22),
      height: Math.round(el.getBoundingClientRect().height * 10) / 10,
      width: Math.round(el.getBoundingClientRect().width * 10) / 10,
    }))
    .filter((m) => m.height > 0 && m.width > 0);
}

test.describe("the map workspace toolbar", () => {
  for (const { label, width, height } of TOOLBAR_WIDTHS) {
    test(`every control in the bar is 36px tall at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/blocks/map-workspace");
      await settle(page);

      const bar = page.locator("[data-slot=map-toolbar]");
      await expect(bar).toBeVisible();

      const measured = await bar.evaluate(readBarControls);

      // A bar that rendered nothing measurable would otherwise pass every
      // assertion below, which is the failure mode .include() has in the a11y
      // suite: an empty set satisfies anything.
      expect(
        measured.length,
        `no controls measured in the bar at ${width}px`,
      ).toBeGreaterThan(2);

      const wrong = measured.filter((m) => m.height !== 36);
      expect(
        wrong,
        wrong.length
          ? `\n  the bar's controls must all be 36px (the "default" ladder step):\n` +
              measured
                .map((m) => `    ${m.height === 36 ? " " : "!"} ${m.label || m.what} is ${m.height}px`)
                .join("\n") +
              "\n"
          : "",
      ).toEqual([]);
    });
  }

  /**
   * The phone's search field, which used to be `hidden md:flex` -- it simply
   * disappeared below 768, taking the only way to move the camera by name with
   * it. It is an icon now that opens the field over the row.
   *
   * Three claims, because each is a way this pattern goes wrong: the field
   * takes focus (or the tap did nothing), the bar does not grow (the block
   * root is overflow-hidden, so a row that grew would clip its own controls
   * silently), and what the field covers stops being tabbable.
   */
  test("the phone search opens over the row without resizing it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/blocks/map-workspace");
    await settle(page);

    const bar = page.locator("[data-slot=map-toolbar]");
    const trigger = bar.getByRole("button", { name: "Search streets and junctions" });
    await expect(trigger, "the field should be an icon button below md").toBeVisible();

    const before = await bar.boundingBox();
    await trigger.click();

    const field = bar.getByRole("textbox", { name: "Search streets and junctions" });
    await expect(field).toBeFocused();

    const after = await bar.boundingBox();
    expect(
      Math.round(after!.height),
      "the bar grew when the field opened -- the block clips, so this loses controls",
    ).toBe(Math.round(before!.height));

    // The row underneath is covered, so it must not still be reachable.
    //
    // Polled, not read once. Every button carries `transition-all`, and
    // visibility is an animatable property -- a discrete one, so it flips at
    // the midpoint of the 150ms transition rather than immediately, and
    // getComputedStyle during those few frames honestly reports the control as
    // still visible. Measured, not assumed: a single read straight after the
    // click returns 7 and settles to 2.
    await expect
      .poll(
        () =>
          bar.evaluate(
            (el) =>
              [...el.querySelectorAll("button, input")]
                .filter((c) => (c as HTMLElement).checkVisibility({ visibilityProperty: true }))
                .map((c) => c.getAttribute("aria-label") ?? c.tagName.toLowerCase()),
            undefined,
          ),
        {
          message: "controls under the open field are still reachable by keyboard",
          timeout: 2_000,
        },
      )
      // The field and its close button, and nothing of the row they cover.
      .toEqual(["Search streets and junctions", "Close search"]);

    await page.keyboard.press("Escape");
    await expect(field).toBeHidden();
    await expect(trigger).toBeVisible();
  });
});
