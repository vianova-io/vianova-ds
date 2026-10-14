import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The basemap switcher, and the contract that the data colours follow it.
 *
 * Deliberately no pixels and no waiting for imagery. Two things are observable
 * in the DOM the moment a style is applied, and they are the two that matter:
 * the `data-map-scheme` the block resolves to, and the attribution MapLibre
 * derives from the style's sources. Both answer "did the right basemap really
 * load" without a single tile having to arrive.
 */

/** A 1x1 transparent PNG, so neither tile backend is a CI dependency. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * The docs page prints the block's own source below the demo, so a bare text
 * query matches the listing as well as the UI. Everything here is scoped to the
 * block, which is the element carrying `data-map-scheme`.
 */
const block = (page: Page) => page.locator("[data-map-scheme]").first();

async function open(page: Page) {
  // Esri and the AWS DEM are the only new external dependencies this feature
  // adds. Stubbing them keeps CI off both; CARTO stays live, as it already is
  // throughout this suite.
  await page.route(/World_Imagery|elevation-tiles-prod/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
  await page.goto("/blocks/map-workspace");
  await settle(page);
  await expect(block(page)).toBeVisible();
}

/** The switcher that is visible at this viewport; there is one per breakpoint. */
function switcher(page: Page) {
  return block(page).locator("[data-slot=basemap-switcher]:visible").first();
}

const options = (page: Page) => page.locator("[data-slot=basemap-options]");

async function choose(page: Page, name: string) {
  await switcher(page).getByRole("button").first().click();
  const option = options(page).getByRole("radio", { name: new RegExp(`^${name}`) });
  await option.waitFor();
  await option.click();
}

test.describe("basemap switcher", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("offers every basemap, exactly one chosen", async ({ page }) => {
    await open(page);
    await switcher(page).getByRole("button").first().click();

    await expect(options(page).getByRole("radio")).toHaveCount(5);
    for (const name of ["Muted", "Plan", "Satellite", "Terrain", "Blank"]) {
      await expect(
        options(page).getByRole("radio", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    }
    // A radiogroup that reports two selections, or none, is worse than a plain
    // list -- it describes a state the map cannot be in.
    const checked = options(page).locator('[role="radio"][aria-checked="true"]');
    await expect(checked).toHaveCount(1);
  });

  test("the data ramp follows the basemap", async ({ page }) => {
    await open(page);

    // The whole point of the feature. Before this, the scheme was read off the
    // reader's light/dark theme and the basemap had no say, despite a comment
    // in the block claiming otherwise.
    await choose(page, "Satellite");
    await expect(block(page)).toHaveAttribute("data-map-scheme", "warm");

    await choose(page, "Terrain");
    // Viridis in dark, blue in light -- assert membership rather than one
    // value, because the project viewport does not pin the colour scheme.
    await expect(block(page)).toHaveAttribute("data-map-scheme", /viridis|blue/);

    await choose(page, "Muted");
    await expect(block(page)).toHaveAttribute("data-map-scheme", /viridis|brand/);
  });

  test("each basemap credits its own sources", async ({ page }) => {
    await open(page);
    const attribution = block(page).locator(".maplibregl-ctrl-attrib");

    // Attribution is derived from the style's sources, so this proves the style
    // was really applied -- and it is the one legal obligation that comes with
    // using other people's tiles for free.
    await choose(page, "Satellite");
    await expect(attribution).toContainText("Esri", { timeout: 15_000 });

    await choose(page, "Terrain");
    await expect(attribution).toContainText("Terrain Tiles", { timeout: 15_000 });

    await choose(page, "Plan");
    await expect(attribution).toContainText("CARTO", { timeout: 15_000 });

    // Blank fetches nothing, so it credits nobody.
    //
    // Asserted as "not visible", not as "has no text". MapLibre hides an empty
    // credit line by adding `maplibregl-attrib-empty` and leaves the previous
    // basemap's markup in the DOM, so textContent still reads "Terrain Tiles"
    // on a control no reader can see. The first version of this test asserted
    // on the text and failed for that reason alone.
    await choose(page, "Blank");
    await expect(attribution).toBeHidden({ timeout: 15_000 });
  });

  test("the trigger says which basemap is showing", async ({ page }) => {
    await open(page);
    // The bug this replaces: the tile read "Satellite" over a CARTO vector
    // basemap, because the label was a hard-coded string with nothing behind it.
    await expect(switcher(page).getByRole("button").first()).toHaveAccessibleName(
      /Basemap: Muted/,
    );
    await choose(page, "Terrain");
    await expect(switcher(page).getByRole("button").first()).toHaveAccessibleName(
      /Basemap: Terrain/,
    );
  });
});

test.describe("basemap switcher on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is reachable, and not in the corner the panel docks into", async ({ page }) => {
    await open(page);

    // MapControls is hidden below lg, so without its own home the basemap
    // would simply be unreachable on a phone.
    const trigger = switcher(page).getByRole("button").first();
    await expect(trigger).toBeVisible();

    const box = (await trigger.boundingBox())!;
    const root = (await block(page).boundingBox())!;
    expect(Math.round(box.y - root.y), "the switcher should sit in the toolbar").toBeLessThan(60);

    await choose(page, "Satellite");
    await expect(block(page)).toHaveAttribute("data-map-scheme", "warm");
  });
});
