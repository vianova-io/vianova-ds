import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  CITIZEN_CENTER,
  SAMPLE_VEHICLES,
} from "../registry/vianova/lib/sample-citizen";
import { settle } from "./examples";

/**
 * The Citizen Platform's three ways in, driven end to end.
 *
 * This suite exists because of a bug that shipped: the map's dots were not
 * clickable at all. The handler compared MapLibre's re-encoded coordinates to
 * the ones that went in, found nothing, and failed silently -- the dots drew,
 * the tap landed, nothing threw, and the card never opened. It passed the a11y
 * crawl, the focus-ring crawl, the responsive measurements and the visual
 * baselines, because not one of them clicks a marker and asserts a selection.
 *
 * So the rule here is that every test finishes a real journey: tap a vehicle,
 * see it named, report it, read the reference back. A spec that only asserts a
 * screen rendered would have passed that bug too.
 *
 * Phone-sized throughout. This is the one block whose only real layout is a
 * phone, and the block's own height is `75svh`, so the viewport decides how
 * much map there is to tap.
 */

test.use({ viewport: { width: 390, height: 844 } });

const BLOCKING = new Set(["serious", "critical"]);

/** Must match the `zoom` MapCanvas is given in the block. */
const ZOOM = 14.4;
/** MapLibre's tile size, which sets the scale `project` works in. */
const TILE = 512;

const REFERENCE = "MUC-7F3K-2908";

/** A real 1x1 PNG, so the file input accepts it and a thumbnail renders. */
const PHOTO = {
  name: "scooter.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

async function open(page: Page) {
  await page.goto("/blocks/citizen-workspace");
  await settle(page);
  const root = page.locator("[data-slot=citizen-workspace]");
  await expect(root.getByRole("button", { name: "Scan the QR code" })).toBeVisible();
  return root;
}

/**
 * The segmented control's hit area.
 *
 * Its radio is visually hidden under its own label, which is how a label and
 * an input are supposed to work -- but it means Playwright reports the label
 * as intercepting a click aimed at the input. Tapping the label is what a
 * finger does; the radio is still what gets asserted.
 */
function segment(root: Locator, name: string) {
  return root.locator(`label[title="${name}"]`);
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("[data-slot=citizen-workspace]")
    // MapLibre's own canvas and controls are not ours to fix.
    .exclude(".maplibregl-canvas, .maplibregl-ctrl")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/* -------------------------------------------------------------------------- */
/* Finding a dot on a canvas                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Web Mercator, at the block's own zoom.
 *
 * The map instance is not on `window` and should not be: a block does not
 * export its internals so a test can reach them. What the test can do instead
 * is the same arithmetic MapLibre does. For an unrotated, unpitched map this
 * is exact, and if the block ever changes its zoom or centre this fails loudly
 * rather than drifting.
 */
function project([lon, lat]: readonly [number, number]) {
  const scale = TILE * 2 ** ZOOM;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Where a vehicle's dot sits on screen, in CSS pixels. */
async function dotOf(canvas: Locator, position: readonly [number, number]) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the map canvas never laid out");
  const centre = project(CITIZEN_CENTER);
  const point = project(position);
  return {
    x: box.x + box.width / 2 + (point.x - centre.x),
    y: box.y + box.height / 2 + (point.y - centre.y),
  };
}

/**
 * Taps a vehicle until its card opens.
 *
 * The retry is for the layer, not for the aim: the dots are added
 * asynchronously once the style settles, so the first tap can land before
 * there is anything to hit. A wrong coordinate fails here just as loudly, it
 * simply takes the full timeout to say so.
 */
async function tapVehicle(root: Locator, page: Page, id: string) {
  const vehicle = SAMPLE_VEHICLES.find((v) => v.id === id)!;
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  const card = root.getByRole("region", { name: "Vehicle", exact: true });

  await expect
    .poll(
      async () => {
        const { x, y } = await dotOf(canvas, vehicle.position);
        await page.mouse.click(x, y);
        return (await card.locator(`text=${id}`).count()) > 0;
      },
      { timeout: 25_000, message: `tapping ${id} never opened its card` },
    )
    .toBe(true);

  return card;
}

/* -------------------------------------------------------------------------- */
/* The map path                                                                */
/* -------------------------------------------------------------------------- */

test("a vehicle is tapped on the map, named, and reported", async ({ page }) => {
  const root = await open(page);

  // One tap to the map. There is no interstitial in between: production asked
  // "scan the QR code first?" here, which is the two taps this block removed.
  await root.getByRole("button", { name: "Find the vehicle on the map" }).click();
  await expect(root.getByRole("heading", { name: "Find the vehicle" })).toBeVisible();
  await expect(root.getByRole("radio", { name: "Map" })).toBeChecked();
  await expect(root.getByText("Tap a vehicle to report it.")).toBeVisible();

  const card = await tapVehicle(root, page, "LIME-QX907");

  // The card says WHICH vehicle, which is the whole point of the tap.
  await expect(card.getByText("Lime", { exact: true })).toBeVisible();
  await expect(card.getByText("Scooter", { exact: true })).toBeVisible();
  await expect(card.getByText("LIME-QX907", { exact: true })).toBeVisible();

  // And it is on screen without scrolling -- the defect this block shipped
  // with was a card that opened below the fold, so a tap read as nothing.
  const inView = await card.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  });
  expect(inView).toBe(true);

  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Report this vehicle" }).click();

  // Three taps from the start screen to the form: map, dot, report.
  await expect(root.getByText("Step 2 of 2")).toBeVisible();
  await expect(root.getByText("A photo is required for this report.")).toBeVisible();

  await root.getByRole("radio", { name: "Bad parking" }).click();
  await root.locator('input[type="file"][capture]').setInputFiles(PHOTO);
  await expect(root.getByText("1 of 5 photos added")).toBeVisible();

  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Send report" }).click();
  await expect(root.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await expect(root.getByText(REFERENCE)).toBeVisible();
  await expect(root.getByText("Sent to the city")).toBeVisible();

  await expectNoBlockingViolations(page);
});

test("the selected dot is marked on the map", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Find the vehicle on the map" }).click();
  await tapVehicle(root, page, "TIER-8F42K");

  // Nothing in the DOM says which dot is selected -- the ring is painted into
  // the WebGL canvas -- so what is asserted is that the tap is announced.
  // Without this the only feedback is visual, which a screen reader cannot use.
  await expect(root.getByText("Selected: TIER Scooter, TIER-8F42K")).toBeAttached();
});

