import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { settle } from "./examples";

/**
 * The feeds workspace's flow: list → catalogue → request → back in Your feeds
 * as pending; and a rejected feed → resend, with the operator's reason shown.
 *
 * The block crawl in a11y.spec only sees the list, dark, on a phone. The
 * detail view and the request dialog are most of this workspace, so they are
 * reached here and judged by the same axe rules, in both themes.
 */

const BLOCKING = new Set(["serious", "critical"]);

async function open(page: Page, theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/blocks/feeds-workspace");
  await settle(page);
  const root = page.locator("[data-slot=feeds-workspace]");
  await expect(root.getByRole("heading", { name: "Feeds", exact: true })).toBeVisible();
  return root;
}

async function expectNoBlockingViolations(page: Page, scope = "[data-slot=feeds-workspace]") {
  const results = await new AxeBuilder({ page })
    .include(scope)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("a catalogue feed is requested in two steps and lands in Your feeds as pending", async ({ page }) => {
  const root = await open(page);
  const before = await root.locator("[data-slot=feed-row]").count();

  await root.getByRole("tab", { name: /Catalogue/ }).click();
  await root.getByRole("button", { name: "Request Hopp Lisbon" }).click();

  const dialog = page.getByRole("dialog", { name: "Request Hopp Lisbon" });
  await expect(dialog.getByText("Step 1 of 2")).toBeVisible();
  await expectNoBlockingViolations(page, "[role=dialog]");
  await dialog.getByRole("button", { name: "Continue" }).click();

  // Sending is accepting terms on the organization's behalf: not until ticked.
  const send = dialog.getByRole("button", { name: "Send request" });
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /I accept these terms/ }).click();
  await send.click();

  await expect(dialog).toBeHidden();
  await expect(root.getByText("Request sent to Hopp")).toBeVisible();
  await expect(root.getByRole("tab", { name: /Your feeds/ })).toHaveAttribute("aria-selected", "true");
  await expect(root.locator("[data-slot=feed-row]")).toHaveCount(before + 1);
  await expect(
    root.locator("[data-slot=feed-row]", { hasText: "Hopp Lisbon" }),
  ).toContainText("Awaiting operator");
});

test("a request with no endpoints cannot continue", async ({ page }) => {
  const root = await open(page);
  await root.getByRole("tab", { name: /Catalogue/ }).click();
  await root.getByRole("button", { name: "Request Emov Lisbon" }).click();
  const dialog = page.getByRole("dialog", { name: "Request Emov Lisbon" });
  for (const e of ["Trips", "Events", "Vehicles", "Vehicle status"]) {
    await dialog.getByRole("checkbox", { name: e, exact: true }).click();
  }
  await expect(dialog.getByText("Choose at least one endpoint.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("a rejected feed shows the operator's reason, in the detail and in the resend", async ({ page }) => {
  const root = await open(page);
  await root.locator("[data-slot=feed-row]", { hasText: "Cooltra Lisbon" }).click();
  await expect(root.getByText("Cooltra declined this request")).toBeVisible();
  await expectNoBlockingViolations(page);

  await root.getByRole("button", { name: "Resend request" }).click();
  const dialog = page.getByRole("dialog", { name: "Resend request to Cooltra" });
  await expect(dialog.getByText("Why Cooltra declined last time")).toBeVisible();
});

for (const theme of ["dark", "light"] as const) {
  test(`the list and a connected feed's incidents pass axe in ${theme}`, async ({ page }) => {
    const root = await open(page, theme);
    await expectNoBlockingViolations(page);

    await root.locator("[data-slot=feed-row]", { hasText: "Voi Lisbon" }).click();
    await expect(root.getByText("1 open incident")).toBeVisible();
    await expectNoBlockingViolations(page);

    await root.getByRole("tab", { name: /Incidents/ }).click();
    await expect(root.getByText("Low trip distance")).toBeVisible();
    await expectNoBlockingViolations(page);
  });
}
