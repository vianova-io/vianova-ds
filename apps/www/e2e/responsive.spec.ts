import { expect, test, type Page } from "@playwright/test";

import { MAP_BLOCKS, NON_MAP_BLOCKS, settle } from "./examples";

/**
 * Geometry of the map blocks at phone, tablet and desktop widths.
 *
 * Deliberately not screenshots. These blocks draw a live WebGL map from tiles
 * fetched over the network, so a baseline would mostly record whether the tiles
 * happened to arrive before the shutter -- which is why `map-canvas-default` is
 * already excluded from the visual suite. What actually has to hold is
 * measurable: one panel below lg and two above it, panels that do not stretch,
 * a top bar that fits inside a box which would silently clip it, and an
 * attribution nobody is sitting on top of.
 *
 * The project viewport is 900px, which after the responsive work is the TABLET
 * layout, so every case here sets its own size.
 */

/** Must match the `lg:` the blocks switch on. */
const LG = 1024;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

type Rect = { x: number; y: number; width: number; height: number };

type Shape = {
  block: Rect;
  blockBorderX: number;
  panels: { visible: boolean; rect: Rect }[];
  topBar: { first: Rect; last: Rect } | null;
  attribution: Rect | null;
  hasCanvas: boolean;
};

/**
 * Reads the block's layout in one pass.
 *
 * Everything is returned as plain numbers rather than asserted in the browser,
 * so a failure reports the measurement rather than just "false".
 */
async function readShape(page: Page): Promise<Shape> {
  return page.evaluate(() => {
    const box = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    // The block root is the positioned ancestor every overlay is placed
    // against; the map canvas is the one element guaranteed to be inside it.
    const canvasSlot = document.querySelector("[data-slot=map-canvas]");
    const root = canvasSlot?.parentElement as HTMLElement;
    const panels = [
      ...root.querySelectorAll("[data-slot=floating-panel]"),
    ] as HTMLElement[];
    const bar = root.querySelector("[data-slot=map-toolbar]") as HTMLElement | null;
    const barKids = bar
      ? ([...bar.children] as HTMLElement[]).filter(
          (el) => getComputedStyle(el).display !== "none",
        )
      : [];
    const attribution = document.querySelector(".maplibregl-ctrl-attrib");
    const rootStyle = getComputedStyle(root);
    return {
      block: box(root),
      // getBoundingClientRect is the border box, but an absolutely positioned
      // child is placed against the padding box, so the two differ by the
      // border on each side. Read rather than assumed, so restyling the block's
      // border does not turn into a mystery failure here.
      blockBorderX:
        parseFloat(rootStyle.borderLeftWidth) + parseFloat(rootStyle.borderRightWidth),
      panels: panels.map((p) => ({
        visible: getComputedStyle(p).display !== "none",
        rect: box(p),
      })),
      topBar:
        barKids.length > 0
          ? { first: box(barKids[0]!), last: box(barKids[barKids.length - 1]!) }
          : null,
      attribution: attribution ? box(attribution) : null,
      hasCanvas: !!document.querySelector("canvas.maplibregl-canvas"),
    };
  });
}

const overlaps = (a: Rect, b: Rect) =>
  !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );

