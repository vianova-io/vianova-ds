import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { settle } from "./examples";
import { zippedShapefile } from "./shapefile-fixture";

/**
 * The regulations workspace's flow: list → new regulation → editor → save →
 * back to the list.
 *
 * The block crawls in a11y.spec and focus-ring.spec only ever see the list,
 * because that is what the block opens on. The editor -- a rule rail, an
 * accordion of settings, the Add zones screen one level deeper, a save bar --
 * is most of the workspace, so it is reached here and judged by the same axe
 * rules.
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
  // An overlay lays a backdrop over the workspace, and this scan is scoped to
  // the workspace -- so axe measures the contrast of text UNDER that scrim and
  // reports colour-contrast failures on markup that is fine a frame later.
  // Intermittent, because it depends on whether the analysis starts before or
  // after the fade: measured when the zone picker was still a sheet, the
  // backdrop was at opacity 1 for ~180ms after it closed and the suite failed
  // roughly two runs in seven. The picker is a screen now, but the type
  // dialog and the leave confirmation still fade, so the guard stays.
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

/** Two polygons over Lisbon, named, as a city's export would arrive. */
const FEATURES = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Cais do Sodré" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-9.146, 38.706],
            [-9.142, 38.706],
            [-9.142, 38.709],
            [-9.146, 38.709],
            [-9.146, 38.706],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Santos" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-9.156, 38.704],
            [-9.152, 38.704],
            [-9.152, 38.707],
            [-9.156, 38.707],
            [-9.156, 38.704],
          ],
        ],
      },
    },
  ],
});

/** Fleet cap, open, with its two zones -- the rule the drawing tests use. */
async function fleetCap(page: Page) {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await expect(root.getByText("2 zones").first()).toBeVisible();
  const map = root.getByRole("region", { name: "Map of the regulation's zones" });
  // The column, not the tray: a session is mounted twice at once, in the Add
  // zones panel and in the tray the phone gets instead, and only one of the
  // two is displayed. So everything here is scoped to the panel.
  const panel = root.locator("[data-slot=zone-picker-panel]");
  const drafts = panel.locator("[data-slot=zone-draft-list]");
  return { root, map, panel, drafts };
}

/**
 * Fleet cap, with a drawing session open and `tool` armed.
 *
 * There is one way in now. The map used to carry the whole tool row, so a
 * test could arm one without opening anything; the tools have moved into the
 * Draw tab of Add zones, where they stay for the rest of the session, and the
 * map carries only the banner. So: Add zones, the Draw tab, one press.
 *
 * `tools` is the grid in that tab -- scoped to the panel, because the phone
 * tray mounts a second copy that is display:none at this width.
 */
async function drawSession(page: Page, tool: string) {
  const { root, map, panel, drafts } = await fleetCap(page);
  await root.getByRole("button", { name: "Add zones" }).click();
  await panel.getByRole("tab", { name: "Draw" }).click();
  await panel.getByRole("button", { name: new RegExp(`^${tool}`) }).click();
  await expect(drafts).toBeVisible();
  const tools = panel.getByRole("group", { name: "Drawing tool" });
  const armed = tools.getByRole("button", { name: tool });
  await expect(armed).toHaveAttribute("aria-pressed", "true");

  /*
   * And it has to *look* armed, which the attribute above cannot tell you.
   * It was wrong for exactly that reason once: `aria-pressed` read "true"
   * while the button was the same grey as the other three, because
   * `Button`'s outline variant paints dark with `dark:border-input` and beat
   * a bare `aria-pressed:border-primary` on source order. The session's only
   * state, invisible, with every assertion still green.
   *
   * So compare it against a tool that is not armed rather than against a
   * fixed colour: the point is that the two differ, in whichever theme and
   * whatever `primary` resolves to.
   */
  const border = (name: string) =>
    tools
      .getByRole("button", { name })
      .evaluate((el) => getComputedStyle(el).borderTopColor);
  const other = tool === "Circle" ? "Line" : "Circle";
  expect(await border(tool)).not.toBe(await border(other));

  // The tools are one thing and what they have produced is another, so the
  // list carries a rule and a name of its own. With only a gap between them
  // a finished zone reads as a fifth tile in the grid: same rounded box,
  // same column, directly beneath. The tray says both in its own header.
  await expect(drafts.getByRole("heading", { name: "Drawn zones" })).toBeVisible();

  return { root, map, panel, drafts, tools };
}

