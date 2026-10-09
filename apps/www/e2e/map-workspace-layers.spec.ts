import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The data hub's sample feeds as map layers.
 *
 * Nothing here hardcodes a column or a category: the files are parsed at
 * runtime and every control is built from what `inferColumns` found, so the
 * assertions are about the SHAPE the data produces — a legend that names its
 * values, a count that matches the file — rather than about particular rows.
 * A feed added to the catalogue should make these pass unchanged.
 *
 * Each test loads a block that fetches CSVs of up to 700KB and parses WKT for
 * every row, on top of MapLibre and a Suspense boundary. Alone that is a few
 * seconds; with four workers sharing a machine the slowest run past the 30s
 * default, so the budget is raised for the fixture, not for the assertions.
 */
test.describe.configure({ timeout: 90_000 });

const WIDE = { width: 1500, height: 950 };

/**
 * The block itself.
 *
 * Every text assertion is scoped to this. The docs page prints the block's own
 * source underneath the demo, so a bare getByText("Rows on the map") matches
 * the rendered chart AND the string literal in the listing, and fails strict
 * mode for a reason that has nothing to do with the block.
 */
const block = (page: Page) => page.locator("[data-map-scheme]").first();

const card = (page: Page, name: string) =>
  page.locator('[data-slot="data-layer-card"]', { hasText: name }).first();

/**
 * The visibility toggle, by its accessible name.
 *
 * Not "the last button on the card": that is the eye only while the card is
 * collapsed, and the first click expands it, so a second click lands on
 * whatever control the expanded form happens to end with.
 */
