# Vianova DS

<img width="2000" height="1000" alt="image" src="https://github.com/user-attachments/assets/a4a866b9-9ce6-49e6-b1a3-9d4f8201924d" />


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

## Touch targets

VIP is used on tablets and phones in the field. The registry was built as
though it were desktop-only, and nothing in here recorded the difference until
a UI review asked for 44px targets and answering it meant finding out whether
VIP is ever touched. It is.

**No control in the registry is too small to conform.** Of 466 controls
measured on a phone, 83 come in under 24x24 — and all but one earn WCAG 2.2
AA's own spacing exception, which lets an undersized target pass when a
24px circle centred on it meets no other target. So 2.5.8 is not the problem.
The problem is that **94–95% of controls sit under 44px**, which is the AAA and
Apple HIG bar and the one that decides whether a thumb lands on the right
thing at a junction.

### The one conformance failure, and it is not a sizing bug

`patterns/bottom-tray.tsx` gives its drag handle a full-width 24px grab strip
(`absolute inset-x-0 top-0 z-10 h-6`) while painting only a 4px pill in the
middle of it. On a map block the tray's first child is the panel header, so
that strip is layered over the top 3.5px of the **Data / Zones tabs** in
`map-workspace`: a 44.8x25 box with a 45x22 tap area. A tab that small needs
the spacing exception and cannot have it while a 768x24 slider sits on top.

The box is the right size. The pixels are being taken by a sibling, which is
why reading class strings would never have found it. The fix is to reserve the
handle's height in the tray's layout — that moves every map panel header down
24px and rewrites four blocks' visual baselines, so it is deliberately left for
its own PR and recorded in `KNOWN_UNDER_FLOOR` in
`e2e/touch-target-floor.spec.ts`. That list exists to be emptied; anything not
in it fails.

### What the 44px gap actually looks like

Measured by hit area, not by class string: the box after borders, line-height,
any parent `min-h`, any `after:-inset-*` hit slop, and anything layered on top.
Probed by walking outward from each control's centre with `elementFromPoint`
until the hit stops resolving back to the control.

| Viewport | Controls | Under 44px | Under 24px |
| --- | --- | --- | --- |
| Phone, 390x844 | 466 | 442 (95%) | 83 |
| Tablet portrait, 834x1112 | 529 | 500 (95%) | 92 |
| Tablet landscape, 1366x1024 | 569 | 534 (94%) | 93 |

Tablet landscape matters more than it looks: at 1366px the `lg:` desktop
arrangements are the ones on screen, so the densest layouts in the system are
exactly the ones being touched.

Under-44 controls per workspace, and the median tap size on a phone:

| Workspace | Phone | Tablet port. | Tablet land. | Median tap (phone) |
| --- | --- | --- | --- | --- |
| `citizen-workspace` | 0/4 | 0/4 | 0/4 | 44px |
| `dashboard-workspace` | 7/7 | 8/8 | 18/18 | 20px |
| `datahub-workspace` | 8/9 | 8/12 | 8/12 | 36px |
| `feeds-workspace` | 5/5 | 6/9 | 5/11 | 32px |
| `map-workspace` | 10/14 | 15/18 | 30/31 | 28px |
| `regulations-workspace` | 14/14 | 15/15 | 15/15 | 32px |
| `reports-workspace` | 14/14 | 38/38 | 51/51 | 30px |

`citizen-workspace` is the phone surface and the only block that clears 44px
everywhere; it hard-codes `min-h-11` / `size-11` because it is never anything
but touched. Every other workspace is a VIP surface, and the two with no
control above the floor at any width — `regulations-workspace` and
`reports-workspace` — are list-and-detail screens whose row actions and links
are 20px text buttons.

The recurring shapes, by `data-slot`, across all three viewports:

| Shape | Instances | Tap range | Median |
| --- | --- | --- | --- |
| `button` | 478 | 20–40px | 32px |
| `input` | 143 | 28–40px | 32px |
| `select-trigger` | 67 | 32–40px | 36px |
| `tooltip-trigger` | 51 | 32px | 32px |
| `toggle-group-item` | 48 | 32–36px | 36px |
| `checkbox` | 44 | 22–30px | 30px |
| `tabs-trigger` | 39 | 22–26px | 26px |
| `report-link` / `regulation-link` | 30 | 20px | 20px |
| `dropdown-menu-trigger` | 21 | 24–36px | 24px |

### The hit slop is already load-bearing

Eight registry files already carry `after:-inset-*` on a `relative` control
(19 call sites: `checkbox`, `radio-group`, `switch`, `slider`, `toast`,
`sidebar`, and the dashboard and map workspaces), which grows the hit area
without moving the box. It is not
cosmetic — it is what makes three form primitives conform:

| Control | Box | Tap area |
| --- | --- | --- |
| `checkbox` | 16x16 | 38x28 |
| `radio-group-item` | 16x16 | 38x24 |
| `switch` | 32x18 | 54x31 |

Without it a checkbox is a 16px target and fails 2.5.8 outright. The claim that
slop "cannot be measured" is not true: `elementFromPoint` resolves a hit on a
`::after` back to the element that owns it, so it measures exactly, and
`e2e/touch-target-floor.spec.ts` asserts all three boxes have not grown *and*
that the slop is still there.

**What these numbers measure, exactly.** The area reachable by aiming *at the
control* — the element or a descendant — and not a wrapping `<label>`, even
though clicking one really does activate the control. Verified rather than
assumed: in `checkbox-default`, `Label` wraps the checkbox and its text into a
187x16 box, and a click 164px to the right of the 16px checkbox toggles it. So
a checkbox's *functional* target is the whole label, and the 38x28 above is the
conservative figure for the control alone.

