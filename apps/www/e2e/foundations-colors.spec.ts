import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * Foundations documents 359 colours, and each one claims two things: this is
 * the code you write for it, and clicking puts exactly that on your clipboard.
 * A docs page that gets either wrong is worse than one that says nothing,
 * because the reader has no way to tell.
 *
 * Nothing else in the suite looks at this page. The a11y crawl, the visual
 * baselines and the ring check all go through `/preview/*` and `/blocks/*`,
 * which is how the first version of these swatches shipped 170 WCAG contrast
 * failures -- step labels dimmed to `opacity-60` and `opacity-45`, down to
 * 1.95:1 -- and nothing failed. That is the hole this file closes.
 */

/**
 * Longer than the 30s default, because the work genuinely is larger: axe has
 * to walk 359 swatches, twice, on a server that may still be cold. The first
 * version inherited the default and timed out under parallel load -- a flake
 * that says nothing about the page.
 */
test.describe.configure({ timeout: 90_000 });

/** The colour sections, and nothing else on the page. */
const SECTIONS = ["#brand-colours", "#primitive-ramps", "#semantic-tokens", "#map-ramps"];

/** A colour of each tier, since the tiers carry genuinely different codes. */
const SAMPLES = [
  { tier: "brand swatch", code: "--brand-teal" },
  { tier: "brand hex chip", code: "#00DC96" },
  { tier: "primitive step", code: "zinc-500" },
  { tier: "semantic row", code: "--primary" },
  { tier: "map stop", code: "--map-ramp-50" },
];

const open = async (page: Page) => {
  await page.goto("/foundations");
  await settle(page);
};

test.describe("foundations colours", () => {
  test("every colour carries a code and copies it", async ({ page }) => {
    await open(page);

    // Every swatch announces its own code, or a reader using a screen reader
    // is told only "button".
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-copy]")]
        .map((el) => ({
          code: el.dataset.copy ?? "",
          name: el.getAttribute("aria-label") ?? "",
        }))
        .filter((s) => !s.code || !s.name.includes(s.code))
        .slice(0, 10),
    );
    expect(unnamed, `swatches whose accessible name omits their code:\n${JSON.stringify(unnamed)}`).
      toEqual([]);

    const count = await page.locator("[data-copy]").count();
    expect(count, "the colour sections rendered nothing").toBeGreaterThan(300);

    // And the clipboard really receives it. Read back rather than trusting the
    // tick: the point of the feature is the string, not the confirmation.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    for (const { tier, code } of SAMPLES) {
      const swatch = page.locator(`[data-copy="${code}"]`).first();
      await swatch.scrollIntoViewIfNeeded();
      await swatch.click();
      const got = await page.evaluate(() => navigator.clipboard.readText());
      expect(got, `clicking the ${tier} should copy ${code}`).toBe(code);
    }

    // Keyboard, not only pointer. The handler is delegated from a container,
    // which is exactly the arrangement that silently becomes mouse-only.
    const viaKey = page.locator('[data-copy="--brand-violet"]');
    await viaKey.scrollIntoViewIfNeeded();
    await viaKey.focus();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("--brand-violet");
  });

  /**
   * Scoped to the colour sections so this cannot be quieted by, or blamed for,
   * anything elsewhere on the page.
   */
  for (const scheme of ["light", "dark"] as const) {
    test(`every label on a colour is legible in ${scheme}`, async ({ page }) => {
      // Before the document runs, so next-themes reads it on first paint and
      // this needs one page load rather than a load, a write and a reload.
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme);
      await open(page);
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));

      let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
      for (const s of SECTIONS) axe = axe.include(s);
      const { violations } = await axe.analyze();

      const report = violations.map(
        (v) => `  ${v.impact} ${v.id} x${v.nodes.length}\n    ${v.nodes[0]?.failureSummary ?? ""}`,
      );
      expect(violations.map((v) => v.id), report.join("\n")).toEqual([]);
    });
  }

  /**
   * The swatches are focusable now, and a ramp is a row of them inside a
   * rounded, bordered strip -- the exact shape that invites `overflow-hidden`
   * and slices the ring off. Geometric rather than driven by Tab: 359 tab
   * stops is a slow test, and `:focus-visible` does not match on programmatic
   * focus, so the ring reach is computed from what the focus rule paints.
   */
  test("no focus ring on a swatch is clipped", async ({ page }) => {
    await open(page);

    const clipped = await page.evaluate(() => {
      // ring-2 over ring-offset-2: 4px beyond the border box on every side.
      const REACH = 4;
      const TOL = 0.5;
      const found: { copy: string; by: string; cut: string }[] = [];

      for (const el of document.querySelectorAll<HTMLElement>("[data-copy]")) {
        const box = el.getBoundingClientRect();
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          const cx = cs.overflowX !== "visible";
          const cy = cs.overflowY !== "visible";
          if (!cx && !cy) continue;

          // The scrollport is the padding box, not the border box.
          const r = p.getBoundingClientRect();
          const port = {
            left: r.left + p.clientLeft,
            top: r.top + p.clientTop,
            right: r.left + p.clientLeft + p.clientWidth,
            bottom: r.top + p.clientTop + p.clientHeight,
          };

          // Only a swatch that is itself fully in view can have its ring cut.
          const visible =
            (!cx || (box.left >= port.left - 0.5 && box.right <= port.right + 0.5)) &&
            (!cy || (box.top >= port.top - 0.5 && box.bottom <= port.bottom + 0.5));
          if (!visible) continue;

          const cut: string[] = [];
          if (cy && box.top - REACH < port.top - TOL) cut.push("top");
          if (cy && box.bottom + REACH > port.bottom + TOL) cut.push("bottom");
          if (cx && box.left - REACH < port.left - TOL) cut.push("left");
          if (cx && box.right + REACH > port.right + TOL) cut.push("right");
          if (cut.length)
            found.push({
              copy: el.dataset.copy ?? "",
              by: `${p.tagName.toLowerCase()}.${(p.className || "").split(/\s+/).slice(0, 3).join(".")}`,
              cut: cut.join(", "),
            });
        }
      }
      return found.slice(0, 10);
    });

    expect(
      clipped,
      clipped.map((c) => `  ${c.copy}: ring cut ${c.cut} by ${c.by}`).join("\n"),
    ).toEqual([]);
  });
});
