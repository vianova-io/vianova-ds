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

async function open(page: Page, viewport = { width: 1440, height: 1000 }) {
  await page.setViewportSize(viewport);
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

test("on a phone, rules are a strip and settings and map take turns", async ({ page }) => {
  const root = await open(page, { width: 390, height: 844 });
  await root.locator("[data-slot=regulation-link]", { hasText: "Parking · Baixa and Chiado" }).click();

  // The rules read as one horizontal row, and nothing pushes the page sideways.
  const tabs = root.getByRole("tablist", { name: "Rules" }).getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  const [a, b] = [await tabs.nth(0).boundingBox(), await tabs.nth(1).boundingBox()];
  expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const map = root.getByRole("region", { name: "Map of the regulation's zones" });
  // The radios are sr-only inside their labels, so a person taps the label.
  const show = (name: string) =>
    root.locator("[data-slot=regulation-pane-switcher] label", { hasText: name }).click();
  await expect(map).toBeHidden();
  await expectNoBlockingViolations(page);

  // The map pane shows a real map, not the 0x0 canvas it was created with.
  await show("Map");
  await expect(map).toBeVisible();
  await expect(root.getByRole("tablist", { name: "Rules" })).toBeHidden();
  await expect
    .poll(async () => (await map.locator(".maplibregl-canvas").boundingBox())?.width ?? 0)
    .toBeGreaterThan(300);
  await expectNoBlockingViolations(page);

  // Locating a zone from the settings brings the map back.
  await show("Settings");
  await root.getByRole("button", { name: /^Show .+ on the map$/ }).first().click();
  await expect(map).toBeVisible();

  // With no ⋯ on the chips, the rule's own menu duplicates it.
  await show("Settings");
  await root.getByRole("button", { name: "Actions for Parking bays" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(root.getByRole("tab", { name: /Parking bays \(copy\)/ })).toHaveAttribute("aria-selected", "true");
  await expect(root.getByRole("radio", { name: "Settings, edited" })).toBeChecked();
});
