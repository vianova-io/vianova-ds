import { defineConfig, devices } from "@playwright/test";

/**
 * The Pages-shaped run: the export served under its basePath, exactly as
 * GitHub Pages will serve it.
 *
 * A separate config rather than a project in playwright.config.ts because the
 * two need incompatible servers -- that one serves the export from the domain
 * root so the existing suites keep working unchanged, this one serves it only
 * under /vianova-ds and 404s everything else.
 *
 * NO `baseURL` on purpose. Playwright resolves `page.goto("/x")` with
 * `new URL()`, which DISCARDS the path of a baseURL -- so a baseURL of
 * ".../vianova-ds" would silently produce ".../x" and the whole guard would
 * test the wrong thing while passing. The spec builds absolute URLs instead.
 */
const PORT = Number(process.env.PAGES_PORT ?? 3101);
const PREFIX = process.env.NEXT_PUBLIC_BASE_PATH ?? "/vianova-ds";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/pages-shape.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    colorScheme: "dark",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: process.env.PAGES_BASE_URL
    ? undefined
    : {
        command: `node scripts/serve-static.mjs --dir out --port ${PORT} --prefix ${PREFIX}`,
        url: `http://127.0.0.1:${PORT}${PREFIX}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