for (const block of MAP_BLOCKS) {
  for (const vp of VIEWPORTS) {
    test.describe(`${block} at ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      const desktop = vp.width >= LG;

      test("lays out without clipping or collision", async ({ page }) => {
        await page.goto(`/blocks/${block}`);
        await settle(page);
        const shape = await readShape(page);

        // 1. One panel below lg, both above it.
        //
        // This single count covers three things at once: that the CSS display
        // toggle resolves the way tailwind-merge is expected to resolve it,
        // that the switcher's state is actually driving something, and that the
        // two panels are mutually exclusive where they would otherwise overlap.
        const visible = shape.panels.filter((p) => p.visible);
        expect(shape.panels.length, "both panels should exist in the DOM").toBe(2);
        expect(
          visible.length,
          desktop
            ? "both panels show from lg, where there is room side by side"
            : "below lg the panels share the bottom of the block, so only one",
        ).toBe(desktop ? 2 : 1);

        // 2. Each tier's panel is the width that tier calls for.
        //
        // Mutation-tested, and the first version of this comment was wrong, so
        // it is worth being exact about what this does and does not buy.
        //
        // It catches a panel that is the wrong width at either tier: a broken
        // breakpoint, a dropped `lg:w-[340px]`, a mobile panel that is not
        // spanning the block. Removing `lg:w-[340px]` makes it fail at 325px.
        //
        // What it does NOT catch, despite appearances, is the tailwind-merge
        // inset trap the blocks are written to avoid -- top/right/bottom/left
        // being four separate conflict groups, so a mobile `inset-x-2 bottom-10`
        // survives alongside `lg:left-4 lg:top-16` with both insets live on both
        // axes. Deleting the `lg:*-auto` resets changes nothing measurable here,
        // because an over-constrained box with an explicit width resolves `right`
        // to auto, and `lg:max-h-*` clamps the vertical case to the same height.
        // The resets stay as hygiene for whoever edits these classes next; they
        // are not what this assertion is pinning.
        for (const p of visible) {
          if (desktop) {
            expect(
              Math.round(p.rect.width),
              "the desktop panel is not 340px wide",
            ).toBe(340);
          } else {
            expect(
              Math.round(shape.block.width - shape.blockBorderX - p.rect.width),
              "the docked panel should span the block less its 8px margins either side",
            ).toBe(16);
          }
        }

        // 3. The top bar fits inside the block.
        //
        // The root is overflow-hidden, so an overflowing bar is CLIPPED: no
        // scrollbar, no ellipsis, the last control simply is not there. That
        // also means scrollWidth can never reveal it -- scrollWidth equals
        // clientWidth on a clipped box -- so this has to compare child rects
        // against the root's.
        expect(shape.topBar, "the top bar rendered no visible children").not.toBeNull();
        const bar = shape.topBar!;
        expect(
          Math.round(bar.first.x - shape.block.x),
          "the first control in the top bar is clipped on the left",
        ).toBeGreaterThanOrEqual(0);
        expect(
          Math.round(shape.block.x + shape.block.width - (bar.last.x + bar.last.width)),
          "the last control in the top bar is clipped on the right",
        ).toBeGreaterThanOrEqual(0);

        // 4. Nothing sits on the map's attribution.
        //
        // Guarded on the canvas: MapCanvas gives up and renders its fallback
        // when WebGL is missing, and these blocks pass no fallback, so without
        // a canvas there is no attribution node and this would fail for a
        // reason that has nothing to do with layout.
        //
        // Geometric rather than elementFromPoint on purpose. The attribution is
        // near the bottom of a block that is often taller than the viewport, so
        // on a short viewport elementFromPoint returns null for it and reports
        // a collision that is not there.
        if (shape.hasCanvas && shape.attribution) {
          for (const p of visible) {
            expect(
              overlaps(p.rect, shape.attribution),
              "a panel is covering the map attribution -- the docked panel needs to clear the badge, which paints at z-index 2 and so sits ABOVE the panel",
            ).toBe(false);
          }
        }
      });

      if (!desktop) {
        test("the switcher reports the panel it actually controls", async ({
          page,
        }) => {
          await page.goto(`/blocks/${block}`);
          await settle(page);

          // Scoped to the switcher itself. Other disclosures in the block --
          // each layer card's Filters row, for one -- carry the same attributes.
          const buttons = page.locator("[data-slot=panel-switcher] button");
          const count = await buttons.count();
          expect(count, "the panel switcher should render below lg").toBe(2);

          for (let i = 0; i < count; i++) {
            const button = buttons.nth(i);
            const id = await button.getAttribute("aria-controls");
            const expanded = (await button.getAttribute("aria-expanded")) === "true";
            // An attribute selector, not `#id`: React's useId emits characters
            // that are not valid unescaped in a CSS id selector.
            const target = page.locator(`[id="${id}"]`);
            expect(await target.count(), `aria-controls="${id}" resolves to nothing`).toBe(1);
            // The claim the button makes has to match what is on screen, which
            // is the whole reason this control only exists below lg: from lg up
            // CSS shows both panels whatever the state says, so a switcher that
            // survived to desktop would announce "collapsed" over a panel the
            // reader can plainly see.
            const shown = await target.evaluate(
              (el) => getComputedStyle(el).display !== "none",
            );
            expect(shown, `aria-expanded="${expanded}" disagrees with the panel`).toBe(
              expanded,
            );
          }

          // Pressing the other one swaps which panel is up.
          await buttons.nth(1).click();
          const after = await readShape(page);
          expect(
            after.panels.filter((p) => p.visible).length,
            "still exactly one panel after switching",
          ).toBe(1);
          expect(
            await buttons.nth(1).getAttribute("aria-expanded"),
            "the pressed button should now report expanded",
          ).toBe("true");
        });

        test("the switcher is big enough for a thumb", async ({ page }) => {
          await page.goto(`/blocks/${block}`);
          await settle(page);

          // WCAG 2.5.8 (AA, the level the a11y suite gates on) asks for 24x24.
          // 44 is 2.5.5, a AAA criterion, and the control-size ladder pins icon
          // buttons to exactly 36px -- so rather than grow the box, these
          // carry an `after:-inset-2` pseudo-element that widens the hit area
          // to 52px. That is invisible to getBoundingClientRect, so it has to
          // be probed the way a thumb arrives: elementFromPoint.
          //
          // Measured as reach from the centre rather than as the corners of a
          // 44x44 square. The two buttons sit 8px apart and each reaches 8px
          // outward, so their slops meet in the middle of that gap and the
          // later one wins the hit test -- a corner probe fails on the side
          // facing the neighbour while describing a target that is, for a
          // thumb, perfectly good. What matters instead is that each button
          // reaches 22px vertically, and that no point between them is dead.
          const scope = page.locator("[data-slot=panel-switcher]");
          await scope.scrollIntoViewIfNeeded();
          const result = await scope.evaluate((root) => {
            const buttons = [...root.querySelectorAll("button")];
            const owns = (el: Element | null) =>
              !!el && buttons.some((b) => b === el || b.contains(el));
            const reach = (b: Element, dx: number, dy: number) => {
              const r = b.getBoundingClientRect();
              const cx = r.x + r.width / 2;
              const cy = r.y + r.height / 2;
              let n = 0;
              // Walk out a pixel at a time; stop as soon as the point stops
              // belonging to THIS button.
              while (n < 60) {
                const el = document.elementFromPoint(cx + dx * (n + 1), cy + dy * (n + 1));
                if (!el || !(b === el || b.contains(el))) break;
                n++;
              }
              return n;
            };
            const verticalReach = buttons.map((b) => Math.min(reach(b, 0, -1), reach(b, 0, 1)));
            // Sweep the strip spanned by the switcher, at its vertical centre.
            const rect = root.getBoundingClientRect();
            const y = rect.y + rect.height / 2;
            const dead: number[] = [];
            for (let x = Math.ceil(rect.x); x <= Math.floor(rect.x + rect.width); x++) {
              if (!owns(document.elementFromPoint(x, y))) dead.push(Math.round(x - rect.x));
            }
            return { count: buttons.length, verticalReach, dead };
          });

          expect(result.count, "the switcher should hold two buttons").toBe(2);
          for (const r of result.verticalReach) {
            expect(
              r * 2,
              `a switcher button is only ${r * 2}px of live height; a thumb wants 44`,
            ).toBeGreaterThanOrEqual(44);
          }
          expect(
            result.dead,
            "there is dead space between the switcher buttons, so a thumb can land on nothing",
          ).toEqual([]);
        });
      }
    });
  }
}

