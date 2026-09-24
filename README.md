# Vianova DS

A shadcn-based design system for Vianova's spatial intelligence platform: brand
foundations as tokens, an installable component registry, and a live gallery.

```bash
pnpm install
pnpm --filter @vianova/tokens build   # tokens must build first
pnpm --filter @vianova/www dev        # http://localhost:3000
```

## Layout

| Path | What it is |
|---|---|
| `packages/tokens` | **Source of truth.** DTCG token JSON → 5 build artefacts |
| `apps/www` | Docs/gallery site **and** the registry source |
| `apps/www/registry/vianova/ui` | Components distributed via `shadcn add` |
| `apps/www/registry/vianova/examples` | One file per preview card |
| `scripts/registry-smoke-test.sh` | The distribution gate — run before every release |

The registry lives *inside* the docs app rather than in its own package. A shadcn
registry does not distribute a compiled package; it distributes source text that
gets copied into the consumer's repo. `shadcn build` resolves `files[].path`
relative to cwd, and the docs site needs each file twice — imported for the live
preview, and read as raw text for the code tab. Both are trivial in-app.

## Consuming the registry

```jsonc
// components.json
{ "registries": { "@vianova": "https://vianova-io.github.io/vianova-ds/r/{name}.json" } }
```

```bash
npx shadcn@latest add @vianova/vianova-theme   # tokens first
npx shadcn@latest add @vianova/button
```

## Tokens

**Source of truth: the upstream Figma library**, captured read-only into
`packages/tokens/figma-ground-truth.json` and converted to DTCG by
`scripts/import-figma.ts`. From there, code is authoritative.

> The product primary is **teal `#0f766e`** (Tailwind teal-700).
> `#5E59E8` is *not* the brand — it is `map/layer-color` in the Brand map
> scheme only. A regression test pins this.

Three tiers, built by `packages/tokens/scripts/build.ts`:

- **Primitive** — the Tailwind palette (244 colours), imported verbatim from the
  Figma `Tailwind` collection.
- **Semantic** — Figma groups these by role (`surface/background`), but shadcn's
  CSS contract is flat (`--background`) and is not negotiable. Each token carries
  both: the Figma path for library parity, the flat name for the stylesheet.
  37 tokens come from Figma; 26 are **code-only** (`chart-*`, `sidebar-*`, the OD
  roles, `success`/`info`), stamped `figma: null` so drift detection can tell
  them apart. The build fails if any mode falls out of parity with light.
- **Component** — button/badge/input/card/alert sizing, from Figma.

**Six themes**, mirroring the Figma Semantic collection's modes: Light, Dark,
Dark Stone, Dark Slate, and the **Dark Fuchsia** (fuchsia) and **Dark Gray**
(teal-300 on gray-800) re-accented variants. Light/dark is the `.dark` class;
the other variants are `.dark[data-theme="…"]`.

Outputs: `theme.css`, `tokens.js`/`.d.ts`, `figma.variables.json`,
`registry-theme.json`, `tokens.json`.

Two things that are easy to get wrong and are load-bearing here:

- `@theme **inline**` — without `inline`, Tailwind snapshots the `:root` value at
  build time and `.dark` silently stops working.
- **The TypeScript output is required, not a convenience.** deck.gl's
  `getFillColor` takes `[r,g,b,a]` byte tuples and cannot resolve
  `var(--map-ramp-40)`, so `mapRamps` is emitted as tuples.

Light/dark and map colour scheme are **orthogonal axes** — a user in dark mode
can select Viridis — so schemes are `[data-map-scheme]` blocks, never merged
into `.dark`.

## Testing

```bash
pnpm --filter @vianova/tokens test    # ramps + WCAG + deuteranopia
./scripts/registry-smoke-test.sh      # the distribution gate
```

The token tests assert that every Figma-sourced token matches the Figma library in all
six modes, WCAG AA on every rendered fg/bg pair, and that the five chart colours
stay distinguishable under simulated deuteranopia *and* protanopia. The chart
palettes were chosen by exhaustively searching the Tailwind palette against all
three constraints — the intuitive teal/violet/amber/rose/sky set collapses under
deuteranopia.