test("a vehicle can still be tapped once the map is zoomed in", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Find the vehicle on the map" }).click();

  const vehicle = "LIME-QX907";
  const card = await tapVehicle(root, page, vehicle);
  await expect(card.getByText(vehicle, { exact: true })).toBeVisible();

  // Selecting eases the map so the vehicle sits SELECTED_OFFSET_Y above the
  // centre. Let that finish before measuring anything off it.
  await page.waitForTimeout(500);
  await root.getByRole("button", { name: "Close" }).click();
  await expect(card).toBeHidden();

  // The block opens at 14.4 and the dot becomes a badge at 15, so ONE tap of
  // the zoom control crosses the hand-over. The hit test used to name only the
  // dots layer, and `queryRenderedFeatures` reports only layers that are
  // actually drawn -- so from here on every tap missed, and because an empty
  // hit also clears the selection, tapping a vehicle dismissed its card
  // instead of opening it.
  await root.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(800);

  // Zoom is about the centre, so one step doubles the vehicle's distance from
  // it. That is the whole projection this test needs, and it stays true if the
  // block ever changes its opening zoom.
  const canvas = page.locator(".maplibregl-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 180);

  // One click, not a poll: a miss selects whatever else is under the thumb and
  // eases the map again, which would move the target out from under a retry.
  await expect(card.getByText(vehicle, { exact: true })).toBeVisible();
});

test("Back from the report returns to the map, not to a list", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Find the vehicle on the map" }).click();
  await tapVehicle(root, page, "LIME-QX907");
  await root.getByRole("button", { name: "Report this vehicle" }).click();
  await expect(root.getByText("Step 2 of 2")).toBeVisible();

  // Production hard-coded this Back to the list view, so reporting a vehicle
  // picked on the map and changing your mind dropped you somewhere you had
  // never been.
  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("heading", { name: "Find the vehicle" })).toBeVisible();
  await expect(root.getByRole("radio", { name: "Map" })).toBeChecked();

  await root.getByRole("button", { name: "Back", exact: true }).click();
  await expect(root.getByRole("button", { name: "Scan the QR code" })).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* The QR path                                                                */
/* -------------------------------------------------------------------------- */