/**
 * The advanced filter builder opens in a popover wider than a phone.
 *
 * Its own test because only one block has it, and because nothing else in this
 * file would catch it: the popup is portalled and fixed-positioned, so it
 * contributes nothing to any scroll metric and sits outside the block root that
 * every other assertion here measures against.
 */
test.describe("map-workspace filter popover on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("opens fully on screen", async ({ page }) => {
    await page.goto("/blocks/map-workspace");
    await settle(page);

    const trigger = page.getByRole("button", { name: "Edit Vehicle Flows filters" });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const popup = page.locator("[data-slot=popover-content]").first();
    await popup.waitFor({ state: "visible" });
    const box = (await popup.boundingBox())!;
    const width = page.viewportSize()!.width;

    // Base UI's collision handling SHIFTS a popup back into view but never
    // SHRINKS it, so a fixed 440px popup on a 375px screen keeps its width and
    // simply hangs off the edge, taking the value inputs with it.
    expect(Math.round(box.x), "the popover starts off the left edge").toBeGreaterThanOrEqual(0);
    expect(
      Math.round(box.x + box.width),
      "the popover runs off the right edge -- it needs a max-width",
    ).toBeLessThanOrEqual(width);
  });
});

/**
 * The docs shell itself, which turned out to be the reason a correctly
 * responsive block still looked wrong on a phone.
 *
 * The header nav was `flex items-center gap-5` with no responsive prefix
 * anywhere and measured 609px against the export -- five links, four gaps and
 * 160px of theme controls -- in a row that offers it 206px at 375px. Nothing
 * in the shell is `overflow-hidden`, so the surplus became document overflow:
 * `scrollWidth` 714 against a 375px viewport, on EVERY page of the site, with
 * the last two links off-screen. The blocks measured 327px and fitted; the
 * page around them slid sideways regardless.
 *
 * It lives in this file rather than its own spec on purpose. `ci.yml` runs
 * Playwright through named scripts, so a new spec needs BOTH a package.json
 * script and a ci.yml step, and `test:responsive` already has both -- the
 * cheapest way for a guard in this repo to become a silent no-op is to need
 * two pieces of wiring and get one.
 */

