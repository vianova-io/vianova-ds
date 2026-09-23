import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 3100);
const BASE_URL = process.env.PW_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Examples are independent; the suite is dominated by page loads.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    // Screenshots must not depend on the machine's colour scheme.
    colorScheme: "dark",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  expect: {
    toHaveScreenshot: {
      // Anti-aliasing differs subtly even on one machine; a hard zero would
      // make the suite flap without catching anything real.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 900, height: 700 },
        deviceScaleFactor: 1,
      },
    },
  ],
  // Reuses a server if one is already up, so local runs are fast.
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `NEXT_DIST_DIR=.next-build pnpm exec next start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
