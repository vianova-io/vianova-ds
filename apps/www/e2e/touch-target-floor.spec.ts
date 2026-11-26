import { test, expect } from "@playwright/test";

import { BLOCKS, NON_MAP_BLOCKS, settle } from "./examples";

/**
 * The touch floor across the whole registry, measured under a coarse pointer.
 *
 * VIP is used on tablets and phones in the field. The design system was built
 * on the opposite assumption, and `control-size.spec.ts` encodes it: a control
 * ladder at sm 32 / default 36 / lg 40, asserted across six control types.
 * That ladder is right for a mouse and it is not going anywhere -- this suite
 * runs beside it, not against it.
 *
 * Division of labour with `touch-target.spec.ts`, which came first: that file
 * takes the two controls Frederic Robinet's review named, measures each one's
 * BOX by hand, and asserts both halves of the `pointer-coarse:` fix -- 44px on
 * a coarse pointer, unchanged on a fine one. It is the per-control gate for
 * controls that have been fixed.
 *
 * This file is the census gate: every control on every workspace, measured by
 * HIT AREA rather than by box, against the conformance floor. The two ask
 * different questions and neither subsumes the other. Read README, "Touch
 * targets" for the numbers and for which convention applies where.
 *
 * What this one adds is the number the ladder cannot tell you: the area a
 * thumb can actually land on. That is not the class string and it is not the
 * bounding box. It is the box after borders, line-height, a parent `min-h`,
 * any `after:-inset-*` hit slop, and -- the part only a browser knows -- any
 * sibling layered on top. So every number here comes from probing outward
 * from a control's centre with `elementFromPoint` until the hit stops
 * resolving back to the control. A hit on a `::after` pseudo-element resolves
 * to the element that owns it, which is what makes the house hit-slop
 * convention measurable rather than merely asserted.
 *
 * Two floors, and they are not the same kind of thing:
 *
 *   24px  WCAG 2.2 AA, 2.5.8 Target Size (Minimum). A conformance floor, with
 *         real exceptions written into the criterion. Failing it is a defect.
 *   44px  AAA / Apple HIG. A comfort floor. The registry misses it almost
 *         everywhere (see README, "Touch targets"), so asserting it across the
 *         board would be a suite that fails on arrival and gets switched off.
 *
 * Hence the shape: the 24px floor is enforced everywhere this suite looks, and
 * the 44px floor is enforced only where it has already been met, so the
 * surfaces that are right cannot quietly stop being right. The ratchet turns
 * one way.
 *
 * `hasTouch: true` is what makes `(pointer: coarse)` match in Chromium --
 * verified, not assumed -- and the rest of the suite runs without it, so
 * nothing here changes what `control-size.spec.ts` measures on a fine pointer.
 */

/** WCAG 2.2 AA 2.5.8. */
const AA_FLOOR = 24;

/** AAA 2.5.5 / Apple HIG. Enforced only on surfaces already at or above it. */
const TOUCH_FLOOR = 44;

/**
 * Surfaces built for touch, which must stay that way.
 *
 * `citizen-workspace` is the phone surface -- it hard-codes `min-h-11` /
 * `size-11` because it is never anything but touched -- and it is the only
 * block in the registry that clears 44px on every control today. It is in here
 * so that stays true, not because it is the only place that should be.
 */
const TOUCH_SIZED = ["citizen-workspace"];

/**
 * The one control under the AA floor, recorded rather than excused.
 *
 * `patterns/bottom-tray.tsx` gives its drag handle a full-width 24px grab
 * strip (`absolute inset-x-0 top-0 z-10 h-6`) while painting only a 4px pill
 * in the middle of it. On a map block the tray's first child is the panel
 * header, so the strip is layered over the top ~3.5px of the Data / Zones
 * tabs: a 44.8x25 box with a 45x22 tap area, and a tab that small has to clear
 * the spacing exception, which it cannot while a 768x24 slider sits on it.
 *
 * It shows up on both a phone and a tablet -- the strip is 324px wide on one
 * and 768px on the other, and covers the tabs either way.
 *
 * It is left alone here on purpose. The fix is to reserve the handle's height
 * in the tray's own layout, which moves every map panel header down 24px and
 * rewrites the visual baselines of four blocks -- a change that deserves its
 * own PR rather than riding along in an audit.
 *
 * The list exists to be emptied. Anything not in it fails: emptying it was
 * verified by emptying it, which turned both map-workspace tests red with the
 * blocking slider named in the failure message.
 */