/**
 * Routes chosen for the shell, not for coverage: one of each layout the header
 * sits on top of.
 *
 * `/foundations` is in the list for a second reason. Its map ramps were the
 * other thing pushing this page sideways -- eleven `flex-1` swatches each
 * printing a hex, which `flex-1` cannot shrink below, so the row refused to
 * fit 327px and took `scrollWidth` to 487 instead of truncating. The hex is
 * now hidden below `sm` and this is what holds that.
 *
 * `/showcase` is deliberately absent, and it is worth saying why rather than
 * leaving a reader to assume the list is arbitrary: it still overflows from
 * its own content, independently of the header, at 375px (scrollWidth 411)
 * AND at 768px (779), from somewhere inside the wall of live component
 * previews. Every candidate sits inside its own scroller, so it needs a dig
 * rather than a guess. Adding it would mean this guard failed on arrival and
 * taught the next person to skip it.
 */
const SHELL_ROUTES = [
  "/",
  "/blocks",
  "/blocks/map-workspace",
  "/components/button",
  "/foundations",
  "/changelog",
];

/**
 * 768 and 820 are in deliberately: the full nav fits at neither.
 *
 * 1800 is in for the brand ribbon, and it is the only width that can see the
 * bug it guards against. The content wrapper is `max-w-[100rem]`, so it only
 * starts centring -- and only starts adding the margins the ribbon must not
 * inherit -- above 1600px. Mutation-tested: giving the ribbon the wrapper's
 * own `max-w-[100rem] mx-auto` passes at 375, 768, 820 AND 1280, and fails
 * only here. Without this width the ribbon assertions are decoration.
 */
const SHELL_WIDTHS = [375, 768, 820, 1280, 1800];

