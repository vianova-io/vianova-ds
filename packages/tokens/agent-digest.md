# Vianova DS — token digest

> **GENERATED** by `packages/tokens/scripts/agent-digest.ts` — do not edit by hand.
> Regenerate with `pnpm --filter @vianova/tokens digest`.

| | |
|---|---|
| Generated | 2026-10-08 |
| DS repo | `65889c3 (public-main)` |
| Input | `dist/tokens.json`, sha256 `ac0b58bb65cb9280…` |
| Observed | 63 semantic roles × 6 modes · 42 of 63 light roles are code-only · 76 tokens carry `a11yFix` |

Light and dark, which is what nearly every task needs. The four white-label
themes and the primitive index are in `agent-digest.full.md`.

**Provenance glyphs** (they combine — `Cp`, `F!`): `F` from the Figma library ·
`C` code-only (`figma: null`, exists nowhere in Figma) · `p` the value originates in
the shadcn preset rather than a Vianova choice · `!` deliberately altered to pass
contrast, so it no longer matches Figma.

Colour values below are **resolved to hex**. The source is often `oklch()`; if you
need the original, read `dist/theme.css`. Alpha renders as 8-digit hex.

## Semantic colours

| Role | CSS var | Light | Dark | Prov | Figma variable |
|---|---|---|---|---|---|
| `background` | `--background` | `#ffffff` | `#09090b` | Cp | — |
| `foreground` | `--foreground` | `#09090b` | `#fafafa` | Cp | — |
| `foreground-80` | `--foreground-80` | `#09090bcc` | `#d4d4d8cc` | F | `text/foreground-80` |
| `foreground-60` | `--foreground-60` | `#09090b99` | `#d4d4d899` | F | `text/foreground-60` |
| `foreground-40` | `--foreground-40` | `#09090b66` | `#d4d4d866` | F | `text/foreground-40` |
| `foreground-20` | `--foreground-20` | `#09090b33` | `#d4d4d833` | F | `text/foreground-20` |
| `foreground-10` | `--foreground-10` | `#09090b1a` | `#d4d4d81a` | F | `text/foreground-10` |
| `primary` | `--primary` | `#0f766e` | `#2dd4bf` | F | `action/primary` |
| `primary-foreground` | `--primary-foreground` | `#fafafa` | `#09090b` | F | `action/primary-foreground` |
| `secondary` | `--secondary` | `#f4f4f5` | `#27272a` | Cp | — |
| `secondary-foreground` | `--secondary-foreground` | `#18181b` | `#fafafa` | Cp | — |
| `muted` | `--muted` | `#f4f4f5` | `#27272a` | Cp | — |
| `muted-40` | `--muted-40` | `#f4f4f5` | `#3f3f4666` | F | `surface/muted-40` |
| `muted-foreground` | `--muted-foreground` | `#52525b` | `#9f9fa9` | Cp! | — |
| `muted-foreground-80` | `--muted-foreground-80` | `#52525bcc` | `#a1a1aacc` | F! | `text/muted-foreground-80` |
| `muted-foreground-60` | `--muted-foreground-60` | `#52525b99` | `#a1a1aa99` | F! | `text/muted-foreground-60` |
| `muted-foreground-40` | `--muted-foreground-40` | `#52525b66` | `#a1a1aa66` | F! | `text/muted-foreground-40` |
| `muted-foreground-20` | `--muted-foreground-20` | `#52525b33` | `#a1a1aa33` | F! | `text/muted-foreground-20` |
| `muted-foreground-10` | `--muted-foreground-10` | `#52525b1a` | `#a1a1aa1a` | F! | `text/muted-foreground-10` |
| `accent` | `--accent` | `#f4f4f5` | `#27272a` | Cp | — |
| `accent-foreground` | `--accent-foreground` | `#18181b` | `#fafafa` | Cp | — |
| `card` | `--card` | `#ffffff` | `#18181b` | Cp | — |
| `card-foreground` | `--card-foreground` | `#09090b` | `#fafafa` | Cp | — |
| `popover` | `--popover` | `#ffffff` | `#18181b` | Cp | — |
| `popover-foreground` | `--popover-foreground` | `#09090b` | `#fafafa` | Cp | — |
| `destructive` | `--destructive` | `#e7000b` | `#ff6467` | Cp | — |
| `destructive-foreground` | `--destructive-foreground` | `#fafafa` | `#09090b` | F | `feedback/destructive-foreground` |
| `border` | `--border` | `#e4e4e7` | `#ffffff1a` | Cp | — |
| `input` | `--input` | `#e4e4e7` | `#ffffff26` | Cp! | — |
| `ring` | `--ring` | `#71717a` | `#71717b` | Cp! | — |
| `syntax-string` | `--syntax-string` | `#16a34a` | `#4ade80` | F | `syntax/string` |
| `syntax-number` | `--syntax-number` | `#d97706` | `#fbbf24` | F | `syntax/number` |
| `syntax-property` | `--syntax-property` | `#6d28d9` | `#a78bfa` | F | `syntax/property` |
| `warning` | `--warning` | `#fbbf24` | `#fbbf24` | F | `feedback/warning` |
| `warning-foreground` | `--warning-foreground` | `#451a03` | `#451a03` | F | `feedback/warning-foreground` |
| `data-accent` | `--data-accent` | `#2dd4bf` | `#2dd4bf` | F | `text/data-accent` |
| `data-warning` | `--data-warning` | `#fcd34d` | `#fcd34d` | F | `text/data-warning` |
| `success` | `--success` | `#15803d` | `#4ade80` | C | — |
| `success-foreground` | `--success-foreground` | `#fafafa` | `#09090b` | C | — |
| `info` | `--info` | `#0369a1` | `#38bdf8` | C | — |
| `info-foreground` | `--info-foreground` | `#fafafa` | `#09090b` | C | — |
| `surface-raised` | `--surface-raised` | `#ffffff` | `#3f3f46` | C | — |
| `surface-sunken` | `--surface-sunken` | `#f4f4f5` | `#18181b` | C | — |
| `overlay` | `--overlay` | `#000000a6` | `#000000a6` | C | — |
| `origin` | `--origin` | `#0f766e` | `#2dd4bf` | C | — |
| `origin-foreground` | `--origin-foreground` | `#fafafa` | `#09090b` | C | — |
| `destination` | `--destination` | `#b45309` | `#fbbf24` | C | — |
| `destination-foreground` | `--destination-foreground` | `#fafafa` | `#09090b` | C | — |
| `selected` | `--selected` | `#0f766e` | `#2dd4bf` | C | — |
| `dimmed` | `--dimmed` | `#a1a1aa` | `#52525b` | C | — |
| `sidebar` | `--sidebar` | `#fafafa` | `#18181b` | Cp | — |
| `sidebar-foreground` | `--sidebar-foreground` | `#09090b` | `#fafafa` | Cp | — |
| `sidebar-primary` | `--sidebar-primary` | `#0f766e` | `#2dd4bf` | C | — |
| `sidebar-primary-foreground` | `--sidebar-primary-foreground` | `#fafafa` | `#09090b` | C | — |
| `sidebar-accent` | `--sidebar-accent` | `#f4f4f5` | `#27272a` | Cp | — |
| `sidebar-accent-foreground` | `--sidebar-accent-foreground` | `#18181b` | `#fafafa` | Cp | — |
| `sidebar-border` | `--sidebar-border` | `#e4e4e7` | `#ffffff1a` | Cp | — |
| `sidebar-ring` | `--sidebar-ring` | `#9f9fa9` | `#71717b` | Cp | — |
| `chart-1` | `--chart-1` | `#0d9488` | `#99f6e4` | Cp! | — |
| `chart-2` | `--chart-2` | `#0f766e` | `#5eead4` | Cp! | — |
| `chart-3` | `--chart-3` | `#115e59` | `#2dd4bf` | Cp! | — |
| `chart-4` | `--chart-4` | `#134e4a` | `#14b8a6` | Cp! | — |
| `chart-5` | `--chart-5` | `#042f2e` | `#0d9488` | Cp! | — |