/**
 * A square, drawn with the polygon tool wherever the map is free.
 *
 * `dx` shifts it, so a second one can be drawn without landing on the first.
 *
 * Clicked on the canvas with element-relative positions rather than at page
 * coordinates worked out from the section's box. The column no longer moves
 * when a tool is armed -- it used to narrow from 460 to 340 and let the map
 * grow into it -- but a locator click hit-tests where `page.mouse` does not,
 * so a cover or a bad position fails saying which rather than clicking
 * nothing.
 */
async function square(map: Locator, dx = 0) {
  const canvas = map.locator(".maplibregl-canvas");
  const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] as const) {
    await canvas.click({
      position: { x: box.width * (x + dx), y: box.height * y },
    });
  }
  await map.getByRole("button", { name: "Done" }).click();
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

  await root.getByRole("spinbutton", { name: "Speed limit" }).fill("20");
  await expect(root.getByText("Unsaved changes")).toBeVisible();

  await root.getByRole("button", { name: "Regulations", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Leave without saving?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(root.getByRole("spinbutton", { name: "Speed limit" })).toHaveValue("20");

  await root.getByRole("button", { name: "Discard" }).click();
  await expect(root.getByRole("spinbutton", { name: "Speed limit" })).toHaveValue("15");
});

test("zones added from the picker land in the rule", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await expect(root.getByText("2 zones").first()).toBeVisible();

  await root.getByRole("button", { name: "Add zones" }).click();
  const panel = root.locator("[data-slot=zone-picker-panel]");
  // The search field is a tag input: a ticked zone becomes a chip in it, and
  // removing the chip unticks the zone.
  const search = panel.getByRole("textbox", { name: "Search zones" });
  await search.fill("Belém");
  await panel.getByRole("checkbox", { name: "Belém", exact: true }).click();
  await expect(panel.locator("[data-slot=tag-input-chip]", { hasText: "Belém" })).toBeVisible();
  await panel.getByRole("button", { name: "Remove Belém" }).click();
  await expect(panel.getByRole("checkbox", { name: "Belém", exact: true })).not.toBeChecked();

  // Enter picks the top match without touching the list.
  //
  // Retried as a whole, because the picker filters on a useDeferredValue
  // (zone-picker.tsx:954) and React is allowed to let that lag -- which it
  // does when the rest of this file is running beside it and MapLibre has the
  // CPU. Enter then runs against the previous filter, finds no unselected
  // match, and onDraftCommit returns without clearing the field
  // (zone-picker.tsx:1046-1051): a silent no-op, so the keypress is lost.
  // toPass re-presses rather than waiting on a value that will never change;
  // it still fails if Enter never commits.
  await expect(async () => {
    await search.fill("Belém");
    await search.press("Enter");
    await expect(search).toHaveValue("");
  }).toPass({ timeout: 10_000 });
  await expect(panel.locator("[data-slot=tag-input-chip]", { hasText: "Belém" })).toBeVisible();
  await panel.getByRole("button", { name: "Add 1 zone" }).click();

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

// Its own test, not another leg of the one above: between them these two run
// four axe scans, a map that has to reach full size and two drawn shapes, which
// together sat just under the 30s default and tipped over it on a slow runner.
test("on a phone, a drawing session is a tray over the map", async ({ page }) => {
  const root = await open(page, { width: 390, height: 844 });
  await root.locator("[data-slot=regulation-link]", { hasText: "Parking · Baixa and Chiado" }).click();
  const map = root.getByRole("region", { name: "Map of the regulation's zones" });

  // A drawing session has no column to put its list in at this width, so the
  // list is a tray over the map -- which means the map keeps its canvas and
  // the two are on screen together, rather than taking turns.
  await root.getByRole("button", { name: "Add zones" }).click();
  const picker = root.locator("[data-slot=zone-picker-panel]");
  // Ticked in the library before a tool is armed. The panel is hidden rather
  // than thrown away when the tray takes over, so the tick is still staged --
  // and the tray's Add has to say so. Uncounted, it would offer to add one
  // zone and quietly add two.
  await picker.getByRole("textbox", { name: "Search zones" }).fill("Belém");
  await picker.getByRole("checkbox", { name: "Belém", exact: true }).click();
  await picker.getByRole("tab", { name: "Draw" }).click();
  await picker.getByRole("button", { name: /^Polygon/ }).click();

  const tray = root.locator("[data-slot=bottom-tray]");
  await expect(tray).toBeVisible();
  await expect(tray.getByRole("button", { name: "Add 1 zone" })).toBeVisible();
  await expect(map).toBeVisible();
  // A peek until there is something to show, so the map keeps its room.
  await expect(tray).toHaveAttribute("data-snap", "peek");
  const grabber = tray.getByRole("slider", { name: "Drawn zones height" });
  await expect(grabber).toBeVisible();

  const canvas = map.locator(".maplibregl-canvas");
  const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[0.3, 0.35], [0.65, 0.35], [0.5, 0.58]] as const) {
    await canvas.click({ position: { x: box.width * x, y: box.height * y } });
  }
  await map.getByRole("button", { name: "Done" }).click();

  // Raised once, on the first shape, so the name it just made up is reachable
  // without a drag -- and not again, so anyone who pulls it back down to see
  // the map keeps it there.
  await expect(tray).toHaveAttribute("data-snap", "half");
  await expect(tray.getByRole("listitem")).toHaveCount(1);
  // One drawn and one ticked, counted together by the one Add there is.
  await expect(tray.getByRole("button", { name: "Add 2 zones" })).toBeVisible();

  /*
   * The rule dividing the tools from the list stands clear of both.
   *
   * It did not, here, while the column was fine: the spacing came from the
   * column's own `gap-3`, and the tray's body is `FloatingPanelBody`, whose
   * className lands on an outer wrapper while the children sit in an inner
   * scroll div with no gap at all. So the rule drew hard against the bottom
   * of the tool grid -- an underline on the last row of buttons rather than
   * a divider -- and nothing in this file could see it. The list owns its
   * own top margin now, which is the same number in both chromes.
   */
  //
  // Both boxes in one evaluation, not two `boundingBox()` round trips. The
  // tray has just risen from peek to half, and its height is animated with
  // the bottom edge pinned -- so two measurements a frame apart describe
  // content at two different offsets, and their difference is whatever the
  // transition was doing in between. It read 1.8px that way once, against a
  // gap that is 12.
  const gap = await tray.evaluate((el) => {
    const grid = el.querySelector('[role="group"][aria-label="Drawing tool"]')!;
    const list = el.querySelector("[data-slot=zone-draft-list]")!;
    const g = grid.getBoundingClientRect();
    return list.getBoundingClientRect().y - (g.y + g.height);
  });
  expect(gap).toBeGreaterThan(4);

  await expectNoBlockingViolations(page);

  // Arrow keys reach every height: "drag it up to rename" has to work without
  // a pointer, which is why the grabber is a slider and not a button.
  await grabber.press("ArrowUp");
  await expect(tray).toHaveAttribute("data-snap", "full");
  await grabber.press("ArrowDown");
  await expect(tray).toHaveAttribute("data-snap", "half");

  // Raised once and not again. Pulled back down to see the map, a second
  // shape leaves it where it was put -- the alternative, raising on every
  // shape, would fight whoever lowered it on every shape they drew.
  await grabber.press("ArrowDown");
  await expect(tray).toHaveAttribute("data-snap", "peek");
  for (const [x, y] of [[0.3, 0.2], [0.7, 0.22], [0.5, 0.42]] as const) {
    await canvas.click({ position: { x: box.width * x, y: box.height * y } });
  }
  await map.getByRole("button", { name: "Done" }).click();
  await expect(tray.getByRole("listitem")).toHaveCount(2);
  await expect(tray).toHaveAttribute("data-snap", "peek");

  await tray.getByRole("button", { name: "Cancel" }).click();
  await expect(tray).toBeHidden();
});

