import { expect, test, type Page } from "@playwright/test";

import { BLOCKS, settle } from "./examples";

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

for (const block of BLOCKS) {
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