test("a QR scan skips the photo requirement and sends", async ({ page }) => {
  const root = await open(page);

  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await expect(root.getByRole("heading", { name: "Scan the QR code" })).toBeVisible();
  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();

  // The photo is optional here and nowhere else, which is the only reason the
  // QR path is shorter.
  await expect(root.getByText("A photo is optional after a QR scan.")).toBeVisible();
  await root.getByRole("radio", { name: "Bad parking" }).click();
  await root.getByRole("button", { name: "Send report" }).click();

  await expect(root.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await expect(root.getByText(REFERENCE)).toBeVisible();
});

test("the camera-denied screen offers the three other ways in", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await root.getByRole("button", { name: "Find the vehicle in another way" }).click();

  await expect(root.getByRole("button", { name: "Use the map" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Use the list near me" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Use the search" })).toBeVisible();
  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Use the map" }).click();
  await expect(root.getByRole("radio", { name: "Map" })).toBeChecked();
});

/* -------------------------------------------------------------------------- */
/* The list and the search                                                     */
/* -------------------------------------------------------------------------- */

test("a partial id narrows the list as it is typed", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await expect(root.getByRole("radio", { name: "List view" })).toBeChecked();

  const rows = root.getByRole("listitem");
  // Wait for the feed to settle first: the list opens on skeletons, so
  // counting rows straight away counts none of them.
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  expect(before).toBeGreaterThan(1);

  // `LIME` is a partial. Production matched the whole id, exactly, on submit,
  // so this found nothing -- indistinguishable from the vehicle not existing.
  await root.getByRole("searchbox", { name: "Search a vehicle by its ID" }).fill("LIME");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("LIME-QX907");

  await expectNoBlockingViolations(page);

  await rows.first().getByRole("button").click();
  await expect(root.getByText("Step 2 of 2")).toBeVisible();
  await expect(root.getByText("LIME-QX907")).toBeVisible();
});

test("an id that matches nothing says so and offers the unlisted form", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await root
    .getByRole("searchbox", { name: "Search a vehicle by its ID" })
    .fill("NOPE-0000");

  await expect(root.getByText("Not found in the live data.")).toBeVisible();
  await root
    .getByRole("button", { name: "Report a vehicle that is not on the map" })
    .click();

  await expect(
    root.getByRole("heading", { name: "Report a vehicle that is not on the map" }),
  ).toBeVisible();
  await expect(root.getByLabel("Operator")).toBeVisible();
  await expectNoBlockingViolations(page);
});

test("a vehicle already reported explains itself instead of being dead", async ({
  page,
}) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await root.getByRole("searchbox", { name: "Search a vehicle by its ID" }).fill("VOI");

  const row = root.getByRole("listitem").first();
  const button = row.getByRole("button");

  // Production rendered this row disabled, with the reason in a badge: the
  // explanation could not be focused, read on its own, or reached by anything
  // that skips disabled controls.
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(
    row.getByText("This vehicle is already reported. The city handles it."),
  ).toBeVisible();
  // And it did not navigate: there is nothing to report.
  await expect(root.getByRole("heading", { name: "Find the vehicle" })).toBeVisible();
});

test("the filters survive the switch between map and list", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Find the vehicle on the map" }).click();

  await root.getByRole("button", { name: "Filter" }).click();
  await root.getByLabel("Operator").selectOption("Lime");
  await root.getByRole("button", { name: "Done" }).click();
  await expect(root.getByRole("button", { name: "Filter (1)" })).toBeVisible();

  // Production's *List view* was a one-way button into a view with its own
  // state, so switching reset the filter.
  await segment(root, "List view").click();
  await expect(root.getByRole("button", { name: "Filter (1)" })).toBeVisible();
  await root
    .getByRole("searchbox", { name: "Search a vehicle by its ID" })
    .fill("TIER");
  await expect(root.getByText("Not found in the live data.")).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* The form                                                                    */
/* -------------------------------------------------------------------------- */

test("submitting an empty report focuses the first thing that is wrong", async ({
  page,
}) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();

  await root.getByRole("button", { name: "Send report" }).click();

  // Production showed a summary alert and left focus on Send, so a
  // screen-reader user heard that something was invalid and had to go hunting.
  await expect(root.getByText("Select a reason.")).toBeVisible();
  await expect(root.getByRole("radio", { name: "Bad parking" })).toBeFocused();
});

test("the comment stays collapsed until Other requires it", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();

  await expect(root.getByRole("button", { name: "Add a comment" })).toBeVisible();
  await expect(root.getByLabel("Comment")).toHaveCount(0);

  await root.getByRole("radio", { name: "Other" }).click();
  await expect(root.getByLabel("Comment")).toBeVisible();

  await root.getByRole("button", { name: "Send report" }).click();
  await expect(
    root.getByText('Describe the problem for the reason "Other".'),
  ).toBeVisible();
  await expect(root.getByLabel("Comment")).toBeFocused();
});