for (const width of SHELL_WIDTHS) {
  test.describe(`docs shell at ${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    for (const route of SHELL_ROUTES) {
      test(`${route} fits the viewport`, async ({ page }) => {
        await page.goto(route);
        await settle(page);

        const measured = await page.evaluate(() => {
          const vw = window.innerWidth;
          // An element inside its own scroller is not document overflow --
          // code blocks, tables and carousels all scroll inside their box by
          // design -- so walk the ancestors and ignore anything already
          // clipped. Without this the report is dozens of innocent rows and
          // the actual offender is somewhere in the middle of them.
          const clipped = (el: Element) => {
            let p = el.parentElement;
            while (p && p !== document.body) {
              if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) return true;
              p = p.parentElement;
            }
            return false;
          };
          const offenders: string[] = [];
          for (const el of document.querySelectorAll("body *")) {
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") continue;
            // Fixed elements are positioned against the viewport and add
            // nothing to scrollable overflow.
            if (style.position === "fixed") continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || (b.right <= vw + 1 && b.left >= -1)) continue;
            if (clipped(el)) continue;
            const cls =
              typeof el.className === "string" && el.className.trim()
                ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}`
                : "";
            offenders.push(
              `${el.tagName.toLowerCase()}${cls} [${Math.round(b.left)}..${Math.round(b.right)}]`,
            );
          }

          // The brand ribbon, measured here rather than in a test of its own
          // because the thing that can go wrong with it is the thing this
          // whole describe is about: it has to span the viewport, and the
          // wrapper it sits next to is margin-bound at every width above
          // 100rem.
          const ribbon = document.querySelector(
            "[data-slot=brand-ribbon]",
          ) as HTMLElement | null;
          const ribbonBox = ribbon ? ribbon.getBoundingClientRect() : null;

          // The header row is measured separately as well as through
          // scrollWidth, because the two catch different things: scrollWidth
          // would go quiet the moment anyone put `overflow-x-hidden` on the
          // shell, which hides the symptom while leaving the links as
          // unreachable as they were.
          const row = document.querySelector("header > div")!;
          const kids = [...row.children]
            .filter((el) => getComputedStyle(el).display !== "none")
            .map((el) => {
              const b = el.getBoundingClientRect();
              return { left: Math.round(b.left), right: Math.round(b.right) };
            });

          return {
            vw,
            scrollWidth: document.documentElement.scrollWidth,
            offenders: offenders.slice(0, 5),
            headerLeft: Math.min(...kids.map((k) => k.left)),
            headerRight: Math.max(...kids.map((k) => k.right)),
            ribbon: ribbonBox
              ? {
                  left: Math.round(ribbonBox.left),
                  width: Math.round(ribbonBox.width),
                  top: Math.round(ribbonBox.top),
                }
              : null,
          };
        });

        // The ribbon is brand expression, so it runs edge to edge and sits
        // above everything else. Checked at every width because the failure
        // mode is silent above 100rem, where the content wrapper starts
        // adding margins the ribbon must not inherit.
        expect(measured.ribbon, "the brand ribbon is missing").not.toBeNull();
        expect(
          measured.ribbon!.left,
          "the brand ribbon is inset from the left edge",
        ).toBe(0);
        expect(
          measured.ribbon!.width,
          `the brand ribbon is ${measured.ribbon!.width}px across a ${measured.vw}px viewport, so it is not full-bleed`,
        ).toBe(measured.vw);
        expect(
          measured.ribbon!.top,
          "the brand ribbon is not at the top of the page",
        ).toBe(0);

        expect(
          measured.headerLeft,
          "the header row starts off the left edge",
        ).toBeGreaterThanOrEqual(0);
        expect(
          measured.headerRight,
          `the header row ends at ${measured.headerRight} on a ${measured.vw}px viewport, so part of the nav is off-screen`,
        ).toBeLessThanOrEqual(measured.vw);

        expect(
          measured.scrollWidth,
          `the page scrolls sideways: scrollWidth ${measured.scrollWidth} against a ${measured.vw}px viewport.${
            measured.offenders.length
              ? `\nwidest things poking out:\n  ${measured.offenders.join("\n  ")}`
              : ""
          }`,
        ).toBeLessThanOrEqual(measured.vw);
      });
    }
  });
}

