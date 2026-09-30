import { test, expect, type Page } from "@playwright/test";

/**
 * The site as GitHub Pages will actually serve it: under /vianova-ds, from
 * static files, with nothing outside that prefix reachable.
 *
 * Everything else in this suite runs against a ROOT-served export, which is
 * the right call -- it keeps five suites working with zero spec edits -- but
 * it means nothing else exercises the shape we actually deploy. `basePath`
 * prefixes `next/link`, `next/image` and CSS-imported assets, and leaves every
 * raw `src`/`href` string exactly as written, so the deployed-only failure
 * mode is an asset 404 that no root-served test can see.
 *
 * Two of those 404s are SILENT, which is why this is a test and not a
 * checklist:
 *
 *   - a maplibre worker that fails to load renders NOTHING and reports no
 *     error (see scripts/copy-maplibre-worker.mjs)
 *   - an `<a download>` pointing at a 404 saves an empty file
 *
 * scripts/check-export-paths.mjs covers the other half -- literal src/href
 * attributes in the built HTML -- which a browser-based test would be a slow
 * way to check. Neither guard subsumes the other: that one cannot see a URL
 * built in JavaScript (the worker), this one cannot see a route it does not
 * visit.
 */

/** No baseURL is configured; see the note in playwright.pages.config.ts. */
const BASE = process.env.PAGES_BASE_URL ?? "http://127.0.0.1:3101/vianova-ds";
const PREFIX = new URL(BASE).pathname.replace(/\/+$/, "");

/**
 * Routes chosen for what they can break, not for coverage: the shell logo, the
 * download links, both maplibre call sites, the avatar, and a page whose
 * content is read off disk at build time.
 */
const ROUTES = [
  "/",
  "/foundations/",
  "/blocks/explore-map/",
  "/blocks/map-workspace/",
  "/preview/map-canvas-default/",
  "/preview/avatar-default/",
  "/components/button/",
  "/changelog/",
];

type Failure = { url: string; detail: string };

/** Everything the page asked for and did not get. */
async function load(page: Page, route: string) {
  const failures: Failure[] = [];
  const sameOrigin: string[] = [];

  page.on("response", (r) => {
    if (r.status() >= 400)
      failures.push({ url: r.url(), detail: `HTTP ${r.status()}` });
  });
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "request failed";
    // ERR_ABORTED is the browser cancelling, not the server refusing. Next
    // fires an RSC prefetch for every `next/link` in view and drops the ones
    // it no longer needs, so these appear on any page with navigation and say
    // nothing about whether the file exists -- all three of the URLs that
    // first tripped this were correctly prefixed and served 200 on request.
    // A genuinely missing file still shows up, as a 404 on the response
    // listener above.
    if (why.includes("ERR_ABORTED")) return;
    failures.push({ url: r.url(), detail: why });
  });
  page.on("request", (r) => {
    if (r.url().startsWith(BASE.replace(PREFIX, ""))) sameOrigin.push(r.url());
  });

  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  return { failures, sameOrigin };
}

const report = (f: Failure[]) =>
  "\n" + f.map((x) => `  ${x.detail}  ${x.url}`).join("\n") + "\n";

/**
 * Wait for one specific asset request, rather than for the network to go quiet.
 *
 * `networkidle` is the wrong synchronisation point for anything the page
 * fetches from JavaScript after hydration. It fires after 500ms without
 * traffic, and on a slow machine that quiet window opens BEFORE hydration gets
 * round to the fetch. Measured against this very page: unthrottled, the fetch
 * landed at 293ms and idle at 1327ms, so it passed; on a 4x-throttled CPU idle
 * came at 695ms and the fetch at 998ms, so it failed.
 *
 * Note the direction, because it is the opposite of the obvious guess:
 * throttling makes idle fire EARLIER, not later -- slow JS pushes the NEXT
 * request further away, so the 500ms gap arrives sooner. A slower machine
 * therefore fails this more reliably, which is exactly why the data assertion
 * failed on every CI run and passed on every local one.
 *
 * The sweep in `load` above still uses idle, and that is fine: it checks URLs
 * that are present in the markup at load. The two assets whose URLs are built
 * in JavaScript are the ones that need waiting for, and they have this.
 */
