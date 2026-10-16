import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The regulations workspace's flow: list → new regulation → editor → save →
 * back to the list.
 *
 * The block crawls in a11y.spec and focus-ring.spec only ever see the list,
 * because that is what the block opens on. The editor -- a rule rail, an
 * accordion of settings, a sheet, a save bar -- is most of the workspace, so
 * it is reached here and judged by the same axe rules.
 */

const BLOCKING = new Set(["serious", "critical"]);

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blocks/regulations-workspace");
  await settle(page);
  const root = page.locator("[data-slot=regulations-workspace]");
  await expect(root.getByRole("heading", { name: "Regulations" })).toBeVisible();
  return root;
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("[data-slot=regulations-workspace]")
    // MapLibre's own canvas and controls are not ours to fix.
    .exclude(".maplibregl-canvas, .maplibregl-ctrl")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("a new regulation is created from a type, edited and saved", async ({ page }) => {
  const root = await open(page);
  const before = await root.locator("[data-slot=regulation-link]").count();

  await root.getByRole("button", { name: "New regulation" }).click();
  const dialog = page.getByRole("dialog", { name: "New regulation" });
  const create = dialog.getByRole("button", { name: "Create regulation" });
  // Choosing is not creating: nothing happens until the button is pressed.
  await expect(create).toBeDisabled();
  await dialog.getByRole("radio", { name: "Multi-parking" }).click();
  await create.click();

  // Multi-parking opens on a parking rule, as production does, with the rail.
  await expect(root.getByRole("tablist", { name: "Rules" })).toBeVisible();
  await expect(root.getByRole("tab", { name: /Parking 1/ })).toHaveAttribute("aria-selected", "true");
  await expect(root.getByText("Not saved yet")).toBeVisible();
  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Create regulation" }).click();
  await expect(root.getByText("All changes saved")).toBeVisible();

  await root.getByRole("button", { name: "Regulations", exact: true }).click();
  // The list opens on active regulations, and the new one starts today.
  await expect(root.locator("[data-slot=regulation-link]")).toHaveCount(before + 1);
});

test("leaving with unsaved changes asks first, and Keep editing keeps them", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Speed limit · Baixa" }).click();
  await expect(root.getByText("All changes saved")).toBeVisible();

  await root.getByLabel("Speed limit").fill("20");
  await expect(root.getByText("Unsaved changes")).toBeVisible();

  await root.getByRole("button", { name: "Regulations", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Leave without saving?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(root.getByLabel("Speed limit")).toHaveValue("20");

  await root.getByRole("button", { name: "Discard" }).click();
  await expect(root.getByLabel("Speed limit")).toHaveValue("15");
});

test("zones added from the picker land in the rule", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await expect(root.getByText("2 zones").first()).toBeVisible();

  await root.getByRole("button", { name: "Add zones" }).click();
  const sheet = page.getByRole("dialog", { name: "Add zones" });
  await sheet.getByRole("textbox").first().fill("Belém");
  await sheet.getByRole("checkbox", { name: "Belém", exact: true }).click();
  await sheet.getByRole("button", { name: "Add 1 zone" }).click();

  await expect(root.getByText("3 zones").first()).toBeVisible();
  await expect(root.getByText("Unsaved changes")).toBeVisible();
  await expectNoBlockingViolations(page);
});
