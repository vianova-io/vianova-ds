import type { Page } from "@playwright/test";

import { Blocks, Index } from "../__registry__";

export type ExampleCase = { component: string; example: string };

/**
 * Every example, read from the generated registry index — the same source the
 * docs render from. A hand-maintained list here would quietly stop covering
 * new components, which is exactly when coverage matters.
 */
export const EXAMPLES: ExampleCase[] = Object.values(Index).flatMap((c) =>
  c.examples.map((e) => ({ component: c.name, example: e.name })),
);

/**
 * Examples whose pixels are not reproducible: they draw a live WebGL map from
 * network tiles. They are still crawled for accessibility; only their
 * screenshots are skipped.
 */
export const NON_DETERMINISTIC = new Set(["map-canvas-default"]);

/**
 * Waits for an example to be ready to inspect.
 *
 * Bounded on purpose: `networkidle` alone never resolves for the map example,
 * which streams vector tiles for as long as it is on screen, so the test times
 * out rather than failing on anything real.
 */
export async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("main").first().waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

/**
 * Blocks, which have no example files and therefore no `/preview/` route.
 *
 * They are the whole point of a component library -- primitives composed into
 * something real -- and were invisible to every suite here until a clipped
 * focus ring turned up in one by hand. Their own route is crawled instead.
 */
export const BLOCKS: string[] = Object.values(Blocks).map((b) => b.name);

/**
 * Blocks that are not built around a map. The map suites assume two floating
 * panels, a toolbar and an attribution badge, so they must not be pointed at
 * these -- each gets its own checks instead.
 */
export const NON_MAP_BLOCKS: string[] = ["datahub-workspace"];
export const MAP_BLOCKS: string[] = BLOCKS.filter((b) => !NON_MAP_BLOCKS.includes(b));