## Foundations

### Type

| Token | CSS var | Value | Notes |
|---|---|---|---|
| `font.family.sans` | `--font-family-sans` | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |  |
| `font.family.mono` | `--font-family-mono` | `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace` | CODE-ONLY: not in Figma. Geist Mono over JetBrains Mono for its disambiguated 0/1/l/I, which is what the mono is actually used for here -- hex codes, token names and commit SHAs at 11-13px, not long-form code. |
| `font.weight.thin` | `--font-weight-thin` | `100` |  |
| `font.weight.extralight` | `--font-weight-extralight` | `200` |  |
| `font.weight.light` | `--font-weight-light` | `300` |  |
| `font.weight.regular` | `--font-weight-regular` | `400` |  |
| `font.weight.medium` | `--font-weight-medium` | `500` |  |
| `font.weight.semibold` | `--font-weight-semibold` | `600` |  |
| `font.weight.bold` | `--font-weight-bold` | `700` |  |
| `font.weight.extrabold` | `--font-weight-extrabold` | `800` |  |
| `font.weight.black` | `--font-weight-black` | `900` |  |
| `font.size.xxs` | `--font-size-xxs` | `0.625rem` | 10px — Dense labels, metric units |
| `font.size.xs` | `--font-size-xs` | `0.75rem` | 12px — Captions, table cells |
| `font.size.sm` | `--font-size-sm` | `0.875rem` | 14px — Body default in compact UI |
| `font.size.base` | `--font-size-base` | `1rem` | 16px — Body default in marketing |
| `font.size.lg` | `--font-size-lg` | `1.125rem` | 18px — Lead paragraphs |
| `font.size.xl` | `--font-size-xl` | `1.25rem` | 20px — Section subheads |
| `font.size.2xl` | `--font-size-2xl` | `1.5rem` | 24px — H4 |
| `font.size.3xl` | `--font-size-3xl` | `1.875rem` | 30px — H3 |
| `font.size.4xl` | `--font-size-4xl` | `2.25rem` | 36px — H2 |
| `font.size.5xl` | `--font-size-5xl` | `3rem` | 48px — H1 |
| `font.size.6xl` | `--font-size-6xl` | `3.75rem` | 60px — Hero headlines |