const KNOWN_UNDER_FLOOR: { block: string; slot: string; label: RegExp; why: string }[] = [
  {
    block: "map-workspace",
    slot: "tabs-trigger",
    label: /^(Data|Zones)$/,
    why: "bottom-tray's 24px grab strip is layered over the panel tabs",
  },
];

/** The viewports a VIP user actually touches. */
const TOUCH_VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
];

type Target = {
  tag: string;
  slot: string | null;
  role: string | null;
  label: string;
  box: { w: number; h: number };
  hit: { w: number; h: number };
  under: boolean;
  spacingOk: boolean;
  clash: string | null;
  scoped: boolean;
  skipped: "occluded" | "clipped" | null;
};

/**
 * Measures every target on the page.
 *
 * Runs against the whole document and tags each target with whether it is in
 * reporting scope, because occlusion and 2.5.8's spacing exception do not
 * respect a scope: on `/blocks` the tray handle that covers the panel tabs
 * lives outside `[data-slot=floating-panel]` entirely. The scope decides what
 * is reported -- the docs shell's nav and theme picker are not registry
 * controls -- never what a control is measured against.
 */
const MEASURE = /* js */ `((ROOTS, AA) => {
  const scopes = ROOTS ? ROOTS.flatMap((s) => [...document.querySelectorAll(s)]) : null;
  const inScope = (el) => !scopes || scopes.some((r) => r.contains(el));

  const SEL = [
    "a[href]", "button", "input:not([type=hidden])", "select", "textarea",
    "[role=button]", "[role=link]", "[role=checkbox]", "[role=radio]",
    "[role=switch]", "[role=tab]", "[role=menuitem]", "[role=menuitemcheckbox]",
    "[role=menuitemradio]", "[role=option]", "[role=slider]", "[role=combobox]",
    "[role=spinbutton]", "[tabindex]",
  ].join(",");
  const NATIVE = "button,a[href],input,select,textarea,summary";
  const ROLES = new Set(["button","link","checkbox","radio","switch","tab","menuitem",
    "menuitemcheckbox","menuitemradio","option","slider","combobox","spinbutton","separator"]);

  const vw = window.innerWidth, vh = window.innerHeight;
  const cand = [];

  for (const el of document.body.querySelectorAll(SEL)) {
    if (el.closest("[aria-hidden=true]")) continue;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") continue;
    // A target is what someone can activate. tabindex="-1" is programmatic
    // focus only -- Base UI puts it on combobox chip bodies and on list
    // containers -- so it is not a target unless the tag is natively
    // interactive or carries an interactive role. Counting those inflates
    // every number in this file.
    const ti = el.getAttribute("tabindex");
    const native = el.matches(NATIVE);
    if (!native && !ROLES.has(el.getAttribute("role") || "")) continue;
    if (!native && ti === "-1") continue;
    // SVG internals are not targets; the host <svg> or <button> is.
    if (el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    cand.push({ el, r, display: cs.display });
  }

  const read = [];
  for (const { el, r, display } of cand) {
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
    const hits = (x, y) => {
      if (x < 0 || y < 0 || x > vw || y > vh) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h));
    };
    // elementFromPoint answers null outside the viewport and resolves to an
    // ancestor where an overflow-hidden parent clips, so a control the fold or
    // a scroll container cuts through reads smaller than it is. Those are
    // reported as skipped rather than as a failure -- a measurement this
    // suite cannot stand behind must not become an assertion.
    const clipped = r.top < 0 || r.bottom > vh - 1 || r.left < 0 || r.right > vw - 1;
    const occluded = !hits(cx, cy);
    const probe = (dx, dy) => {
      let d = 0;
      for (let i = 1; i <= 28 + Math.max(r.width, r.height); i++) {
        if (!hits(cx + dx * i, cy + dy * i)) break;
        d = i;
      }
      return d;
    };
    const w = occluded || clipped ? 0 : probe(-1, 0) + probe(1, 0) + 1;
    const h = occluded || clipped ? 0 : probe(0, -1) + probe(0, 1) + 1;

    read.push({
      el,
      tag: el.tagName.toLowerCase(),
      slot: el.getAttribute("data-slot") || null,
      role: el.getAttribute("role") || null,
      label: ((el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\\s+/g, " ")).slice(0, 44),
      box: { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 },
      hit: { w, h },
      c: { x: cx, y: cy },
      rect: { l: r.left, t: r.top, rt: r.right, b: r.bottom },
      scoped: inScope(el),
      skipped: occluded ? "occluded" : clipped ? "clipped" : null,
      // 2.5.8's "inline" exception: a target inside a sentence or block of
      // text is exempt, because the text's own line height sets its size.
      inline: display.startsWith("inline") && !!el.parentElement &&
        (el.parentElement.textContent || "").trim().length > (el.textContent || "").trim().length + 3,
    });
  }

  // 2.5.8's spacing exception. An undersized target passes if a 24px-diameter
  // circle centred on it touches neither another undersized target's circle
  // nor any other target's box.
  const judged = read.filter((t) => !t.skipped);
  for (const t of judged) t.under = Math.min(t.hit.w, t.hit.h) < AA;
  for (const t of judged) {
    if (!t.under) { t.spacingOk = true; t.clash = null; continue; }
    let clash = null;
    for (const u of judged) {
      if (u === t) continue;
      if (u.under) {
        if (Math.hypot(t.c.x - u.c.x, t.c.y - u.c.y) < AA) { clash = u; break; }
      } else {
        const dx = Math.max(u.rect.l - t.c.x, 0, t.c.x - u.rect.rt);
        const dy = Math.max(u.rect.t - t.c.y, 0, t.c.y - u.rect.b);
        if (Math.hypot(dx, dy) < AA / 2) { clash = u; break; }
      }
    }
    t.spacingOk = !clash;
    t.clash = clash ? \`\${clash.tag}\${clash.role ? "[" + clash.role + "]" : ""} "\${clash.label}" \${clash.box.w}x\${clash.box.h}\` : null;
  }
  for (const t of read) if (t.skipped) { t.under = false; t.spacingOk = true; t.clash = null; }

  return read.map(({ el, c, rect, ...rest }) => rest);
})(__ROOTS__, __AA__)`;