test("a polygon drawn in a session is collected, and the tool stays armed", async ({ page }) => {
  const { root, map, panel, drafts, tools } = await drawSession(page, "Polygon");

  // The tool row lives in the Draw tab for the whole session, where the list
  // it fills is. It used to float on the map -- the one surface that is also
  // the drawing surface -- while the column showed drafts and no way to
  // change tool at all.
  const polygon = tools.getByRole("button", { name: "Polygon" });

  await square(map);

  // The shape is a draft in the left column, not a zone in the rule: nothing
  // reaches the rule until Add. And the tool is STILL armed -- the assertion
  // that used to read "false" here, and the whole point of the redesign: a
  // run of zones is a run of drags, not a trip through the picker each time.
  await expect(drafts.getByRole("listitem")).toHaveCount(1);
  // Exactly one pending, so nothing has been counted twice. The rule's own
  // "2 zones" is not assertable here -- Add zones has taken the column it was
  // printed in -- and what proves nothing reached the rule is the count
  // below, which goes 2 to 4, and Cancel's test further down.
  await expect(panel.getByRole("button", { name: "Add 1 zone" })).toBeVisible();
  await expect(polygon).toHaveAttribute("aria-pressed", "true");

  await square(map, -0.25);
  await expect(drafts.getByRole("listitem")).toHaveCount(2);

  await panel.getByRole("button", { name: "Add 2 zones" }).click();
  await expect(root.getByText("4 zones").first()).toBeVisible();
  await expect(root.getByText("Unsaved changes")).toBeVisible();
});