test("a batch over the limit keeps what fits instead of refusing it", async ({
  page,
}) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();

  // Six photos, five allowed. Production added none of them and showed an
  // error, which punishes the reporter for the limit rather than applying it.
  await root
    .locator('input[type="file"][capture]')
    .setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({ ...PHOTO, name: `shot-${i}.png` })),
    );

  await expect(root.getByText("5 of 5 photos added")).toBeVisible();
  await expect(root.getByText("Only the first 5 photos were added.")).toBeVisible();
  await expect(root.getByRole("button", { name: "Remove photo 1" })).toBeVisible();

  await root.getByRole("button", { name: "Remove photo 1" }).click();
  await expect(root.getByText("4 of 5 photos added")).toBeVisible();
});

/* -------------------------------------------------------------------------- */
/* Both locales                                                                */
/* -------------------------------------------------------------------------- */

test("the language toggle names its action and switches every screen", async ({
  page,
}) => {
  const root = await open(page);

  // The accessible name used to be the target language alone -- "Deutsch" --
  // which names a language but not an action.
  const toggle = root.getByRole("button", { name: "Switch to German" });
  await toggle.click();

  await expect(root.getByRole("button", { name: "QR-Code scannen" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Auf Englisch umschalten" })).toBeVisible();

  await root.getByRole("button", { name: "Fahrzeug auf der Karte finden" }).click();
  await expect(root.getByRole("heading", { name: "Fahrzeug finden" })).toBeVisible();
  await expect(root.getByText("Tippen Sie auf ein Fahrzeug, um es zu melden.")).toBeVisible();
  await expectNoBlockingViolations(page);
});

/* -------------------------------------------------------------------------- */
/* The states that are not the happy one                                       */
/* -------------------------------------------------------------------------- */

/**
 * These are the tests the block existed without.
 *
 * A demo with no network shows the one path where nothing goes wrong, which
 * is the path nobody needs help designing. Everything below reaches a state a
 * resident can cause: a feed that has not arrived, a code that resolves to
 * nothing, a file that is not an image, an id in the wrong shape, a vehicle
 * that left the feed, a report the city holds or refuses.
 *
 * The states only a SERVER can cause are the `scenario` prop, and the docs
 * page renders the block with no props — so they are covered by types and by
 * the block's own documentation, not from here. `FeedsWorkspace`'s `status`
 * prop sits the same way.
 *
 * A note on the brief states: several assertions below race a timer of a few
 * hundred milliseconds. Playwright arriving late fails the test rather than
 * passing it quietly, which is the failure mode to want — if one of these
 * starts flaking, the delay is too short to be seen by a person either.
 */

/** Search for a vehicle by id and open its report form. */
async function reportById(root: Locator, id: string) {
  await root.getByRole("button", { name: "Use the search" }).click();
  await root.getByRole("searchbox", { name: "Search a vehicle by its ID" }).fill(id);
  await root.getByRole("listitem").filter({ hasText: id }).getByRole("button").click();
  await root.getByText("Step 2 of 2").waitFor();
}

/** A reason and a photo, which is everything a listed vehicle's report needs. */
async function fillReport(root: Locator) {
  await root.getByRole("radio", { name: "Bad parking" }).click();
  await root.locator('input[type="file"][capture]').setInputFiles(PHOTO);
  await root.getByText("1 of 5 photos added").waitFor();
}

test("the scan says what it is doing before it resolves", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();

  // The camera is not instant, and production wrote a string for the wait.
  await expect(root.getByText("Starting the camera …")).toBeVisible();
  await expect(root.getByText("Hold the camera over the QR code on the vehicle.")).toBeVisible();

  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();
  await expect(root.getByText("Looking up the vehicle …")).toBeVisible();
  await expect(root.getByText("Step 2 of 2")).toBeVisible();
});

test("the near-you list shows it is loading before it shows vehicles", async ({
  page,
}) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();

  await expect(
    root.getByRole("status", { name: "Loading the vehicles near you …" }),
  ).toBeVisible();
  await expect(root.getByRole("listitem").first()).toBeVisible();
  await expectNoBlockingViolations(page);
});

test("the search says it is searching while the typing settles", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await root.getByRole("listitem").first().waitFor();

  await root.getByRole("searchbox", { name: "Search a vehicle by its ID" }).fill("TIER");
  await expect(root.getByText("Searching …")).toBeVisible();
  await expect(root.getByText("The ID is on the vehicle. Matches appear as you type.")).toBeVisible();
});