/** Same scoping `a11y.spec.ts` uses: the block's own markup, never the shell. */
function rootsFor(block: string): string[] {
  return NON_MAP_BLOCKS.includes(block)
    ? [`[data-slot=${block}]`]
    : ["[data-slot=map-toolbar]", "[data-slot=floating-panel]"];
}

async function measure(page: import("@playwright/test").Page, roots: string[] | null) {
  const script = MEASURE.replace("__ROOTS__", JSON.stringify(roots)).replace("__AA__", String(AA_FLOOR));
  return (await page.evaluate(script)) as Target[];
}

function describeTarget(t: Target) {
  const what = t.slot ?? `<${t.tag}${t.role ? ` role=${t.role}` : ""}>`;
  const name = t.label ? ` "${t.label}"` : "";
  return `${what}${name}: box ${t.box.w}x${t.box.h}, tap ${t.hit.w}x${t.hit.h}`;
}

test.describe("touch targets", () => {
  for (const vp of TOUCH_VIEWPORTS) {
    test.describe(`on a ${vp.name}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: true,
        isMobile: vp.name === "phone",
      });

      /**
       * The conformance floor. Every registry control on every block clears
       * 24x24, or earns one of 2.5.8's own exceptions.
       */
      for (const block of BLOCKS) {
        test(`${block} clears the ${AA_FLOOR}px WCAG floor`, async ({ page }) => {
          await page.goto(`/blocks/${block}`);
          await settle(page);

          const targets = await measure(page, rootsFor(block));
          const scoped = targets.filter((t) => t.scoped);
          expect(scoped.length, `no controls found in ${block} -- the scope matched nothing`)
            .toBeGreaterThan(0);

          const failing = scoped.filter((t) => t.under && !t.spacingOk && !t.skipped);
          const unexpected = failing.filter(
            (t) =>
              !KNOWN_UNDER_FLOOR.some(
                (k) => k.block === block && k.slot === t.slot && k.label.test(t.label),
              ),
          );

          expect(
            unexpected.map(describeTarget),
            unexpected.length
              ? `\n  ${block} on a ${vp.name}: ${unexpected.length} control(s) under ${AA_FLOOR}px ` +
                `with no spacing to earn the exception:\n` +
                unexpected.map((t) => `    ${describeTarget(t)}\n      blocked by ${t.clash}`).join("\n") +
                `\n`
              : "",
          ).toEqual([]);
        });
      }

      /** The comfort floor, only where it is already met. */
      for (const block of TOUCH_SIZED) {
        test(`${block} holds the ${TOUCH_FLOOR}px touch floor`, async ({ page }) => {
          await page.goto(`/blocks/${block}`);
          await settle(page);

          const targets = await measure(page, rootsFor(block));
          const scoped = targets.filter((t) => t.scoped && !t.skipped);
          expect(scoped.length, `no controls found in ${block}`).toBeGreaterThan(0);

          const small = scoped.filter((t) => Math.min(t.hit.w, t.hit.h) < TOUCH_FLOOR);
          expect(
            small.map(describeTarget),
            small.length
              ? `\n  ${block} is a touch surface: every control must stay at least ` +
                `${TOUCH_FLOOR}px.\n` +
                small.map((t) => `    ${describeTarget(t)}`).join("\n") +
                `\n`
              : "",
          ).toEqual([]);
        });
      }
    });
  }

  /**
   * The hit-slop convention, asserted so it cannot be tidied away.
   *
   * A checkbox is a 16px box. It clears the WCAG floor only because
   * `after:-inset-x-3 after:-inset-y-2` grows its hit area to roughly 38x28
   * without moving a pixel of the box -- which is exactly why the ladder and
   * the floor can both hold at once. Someone removing the pseudo-element
   * because it looks decorative would take three components under 24px and
   * break nothing that any other suite measures.
   *
   * This is the second of the two conventions, and the test exists partly to
   * settle a question the first one raised: the note beside `ToastClose` says
   * hit slop "cannot be measured and tends to read as a false pass". Probed
   * with `elementFromPoint` it measures exactly, because a hit on a pseudo
   * element resolves to the element that owns it -- so slop is a legitimate
   * tool for controls that cannot grow their box, and this is the assertion
   * that keeps it honest.
   *
   * Measured on a coarse pointer, like the rest of this file, though the slop
   * itself is unconditional. That is the trade: geometry that never changes
   * cannot be got wrong by a device that misreports its pointer, and the
   * `pointer` media query reports the PRIMARY pointer -- a tablet with a
   * trackpad, or a touchscreen laptop, can report `fine` while being touched.
   */
  test.describe("the hit-slop convention", () => {
    test.use({ viewport: { width: 834, height: 1112 }, hasTouch: true });

    const SLOPPED = [
      { example: "checkbox-default", slot: "checkbox", box: 16 },
      { example: "radio-group-default", slot: "radio-group-item", box: 16 },
      { example: "switch-default", slot: "switch", box: 32 },
    ];

    for (const { example, slot, box } of SLOPPED) {
      test(`${slot} is a ${box}px box with a tap area over ${AA_FLOOR}px`, async ({ page }) => {
        await page.goto(`/preview/${example}`);
        await settle(page);

        const targets = (await measure(page, null)).filter(
          (t) => t.slot === slot && !t.skipped,
        );
        expect(targets.length, `no ${slot} rendered by ${example}`).toBeGreaterThan(0);

        for (const t of targets) {
          // The box is untouched -- this is the half that keeps the ladder and
          // the visual baselines honest.
          expect(
            Math.round(Math.max(t.box.w, t.box.h)),
            `${slot} box grew: ${t.box.w}x${t.box.h}`,
          ).toBe(box);
          // And the slop is doing real work.
          expect(
            Math.min(t.hit.w, t.hit.h),
            `${slot} has a ${t.hit.w}x${t.hit.h} tap area; the hit slop is gone`,
          ).toBeGreaterThanOrEqual(AA_FLOOR);
          expect(
            t.hit.h,
            `${slot} tap area (${t.hit.h}px) is no bigger than its box (${t.box.h}px)`,
          ).toBeGreaterThan(t.box.h);
        }
      });
    }
  });
});
