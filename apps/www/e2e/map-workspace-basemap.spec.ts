import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The basemap switcher, and the contract that the data colours follow it.
 *
 * Three basemaps: Plan, Satellite, Terrain -- the triad GIS galleries ship.
 * Muted and Blank were here. Blank took the only assertion in this file that
 * was about MapLibre rather than about us, and the finding behind it is worth
 * keeping even though the case is gone: MapLibre hides an empty credit line by
 * adding `maplibregl-attrib-empty` and does NOT clear its innerHTML, so the
 * previous basemap's text stays in the DOM while invisible. Assert visibility,
 * never textContent, if an empty-attribution case ever comes back.
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

/**
 * 60s, where the project default is 30s.
 *
 * Every case here loads at least one real CARTO vector style and most load
 * two, and the default basemap is now Plan: `dark-matter`, 93 layers of which
 * 27 are symbol layers, so each load also fetches a glyph range per font in
 * view. The old default was `dark-matter-nolabels` -- 66 layers, zero symbol
 * layers, no glyphs. That difference is what pushed this file over 30s: the
 * two failures were timeouts at 30.2s and 30.5s, with the passes at 23.7s and
 * 29.6s, i.e. the whole file was already sitting on the limit.
 */
test.describe.configure({ timeout: 60_000 });

test.describe("basemap switcher", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("offers every basemap, exactly one chosen", async ({ page }) => {
    await open(page);
    await switcher(page).getByRole("button").first().click();

    await expect(options(page).getByRole("radio")).toHaveCount(3);
    for (const name of ["Plan", "Satellite", "Terrain"]) {
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

    await choose(page, "Plan");
    await expect(block(page)).toHaveAttribute("data-map-scheme", /viridis|brand/);
  });

  // Attribution is derived from the style's sources, so this proves the style
  // was really applied -- and it is the one legal obligation that comes with
  // using other people's tiles for free.
  //
  // One test per basemap rather than one test doing all three. Three live style
  // loads in a single case needed the whole budget, so a slow CARTO response
  // failed the case on whichever basemap happened to be last; now each gets its
  // own budget and a failure names the basemap that actually lost its credit.
  for (const [name, credit] of [
    ["Satellite", "Esri"],
    ["Terrain", "Terrain Tiles"],
  ] as const) {
    test(`${name} credits its own sources`, async ({ page }) => {
      await open(page);
      await choose(page, name);
      await expect(block(page).locator(".maplibregl-ctrl-attrib")).toContainText(credit, {
        timeout: 15_000,
      });
    });
  }

  test("Plan credits CARTO once it has been left and returned to", async ({ page }) => {
    await open(page);
    const attribution = block(page).locator(".maplibregl-ctrl-attrib");

    // Plan is the default, so asserting on it directly would pass without the
    // switcher doing anything at all. Leaving and coming back is the only form
    // of this assertion that tests something.
    await choose(page, "Satellite");
    await expect(attribution).toContainText("Esri", { timeout: 15_000 });

    await choose(page, "Plan");
    await expect(attribution).toContainText("CARTO", { timeout: 15_000 });
    await expect(attribution).not.toContainText("Esri");
  });

  test("the data layer survives a swap onto a basemap that carries an overlay", async ({
    page,
  }) => {
    // Pins the contract -- `data-map-layer` is the only DOM-observable signal
    // that the data layer is really on the map, since nothing throws when it
    // is not and the map examples are excluded from the visual suite for being
    // non-deterministic.
    //
    // HONEST LIMIT, so nobody trusts this further than it goes: this test does
    // NOT reliably reproduce the bug it was written for. The failure is that
    // Terrain's raster-dem source flips isStyleLoaded() back to false
    // (measured: true before applying overlays, false after, on Terrain alone)
    // and onStyleReady fired into that window, so the block's own
    // isStyleLoaded guard bailed in silence and the flows never returned. It
    // was reproduced on the dev server and on the deployed site, and fixed by
    // a second whenStyleReady gate in map-canvas. But reverting that fix and
    // re-running THIS test against the local static export still passes -- the
    // export serves fast enough that the race usually loses.
    //
    // So treat it as a smoke test, not a guard. The real check is switching
    // through all six ordered pairs and looking at the map.
    await open(page);
    await expect(block(page)).toHaveAttribute("data-map-layer", "on");

    // Satellite first, deliberately: it is an authored style object, so
    // leaving it is a real setStyle with a re-add on the far side. Plan ->
    // Terrain shares a style and never exercises this path.
    await choose(page, "Satellite");
    await expect(block(page)).toHaveAttribute("data-map-layer", "on");

    await choose(page, "Terrain");
    await expect(block(page)).toHaveAttribute("data-map-layer", "on", { timeout: 15_000 });
  });

  test("a basemap sharing another's style still gets its own overlays", async ({ page }) => {
    // Plan and Terrain resolve to the SAME CARTO style in dark -- both are Dark
    // Matter -- and differ only by the hillshade laid over it. That makes this
    // the one pair that exercises the swap path where `setStyle` is correctly
    // skipped and the overlays still have to be reconciled, in both directions.
    //
    // It is not hypothetical: with `style` alone in the swap effect's deps, the
    // effect never ran for this pair, and Terrain silently had no hillshade.
    await open(page);
    const attribution = block(page).locator(".maplibregl-ctrl-attrib");

    await choose(page, "Terrain");
    await expect(attribution).toContainText("Terrain Tiles", { timeout: 15_000 });

    await choose(page, "Plan");
    await expect(attribution).not.toContainText("Terrain Tiles", { timeout: 15_000 });
    await expect(attribution).toContainText("CARTO");
  });

  test("the trigger says which basemap is showing", async ({ page }) => {
    await open(page);
    // The bug this replaces: the tile read "Satellite" over a CARTO vector
    // basemap, because the label was a hard-coded string with nothing behind it.
    await expect(switcher(page).getByRole("button").first()).toHaveAccessibleName(
      /Basemap: Plan/,
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
