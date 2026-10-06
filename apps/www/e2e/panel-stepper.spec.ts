import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The cascade's rules, which are behavioural rather than visual and so are not
 * covered by a screenshot.
 *
 * Assertions go through `[data-open]` and `aria-expanded` rather than
 * visibility: a closing panel stays in the DOM until its exit animation ends,
 * and an element at opacity 0 is still "visible" to Playwright. Open state is
 * the thing being tested anyway.
 */

const OPEN_PANEL = '[data-slot="panel-step"][data-open]';

/**
 * The preview page centres its content, so the chain needs room on BOTH sides
 * of centre: half the viewport has to clear the trigger plus 360 + 5 + 420, or
 * the second step flips to the left and the gap reads as -785.
 */
async function openChain(page: Page) {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto("/preview/panel-stepper-default");
  await page.getByRole("button", { name: "Colorize", exact: true }).click();
  await expect(page.locator(OPEN_PANEL)).toHaveCount(1);
}

/** The preset row: the only expandable control in the panel with no label. */
function presetRow(colorize: Locator) {
  return colorize.locator("button[aria-expanded]:not([aria-label])").first();
}

test("a step anchors to the previous panel, not to the row that opened it", async ({
  page,
}) => {
  await openChain(page);
  const colorize = page.getByRole("dialog", { name: "Colorize" });
  const row = presetRow(colorize);
  const rowBox = (await row.boundingBox())!;
  await row.click();

  const preset = page.getByRole("dialog", { name: "Preset" });
  await expect(preset).toBeVisible();

  // Polled, not read once: the entrance animation zooms from 95%, which moves
  // the measured box by ~9px until it settles.
  const geometry = async () => {
    const parent = (await colorize.boundingBox())!;
    const child = (await preset.boundingBox())!;
    return {
      topDelta: Math.round(child.y - parent.y),
      gap: Math.round(child.x - (parent.x + parent.width)),
      parentWidth: Math.round(parent.width),
      childWidth: Math.round(child.width),
    };
  };
  // Anchored to the panel: tops line up with the PANEL, and it sits beside it
  // with the 5px gap. Stated for the un-flipped case; the collision flip is its
  // own behaviour and gets its own test when the responsive mode lands.
  await expect(preset).toHaveAttribute("data-side", "inline-end");
  await expect.poll(geometry).toEqual({
    topDelta: 0,
    gap: 5,
    parentWidth: 360,
    childWidth: 420,
  });

  // ...which is NOT where the row that opened it sits.
  const settled = (await preset.boundingBox())!;
  expect(Math.abs(settled.y - rowBox.y)).toBeGreaterThan(20);
});

test("opening a different child closes the current one", async ({ page }) => {
  await openChain(page);
  const colorize = page.getByRole("dialog", { name: "Colorize" });

  await presetRow(colorize).click();
  await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();
  await expect(page.locator(OPEN_PANEL)).toHaveCount(2);

  await colorize.getByRole("button", { name: /^Choose color for/ }).first().click();

  // Still two open, but the second is now the picker: the chain never stacks a
  // third sibling level.
  await expect(page.locator(OPEN_PANEL)).toHaveCount(2);
  await expect(
    page.locator(`${OPEN_PANEL}[aria-labelledby]`).nth(1),
  ).toContainText("Color for");
  await expect(
    page.getByRole("dialog", { name: "Preset" }).and(page.locator("[data-open]")),
  ).toHaveCount(0);
});

test("escape closes the innermost step only, and restores focus to its trigger", async ({
  page,
}) => {
  await openChain(page);
  const colorize = page.getByRole("dialog", { name: "Colorize" });
  const row = presetRow(colorize);
  await row.click();
  await expect(page.locator(OPEN_PANEL)).toHaveCount(2);

  await page.keyboard.press("Escape");

  await expect(page.locator(OPEN_PANEL)).toHaveCount(1);
  await expect(colorize).toBeVisible();
  await expect(row).toBeFocused();
});

