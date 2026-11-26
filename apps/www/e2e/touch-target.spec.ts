import { test, expect } from "@playwright/test";

import { settle } from "./examples";

/**
 * The touch floor, measured under an emulated coarse pointer.
 *
 * VIP is used on tablets and phones in the field, not only on desks, and the
 * registry was built as though it were desktop-only -- the only 44px controls
 * anywhere were in `blocks/citizen-workspace`, the phone surface. Two controls
 * on the maintenance surfaces were the first to be fixed: the status card's
 * dismiss (24px) and the maintenance screen's "Check again" (32px). Both clear
 * WCAG 2.2 AA, which asks for 24x24 under 2.5.8; neither is a thing you want to
 * hit with a thumb while standing at a junction.
 *
 * The fix is `pointer-coarse:` on the control itself, never a change to the
 * control ladder -- see the convention written out in full beside the dismiss
 * button in patterns/status-toast.tsx. Which is why this file asserts BOTH
 * sides: that the targets reach 44px on a coarse pointer, and that they are
 * still 24 and 32 on a fine one. The second half is the one that keeps
 * e2e/control-size.spec.ts honest and VIP's desktop screenshots valid; a fix
 * that quietly grew every control would pass the first half alone.
 *
 * This is the per-control GATE over two controls, and it measures rendered
 * rects because these two have no slop -- the card's dismiss is parked
 * absolutely over a corner and "Check again" is a plain button. A rect is the
 * wrong instrument for the registry at large: a control can conform entirely on
 * pseudo-element slop, which a rect cannot see but elementFromPoint can, by
 * resolving a hit on a `::after` back to the element that owns it. Checkbox is
 * a 16x16 box with a 53x43 tap area and conforms on slop alone. The
 * registry-wide census measures tap areas that way and lives in
 * e2e/touch-target-floor.spec.ts; do not grow this file into it.
 *
 * `hasTouch: true` is the whole knob. Measured rather than assumed: it flips
 * `(pointer: coarse)` to true on its own, and `isMobile` is not needed -- which
 * matters, because `isMobile` also swaps the viewport and the user agent and
 * would drag unrelated layout into these numbers.
 */

/** WCAG 2.5.5 Target Size (Enhanced), AAA -- and the platform convention. */
const FLOOR = 44;

type Target = {
  what: string;
  route: string;
  locate: (page: import("@playwright/test").Page) => import("@playwright/test").Locator;
  /** What it measures on a fine pointer, which must not move. */
  fine: number;
};

const TARGETS: Target[] = [
  {
    what: "the status card's dismiss",
    route: "/preview/status-toast-default",
    locate: (page) => page.getByRole("button", { name: "Dismiss status update" }).first(),
    fine: 24,
  },
  {
    what: '"Check again" on the maintenance screen',
    route: "/preview/maintenance-screen-default",
    locate: (page) => page.getByRole("button", { name: "Check again" }).first(),
    fine: 32,
  },
];

async function measure(locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { height: Math.round(r.height * 10) / 10, width: Math.round(r.width * 10) / 10 };
  });
  return box;
}

test.describe("touch targets on a coarse pointer", () => {
  test.use({ hasTouch: true });

  for (const target of TARGETS) {
    test(`${target.what} is at least ${FLOOR}px`, async ({ page }) => {
      await page.goto(target.route);
      await settle(page);

      expect(
        await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
        "the context is not emulating a coarse pointer, so this test proves nothing",
      ).toBe(true);

      const { height, width } = await measure(target.locate(page));
      expect(
        Math.min(height, width),
        `${target.what} is ${width}x${height} on a coarse pointer; the floor is ${FLOOR}px`,
      ).toBeGreaterThanOrEqual(FLOOR);
    });
  }
});

test.describe("the same controls on a fine pointer", () => {
  for (const target of TARGETS) {
    test(`${target.what} is still ${target.fine}px`, async ({ page }) => {
      await page.goto(target.route);
      await settle(page);

      expect(
        await page.evaluate(() => matchMedia("(pointer: fine)").matches),
        "the default context should be a fine pointer",
      ).toBe(true);

      const { height } = await measure(target.locate(page));
      expect(
        height,
        `${target.what} moved on a fine pointer: ${height}px, expected ${target.fine}px. ` +
          "The coarse-pointer fix must not touch the control ladder.",
      ).toBe(target.fine);
    });
  }
});