test.describe("docs shell navigation on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("every destination is reachable behind the menu", async ({ page }) => {
    await page.goto("/changelog");
    await settle(page);

    // Kill transitions for this test, because what it measures is where things
    // come to rest.
    //
    // The sheet enters from `translate-x-[2.5rem]` over 200ms and nothing in
    // Playwright waits for that: `toBeVisible` returns immediately and the
    // links measure 406px on a 375px viewport, 39px of which is the animation.
    // Polling the transform instead does not fix it -- the first poll can land
    // in the frame BEFORE the starting style is applied, see an identity matrix
    // and resolve early, which is exactly how this test first passed locally
    // and failed in the suite.
    await page.addStyleTag({
      content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
    });

    // Hidden, not absent: the row stays in the DOM and is revealed by CSS, so
    // nothing unmounts and no state is lost crossing the breakpoint.
    await expect(page.locator('header nav[aria-label="Main"]')).toBeHidden();

    const trigger = page.getByRole("button", { name: "Menu" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.locator("[data-slot=sheet-content]");
    await expect(sheet).toBeVisible();

    // The point of the whole exercise: the links that used to be off the right
    // edge are all here, all on screen, and all big enough to hit.
    const links = sheet.locator("nav a");
    await expect(links).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const box = (await links.nth(i).boundingBox())!;
      expect(Math.round(box.x), `link ${i} starts off the left edge`).toBeGreaterThanOrEqual(0);
      expect(
        Math.round(box.x + box.width),
        `link ${i} runs off the right edge`,
      ).toBeLessThanOrEqual(375);
      // 44, not the 24 of WCAG 2.5.8 that the a11y suite gates on: this is a
      // list of destinations built for a thumb, with no control-size ladder to
      // respect, so there is no reason to sit at the floor.
      expect(
        Math.round(box.height),
        `link ${i} is only ${Math.round(box.height)}px tall`,
      ).toBeGreaterThanOrEqual(44);
    }

    // Client-side navigation does not unmount the layout, so a sheet that does
    // not close itself stays open over the page it just moved to.
    await links.nth(1).click();
    await expect(page).toHaveURL(/\/blocks\/?$/);
    await expect(sheet).toBeHidden();
  });
});

test.describe("docs shell navigation on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the links are inline and the menu button is gone", async ({ page }) => {
    await page.goto("/changelog");
    await settle(page);

    await expect(page.locator('header nav[aria-label="Main"] a')).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });
});

/**
 * Blocks with no map have no panels to count, so what has to hold is simpler:
 * the block fits the viewport, and neither of its views scrolls sideways inside
 * it. Cards, tabs and the toolbar wrap; the column and data tables are the only
 * things allowed to scroll, and they do so inside their own container.
 */
for (const block of NON_MAP_BLOCKS) {
  for (const vp of VIEWPORTS) {
    test.describe(`${block} at ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("fits the viewport in the list and in a dataset", async ({ page }) => {
        await page.goto(`/blocks/${block}`);
        await settle(page);
        const root = page.locator(`[data-slot=${block}]`);

        const measure = () =>
          root.evaluate((el) => {
            const b = el.getBoundingClientRect();
            return {
              right: Math.round(b.right),
              vw: window.innerWidth,
              overflow: el.scrollWidth - el.clientWidth,
            };
          });

        for (const view of ["list", "dataset"] as const) {
          if (view === "dataset") await root.locator("ul button").first().click();
          const m = await measure();
          expect(m.right, `${view}: the block runs past the viewport`).toBeLessThanOrEqual(m.vw);
          expect(m.overflow, `${view}: the block scrolls sideways inside itself`).toBeLessThanOrEqual(1);
        }
      });
    });
  }
}