test("closing a parent closes its descendants and restores focus", async ({
  page,
}) => {
  await openChain(page);
  const trigger = page.getByRole("button", { name: "Colorize", exact: true });
  const colorize = page.getByRole("dialog", { name: "Colorize" });
  await presetRow(colorize).click();
  await expect(page.locator(OPEN_PANEL)).toHaveCount(2);

  await colorize.getByRole("button", { name: "Close" }).click();

  await expect(page.locator(OPEN_PANEL)).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("the chain is non-modal: a press inside a child leaves the parent open", async ({
  page,
}) => {
  await openChain(page);
  const colorize = page.getByRole("dialog", { name: "Colorize" });
  await presetRow(colorize).click();
  const preset = page.getByRole("dialog", { name: "Preset" });
  await expect(preset).toBeVisible();

  await preset.getByRole("button", { name: "Pastel" }).click();

  await expect(page.locator(OPEN_PANEL)).toHaveCount(2);
  // Nothing behind the panels is blocked out.
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
});

test("the open chain has no serious or critical violations", async ({ page }) => {
  await openChain(page);
  await presetRow(page.getByRole("dialog", { name: "Colorize" })).click();
  await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  ).toEqual([]);
});

/**
 * Below lg the cascade has nowhere to go, so panels dock to the bottom of
 * their container and show one at a time. The breakpoint matches the map
 * blocks, which dock their own panels at exactly the same width.
 */
test.describe("docked below lg", () => {
  async function openDockedChain(page: Page) {
    await page.setViewportSize({ width: 900, height: 820 });
    await page.goto("/preview/panel-stepper-default");
    await page.getByRole("button", { name: "Colorize", exact: true }).click();
    const colorize = page.getByRole("dialog", { name: "Colorize" });
    await expect(colorize).toBeVisible();
    await presetRow(colorize).click();
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();
  }

  test("shows only the deepest step, keeping its ancestors mounted", async ({
    page,
  }) => {
    await openDockedChain(page);

    // Both exist -- a nested step is declared inside its parent's content, so
    // unmounting the parent would leave nothing to step back to.
    await expect(page.locator('[data-slot="panel-step"][data-docked]')).toHaveCount(2);
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();
    await expect(page.locator('[data-slot="panel-step"][data-depth="1"]')).toBeHidden();

    const dock = page.locator('[data-slot="panel-stepper-dock"]');
    await expect(dock).toBeVisible();
    const dockBox = (await dock.boundingBox())!;
    const panelBox = (await page.getByRole("dialog", { name: "Preset" }).boundingBox())!;
    // Full width of the dock, not a 420px column.
    expect(Math.round(panelBox.width)).toBe(Math.round(dockBox.width));
  });

  test("no popover dialog is wired to a trigger while docked", async ({ page }) => {
    await openDockedChain(page);

    // The whole reason this is a mode switch rather than two rendered copies:
    // a cascade popover hidden by CSS would still own aria-controls and focus.
    const dialogs = page.locator('[data-slot="panel-step"]');
    const count = await dialogs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(dialogs.nth(i)).toHaveAttribute("data-docked", "");
    }
  });

  test("back steps up one and restores focus to the row that opened it", async ({
    page,
  }) => {
    // The row id has to be read before Preset opens: once it is the deepest
    // step its parent is display:none, which correctly takes the parent out of
    // the accessibility tree, so no role query can reach it.
    await page.setViewportSize({ width: 900, height: 820 });
    await page.goto("/preview/panel-stepper-default");
    await page.getByRole("button", { name: "Colorize", exact: true }).click();
    const row = presetRow(page.getByRole("dialog", { name: "Colorize" }));
    const rowId = await row.getAttribute("id");
    await row.click();
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();

    await expect(page.getByRole("dialog", { name: "Preset" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Colorize" })).toBeVisible();
    await expect(page.locator(`[id="${rowId}"]`)).toBeFocused();
  });

  test("close dismisses the chain and restores focus to the first trigger", async ({
    page,
  }) => {
    await openDockedChain(page);
    const trigger = page.getByRole("button", { name: "Colorize", exact: true });

    await page
      .getByRole("dialog", { name: "Preset" })
      .getByRole("button", { name: "Close" })
      .click();

    await expect(page.locator('[data-slot="panel-step"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="panel-stepper-dock"]')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the open path survives crossing the breakpoint", async ({ page }) => {
    await openChain(page);
    await presetRow(page.getByRole("dialog", { name: "Colorize" })).click();
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();

    await page.setViewportSize({ width: 900, height: 820 });

    // Same step still open, now docked rather than cascading.
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();
    await expect(
      page.locator('[data-slot="panel-step"][data-docked][data-depth="2"]'),
    ).toHaveCount(1);
  });

  test("the docked chain has no serious or critical violations", async ({
    page,
  }) => {
    await openDockedChain(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations
        .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
        .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    ).toEqual([]);
  });
});
