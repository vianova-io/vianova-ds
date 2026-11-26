import { test, expect } from "@playwright/test";

import { settle } from "./examples";

/**
 * What a screen-reader user and a keyboard user get from the toast layer.
 *
 * Three defects Frederic found reviewing the maintenance surfaces inside VIP,
 * all of them in the shared wrapper rather than in one pattern, and none of
 * them visible in a screenshot -- which is why they are asserted here instead
 * of being left to the visual suite.
 *
 * Base UI renders every toast as `role="dialog"` and names it from whatever
 * `Toast.Title` rendered, so a card that renders its own layout instead of the
 * stock title/description pair is announced as "dialog" and nothing else. It
 * also names every viewport "Notifications", so an app running two providers --
 * `Toaster` beside `StatusToaster`, which is what VIP does -- ships two
 * identically named regions. And it moves focus for its own focus guards only,
 * so dismissing a card from the button inside it drops focus on `<body>`.
 */

const QUEUE = "/preview/status-toast-queue";

async function queue(page: import("@playwright/test").Page, which: string) {
  await page.getByRole("button", { name: which }).click();
}

test.describe("the status toast's semantics", () => {
  test("each card names the dialog it is wrapped in", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);
    await queue(page, "Announce maintenance");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCount(1);

    // The name has to resolve to the card's own headline, and come from the
    // headline element itself rather than a screen-reader-only copy of it --
    // otherwise the title is in the accessibility tree twice, once as the
    // dialog's name and once as its content.
    await expect(dialog).toHaveAccessibleName("Planned maintenance on Munich shared mobility");

    const copies = await page.evaluate(() => {
      const toast = document.querySelector("[data-slot=toast]")!;
      const id = toast.getAttribute("aria-labelledby");
      const named = id ? document.getElementById(id) : null;
      return {
        namedBy: named?.getAttribute("data-slot") ?? named?.tagName.toLowerCase() ?? null,
        titleOccurrences: [...toast.querySelectorAll("p, h1, h2, h3, span")].filter(
          (el) => el.textContent?.trim() === "Planned maintenance on Munich shared mobility",
        ).length,
      };
    });
    expect(copies.namedBy, "the dialog should be named by an element in the card").toBe("p");
    expect(
      copies.titleOccurrences,
      "the title is in the card more than once -- a reader hears it twice",
    ).toBe(1);
  });

  /**
   * One live region over the queue, not two nested ones.
   *
   * Base UI's viewport is itself `aria-live="polite" aria-relevant="additions
   * text"`. The card declared `role="status" aria-live="polite"` as well, which
   * nested one polite region inside another over the same sentence. The
   * viewport wins -- it is the layer that knows a card arrived, it is what
   * makes every other toast in the system announce at all, and it is Base UI's,
   * so the alternative is forking it.
   */
  test("the card does not declare a live region inside the viewport's", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);
    await queue(page, "Announce maintenance");

    const regions = await page.evaluate(() =>
      [...document.querySelectorAll("[aria-live], [role=status], [role=alert]")].map(
        (el) => el.getAttribute("data-slot") ?? el.tagName.toLowerCase(),
      ),
    );
    expect(regions, "exactly one live region should cover the queue").toEqual(["toast-viewport"]);
  });

  test("the status viewport is not called Notifications", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);
    await queue(page, "Announce maintenance");

    // Counted, not asserted visible: the viewport's own box is zero-height --
    // the cards inside it are absolutely positioned -- so Playwright calls the
    // region hidden while every card in it is on screen.
    await expect(page.getByRole("region", { name: "Platform status" })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Notifications" })).toHaveCount(0);
  });
});

test.describe("focus when a toast is dismissed from inside it", () => {
  test("goes to the card still on screen", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);
    await queue(page, "Announce maintenance");
    await queue(page, "Announce incident");
    await expect(page.getByRole("dialog")).toHaveCount(2);

    const dismissals = page.getByRole("button", { name: "Dismiss status update" });
    // Focused and activated from the keyboard: a mouse click would move focus
    // on its own and prove nothing about what the wrapper does.
    await dismissals.first().focus();
    await page.keyboard.press("Enter");

    const surviving = page.getByRole("dialog");
    await expect(surviving).toHaveCount(1);

    // Polled rather than read once: the card animates out over 500ms and the
    // focus move happens when it starts, not when it unmounts.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const active = document.activeElement;
            if (!active || active === document.body) return "BODY";
            const viewport = document.querySelector("[data-slot=toast-viewport]");
            if (!viewport?.contains(active)) return "OUTSIDE THE REGION";
            return active.getAttribute("data-slot") ?? active.tagName.toLowerCase();
          }),
        { message: "focus should land on the toast still in the region", timeout: 3_000 },
      )
      .toBe("toast");
  });

  test("goes back where it came from when the last card closes", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);

    const trigger = page.getByRole("button", { name: "Announce maintenance" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toHaveCount(1);

    // Focus enters the region from the trigger, which is what the viewport has
    // to remember. Base UI keeps this as `prevFocusElement` on its store but
    // only ever writes it from its own F6 handler, and the store is internal --
    // so a reader who simply tabbed in has nothing stored, and the wrapper
    // tracks the crossing itself.
    await trigger.focus();
    const dismiss = page.getByRole("button", { name: "Dismiss status update" });
    await dismiss.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(
        () =>
          page.evaluate(() => (document.activeElement?.textContent ?? "").trim() || "BODY"),
        {
          message: "focus should return to the control the reader came from",
          timeout: 3_000,
        },
      )
      .toBe("Announce maintenance");
  });

  /**
   * The hotkey, which is also how a reader gets into the region in the first
   * place. Base UI hard-codes F6 per provider, so two providers both answer it
   * and whichever registered last wins; `ToastViewport` takes the key in the
   * capture phase ahead of Base UI's own listener and routes it to one
   * viewport.
   */
  test("the hotkey moves focus into the region", async ({ page }) => {
    await page.goto(QUEUE);
    await settle(page);

    const trigger = page.getByRole("button", { name: "Announce maintenance" });
    await trigger.click();
    await trigger.focus();
    await page.keyboard.press("F6");

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-slot")), {
        message: "F6 should focus the status viewport",
        timeout: 2_000,
      })
      .toBe("toast-viewport");
  });
});