test("the unlisted form says it is loading before it is a form", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await root.getByRole("button", { name: "Report a vehicle that is not on the map" }).click();

  await expect(root.getByRole("status", { name: "Loading the form …" })).toBeVisible();
  await expect(root.getByLabel("Operator")).toBeVisible();
  await expectNoBlockingViolations(page);
});

test("an id in the wrong shape is named as the wrong shape", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Use the search" }).click();
  await root.getByRole("button", { name: "Report a vehicle that is not on the map" }).click();
  await root.getByLabel("Operator").waitFor();

  await root.getByLabel("Operator").selectOption("Lime");
  await root.getByLabel("Vehicle ID").fill("LIME/QX907");
  await root.getByRole("radio", { name: "Bad parking" }).click();
  await root.getByRole("button", { name: "Send report" }).click();

  // Not "Enter the vehicle ID" — something WAS entered. Production has a
  // separate string for the shape, and it had never been reachable.
  await expect(
    root.getByText("Use letters, digits, spaces and . _ : - only."),
  ).toBeVisible();
  await expect(root.getByLabel("Vehicle ID")).toBeFocused();

  await root.getByLabel("Vehicle ID").fill("LIME-QX907");
  await expect(
    root.getByText("Use letters, digits, spaces and . _ : - only."),
  ).toHaveCount(0);
});

test("a file that is not an image is refused with a reason", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("button", { name: "Scan the QR code" }).click();
  await root.getByRole("button", { name: "Camera view for the QR code scan" }).click();
  await root.getByText("Step 2 of 2").waitFor();

  // `accept="image/*"` is a hint to the picker, not a guarantee: the file is
  // named .png and is not one, which is what the picker can hand back.
  await root.locator('input[type="file"][capture]').setInputFiles({
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is text, not an image"),
  });

  await expect(
    root.getByText("The app cannot use this photo. Please choose another photo."),
  ).toBeVisible();
  await expect(root.getByText("1 of 5 photos added")).toHaveCount(0);
  await expectNoBlockingViolations(page);
});

test("sending sends the photos first and says so", async ({ page }) => {
  const root = await open(page);
  await reportById(root, "LIME-QX907");
  await fillReport(root);

  await root.getByRole("button", { name: "Send report" }).click();
  await expect(root.getByRole("button", { name: "Sending the photos …" })).toBeVisible();
  await expect(root.getByRole("button", { name: "Sending …" })).toBeVisible();
  await expect(root.getByRole("heading", { name: "Thank you" })).toBeVisible();
});

test("a vehicle that left the feed sends you back and says why", async ({ page }) => {
  const root = await open(page);
  // The cargo bike is the fixture for this: on the map when it was picked,
  // gone from the feed by the time Send was pressed.
  await reportById(root, "MVG-C-0912");
  await fillReport(root);
  await root.getByRole("button", { name: "Send report" }).click();

  // Back to finding, because nothing on the form could have fixed it.
  await expect(root.getByRole("heading", { name: "Find the vehicle" })).toBeVisible();
  await expect(
    root.getByText("This vehicle is not in the live data. Please choose the vehicle again."),
  ).toBeVisible();
  await expectNoBlockingViolations(page);

  // And it is dismissible, so it does not sit over the map forever.
  await root.getByRole("alert").getByRole("button", { name: "Close" }).click();
  await expect(
    root.getByText("This vehicle is not in the live data. Please choose the vehicle again."),
  ).toHaveCount(0);
});

test("a report the city holds says so instead of claiming it was sent", async ({
  page,
}) => {
  const root = await open(page);
  await reportById(root, "TIER-1A55M");
  await fillReport(root);
  await root.getByRole("button", { name: "Send report" }).click();

  await expect(root.getByRole("heading", { name: "Thank you" })).toBeVisible();
  // Received first, and the outcome only once the poll settles.
  await expect(root.getByText("Received", { exact: true })).toBeVisible();
  await expect(root.getByText("Delayed, we will retry it")).toBeVisible();
  await expect(root.getByText("Sent to the city", { exact: true })).toHaveCount(0);
  await expectNoBlockingViolations(page);
});

test("a report the city refuses says so", async ({ page }) => {
  const root = await open(page);
  await reportById(root, "DOTT-44F0");
  await fillReport(root);
  await root.getByRole("button", { name: "Send report" }).click();

  await expect(root.getByRole("heading", { name: "Thank you" })).toBeVisible();
  await expect(root.getByText("Could not be sent to the city")).toBeVisible();
  await expect(root.getByText("Sent to the city", { exact: true })).toHaveCount(0);
  await expectNoBlockingViolations(page);
});
