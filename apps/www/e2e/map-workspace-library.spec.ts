import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The data library: the catalogue the + button opens.
 *
 * The panel behind it lists what the map has; this lists what it could have.
 * That split is the whole control, and it is why the panel no longer arrives
 * with every sample feed already in it — a button that adds something has to
 * have something left to add. These tests are mostly about that invariant
 * holding at both ends: the panel starts bare, and what the dialog says it
 * added is what the panel ends up showing.
 *
 * Each run loads a block with MapLibre and parses CSVs when a layer switches
 * on, so the budget is raised for the fixture rather than for the assertions.
 */
test.describe.configure({ timeout: 90_000 });

const WIDE = { width: 1500, height: 950 };

const dialog = (page: Page) => page.locator("[data-slot=data-library]");
/**
 * The block itself.
 *
 * Text assertions are scoped to it. The docs page prints the block's source
 * under the demo, so a bare getByText("No other layers yet.") matches the
 * rendered panel AND the string literal in the listing, and fails strict mode
 * for a reason that has nothing to do with the block.
 */
const block = (page: Page) => page.locator("[data-map-scheme]").first();
const cards = (page: Page) => dialog(page).locator("[data-slot=library-card]");
const panelCards = (page: Page) => page.locator('[data-slot="data-layer-card"]');

async function open(page: Page) {
  await page.goto("/blocks/map-workspace");
  await expect(page.getByRole("tab", { name: "Data" })).toBeVisible();
}

async function openLibrary(page: Page) {
  await page.getByRole("button", { name: "Add data layer" }).click();
  await expect(dialog(page)).toBeVisible();
}

/** The card titles on screen, in the order the grid has them. */
const titles = (page: Page) =>
  cards(page).locator("span.text-sm").allInnerTexts();

test.describe("the data library", () => {
  test.use({ viewport: WIDE });

  test("the map starts with its own layer and nothing else", async ({ page }) => {
    await open(page);

    // Zürich's flows, and no sample feeds: those are added, not pre-listed.
    await expect(panelCards(page)).toHaveCount(1);
    await expect(panelCards(page).first()).toContainText("Vehicle Flows");
    // And the panel says so, with the way out of it.
    await expect(
      block(page).getByText("No other layers yet.", { exact: true }),
    ).toBeVisible();
  });

  test("each tab offers its own section of the catalogue", async ({ page }) => {
    await open(page);
    await openLibrary(page);

    // The counts come from the fixtures' own `section` field, which is what
    // the tabs are built from — a feed added to the catalogue lands in the
    // right tab without this dialog knowing it exists.
    for (const [tab, count] of [
      ["Data", 4],
      ["Zones", 2],
      ["Regulations", 4],
    ] as const) {
      await dialog(page).getByRole("tab", { name: tab }).click();
      await expect(cards(page)).toHaveCount(count);
    }
  });

  test("search filters, and sort reorders", async ({ page }) => {
    await open(page);
    await openLibrary(page);

    const search = dialog(page).getByLabel("Search the library");
    await search.fill("parking");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Parking infringements");

    await search.fill("nothing matches this");
    await expect(
      dialog(page).getByText("Nothing matches", { exact: true }),
    ).toBeVisible();
    await search.fill("");

    // Most recent first by default; by name is a different order, and the
    // assertion is that it changed rather than that it equals one list.
    const recent = await titles(page);
    await dialog(page).getByLabel("Sort by").click();
    await page.getByRole("option", { name: "Name (A–Z)" }).click();
    const byName = await titles(page);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    expect(byName).not.toEqual(recent);
  });

  test("what it says it added is what the panel shows", async ({ page }) => {
    await open(page);
    await openLibrary(page);

    await cards(page).nth(0).click();
    await cards(page).nth(1).click();
    const picked = (await titles(page)).slice(0, 2);

    // The button counts, so it cannot promise one thing and do another.
    const add = dialog(page).getByRole("button", { name: "Add 2 layers" });
    await expect(add).toBeVisible();
    await expect(dialog(page).getByText("2 selected", { exact: true })).toBeVisible();
    await add.click();
    await expect(dialog(page)).toBeHidden();

    // Zürich's layer plus the two.
    await expect(panelCards(page)).toHaveCount(3);
    for (const name of picked) {
      await expect(panelCards(page).filter({ hasText: name })).toHaveCount(1);
    }
  });

  test("adding switches the layer on rather than listing it dark", async ({
    page,
  }) => {
    await open(page);
    await openLibrary(page);

    await cards(page).filter({ hasText: "Parking infringements" }).click();
    await dialog(page).getByRole("button", { name: "Add layer" }).click();

    // You asked for the layer, so it is drawn: the eye reads as hide, and the
    // card has opened onto its controls.
    const card = panelCards(page).filter({ hasText: "Parking infringements" });
    await expect(
      card.getByRole("button", { name: "Hide Parking infringements" }),
    ).toBeVisible();
    await expect(card).not.toHaveAttribute("data-expanded", "false");
  });

  test("a layer already on the map cannot be added twice", async ({ page }) => {
    await open(page);
    await openLibrary(page);
    await cards(page).nth(0).click();
    const first = (await titles(page))[0]!;
    await dialog(page).getByRole("button", { name: "Add layer" }).click();
    await expect(dialog(page)).toBeHidden();

    await openLibrary(page);
    const added = cards(page).filter({ hasText: first });
    await expect(added).toBeDisabled();
    await expect(added.getByText("Added")).toBeVisible();
  });

  test("cancelling adds nothing, and forgets the selection", async ({ page }) => {
    await open(page);
    await openLibrary(page);

    await cards(page).nth(0).click();
    await expect(dialog(page).getByText("1 selected", { exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(panelCards(page)).toHaveCount(1);

    // Reopening must not leave the earlier pick armed behind the Add button.
    await openLibrary(page);
    await expect(
      dialog(page).getByText("Select one or more to add", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Add layer" }),
    ).toBeDisabled();
  });

  test("the dialog has no serious or critical violations", async ({ page }) => {
    await open(page);
    await openLibrary(page);

    const results = await new AxeBuilder({ page })
      .include("[data-slot=data-library]")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(
      blocking.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
    ).toEqual([]);
  });
});
