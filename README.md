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
{ "registries": { "@vianova": "https://vianova-ds.vercel.app/r/{name}.json" } }
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

Hosted on Vercel. The settings that matter, because the defaults are wrong for a
monorepo:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/www` |
| Build Command | leave on default |
| Output Directory | leave empty |
| Include files outside Root Directory | enabled — the build needs `packages/tokens` |

Vercel runs `vercel-build` in preference to `build`. That script builds the tokens
package first (Next has no idea the theme is generated elsewhere) and writes to
`.next`. The local `build` writes to `.next-build` instead, so that `next build`
cannot corrupt a running dev server's chunks.

Do not add a `vercel.json` with `outputDirectory` — on a Next.js project that
setting breaks the post-build check even though the build itself succeeds.

Commits must carry an email linked to a GitHub account or Vercel blocks the
deployment. With no `user.email` configured, git invents one from the hostname
(`…@Miguels-Mini-2.lan`), which matches nothing:

```bash
git config user.email "223450897+miguelguerreiro-ext-arch@users.noreply.github.com"
```

## Not done yet

- Data grid, and the remaining Tier 3 map/OD components.
- `data-panel` and `preset-panel` — both need reads from the Figma library.
- Figma *components* — only variables were pushed; no component library yet.
- Code Connect (needs an Organization/Enterprise plan; this team is `pro`).
- Publishing the Figma library, which requires a human clicking Publish.
