import { test, expect, type Page } from "@playwright/test";

import { BLOCKS, EXAMPLES, settle } from "./examples";

/**
 * A focus ring that an ancestor clips is a real accessibility defect, not a
 * cosmetic one: the ring IS the keyboard user's only indication of where they
 * are, and this system leans on it harder than most, having deliberately set
 * the resting field border below 3:1. Half a ring inside a scrolling panel is
 * how that bargain quietly breaks.
 *
 * The ring paints OUTSIDE the border box, so any ancestor with `overflow`
 * other than `visible` cuts it -- a scrolling panel, a rounded card with
 * `overflow-hidden`, a virtualised grid. Nothing about a control in isolation
 * reveals this. It only appears in composition, which is the thing a component
 * library actually ships, so BLOCKS are crawled here too.
 *
 * Two details this test got wrong before they were fixed, both worth keeping:
 *
 *   1. Focus is driven with Tab, not `el.focus()`. `:focus-visible` is what
 *      draws the ring and does not reliably match on programmatic focus, so
 *      measuring the latter finds nothing, every time, and looks like a pass.
 *
 *   2. The ring is not always on the focused element. `InputGroup` puts
 *      `has-[...:focus-visible]:ring-3` on the WRAPPER and `ring-0` on the
 *      inner input, which is exactly the case that reached a human first.
 *      Every ancestor is therefore checked for a ring of its own.
 */

/** Below this, the difference is antialiasing rather than a clipped ring. */
const TOLERANCE = 0.5;

/** Tab stops per page. Generous: a block is a whole screen of controls. */
const MAX_STOPS = 80;

type Clip = { control: string; clipper: string; sides: string };

