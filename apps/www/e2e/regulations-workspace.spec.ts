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
  // Nothing dimming the block when the scan runs.
  //
  // A sheet lays a backdrop over the workspace, and this scan is scoped to the
  // workspace -- so axe measures the contrast of text UNDER that scrim and
  // reports colour-contrast failures on markup that is fine a frame later.
  // Intermittent, because it depends on whether the analysis starts before or
  // after the fade: measured at the exact point this helper was called after
  // adding a zone, the backdrop was still at opacity 1 and took ~180ms to go,
  // and the suite failed roughly two runs in seven.
  await expect(
    page.locator("[data-slot=sheet-overlay], [data-slot=dialog-overlay]"),
  ).toHaveCount(0);

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

  await root.getByRole("button", { name: "Create regulation" }).click();
  const dialog = page.getByRole("dialog", { name: "Create regulation" });
  // One click on a card creates it, as production does. The cards are buttons
  // rather than radios precisely so this can be true without arrow keys
  // dropping a keyboard user into the editor for a type they passed.
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Multi-parking", exact: true }).click();

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
  // The search field is a tag input: a ticked zone becomes a chip in it, and
  // removing the chip unticks the zone.
  const search = sheet.getByRole("textbox", { name: "Search zones" });
  await search.fill("Belém");
  await sheet.getByRole("checkbox", { name: "Belém", exact: true }).click();
  await expect(sheet.locator("[data-slot=tag-input-chip]", { hasText: "Belém" })).toBeVisible();
  await sheet.getByRole("button", { name: "Remove Belém" }).click();
  await expect(sheet.getByRole("checkbox", { name: "Belém", exact: true })).not.toBeChecked();

  // Enter picks the top match without touching the list.
  //
  // Retried as a whole, because the picker filters on a useDeferredValue
  // (zone-picker.tsx:639) and React is allowed to let that lag -- which it
  // does when the rest of this file is running beside it and MapLibre has the
  // CPU. Enter then runs against the previous filter, finds no unselected
  // match, and onDraftCommit returns without clearing the field
  // (zone-picker.tsx:702-707): a silent no-op, so the keypress is simply lost.
  // toPass re-presses rather than waiting on a value that will never change;
  // it still fails if Enter never commits.
  await expect(async () => {
    await search.fill("Belém");
    await search.press("Enter");
    await expect(search).toHaveValue("");
  }).toPass({ timeout: 10_000 });
  await expect(sheet.locator("[data-slot=tag-input-chip]", { hasText: "Belém" })).toBeVisible();
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

test("a polygon drawn with the map's draw control joins the rule, and the tool returns to Select", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await expect(root.getByText("2 zones").first()).toBeVisible();

  // The same split control as the map workspace: the tool on the left, the
  // menu of tools behind the chevron.
  const map = root.getByRole("region", { name: "Map of the regulation's zones" });
  await map.getByRole("button", { name: "Choose a drawing tool" }).click();
  await page.getByRole("menuitemradio", { name: /Polygon/ }).click();
  await expect(map.getByRole("button", { name: "Draw a zone" })).toHaveAttribute("aria-pressed", "true");

  const box = (await map.boundingBox())!;
  for (const [x, y] of [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] as const) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await map.getByRole("button", { name: "Done" }).click();

  await expect(root.getByText("3 zones").first()).toBeVisible();
  await expect(map.getByRole("button", { name: "Draw a zone" })).toHaveAttribute("aria-pressed", "false");
});
