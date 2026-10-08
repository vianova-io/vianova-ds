import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The colorize flow on the map workspace: legend -> Colorize -> Preset, with
 * the map repainting as you go.
 *
 * Three things here are worth stating because they are easy to get wrong when
 * reading a failure.
 *
 * 1. **Geometry is read with `expect.poll`, never once.** The panels enter with
 *    `zoom-in-95`, so a box measured mid-animation is 95% of its real size and
 *    offset by half the difference. A single read is a coin toss.
 * 2. **The chain needs room.** The data panel is 340px at `lg:left-4`, and the
 *    chain is 340 + 360 + 420 plus gaps. The project viewport is 900px wide, so
 *    every cascade test sets its own.
 * 3. **The map is not assumed to have painted.** map-canvas falls back to a
 *    token-free style whose tiles may not load in CI, so the repaint test
 *    checks the canvas has content before trusting a pixel comparison.
 */

/**
 * Every test here loads the map workspace: a 2MB GeoJSON, MapLibre, and a block
 * that hydrates behind a Suspense boundary. Each is a few seconds alone, but
 * with four workers sharing one machine the slowest have run past the 30s
 * default -- which showed up as a click "not finding" a button that was plainly
 * there. The budget is about the fixture, not about what is asserted.
 */
test.describe.configure({ timeout: 60_000 });

const WIDE = { width: 1500, height: 950 };

/** The control laid over the layer's legend. */
const legendTrigger = (page: Page) =>
  page.getByRole("button", { name: "Colorize Vehicle Flows" });

const step = (page: Page, depth: 1 | 2) =>
  page.locator(`[data-slot="panel-step"][data-depth="${depth}"]`);

async function openWorkspace(page: Page) {
  await page.goto("/blocks/map-workspace");
  await expect(legendTrigger(page)).toBeVisible();
}

/** Where `child` sits relative to `parent`, in whole pixels. */
async function relate(parent: Locator, child: Locator) {
  const a = (await parent.boundingBox())!;
  const b = (await child.boundingBox())!;
  return {
    gap: Math.round(b.x - (a.x + a.width)),
    topDelta: Math.round(b.y - a.y),
    width: Math.round(b.width),
  };
}

