import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The dashboard canvas, where the V2 add-widget flow lives.
 *
 * The block opens on the dashboard list, so the a11y and focus-ring crawls
 * never reach the canvas. The canvas is the workspace, so it is reached here.
 *
 * What V2 changed: the toolbar's `+` used to insert a widget. It now only
 * takes you to the first free cell, and the cell offers Chart or Text. A
 * button that visibly does nothing reads as broken, so arriving there raises a
 * hint saying what happened -- which is the thing these tests pin.
 */

/** The rendered hint, not the same sentence inside the printed source. */
function hintTooltip(page: Page) {
  return page
    .locator("[data-slot=tooltip-content]")
    .filter({ hasText: "Nothing added yet" });
}

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blocks/reports-workspace");
  await settle(page);
  const root = page.locator("[data-slot=reports-workspace]");
  await expect(root.getByRole("heading", { name: "Dashboards" })).toBeVisible();

  // Into the first dashboard, where the canvas is.
  await root.locator("[data-slot=report-link]").first().click();
  await expect(root.getByRole("group", { name: "Dashboard canvas" })).toBeVisible();
  return root;
}

test("the + goes to the first free cell and says it added nothing", async ({
  page,
}) => {
  const root = await openEditor(page);
  const canvas = root.getByRole("group", { name: "Dashboard canvas" });
  const before = await canvas.locator("[data-slot=report-widget]").count();

  await root.getByRole("button", { name: "Go to the first free cell" }).click();

  // The hint, which is the whole point: the + no longer inserts.
  //
  // Scoped to the tooltip itself: this page also prints the block's source,
  // so the bare string matches the code listing as well.
  await expect(hintTooltip(page)).toHaveText(
    "Nothing added yet — choose Widget or Text here.",
  );

  // And it really did not insert.
  expect(await canvas.locator("[data-slot=report-widget]").count()).toBe(before);

  // The cell it landed on holds focus and offers the two ways in.
  await expect(canvas.getByRole("button", { name: "Create a widget here" })).toBeVisible();
  await expect(canvas.getByRole("button", { name: "Create text here" })).toBeVisible();
});

test("the hint goes on its own, without being dismissed", async ({ page }) => {
  const root = await openEditor(page);
  await root.getByRole("button", { name: "Go to the first free cell" }).click();

  const hint = hintTooltip(page);
  await expect(hint).toBeVisible();
  // It is a nudge, not a notice: nothing is clicked to clear it.
  await expect(hint).toBeHidden({ timeout: 10_000 });
});

test("the hint is announced, not only drawn", async ({ page }) => {
  const root = await openEditor(page);
  await root.getByRole("button", { name: "Go to the first free cell" }).click();

  // Sighted users get the tooltip; the live region carries the same fact.
  await expect(
    root.locator("[aria-live=polite]").filter({ hasText: "Nothing was added" }),
  ).toHaveCount(1);
});