async function awaitAsset(
  page: Page,
  route: string,
  match: string,
  absent: string,
) {
  // Armed BEFORE navigating: the response can arrive before the goto settles.
  const arrived = page.waitForResponse((r) => r.url().includes(match), {
    timeout: 30_000,
  });
  await page.goto(`${BASE}${route}`);
  // Swallowing the timeout to keep the message about the asset rather than
  // about Playwright's event loop.
  const res = await arrived.catch(() => null);
  expect(res, absent).not.toBeNull();
  return res!;
}

test.describe("pages shape", () => {
  for (const route of ROUTES) {
    test(`${route} loads every asset under the basePath`, async ({ page }) => {
      const { failures, sameOrigin } = await load(page, route);

      expect(failures, report(failures)).toEqual([]);

      // Not merely "nothing 404'd" -- the server could later stop being strict
      // and an unprefixed path would start resolving. Assert the prefix
      // directly so this guard cannot quietly rot into a pass.
      const unprefixed = sameOrigin
        .map((u) => new URL(u).pathname)
        .filter((p) => !p.startsWith(`${PREFIX}/`) && p !== PREFIX);
      expect(
        unprefixed,
        `requests that escaped ${PREFIX}:\n${unprefixed.join("\n")}`,
      ).toEqual([]);
    });
  }

  /**
   * The worker gets its own assertion because its URL is built in JavaScript,
   * so the static scan cannot see it, and because its failure is invisible.
   *
   * Deliberately NOT asserting that the map painted tiles: map-canvas falls
   * back when WebGL is absent, which is the usual CI case, so a pixel check
   * would pass for the wrong reason. The honest signal is that the worker was
   * fetched, returned 200, and came back as JavaScript -- a wrong MIME here is
   * enough on its own to stop the browser executing a module worker.
   */
  test("the maplibre worker is fetched, 200, and typed as JavaScript", async ({
    page,
  }) => {
    const res = await awaitAsset(
      page,
      "/preview/map-canvas-default/",
      "maplibre-gl-worker",
      "the page never requested the maplibre worker at all",
    );

    expect(
      new URL(res.url()).pathname,
      "worker path is missing the basePath",
    ).toContain(PREFIX);
    expect(res.status(), "worker did not return 200").toBe(200);
    const type = res.headers()["content-type"] ?? "";
    expect(
      type,
      `worker served as "${type}", which a browser will refuse`,
    ).toMatch(/javascript|ecmascript/i);
  });

  /**
   * The flow layer's GeoJSON is a raw path built in JavaScript, so `basePath`
   * does not rewrite it and the static path scan cannot see it -- the same
   * blind spot as the maplibre worker. And it fails the same way: the map
   * simply draws no lines, with the panels still rendering happily around it.
   */
  test("the vehicle flows data is fetched, 200, and typed as JSON", async ({
    page,
  }) => {
    const res = await awaitAsset(
      page,
      "/blocks/map-workspace/",
      "vehicle-flows",
      "the block never requested its data file at all",
    );

    expect(
      new URL(res.url()).pathname,
      "data path is missing the basePath",
    ).toContain(PREFIX);
    expect(res.status(), "vehicle-flows.json did not return 200").toBe(200);
    const type = res.headers()["content-type"] ?? "";
    expect(type, `served as "${type}"`).toMatch(/json/i);
  });

  /**
   * The registry is the repo's actual product: `npx shadcn add <url>` fetches
   * these. `trailingSlash: true` governs prerendered HTML naming only and
   * leaves public/ copied verbatim -- asserted here rather than believed.
   */
  test("registry items are fetchable as JSON", async ({ request }) => {
    for (const item of ["button", "stat-tile", "map-canvas"]) {
      const res = await request.get(`${BASE}/r/${item}.json`);
      expect(res.status(), `/r/${item}.json`).toBe(200);
      expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/);
      const body = await res.json();
      expect(body.name, `/r/${item}.json has no name`).toBeTruthy();
    }
  });
});