test("Public is tinted where Private stays quiet, in the list and the editor", async ({ page }) => {
  const root = await open(page);
  const row = (name: string) =>
    root.getByRole("row").filter({ has: page.locator("[data-slot=regulation-link]", { hasText: name }) });

  // The list said nothing about visibility before; now a public row does, and
  // a private one stays silent -- private is the default, so it reads as absence.
  await expect(row("Fleet cap · Baixa and Avenidas Novas").locator("[data-visibility=public]")).toBeVisible();
  await expect(row("Parking · Baixa and Chiado").locator("[data-visibility]")).toHaveCount(0);

  await root.locator("[data-slot=regulation-link]", { hasText: "Parking · Baixa and Chiado" }).click();
  const header = root.locator("[data-visibility]");
  await expect(header).toHaveAttribute("data-visibility", "private");

  await root.getByRole("button", { name: "Regulation options" }).click();
  await page.getByRole("menuitem", { name: "Make public" }).click();
  await expect(header).toHaveAttribute("data-visibility", "public");
  await expect(header).toHaveText("Public");
  await expectNoBlockingViolations(page);
});

test("a line drawn in a session becomes a corridor zone, at the width the banner sets", async ({ page }) => {
  const { root, map, panel, drafts, tools } = await drawSession(page, "Line");

  const line = tools.getByRole("button", { name: "Line" });

  // The width is the line tool's own control, and it is in the banner rather
  // than a panel because it is only judgeable against the street underneath.
  const width = map.getByRole("spinbutton", { name: "Corridor width in metres" });
  await expect(width).toHaveValue("20");
  await width.fill("120");

  // Two points are enough for a line, where a polygon needs three -- so Done
  // is still refused after one and offered after two.
  const canvas = map.locator(".maplibregl-canvas");
  const box = (await canvas.boundingBox())!;
  const click = ([x, y]: readonly [number, number]) =>
    canvas.click({ position: { x: box.width * x, y: box.height * y } });
  const done = map.getByRole("button", { name: "Done" });
  await click([0.35, 0.35]);
  await expect(done).toBeDisabled();
  await click([0.55, 0.5]);
  await click([0.7, 0.42]);
  await done.click();

  await expect(drafts.getByRole("listitem")).toHaveCount(1);
  await expect(line).toHaveAttribute("aria-pressed", "true");
  // The banner stays mounted across a run of shapes, so the width someone set
  // once is still set for the next street rather than back at the default.
  await expect(width).toHaveValue("120");

  await click([0.3, 0.7]);
  await click([0.5, 0.78]);
  await done.click();
  await expect(drafts.getByRole("listitem")).toHaveCount(2);

  await panel.getByRole("button", { name: "Add 2 zones" }).click();
  await expect(root.getByText("4 zones").first()).toBeVisible();
});