### Spacing

| Token | CSS var | Value | Notes |
|---|---|---|---|
| `spacing.0` | `--spacing-0` | `0rem` |  |
| `spacing.1` | `--spacing-1` | `0.25rem` |  |
| `spacing.2` | `--spacing-2` | `0.5rem` |  |
| `spacing.3` | `--spacing-3` | `0.75rem` |  |
| `spacing.4` | `--spacing-4` | `1rem` |  |
| `spacing.5` | `--spacing-5` | `1.25rem` |  |
| `spacing.6` | `--spacing-6` | `1.5rem` |  |
| `spacing.7` | `--spacing-7` | `1.75rem` |  |
| `spacing.8` | `--spacing-8` | `2rem` |  |
| `spacing.9` | `--spacing-9` | `2.25rem` |  |
| `spacing.10` | `--spacing-10` | `2.5rem` |  |
| `spacing.11` | `--spacing-11` | `2.75rem` |  |
| `spacing.12` | `--spacing-12` | `3rem` |  |

### Radius

| Token | CSS var | Value | Notes |
|---|---|---|---|
| `radius.DEFAULT` | `--radius-DEFAULT` | `0.625rem` |  |
| `radius.sm` | `--radius-sm` | `calc(0.625rem - 4px)` |  |
| `radius.md` | `--radius-md` | `calc(0.625rem - 2px)` |  |
| `radius.lg` | `--radius-lg` | `0.625rem` |  |
| `radius.xl` | `--radius-xl` | `calc(0.625rem + 4px)` |  |
| `radius.full` | `--radius-full` | `9999px` |  |

### Motion

| Token | CSS var | Value | Notes |
|---|---|---|---|
| `motion.duration.fast` | `--motion-duration-fast` | `120ms` |  |
| `motion.duration.base` | `--motion-duration-base` | `180ms` |  |
| `motion.duration.slow` | `--motion-duration-slow` | `240ms` |  |
| `motion.easing.default` | `--motion-easing-default` | `cubic-bezier(0.2, 0, 0, 1)` |  |
| `motion.easing.enter` | `--motion-easing-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` |  |

## Component tokens

Components never reference a primitive directly — they go through semantics.

