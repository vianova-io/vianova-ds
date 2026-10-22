import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The phone's bottom tray.
 *
 * A docked panel at a fixed height is a permanent hole in the map behind it.
 * This one is dragged between three heights and can be dismissed, so the
 * assertions here are about the two things that makes possible: the map can be
 * seen whole, and every height is reachable without a pointer.
 *
 * Heights are asserted as a share of the block, not in pixels: the snaps are
 * fractions, and a pixel figure would pin the block's size instead.
 */
test.describe.configure({ timeout: 90_000 });

const PHONE = { width: 390, height: 844 };

const block = (page: Page) => page.locator("[data-map-scheme]").first();
const openTray = (page: Page) =>
  page.locator("[data-slot=bottom-tray][data-open=true]");
const grabber = (page: Page) =>
  page.getByRole("slider", { name: "Data layers height" });
/**
 * The switcher's own buttons.
 *
 * Scoped: the docs page prints the block's source under the demo, so a bare
 * getByRole("button", { name: "Charts" }) matches the switcher, the lg
 * disclosure and the listing, and fails strict mode for a reason that has
 * nothing to do with the tray.
 */
const switcherButton = (page: Page, name: string) =>
  page.locator("[data-slot=panel-switcher]").getByRole("button", { name });

async function open(page: Page) {
  await page.goto("/blocks/map-workspace");
  await expect(page.getByRole("tab", { name: "Data" })).toBeVisible();
  await settle(page);
}

/** The tray's height as a percentage of the block it covers. */
async function share(page: Page) {
  const b = (await block(page).boundingBox())!;
  const t = (await openTray(page).boundingBox())!;
  return Math.round((t.height / b.height) * 100);
}

test.describe("the phone's bottom tray", () => {
  test.use({ viewport: PHONE });

  test("opens at half, and says which height it is at", async ({ page }) => {
    await open(page);
    await expect(openTray(page)).toHaveAttribute("data-snap", "half");
    await expect.poll(() => share(page)).toBeGreaterThan(45);
    // The grabber is a slider, so a screen reader is told the height by name
    // rather than by an index into a list it cannot see.
    await expect(grabber(page)).toHaveAttribute("aria-valuetext", "half");
  });

  test("every height is reachable from the keyboard", async ({ page }) => {
    await open(page);
    await grabber(page).focus();

    // Polled, because the height animates for 200ms after the snap changes:
    // data-snap is the decision, the box catches up.
    await page.keyboard.press("ArrowUp");
    await expect(openTray(page)).toHaveAttribute("data-snap", "full");
    await expect.poll(() => share(page)).toBeGreaterThan(80);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(openTray(page)).toHaveAttribute("data-snap", "peek");
    await expect.poll(() => share(page)).toBeLessThan(25);

    // Home and End are the ends of the range, not steps along it.
    await page.keyboard.press("End");
    await expect(openTray(page)).toHaveAttribute("data-snap", "full");
    await page.keyboard.press("Home");
    await expect(openTray(page)).toHaveAttribute("data-snap", "peek");
  });

  test("the lit button in the top bar closes it, and the map is whole", async ({
    page,
  }) => {
    await open(page);
    await expect(openTray(page)).toHaveCount(1);

    await switcherButton(page, "Data layers").click();
    await expect(openTray(page)).toHaveCount(0);
    // Nothing is covering the map, which is the whole point of letting it close.
    await expect(
      page.locator("[data-slot=bottom-tray]").first(),
    ).not.toBeVisible();

    // And it comes back.
    await switcherButton(page, "Data layers").click();
    await expect(openTray(page)).toHaveCount(1);
  });

  test("the other button swaps rather than closing", async ({ page }) => {
    await open(page);
    await switcherButton(page, "Charts").click();

    await expect(openTray(page)).toHaveCount(1);
    await expect(
      page.getByRole("slider", { name: "Charts height" }),
    ).toBeVisible();
    await expect(grabber(page)).toHaveCount(0);
  });

  test("a height chosen on one panel is kept when the other opens", async ({
    page,
  }) => {
    await open(page);
    await grabber(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(openTray(page)).toHaveAttribute("data-snap", "peek");

    await switcherButton(page, "Charts").click();
    // Only one tray is ever on screen, so a reader who dragged it down means
    // it to stay down when they look at the other panel.
    await expect(openTray(page)).toHaveAttribute("data-snap", "peek");
  });

  test("the tile attribution stays clear of it at every height", async ({
    page,
  }) => {
    await open(page);
    const badge = page.locator(".maplibregl-ctrl-attrib").first();

    for (const key of ["End", "Home", "ArrowUp"] as const) {
      await grabber(page).focus();
      await page.keyboard.press(key);
      const a = await badge.boundingBox();
      const t = (await openTray(page).boundingBox())!;
      // The badge paints at z-index 2 and the tray at z-20, so a tray that
      // reached the bottom edge would hide the credit the tiles are served
      // under. Overlap is the thing being ruled out, not position.
      expect(
        a && a.y < t.y + t.height && a.y + a.height > t.y,
        `the attribution is covered by the tray at ${key}`,
      ).toBe(false);
    }
  });

  test("from lg the tray stops existing and the panels dock", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 950 });
    await open(page);

    await expect(grabber(page)).toBeHidden();

    // Geometry, not visibility. `lg:contents` leaves the wrapper with no box,
    // so each panel positions against the BLOCK -- 16px in, 64px down, the
    // column it has always been. A wrapper that still had a box would make
    // itself the positioning ancestor and the panel would hang off the tray
    // instead, which is visible to checkVisibility and so passes a test that
    // only counts panels. Measured relative to the block for that reason.
    const root = (await block(page).boundingBox())!;
    const data = (await page
      .locator("[data-slot=floating-panel]")
      .first()
      .boundingBox())!;
    // 17 and 65, not 16 and 64: the block draws a 1px border, and these are
    // measured from its border box. The number that matters is the contrast
    // with a tray that still has a box -- that puts the panel at 25, because
    // it positions against the tray's own 8px inset instead of the block.
    expect(Math.round(data.x - root.x), "docked 16px inside the border").toBe(17);
    expect(Math.round(data.y - root.y), "docked under the 56px bar").toBe(65);
    expect(Math.round(data.width), "the desktop column is 340px").toBe(340);
  });
});