test("Add zones offers drawing, and one press on a tool starts a drawing session", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();

  await root.getByRole("button", { name: "Add zones" }).click();
  const panel = root.locator("[data-slot=zone-picker-panel]");
  // The sources are tabs now: three short words in one row, where five cards
  // with a sentence each used to fill the top of the panel before anything
  // had been done.
  await panel.getByRole("tab", { name: "Draw" }).click();

  // The tools are buttons, and pressing one is the whole action. This used to
  // need a second press on a footer button named after the source tile above
  // it, which nobody found: Katell reported the tools as doing nothing. The
  // press below is deliberately the only one -- if a confirm step comes back,
  // this test fails rather than quietly clicking through it.
  // Measured before the press, because the press must not move it. Arming a
  // tool used to swap this panel for a second one, retitle it and narrow it
  // from 460 to 340 in the same tick -- three things at once in answer to one
  // press, which is why it read as the panel jumping away rather than as a
  // tool being armed.
  const column = root.getByRole("region", { name: "Add zones" });
  const before = (await column.boundingBox())!;

  await panel.getByRole("button", { name: /^Line/ }).click();

  // The panel stays, and stays the same panel: same width, same heading, same
  // tab row, with Draw still the tab you are on. The map it just handed over
  // to is beside it, and the tool pressed is the one armed -- not a toolbar's
  // own default.
  await expect(panel).toBeVisible();
  expect((await column.boundingBox())!.width).toBe(before.width);
  await expect(panel.getByRole("heading", { name: "Add zones" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Draw" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const drafts = panel.locator("[data-slot=zone-draft-list]");
  await expect(drafts).toBeVisible();
  const map = root.getByRole("region", { name: "Map of the regulation's zones" });
  await expect(
    panel.getByRole("group", { name: "Drawing tool" }).getByRole("button", { name: "Line" }),
  ).toHaveAttribute("aria-pressed", "true");
  // And the map carries no tool row of its own: one place to pick a tool.
  await expect(map.getByRole("group", { name: "Drawing tool" })).toHaveCount(0);
  await expect(map.getByRole("spinbutton", { name: "Corridor width in metres" })).toBeVisible();
  // Nothing named "Start drawing" or "Draw the zone" anywhere: if a confirm
  // step comes back in any shape, this fails rather than being clicked past.
  await expect(root.getByRole("button", { name: /^(Start|Continue|Draw) / })).toHaveCount(0);
});

test("a session and the other two sources stage into one list, added together", async ({ page }) => {
  const { root, map, panel, drafts } = await drawSession(page, "Polygon");
  await square(map);
  await expect(drafts.getByRole("listitem")).toHaveCount(1);

  // Switching tab mid-session is a way of adding more, not of starting again:
  // the drawn shape is still staged while the library is on screen, and the
  // count in the footer says so. It used to be impossible to find out -- the
  // session had replaced the panel, so the only route back to the library was
  // Cancel, which threw the shape away.
  await panel.getByRole("tab", { name: "Library" }).click();
  await expect(drafts).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Add 1 zone" })).toBeVisible();

  await panel.getByRole("textbox", { name: "Search zones" }).fill("Belém");
  await panel.getByRole("checkbox", { name: "Belém", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Add 2 zones" })).toBeVisible();

  // And back: the shape is where it was left, under the tool that is still
  // armed, with the rest of the session intact.
  await panel.getByRole("tab", { name: "Draw" }).click();
  await expect(drafts.getByRole("listitem")).toHaveCount(1);
  await expect(
    panel.getByRole("group", { name: "Drawing tool" }).getByRole("button", { name: "Polygon" }),
  ).toHaveAttribute("aria-pressed", "true");

  // One Add, and it adds both: the drawn one and the ticked one. Two zones in
  // the rule became four.
  await panel.getByRole("button", { name: "Add 2 zones" }).click();
  await expect(root.getByText("4 zones").first()).toBeVisible();
  await expect(root.getByText("Unsaved changes")).toBeVisible();
});

test("a zipped shapefile uploads, previews its shapes and adds them to the rule", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  // Pasting, uploading and fetching a link are one tab: all three end at the
  // same bytes, and only the way in differed. The dropzone is unchanged, and
  // so is everything a dropped shapefile does.
  await panel.getByRole("tab", { name: "Import" }).click();
  await panel.locator("input[type=file]").setInputFiles({
    name: "Zones.zip",
    mimeType: "application/zip",
    buffer: zippedShapefile(),
  });

  // The names come from the .dbf, which is the half of a shapefile that would
  // be easiest to quietly skip -- the shapes would still draw without it.
  const preview = panel.locator("[data-slot=zone-picker-preview]");
  await expect(preview).toContainText("2 zones found");
  await expect(preview).toContainText("Baixa core");
  await expect(preview).toContainText("Alfama edge");
  // And a shape apiece, which is the whole point of previewing before adding.
  await expect(preview.locator("svg")).toHaveCount(2);

  await panel.getByRole("button", { name: "Add 2 zones" }).click();
  await expect(root.getByText("4 zones").first()).toBeVisible();
});

test("a shapefile in a projection the reader cannot convert is refused by name", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  await panel.getByRole("tab", { name: "Import" }).click();
  await panel.locator("input[type=file]").setInputFiles({
    name: "Zones.zip",
    mimeType: "application/zip",
    buffer: zippedShapefile("sweref"),
  });

  // Metres read as degrees would land these in the Atlantic without a word of
  // warning, so the refusal names the system and the fix.
  await expect(panel.getByRole("alert")).toContainText("SWEREF99_TM");
  await expect(panel.getByRole("alert")).toContainText("EPSG:4326");
  await expect(panel.locator("[data-slot=zone-picker-preview]")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Add zones" })).toBeDisabled();
});

test("a drawn shape arrives named, focused and ready to be typed over", async ({ page }) => {
  const { root, map, panel, drafts } = await drawSession(page, "Polygon");
  await square(map);

  // Numbered from the rule's own zones -- Fleet cap has two -- rather than
  // from a counter shared with rules and regulations, which is why the first
  // zone drawn on a rule used to arrive as "Drawn zone 7".
  const field = drafts.getByRole("textbox", { name: "Rename Zone 3" });
  await expect(field).toBeFocused();
  // Selected, not merely focused: the name is a guess, so typing replaces it
  // and nobody has to clear it first.
  expect(
    await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 6]);
  // The tool row, the rows and the focus, judged by the same rules as the rest.
  await expectNoBlockingViolations(page);

  await page.keyboard.type("Praça do Comércio");
  await page.keyboard.press("Enter");
  await panel.getByRole("button", { name: "Add 1 zone" }).click();

  // Named before it existed, so the name is the one the rule gets -- where
  // renaming afterwards goes through the zone library and renames it in every
  // rule that shares it.
  await expect(root.getByText("3 zones").first()).toBeVisible();
  await expect(root.getByRole("textbox", { name: "Rename Praça do Comércio" })).toBeVisible();
});

test("the name field does not arm the drawing tools", async ({ page }) => {
  const { map, drafts, tools } = await drawSession(page, "Polygon");
  const polygon = tools.getByRole("button", { name: "Polygon" });
  await square(map);

  const field = drafts.getByRole("textbox", { name: "Rename Zone 3" });
  await expect(field).toBeFocused();

  // P, C, S and L arm tools on the window, and Escape and Enter end a shape.
  // Typed into a name they have to be letters: otherwise naming a zone
  // "Praça" would arm Polygon on the P, and Enter would close a shape rather
  // than accept the name. The coupling is one guard deep, so this is the
  // thing here that is easiest to break without noticing.
  await field.fill("");
  await page.keyboard.type("pcsl");
  await page.keyboard.press("Enter");

  await expect(polygon).toHaveAttribute("aria-pressed", "true");
  await expect(drafts.getByRole("listitem")).toHaveCount(1);
  await expect(drafts.getByRole("textbox", { name: "Rename pcsl" })).toBeVisible();
});

test("pressing the armed tool stops drawing without discarding, and Cancel leaves no trace", async ({ page }) => {
  const { root, map, panel, drafts, tools } = await drawSession(page, "Polygon");
  const polygon = tools.getByRole("button", { name: "Polygon" });
  await square(map);

  // Stopping drawing is not throwing the work away: the list and its Add
  // button still have something to do, so the session outlives the tool.
  //
  // Pressing the armed tool again is the stop. It used to be a Select button
  // standing beside the tools on the map, and the map carries nothing now --
  // so the pressed button has to unpress, or a session could be left armed
  // with Cancel, which discards, as the only way out.
  await polygon.click();
  await expect(polygon).toHaveAttribute("aria-pressed", "false");
  await expect(drafts.getByRole("listitem")).toHaveCount(1);

  // Cancel is the panel's own, in the footer beside Add: one exit for the
  // whole screen, because the session is part of it rather than somewhere
  // else it went.
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel).toHaveCount(0);
  await expect(root.getByText("2 zones").first()).toBeVisible();

  // And nothing reached the zone library either. The old path committed to the
  // rule AND to everyone's library the instant a shape closed, so it could
  // not have offered this at all.
  await root.getByRole("button", { name: "Add zones" }).click();
  await panel.getByRole("textbox", { name: "Search zones" }).fill("Zone 3");
  await expect(panel.getByRole("checkbox", { name: "Zone 3", exact: true })).toHaveCount(0);
});

test("one import field takes pasted GeoJSON or a link, told apart by looking", async ({ page }) => {
  // Fulfilled with the CORS header a real host would need: a cross-origin
  // fetch without it fails before the status can even be read, which is the
  // whole substance of the caveat the component documents.
  await page.route("**/bays.geojson", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/geo+json",
      headers: { "access-control-allow-origin": "*" },
      body: FEATURES,
    }),
  );

  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  await panel.getByRole("tab", { name: "Import" }).click();
  const field = panel.getByRole("textbox", { name: "Or paste GeoJSON or a link" });
  const fetchIt = panel.getByRole("button", { name: "Fetch" });
  const preview = panel.locator("[data-slot=zone-picker-preview]");

  // GeoJSON is read as it is typed, the way the paste box always was -- and no
  // button appears, because there is nothing left to press.
  await field.fill(FEATURES);
  await expect(preview).toContainText("2 zones found");
  await expect(preview).not.toContainText("found in");
  await expect(fetchIt).toHaveCount(0);

  // A link cannot be read on every keystroke, so it waits for Fetch. The
  // button appearing is also how the field says it accepts one.
  await field.fill("https://example.test/zones/bays.geojson");
  await expect(preview).toHaveCount(0);
  await expect(fetchIt).toBeVisible();
  await fetchIt.click();
  // Named, because one field now has three ways in and "2 zones found" alone
  // no longer says which of them is on screen.
  await expect(preview).toContainText("2 zones found in bays.geojson");

  await panel.getByRole("button", { name: "Add 2 zones" }).click();
  await expect(root.getByText("4 zones").first()).toBeVisible();
});