| Token | CSS var | Value |
|---|---|---|
| `component.button.sm.padding-y` | `--component-button-sm-padding-y` | `4px` |
| `component.button.sm.padding-x` | `--component-button-sm-padding-x` | `10px` |
| `component.button.sm.font-size` | `--component-button-sm-font-size` | `12px` |
| `component.button.md.padding-y` | `--component-button-md-padding-y` | `8px` |
| `component.button.md.padding-x` | `--component-button-md-padding-x` | `16px` |
| `component.button.md.font-size` | `--component-button-md-font-size` | `14px` |
| `component.button.lg.padding-y` | `--component-button-lg-padding-y` | `10px` |
| `component.button.lg.padding-x` | `--component-button-lg-padding-x` | `20px` |
| `component.button.lg.font-size` | `--component-button-lg-font-size` | `16px` |
| `component.button.radius` | `--component-button-radius` | `6px` |
| `component.badge.padding-y` | `--component-badge-padding-y` | `2px` |
| `component.badge.padding-x` | `--component-badge-padding-x` | `8px` |
| `component.badge.radius` | `--component-badge-radius` | `6px` |
| `component.input.padding-y` | `--component-input-padding-y` | `8px` |
| `component.input.padding-x` | `--component-input-padding-x` | `12px` |
| `component.input.radius` | `--component-input-radius` | `6px` |
| `component.input.font-size` | `--component-input-font-size` | `14px` |
| `component.card.padding` | `--component-card-padding` | `24px` |
| `component.card.radius` | `--component-card-radius` | `8px` |
| `component.alert.padding` | `--component-alert-padding` | `16px` |
| `component.alert.gap` | `--component-alert-gap` | `12px` |
| `component.alert.radius` | `--component-alert-radius` | `8px` |

## Brand gradient — expression only

**Never use these as product UI colour.** They are the logo and marketing
gradient. Stop order left→right as listed.

| Stop | CSS var | Hex | Notes |
|---|---|---|---|
| `red-pink` | `--brand-red-pink` | `#fc0061` | Gradient start |
| `magenta` | `--brand-magenta` | `#ba00c7` | Gradient |
| `violet` | `--brand-violet` | `#6000f3` | Gradient |
| `blue` | `--brand-blue` | `#004bd9` | Gradient |
| `teal` | `--brand-teal` | `#00dc96` | Gradient end |

The four-stop set `#FC01B4 #FE4765 #1804E4 #02D98F` describes the **logo's**
internal two-pass `soft-light` construction. It is not an alternative to the
stops above — both are true at different layers.

## Map ramps

A second axis, independent of theme — selected by `data-map-scheme`. Eleven
stops each, 0→100.

- **brand** — `#ede9fe` `#ddd6fe` `#c4b5fd` `#a78bfa` `#8b5cf6` `#7c3aed` `#6d28d9` `#5b21b6` `#4c1d95` `#3d157f` `#2e1065`
- **warm** — `#fcd34d` `#fbbf24` `#fb923c` `#f97316` `#fb7185` `#ec4899` `#d946ef` `#c026d3` `#9333ea` `#7e22ce` `#6b21a8`
- **viridis** — `#440154` `#482475` `#414487` `#355f8d` `#2f788e` `#21918c` `#22a884` `#44bf70` `#7ad151` `#bddf26` `#fde725`
- **blue** — `#dbeafe` `#bfdbfe` `#93c5fd` `#60a5fa` `#3b82f6` `#2563eb` `#1d4ed8` `#1e40af` `#1e3a8a` `#172554` `#0f1a40`

## Primitives

Stock Tailwind v4, captured verbatim from the Figma `Tailwind` collection —
244 of them. You already know `teal-600`; the full index is in
`agent-digest.full.md`. What matters is which primitive a semantic resolves to:

| Semantic role (light) | Resolves to |
|---|---|
| `selected` | `primary` |
| `sidebar` | `card` |
| `sidebar-foreground` | `foreground` |
| `sidebar-primary` | `primary` |
| `sidebar-primary-foreground` | `primary-foreground` |
| `sidebar-accent` | `accent` |
| `sidebar-accent-foreground` | `accent-foreground` |
| `sidebar-border` | `border` |
| `sidebar-ring` | `ring` |