Both readings matter and neither is wrong: 187x16 is why checkboxes in a form
are not a practical problem to tap, and 38x28 is why one on its own, outside a
label, would be. The numbers in this section are the second kind throughout,
because the first would report a 16px control as a 187px target and hide
exactly what the audit is for. Anything measuring these controls should say
which it is counting — the two disagree about whether a checkbox clears 44px.

**Which measure counts, then.** For 2.5.8 the hit area, without argument: the
criterion is about the region that accepts the pointer action, and slop is part
of it. For the 44px comfort floor the hit area is what decides whether a tap
registers, but it is not the whole story — a 32px box with 48px of invisible
slop is still a 32px thing to *aim* at, and slop can be taken: the
`map-workspace` tabs above are a measured case of a neighbour sitting on top
and eating it. So slop is a real mechanism and not a free pass. It has to be
measured as effective area, which is what this suite does, rather than inferred
from the class string.

`ToastClose` in `ui/toast.tsx` is the test case for that rule: a `Button
size="icon-sm"` (32px) carrying `after:-inset-2`, so 48px of hit area. By the
rule above it conforms and clears the comfort floor, and it should be left
alone — its box is on the ladder, and the slop is doing precisely the job slop
is for.

That is a reading of its class strings, not a measurement, because **no example
renders it**. `examples/toast-default.tsx` wraps `AddToastButton` in its own
`ToastProvider` while `<Toaster />` builds a second, nested provider around the
module-level manager, so the click adds to one manager and `ToastList` renders
from the other. The toast never appears — the committed visual baseline is an
empty frame with one button — which is why `ToastClose` is absent from this
census, from `touch-target.spec.ts`, from the axe crawl and from the baseline
alike. Fixing the example is the prerequisite for asserting anything about it.

### The convention

Two mechanisms, and the choice between them is about whether the box can move.

**1. `pointer-coarse:` on the control** — established by the status-toast and
maintenance-screen fixes, and the default for anything that can afford to grow:

```
pointer-coarse:size-11      icon-only controls
pointer-coarse:h-11         controls with a label
```

Tailwind v4 ships the variant; nothing to register. It goes on the element's
own `className` and **never into a cva size variant**, so the ladder keeps its
fine-pointer geometry and `control-size.spec.ts` needs no changes.

**2. `after:-inset-*` hit slop** — for controls that cannot grow: anything on a
fixed-height toolbar row the ladder pins, the 16px form primitives whose box is
the design, and map chrome where a bigger box would cover the map. Unconditional
rather than pointer-gated, which is also its advantage: the `pointer` media
query reports the *primary* pointer, so a tablet with a trackpad or a
touchscreen laptop can report `fine` while being touched, and geometry that
never changes cannot get that wrong.

**What this costs, stated plainly.** Because `pointer-coarse:` must stay out of
the cva variants, it is per-call-site work: **42 distinct `data-slot` kinds**
sit under 44px, across hundreds of instances. There is no central edit that
fixes 95% of the registry.

The one change that would is putting `pointer-coarse:` *into* the ladder in
`ui/button.tsx` and its four siblings — effectively a density mode. It was not
recommended, for three reasons worth recording rather than rediscovering: the
ladder's promise is that a toolbar row lines up, so all six control types would
have to move together or alignment breaks under touch; every tablet and phone
visual baseline churns at once; and it would grow controls on hybrid devices
that report `fine`, or fail to grow them on devices that report `fine` while
being touched. A density mode may still be the right answer for the VIP
workspaces specifically — it is the only option that scales — but it is a
product decision about how dense those screens should be on a tablet, not a
cleanup.

So: fix per surface, worst-first, starting with `regulations-workspace` and
`reports-workspace`, whose 20px row links are both the smallest real targets
and the ones a field user taps most.

### The gate

`e2e/touch-target-floor.spec.ts` runs every workspace at phone and tablet under
`hasTouch: true`, which is what flips `(pointer: coarse)` — verified, not
assumed. It asserts the 24px conformance floor everywhere it looks, and the
44px floor only on surfaces that already meet it, so the ratchet turns one way
and nothing regresses silently. The whole file runs in about eight seconds.

```bash
pnpm --filter @vianova/www test:touch    # the floor, on a coarse pointer
```

| Guard | Sees | Misses |
| --- | --- | --- |
| `e2e/control-size.spec.ts` | the ladder's heights on a fine pointer | anything about a thumb |
| `e2e/touch-target.spec.ts` | the two fixed controls, both pointer types | the rest of the registry |
| `e2e/touch-target-floor.spec.ts` | every workspace control's real tap area | controls behind an interaction, and overlays |

That last gap is real: a control only reachable by opening a menu or a dialog
is never measured, because the suite measures what the page renders. Opening
every overlay is the obvious next increment.

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
- `examples/toast-default.tsx` wires two `ToastProvider`s with different
  managers, so no toast ever renders and `ToastClose` is untestable. See
  **Touch targets**.
- The 44px floor on the VIP workspaces, worst-first — `regulations-workspace`
  and `reports-workspace` have no control above it at any width.
- `patterns/bottom-tray.tsx`'s grab strip covering the panel tabs, the one
  WCAG 2.2 AA failure, recorded in `KNOWN_UNDER_FLOOR`.
- Measuring controls that only exist after an interaction — a menu, a dialog,
  a toast. The census measures what the page renders.