Every AA failure is fixed. The 16 defects inherited from the Figma library (e.g.
`input on background` at 1.22:1) used to sit in a tracked exception list; they are
now re-picked in an accessibility override layer in the Figma import, stamped
`a11yFix: true` so the divergence from the design file stays auditable rather than
looking like a bad transcription. The exception list is empty and a new inherited
defect still fails the build.

`a11yFix` is a fourth provenance, ranked above the recorded `figma`/`preset`
origin. Provenance answers who chose the value that is *in the build*, and for a
re-picked token that is us — reporting `preset` for a `ring` we chose ourselves
would blame upstream for a defect we would have introduced.

## Figma

**`Vianova DS – Library`**

Generated from the tokens in this repo. 374 variables across five collections
mirroring the Figma library's structure:

| Collection | Modes | Variables |
|---|---|---|
| Primitives | 1 | 244 |
| Semantic | 6 | 63 |
| Map data | 4 | 12 |
| Foundations | 1 | 33 |
| Component | 1 | 22 |

Semantic variables are **aliased** to Primitives (not flat hex) and carry
`var(--token)` Dev Mode code syntax.

**The Figma library is read-only here.** It was never written to; re-capture
`figma-ground-truth.json` from it if the design changes.

**Publishing the library requires a human clicking Publish** — there is no API
for it. Nothing reaches consuming files until you do.

## Deploying

Hosted on **GitHub Pages** at <https://vianova-io.github.io/vianova-ds/>, built
and published by `.github/workflows/pages.yml` on every push to `main`.

The site is a **static export** (`output: "export"`): no Node server runs at
request time, which is what lets Pages host it and what lets the registry under
`public/r/` be fetched as plain files.

### One manual step, once

Settings → Pages → Source = **GitHub Actions**. This needs repository *admin*.

The workflow asks for it too (`configure-pages` with `enablement: true`), but
that cannot substitute: `GITHUB_TOKEN` gets *"Resource not accessible by
integration"* from the create-site API however its permissions are set, because
creating a Pages site requires admin and an Actions token is never granted it.

Until someone sets it, the build job succeeds and uploads a perfectly good
artifact, and the deploy job fails — which is the intended shape. Once set, no
further manual steps: every push to `main` deploys.

### The sub-path, and the one thing it breaks

Pages serves a project repo from `/vianova-ds/`, not the domain root, so the
deploy sets `NEXT_PUBLIC_BASE_PATH=/vianova-ds` and `next.config.ts` turns that
into `basePath`.

`basePath` prefixes `next/link`, `next/image` and CSS-imported assets — and
**nothing else**. A raw string in a `src` or `href` is left exactly as written
and will 404 on the deployed site. Two of those failures are silent: a maplibre
worker that does not load renders an empty map and reports no error, and an
`<a download>` pointing at a 404 saves an empty file.

So paths to `public/` are written as:

- **docs pages** — `asset("/brand/…")` from `@/lib/asset`
- **registry components** — the prefix inlined at the call site, because these
  files are installed into other people's repos and must not drag a helper along

Two guards enforce it, and they cover different halves:

| Guard | Sees | Misses |
| --- | --- | --- |
| `scripts/check-export-paths.mjs` | literal `src`/`href` in the built HTML | URLs built in JavaScript |
| `e2e/pages-shape.spec.ts` | every real network request under the prefix | routes it does not visit |

Removing the prefix from the maplibre worker passes the first and fails the
second — which is exactly why both exist.

### Local equivalents

```bash
pnpm --filter @vianova/www build                        # exports to apps/www/out
NEXT_PUBLIC_BASE_PATH=/vianova-ds pnpm --filter @vianova/www build
pnpm --filter @vianova/www check:export                 # static path scan
pnpm --filter @vianova/www test:pages                   # the deployed shape, in a browser
```

`next start` is gone — it cannot serve an export. `scripts/serve-static.mjs`
serves `out/` instead, and is what the Playwright suites run against.

## Not done yet

- Data grid, and the remaining Tier 3 map/OD components.
- `data-panel` and `preset-panel` — both need reads from the Figma library.
- Figma *components* — only variables were pushed; no component library yet.
- Code Connect (needs an Organization/Enterprise plan; this team is `pro`).
- Publishing the Figma library, which requires a human clicking Publish.