test("a link that cannot be fetched says what to do instead", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  await panel.getByRole("tab", { name: "Import" }).click();
  const field = panel.getByRole("textbox", { name: "Or paste GeoJSON or a link" });
  const alert = panel.getByRole("alert");
  const fetchIt = panel.getByRole("button", { name: "Fetch" });

  // A zip is refused by reading the link, with no request made: the dropzone
  // above unpacks shapefiles and the fetch never could.
  let hits = 0;
  await page.route("**/zones.zip", (route) => {
    hits += 1;
    return route.abort("failed");
  });
  await field.fill("https://example.test/zones.zip");
  await fetchIt.click();
  await expect(alert).toContainText("Drop the file above instead");
  expect(hits).toBe(0);

  await page.route("**/missing.geojson", (route) =>
    route.fulfill({
      status: 404,
      headers: { "access-control-allow-origin": "*" },
      body: "not here",
    }),
  );
  await field.fill("https://example.test/missing.geojson");
  await fetchIt.click();
  await expect(alert).toContainText("answered 404");

  // The browser collapses a CORS refusal, a DNS failure, being offline and a
  // bad certificate into one opaque TypeError with nothing readable from
  // script -- so the sentence has to cover all of them and name the way out.
  await page.route("**/blocked.geojson", (route) => route.abort("failed"));
  await field.fill("https://example.test/blocked.geojson");
  await fetchIt.click();
  await expect(alert).toContainText("allow requests from other sites");
  await expect(alert).toContainText("drop the file above instead");
});