const toggle = (page: Page, name: string) =>
  page.getByRole("button", {
    // Escaped: "Trips (MDS)" would otherwise read as a capture group and the
    // pattern would never match the label it was built from.
    name: new RegExp(`^(Show|Hide) ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  });

async function open(page: Page) {
  await page.goto("/blocks/map-workspace");
  await expect(page.getByRole("tab", { name: "Data" })).toBeVisible();
}

const zones = (page: Page) => page.getByRole("tab", { name: "Zones" });

test.describe("the layer list", () => {
  test.use({ viewport: WIDE });

  test("Data lists the feeds and Zones the areas", async ({ page }) => {
    await open(page);

    for (const name of ["Trips (MDS)", "Vehicle events", "Parking infringements"]) {
      await expect(card(page, name)).toBeVisible();
    }
    // Areas belong to the other tab, which is the distinction the hub draws.
    await expect(card(page, "Parking zones")).toHaveCount(0);

    await zones(page).click();

    for (const name of ["Parking zones", "Districts", "Night curfew · Bairro Alto"]) {
      await expect(card(page, name)).toBeVisible();
    }
    await expect(card(page, "Trips (MDS)")).toHaveCount(0);
  });

  test("search narrows the list it is looking at", async ({ page }) => {
    await open(page);
    const search = page.getByPlaceholder("Search data");
    await search.fill("infringe");

    await expect(card(page, "Parking infringements")).toBeVisible();
    await expect(card(page, "Vehicle events")).toHaveCount(0);

    await search.fill("nothing matches this");
    await expect(block(page).getByText(/Nothing here matches/)).toBeVisible();
  });

  test("a layer is a name and an eye until it is switched on", async ({ page }) => {
    await open(page);
    const events = card(page, "Vehicle events");
    await expect(events).toHaveAttribute("data-expanded", "false");

    await toggle(page, "Vehicle events").click();

    // Expanded follows visibility, and the controls arrive with the data.
    await expect(events).not.toHaveAttribute("data-expanded", "false");
    await expect(
      events.getByRole("radiogroup", { name: "Visualization type" }),
    ).toBeVisible();
    await expect(events.getByText(/Filters/)).toBeVisible();
  });
});

test.describe("a layer carries its own data", () => {
  test.use({ viewport: WIDE });

  test("the legend names the values found in the file", async ({ page }) => {
    await open(page);
    await toggle(page, "Parking infringements").click();

    const legend = card(page, "Parking infringements").locator(
      '[data-slot="legend-categorical"]',
    );
    await expect(legend).toBeVisible();
    // Counted from the rows, so the count is a fact about the file.
    const items = legend.locator("li");
    expect(await items.count()).toBeGreaterThan(1);
    // Every value is named; a swatch alone would be unusable in monochrome.
    for (const text of await items.allInnerTexts()) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test("the meta line counts the rows the filters leave", async ({ page }) => {
    await open(page);
    await toggle(page, "Parking infringements").click();

    const meta = card(page, "Parking infringements").getByText(
      /\d[\d,]* of \d[\d,]* ·/,
    );
    await expect(meta).toBeVisible();
    const [shown, total] = (await meta.innerText())
      .match(/([\d,]+) of ([\d,]+)/)!
      .slice(1)
      .map((n) => Number(n.replace(/,/g, "")));
    expect(shown).toBe(total);
    expect(total).toBeGreaterThan(100);
  });

  test("colorize offers the file's own columns, labelled", async ({ page }) => {
    await open(page);
    await toggle(page, "Parking infringements").click();
    await page.getByRole("button", { name: "Colorize Parking infringements" }).click();

    const step = page.locator('[data-slot="panel-step"][data-depth="1"]');
    await expect(step).toBeVisible();
    await step.locator("#color-by").click();

    // Labels from the hub's own column names, not the raw header.
    await expect(page.getByRole("option", { name: "Operator", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Fine", exact: true })).toBeVisible();
    // The geometry column is not something you colour by.
    await expect(page.getByRole("option", { name: "location", exact: true })).toHaveCount(0);
  });

  test("a numeric column switches the panel to the ramp body", async ({ page }) => {
    await open(page);
    await toggle(page, "Parking infringements").click();
    await page.getByRole("button", { name: "Colorize Parking infringements" }).click();

    const step = page.locator('[data-slot="panel-step"][data-depth="1"]');
    await step.locator("#color-by").click();
    await page.getByRole("option", { name: "Fine", exact: true }).click();

    await expect(step.locator('[data-slot="colorize-panel"]')).toHaveAttribute(
      "data-field-type",
      "number",
    );
    // And the card's legend follows the map off the category list.
    await expect(
      card(page, "Parking infringements").locator('[data-slot="legend-ramp"]'),
    ).toBeVisible();
  });

  test("an area layer offers zones, a point layer points", async ({ page }) => {
    await open(page);
    await toggle(page, "Parking infringements").click();
    const points = card(page, "Parking infringements");
    // Only what is actually painted is selectable. Asserted through the radio
    // rather than the label, because a disabled one has the reason appended to
    // its title and no longer matches on the name alone.
    await expect(points.getByRole("radio", { name: "Points" })).toBeEnabled();
    await expect(points.getByRole("radio", { name: "Zones" })).toBeDisabled();

    await zones(page).click();
    await toggle(page, "Districts").click();
    const areas = card(page, "Districts");
    await expect(areas.getByRole("radio", { name: "Zones" })).toBeEnabled();
    await expect(areas.getByRole("radio", { name: "Points" })).toBeDisabled();
  });
});

/**
 * Every feed, not a sample of them.
 *
 * The colorize chain is built from whatever `inferColumns` found, so a feed
 * whose columns the inference reads differently -- a regulation with three
 * rows, a file whose only category column never varies -- is exactly where it
 * would quietly produce a card with no legend and therefore no trigger, since
 * the trigger is laid over the legend. Walking the whole catalogue is the only
 * way that stays caught.
 */
const FEEDS: { tab: "Data" | "Zones"; name: string }[] = [
  { tab: "Data", name: "Trips (MDS)" },
  { tab: "Data", name: "Parking infringements" },
  { tab: "Data", name: "Vehicle events" },
  { tab: "Data", name: "Vehicle snapshot" },
  { tab: "Zones", name: "Parking zones" },
  { tab: "Zones", name: "Districts" },
  { tab: "Zones", name: "Speed limit · Baixa" },
  { tab: "Zones", name: "No parking · Historic centre" },
  { tab: "Zones", name: "Fleet cap per operator" },
  { tab: "Zones", name: "Night curfew · Bairro Alto" },
];

test.describe("every layer gets the chain", () => {
  test.use({ viewport: WIDE });

  for (const { tab, name } of FEEDS) {
    test(`${name} colorizes by its own columns`, async ({ page }) => {
      await open(page);
      await page.getByRole("tab", { name: tab }).click();
      await toggle(page, name).click();

      // A legend, because the trigger is laid over it.
      const legend = card(page, name).locator(
        '[data-slot="legend-categorical"], [data-slot="legend-ramp"]',
      );
      await expect(legend.first()).toBeVisible();

      const trigger = page.getByRole("button", { name: `Colorize ${name}` });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const step = page.locator('[data-slot="panel-step"][data-depth="1"]');
      await expect(step).toBeVisible();
      await expect(step).toHaveAttribute("data-side", "inline-end");

      // Fields from this file, named by the hub rather than by the raw header.
      await step.locator("#color-by").click();
      // Waited for, not slept on: reading the listbox the instant the trigger
      // is clicked returns an empty list on whichever layer happens to be slow.
      await expect(page.getByRole("option").first()).toBeVisible();
      const options = await page.getByRole("option").allInnerTexts();
      expect(options.length).toBeGreaterThan(1);
      expect(options.some((o) => /^[A-Z]/.test(o.trim()))).toBe(true);
      await page.keyboard.press("Escape");

      // And the chain goes a second step deep.
      await step.getByRole("button", { name: "Preset" }).click();
      const preset = page.locator('[data-slot="panel-step"][data-depth="2"]');
      await expect(preset).toBeVisible();
      await expect(preset.getByRole("option").first()).toBeVisible();
    });
  }

  test("opening one layer's chain closes another's", async ({ page }) => {
    await open(page);
    await toggle(page, "Vehicle events").click();
    await toggle(page, "Parking infringements").click();

    await page.getByRole("button", { name: "Colorize Vehicle events" }).click();
    await expect(page.locator('[data-slot="panel-step"][data-depth="1"]')).toHaveCount(1);

    await page.getByRole("button", { name: "Colorize Parking infringements" }).click();

    // One path, so one chain: the stepper truncates rather than stacking.
    const open_ = page.locator('[data-slot="panel-step"][data-depth="1"]');
    await expect(open_).toHaveCount(1);
    // By its heading, not aria-label: cascaded, the step is named through
    // PopoverTitle and aria-labelledby. Only the docked form sets aria-label.
    await expect(open_).toContainText("Parking infringements");
  });

  test("the Z\u00fcrich layer keeps its own chain", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Colorize Vehicle Flows" }).click();
    const step = page.locator('[data-slot="panel-step"][data-depth="1"]');
    await expect(step).toBeVisible();
    await step.getByRole("button", { name: "Preset" }).click();
    await expect(page.locator('[data-slot="panel-step"][data-depth="2"]')).toBeVisible();
  });
});

test.describe("the charts follow the layer", () => {
  test.use({ viewport: WIDE });

  const source = (page: Page) =>
    page.getByRole("combobox", { name: "Chart source layer" });

  test("switching a layer on points the charts at it", async ({ page }) => {
    await open(page);
    await expect(source(page)).toContainText("Vehicle Flows");

    await toggle(page, "Vehicle events").click();

    // The selection survives the fetch -- it used to bounce straight back to
    // the flows, because the fallback fired before any rows had arrived.
    await expect(source(page)).toContainText("Vehicle events");
    await expect(block(page).getByText("Rows on the map")).toBeVisible();
    await expect(block(page).getByText(/^By /).first()).toBeVisible();
  });

  test("switching it off hands the charts back", async ({ page }) => {
    await open(page);
    await toggle(page, "Vehicle events").click();
    await expect(source(page)).toContainText("Vehicle events");

    await toggle(page, "Vehicle events").click();

    await expect(source(page)).toContainText("Vehicle Flows");
  });
});

test("the layer panel has no serious or critical violations", async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page);
  await toggle(page, "Parking infringements").click();
  await expect(
    card(page, "Parking infringements").locator('[data-slot="legend-categorical"]'),
  ).toBeVisible();

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