async function auditPage(page: Page, url: string): Promise<Clip[]> {
  await page.goto(url);
  await settle(page);

  const found: Clip[] = [];
  const seen = new Set<string>();
  let first: string | null = null;

  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");

    const result = await page.evaluate((tolerance) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;

      // Identity, not appearance: two ghost icon buttons with identical markup
      // are still two stops. Comparing descriptions ended the sweep early.
      const KEY = "vnFocusStop";
      const store = window as unknown as Record<string, number>;
      if (!el.dataset[KEY]) {
        store[KEY] = (store[KEY] ?? 0) + 1;
        el.dataset[KEY] = String(store[KEY]);
      }
      const stop = el.dataset[KEY]!;

      const describe = (n: Element) => {
        const slot = n.getAttribute("data-slot");
        const cls = (n.getAttribute("class") ?? "").split(/\s+/).slice(0, 2).join(".");
        return `${n.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}${cls ? `.${cls}` : ""}`;
      };

      /** How far a focus indicator reaches beyond this element's border box. */
      const reachOf = (n: Element) => {
        const cs = getComputedStyle(n);
        const out = { top: 0, right: 0, bottom: 0, left: 0 };
        const shadows = cs.boxShadow === "none" ? [] : cs.boxShadow.split(/,(?![^(]*\))/);
        for (const s of shadows) {
          if (s.includes("inset")) continue;
          // A transparent shadow is a Tailwind ring placeholder, not a ring.
          if (/rgba\(0,\s*0,\s*0,\s*0\)|transparent|\/\s*0\)/.test(s)) continue;
          const nums = (s.match(/-?[\d.]+px/g) ?? []).map(parseFloat);
          if (nums.length < 3) continue;
          const [dx = 0, dy = 0, blur = 0, spread = 0] = nums;
          const reach = blur / 2 + spread;
          out.top = Math.max(out.top, reach - dy);
          out.bottom = Math.max(out.bottom, reach + dy);
          out.left = Math.max(out.left, reach - dx);
          out.right = Math.max(out.right, reach + dx);
        }
        if (cs.outlineStyle !== "none") {
          const r = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset || "0");
          if (r > 0) {
            out.top = Math.max(out.top, r);
            out.right = Math.max(out.right, r);
            out.bottom = Math.max(out.bottom, r);
            out.left = Math.max(out.left, r);
          }
        }
        return out.top + out.right + out.bottom + out.left > 0 ? out : null;
      };

      // The focused element AND its ancestors: the ring may be painted by a
      // wrapper reacting to :has(:focus-visible).
      const hosts: { node: HTMLElement; out: ReturnType<typeof reachOf> }[] = [];
      for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        const out = reachOf(n);
        if (out) hosts.push({ node: n, out });
      }
      if (!hosts.length) return { stop, clip: null };

      for (const { node, out } of hosts) {
        const box = node.getBoundingClientRect();
        const ring = {
          top: box.top - out!.top,
          right: box.right + out!.right,
          bottom: box.bottom + out!.bottom,
          left: box.left - out!.left,
        };

        for (let p = node.parentElement; p; p = p.parentElement) {
          const ps = getComputedStyle(p);
          const clipsX = ps.overflowX !== "visible";
          const clipsY = ps.overflowY !== "visible";
          if (!clipsX && !clipsY) continue;

          // The scrollport is the padding box, not the border box.
          const r = p.getBoundingClientRect();
          const port = {
            left: r.left + p.clientLeft,
            top: r.top + p.clientTop,
            right: r.left + p.clientLeft + p.clientWidth,
            bottom: r.top + p.clientTop + p.clientHeight,
          };

          // Only a control that is itself fully visible can have its ring
          // clipped. A half-scrolled row is not this bug.
          const visible =
            (!clipsX || (box.left >= port.left - 0.5 && box.right <= port.right + 0.5)) &&
            (!clipsY || (box.top >= port.top - 0.5 && box.bottom <= port.bottom + 0.5));
          if (!visible) continue;

          const cut: Record<string, number> = {};
          if (clipsY && ring.top < port.top) cut.top = port.top - ring.top;
          if (clipsY && ring.bottom > port.bottom) cut.bottom = ring.bottom - port.bottom;
          if (clipsX && ring.left < port.left) cut.left = port.left - ring.left;
          if (clipsX && ring.right > port.right) cut.right = ring.right - port.right;

          const sides = Object.entries(cut).filter(([, v]) => v > tolerance);
          if (sides.length)
            return {
              stop,
              clip: {
                control: describe(node) + (node === el ? "" : ` (ring for ${describe(el)})`),
                clipper: `${describe(p)} (overflow-x:${ps.overflowX}, overflow-y:${ps.overflowY})`,
                sides: sides.map(([k, v]) => `${k} by ${v.toFixed(1)}px`).join(", "),
              },
            };
        }
      }
      return { stop, clip: null };
    }, TOLERANCE);

    if (!result) break;
    if (first !== null && result.stop === first) break; // focus wrapped
    first ??= result.stop;

    if (result.clip) {
      const key = `${result.clip.control}|${result.clip.sides}|${result.clip.clipper}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(result.clip);
      }
    }
  }

  return found;
}

const report = (clipped: Clip[]) =>
  clipped.length
    ? "\n" +
      clipped.map((c) => `  ${c.control}\n    clipped ${c.sides}\n    by ${c.clipper}`).join("\n") +
      "\n"
    : "";

/**
 * MapLibre focuses its own <canvas> for keyboard panning and paints a 1px
 * outline on it, which its own wrapper clips. It is third-party markup we do
 * not style, and suppressing the outline would remove an indicator rather than
 * fix one. Tracked rather than silenced: if OUR components start clipping in
 * these examples, the test still fails on that.
 */
const THIRD_PARTY = /^canvas\.maplibregl-canvas/;

test.describe("focus rings", () => {
  const run = async (page: Page, url: string) => {
    const clipped = (await auditPage(page, url)).filter((c) => !THIRD_PARTY.test(c.control));
    expect(clipped, report(clipped)).toEqual([]);
  };

  for (const { example } of EXAMPLES)
    test(`${example} draws every focus ring in full`, ({ page }) => run(page, `/preview/${example}`));

  /**
   * Blocks get crawled at two sizes, because they have two layouts.
   *
   * The project viewport is 900px, which is below the lg the map blocks switch
   * on -- so without the desktop pass here the side-by-side layout would have no
   * coverage at all. The phone pass is not symmetry: below lg the panels dock to
   * the bottom of the block, which makes a NEW scrolling clipper with a much
   * shorter scrollport, and a ring sliced off by a scrollport edge is the exact
   * defect this file exists for.
   *
   * Set here rather than on the project so the 96 example baselines, which are
   * fullPage at 900px, keep reproducing.
   */
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["phone", { width: 390, height: 844 }],
  ] as const) {
    test.describe(label, () => {
      test.use({ viewport });
      for (const block of BLOCKS)
        test(`block ${block} draws every focus ring in full`, ({ page }) =>
          run(page, `/blocks/${block}`));
    });
  }
});