test("the sources are three tabs in one row, and the bodies swap rather than remount", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  const list = panel.getByRole("tablist", { name: "Zone source" });
  const tabs = list.getByRole("tab");
  // Three short words, and the long phrasing is a title rather than an
  // aria-label: a tab reading "Library" whose accessible name is "Select from
  // your zones" is a label-in-name failure, which axe treats as blocking.
  await expect(tabs).toHaveText(["Library", "Draw", "Import"]);
  const ys = await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
  // Tabs, not radios: moving between them swaps which body is shown and
  // commits nothing, so arrowing through cannot arm a tool or pick a zone.
  await expect(list.getByRole("radio")).toHaveCount(0);

  // And it is one panel whose body changes, so what has been typed survives a
  // round trip -- the reason the sources are not five mounted panels.
  await panel.getByRole("tab", { name: "Import" }).click();
  const field = panel.getByRole("textbox", { name: "Or paste GeoJSON or a link" });
  await field.fill("https://example.test/zones/bays.geojson");
  await panel.getByRole("tab", { name: "Library" }).click();
  await expect(field).toHaveCount(0);
  await panel.getByRole("tab", { name: "Import" }).click();
  await expect(field).toHaveValue("https://example.test/zones/bays.geojson");
});

test("Try a sample fetches the GeoJSON served beside the page", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  await root.getByRole("button", { name: "Add zones" }).click();

  const panel = root.locator("[data-slot=zone-picker-panel]");
  await panel.getByRole("tab", { name: "Import" }).click();
  const field = panel.getByRole("textbox", { name: "Or paste GeoJSON or a link" });
  const sample = panel.getByRole("button", { name: "Try a sample" });

  // Deliberately NOT routed: this fetches the file out of the built export,
  // which is the only way to know it shipped and is reachable under the
  // basePath the Pages site adds. Every other link in this suite is a stub.
  await expect(sample).toBeVisible();
  await sample.click();

  // One press fills the field and fetches, so what it did is visible rather
  // than merely plausible -- and the sample gives way to Fetch, which is now
  // what the field offers.
  await expect(field).toHaveValue(/\/data\/parking-bays-lisbon\.geojson$/);
  await expect(sample).toHaveCount(0);

  const preview = panel.locator("[data-slot=zone-picker-preview]");
  await expect(preview).toContainText("6 zones found in parking-bays-lisbon.geojson");
  // Named from the file's own properties, not numbered by the reader.
  await expect(preview).toContainText("Baixa bay 9");

  await panel.getByRole("button", { name: "Add 6 zones" }).click();
  await expect(root.getByText("8 zones").first()).toBeVisible();
});

