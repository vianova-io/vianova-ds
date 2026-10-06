import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The picker's filters and ordering, which are behavioural rather than visual.
 *
 * Palette families are deliberately data: which ones a layer offers depends on
 * what it colours by, so nothing here hardcodes a list.
 */

async function open(page: Page) {
  await page.goto("/preview/preset-picker-default");
  await expect(page.getByRole("listbox", { name: "Preset" })).toBeVisible();
}

const stripColors = (page: Page) =>
  page
    .locator('[role="option"]')
    .first()
    .locator('[data-slot="palette-strip"] > span')
    .evaluateAll((els) =>
      els.slice(0, 3).map((e) => getComputedStyle(e).backgroundColor),
    );

test("palettes are options in a listbox, with one selected", async ({ page }) => {
  await open(page);
  const options = page.getByRole("option");
  expect(await options.count()).toBeGreaterThan(1);
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  // Every row names itself. A row distinguished only by colour would be
  // unusable by the people the colour-blind-safe filter is for.
  for (const name of ["Spectrum", "Pastel", "Accessible"]) {
    await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();
  }
});

test("the colour-blind-safe filter narrows the list to safe palettes", async ({
  page,
}) => {
  await open(page);
  const before = await page.getByRole("option").count();

  await page.getByRole("button", { name: "Color-blind-safe only" }).click();

  const after = await page.getByRole("option").count();
  expect(after).toBeLessThan(before);
  await expect(page.getByRole("option", { name: /Accessible/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Pastel/ })).toHaveCount(0);
});

test("reverse flips the order of every strip", async ({ page }) => {
  await open(page);
  const before = await stripColors(page);

  await page.getByRole("button", { name: "Reverse" }).click();

  const after = await stripColors(page);
  expect(after).not.toEqual(before);
});

test("switching family replaces the palettes on offer", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("option", { name: /Spectrum/ })).toBeVisible();

  await page.getByRole("combobox", { name: "Family" }).click();
  await page.getByRole("option", { name: "Sequential", exact: true }).click();

  await expect(page.getByRole("option", { name: /Viridis/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Spectrum/ })).toHaveCount(0);
});

test("the picker has no serious or critical violations", async ({ page }) => {
  await open(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, impact: v.impact })),
  ).toEqual([]);
});

test("composed with ColorizePanel, Preset cascades beside the panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/preview/colorize-panel-stepper");

  await page.getByRole("button", { name: "Preset" }).click();
  const step = page.getByRole("dialog", { name: "Preset" });
  await expect(step).toBeVisible();
  await expect(step).toHaveAttribute("data-side", "inline-end");

  const geometry = async () => {
    const panel = (await page.locator('[data-slot="colorize-panel"]').boundingBox())!;
    const child = (await step.boundingBox())!;
    return {
      topDelta: Math.round(child.y - panel.y),
      gap: Math.round(child.x - (panel.x + panel.width)),
      panelWidth: Math.round(panel.width),
      stepWidth: Math.round(child.width),
    };
  };
  // Anchored to the panel, not to the Browse row inside it.
  await expect.poll(geometry).toEqual({
    topDelta: 0,
    gap: 5,
    panelWidth: 360,
    stepWidth: 420,
  });
});

test("choosing a palette recolours the categories behind it", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/preview/colorize-panel-stepper");

  const firstSwatch = page
    .getByRole("button", { name: /^Choose color for/ })
    .first();
  const before = await firstSwatch.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );

  await page.getByRole("button", { name: "Preset" }).click();
  await page
    .getByRole("dialog", { name: "Preset" })
    .getByRole("option", { name: /Accessible/ })
    .click();

  await expect
    .poll(() => firstSwatch.evaluate((e) => getComputedStyle(e).backgroundColor))
    .not.toBe(before);
});