test.describe("the cascade", () => {
  test.use({ viewport: WIDE });

  test("the legend opens Colorize beside the data panel, not beside itself", async ({
    page,
  }) => {
    await openWorkspace(page);
    const trigger = legendTrigger(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();

    const colorize = step(page, 1);
    await expect(colorize).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(colorize).toHaveAttribute("data-side", "inline-end");

    // Anchored to the PANEL: top edges flush, and the gap measured from the
    // panel's right edge rather than from the legend's.
    const panel = page.locator('[data-slot="floating-panel"]').first();
    await expect
      .poll(() => relate(panel, colorize))
      .toEqual({ gap: 5, topDelta: 0, width: 360 });
  });

  test("Preset cascades beside Colorize, and the chain fits", async ({
    page,
  }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();

    const colorize = step(page, 1);
    const browse = colorize.getByRole("button", { name: "Preset" });
    await expect(browse).toHaveAttribute("aria-expanded", "false");

    await browse.click();

    const preset = step(page, 2);
    await expect(preset).toBeVisible();
    await expect(browse).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() => relate(colorize, preset))
      .toEqual({ gap: 5, topDelta: 0, width: 420 });

    // Three panels on screen at once is the whole point -- the parent stays
    // readable and interactive while its child is open.
    await expect(page.locator('[data-slot="floating-panel"]').first()).toBeVisible();
    await expect(colorize).toBeVisible();
    await expect(preset.getByRole("option").first()).toBeVisible();
  });

  test("closing Colorize takes Preset with it", async ({ page }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();
    await step(page, 1).getByRole("button", { name: "Preset" }).click();
    await expect(step(page, 2)).toBeVisible();

    await step(page, 1).getByRole("button", { name: "Close" }).click();

    await expect(step(page, 1)).toBeHidden();
    await expect(step(page, 2)).toBeHidden();
    await expect(legendTrigger(page)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("colouring by a category", () => {
  test.use({ viewport: WIDE });

  /** Switches "Color by" to a named field. */
  async function colorBy(page: Page, label: string) {
    await step(page, 1).locator("#color-by").click();
    await page.getByRole("option", { name: label, exact: true }).click();
  }

  test("a string field swaps the ramp legend for categories, counted from the data", async ({
    page,
  }) => {
    await openWorkspace(page);
    await expect(page.locator('[data-slot="legend-ramp"]')).toBeVisible();

    await legendTrigger(page).click();
    await colorBy(page, "Road type");

    const panel = step(page, 1).locator('[data-slot="colorize-panel"]');
    await expect(panel).toHaveAttribute("data-field-type", "string");

    // The count is a fact about the loaded GeoJSON, not a constant: 13 road
    // types are present and the panel shows the commonest 8.
    await expect(panel.getByText(/showing top 8 of 13 values/)).toBeVisible();

    // The card's legend follows the map, and names its values -- a category
    // list distinguished only by colour is unusable by the people the
    // colour-blind-safe filter exists for.
    const legend = page.locator('[data-slot="legend-categorical"]');
    await expect(legend).toBeVisible();
    await expect(page.locator('[data-slot="legend-ramp"]')).toHaveCount(0);
    await expect(legend.locator("li")).toHaveCount(8);

    // Labelled, not raw: the column holds "motorway_link".
    await expect(legend.getByText("Motorway link")).toBeVisible();
  });

  test("an aggregate visualisation keeps the ramp, whatever the panel says", async ({
    page,
  }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();
    await colorBy(page, "Road type");
    await expect(page.locator('[data-slot="legend-categorical"]')).toBeVisible();

    // A grid cell sums many segments, so it has no single road type -- and no
    // honest category legend. Both fall back together.
    //
    // The label, not the radio: SegmentedControl's input is sr-only and the
    // visualisation glyph sits over it, so a click on the input is intercepted
    // by the SVG. Clicking the label is what a pointer user does anyway.
    await page.locator('label[title="Grid"]').click();

    await expect(page.locator('[data-slot="legend-ramp"]')).toBeVisible();
    await expect(page.locator('[data-slot="legend-categorical"]')).toHaveCount(0);
  });

  test("choosing a preset recolours the legend swatches", async ({ page }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();
    await colorBy(page, "Road type");

    const swatchColors = () =>
      page
        .locator('[data-slot="legend-categorical"] li > span[aria-hidden]')
        .evaluateAll((els) =>
          els.map((e) => getComputedStyle(e).backgroundColor),
        );
    const before = await swatchColors();

    await step(page, 1).getByRole("button", { name: "Preset" }).click();
    await step(page, 2).getByRole("option", { name: /Accessible/ }).click();

    await expect.poll(swatchColors).not.toEqual(before);
  });
});

test.describe("colouring by a measure", () => {
  test.use({ viewport: WIDE });

  test("the Preset row names the ramp the map is painted with", async ({
    page,
  }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();

    const row = step(page, 1).getByRole("button", { name: "Preset" });
    // The scheme's own ramp, and no Custom badge until something is edited.
    // Both used to be hardcoded: the row said "Greys" whatever the layer was
    // painted with, and claimed Custom before anyone had touched a stop.
    await expect(row).toContainText(/Viridis|Brand/);
    await expect(row).not.toContainText("Greys");
    await expect(step(page, 1).getByText("Custom", { exact: true })).toHaveCount(0);
  });

  test("the preset browser offers ramps for a measure, not category sets", async ({
    page,
  }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();
    await step(page, 1).getByRole("button", { name: "Preset" }).click();

    const preset = step(page, 2);
    await expect(preset.getByRole("option", { name: /Viridis/ })).toBeVisible();
    // A set with no order would imply one over a measure, and vice versa.
    await expect(preset.getByRole("option", { name: /Spectrum/ })).toHaveCount(0);
  });

  test("choosing a ramp repaints the legend and marks nothing custom", async ({
    page,
  }) => {
    await openWorkspace(page);
    // The card shows a Skeleton until the 2MB GeoJSON lands, and a skeleton
    // has no bands to compare.
    await expect(page.locator('[data-slot="legend-ramp"]')).toBeVisible();

    const rampColors = () =>
      page
        .locator('[data-slot="legend-ramp"] > div > div')
        .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    const before = await rampColors();
    expect(before.length).toBeGreaterThan(2);

    await legendTrigger(page).click();
    await step(page, 1).getByRole("button", { name: "Preset" }).click();
    await step(page, 2).getByRole("option", { name: /Heat/ }).click();

    // The card's legend is the same ramp the layer is painted with, so it has
    // to follow -- it reads explicit colours now, not the scheme's tokens.
    await expect.poll(rampColors).not.toEqual(before);
    await expect(
      step(page, 1).getByRole("button", { name: "Preset" }),
    ).toContainText("Heat");
  });
});

test.describe("the map repaints", () => {
  test.use({ viewport: WIDE });

  /**
   * The canvas, as a PNG.
   *
   * MapLibre does not keep its drawing buffer, so the pixels have to come from
   * a composited screenshot rather than from `toDataURL`.
   */
  const canvasShot = (page: Page) =>
    page.locator("canvas.maplibregl-canvas").screenshot();

  test("switching the colour field changes what is drawn", async ({ page }) => {
    await openWorkspace(page);
    // The lines are GeoJSON and need no tiles, but they are only drawn once the
    // style has loaded; give it a moment to settle rather than racing it.
    await page.waitForTimeout(2500);

    const before = await canvasShot(page);
    // A canvas that never painted is a uniform block, and comparing two of
    // those proves nothing. Skip rather than pass vacuously.
    const distinctBytes = new Set(before.subarray(0, 4096)).size;
    test.skip(
      distinctBytes < 16,
      "the basemap did not paint, so a pixel comparison would be vacuous",
    );

    await legendTrigger(page).click();
    await step(page, 1).locator("#color-by").click();
    await page.getByRole("option", { name: "Road type", exact: true }).click();
    await page.waitForTimeout(1200);

    // Measured with the panels closed, so the difference is the map and not
    // the chain sitting over it.
    await page.keyboard.press("Escape");
    await expect(step(page, 1)).toBeHidden();
    await page.waitForTimeout(600);

    expect(await canvasShot(page)).not.toEqual(before);
  });
});

test.describe("docked below lg", () => {
  test.use({ viewport: { width: 900, height: 820 } });

  test("one panel at a time, and Back steps up rather than closing", async ({
    page,
  }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();

    const colorize = page.locator('[data-slot="panel-step"][data-docked]').first();
    await expect(colorize).toBeVisible();

    await page.getByRole("button", { name: "Preset" }).click();

    // The parent stays mounted -- a nested step is declared inside it -- but
    // only the deepest one shows.
    const panels = page.locator('[data-slot="panel-step"][data-docked]');
    await expect(panels).toHaveCount(2);
    await expect(page.getByRole("dialog", { name: "Preset" })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();

    await expect(page.getByRole("dialog", { name: "Preset" })).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: /^Colorize/ }),
    ).toBeVisible();
  });

  test("Back and Close both leave focus on a real control", async ({ page }) => {
    await openWorkspace(page);
    await legendTrigger(page).click();
    await page.getByRole("button", { name: "Preset" }).click();

    await page.getByRole("button", { name: "Back" }).click();
    // Back returns to the control that opened the step -- the Preset row --
    // not to the body.
    await expect(page.getByRole("button", { name: "Preset" })).toBeFocused();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(legendTrigger(page)).toBeFocused();
  });
});

test("the open chain has no serious or critical violations", async ({ page }) => {
  // Axe walks the whole block, MapLibre's DOM included, and this page is the
  // heaviest in the suite: ~18s alone, past 30s when four workers are sharing
  // the machine. The default timeout makes it a load-dependent coin toss.
  test.setTimeout(90_000);
  await page.setViewportSize(WIDE);
  await openWorkspace(page);
  await legendTrigger(page).click();
  await step(page, 1).getByRole("button", { name: "Preset" }).click();
  await expect(step(page, 2)).toBeVisible();

  const results = await new AxeBuilder({ page })
    // MapLibre's own canvas and attribution are not ours to fix.
    .exclude(".maplibregl-canvas-container")
    .exclude(".maplibregl-ctrl-attrib")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  ).toEqual([]);
});