test("the map's search finds a place, and prefers the one near the map", async ({ page }) => {
  // The block ships no geocoder -- a deployment searches its own places -- so
  // the docs site wires OpenStreetMap's and this stands in for it. Two places
  // of the same name, the far one ranked first by the geocoder, exactly as
  // Nominatim really answers "Belem" over Lisbon.
  await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          name: "Belém",
          display_name: "Belém, Pará, Região Norte, Brasil",
          lat: "-1.4557",
          lon: "-48.5044",
        },
        {
          name: "Belém",
          display_name: "Belém, Lisboa, Portugal",
          lat: "38.6979",
          lon: "-9.2065",
          boundingbox: ["38.69", "38.71", "-9.22", "-9.19"],
        },
      ]),
    });
  });

  const root = await open(page);
  await root.locator("[data-slot=regulation-link]", { hasText: "Fleet cap" }).click();
  const map = root.getByRole("region", { name: "Map of the regulation's zones" });

  const search = map.locator("[data-slot=map-search]");
  await expect(search).toBeVisible();
  const field = search.getByRole("combobox", { name: "Search the map" });
  await field.fill("Belem");

  // Nearest first. The geocoder ranks by size, so the Brazilian city comes
  // back first; which of two identically named places was meant is the map's
  // question, not the geocoder's, and the map is over Lisbon.
  const options = search.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toContainText("Lisboa");

  await options.first().click();
  await expect(options).toHaveCount(0);
  await expect(field).toHaveValue("Belém");

  // It stands down for a drawing session: both want the top centre, and the
  // banner is what has to be read there while a tool is armed.
  await root.getByRole("button", { name: "Add zones" }).click();
  const picker = root.locator("[data-slot=zone-picker-panel]");
  await picker.getByRole("tab", { name: "Draw" }).click();
  await picker.getByRole("button", { name: /^Polygon/ }).click();
  await expect(search).toHaveCount(0);

  // And comes back when the session ends.
  await picker.getByRole("button", { name: "Cancel" }).click();
  await expect(search).toBeVisible();
});
