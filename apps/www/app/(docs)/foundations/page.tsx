import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Download } from "lucide-react";

import { asset } from "@/lib/asset";
import { CopyScope } from "@/components/copy-scope";
import { FoundationsNav } from "@/components/foundations-nav";
import tokens from "@vianova/tokens/tokens.json";

/**
 * The icon grid pulls the whole lucide-react module, so it is split out of the
 * page bundle. Everything above it is static token data measured in kilobytes;
 * making colour swatches wait on 1,500 SVG components would be a poor trade.
 */
const IconBrowser = dynamic(() =>
  import("@/components/icon-browser").then((m) => m.IconBrowser),
);

export const metadata: Metadata = { title: "Foundations" };

type Token = { value: string; type: string; cssVar: string; description?: string };
const T = tokens as Record<string, Token>;

/**
 * Rendered from the BUILT token JSON, never hand-written HTML -- a foundations
 * page that can drift from the tokens it documents is worse than no page.
 */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Ramp names are DERIVED, not listed. A hardcoded list silently rendered blank
 * rows once the primitive tier moved from `vn.*` to the imported Tailwind
 * palette: every lookup missed, every swatch returned null, and the page still
 * built. Deriving them means a rename shows up as different swatches rather
 * than as nothing at all.
 */
const RAMPS = [
  ...new Set(
    Object.keys(T)
      .filter((k) => k.startsWith("tw.") && k.split(".").length === 3)
      .map((k) => k.split(".")[1]!),
  ),
];
const SCHEMES = ["brand", "blue", "warm", "viridis"];

/** Derived from the tokens, in the order the scale is authored. */
const TYPE_SCALE = Object.keys(T)
  .filter((k) => k.startsWith("font.size."))
  .map((k) => k.replace("font.size.", ""));

const WEIGHTS = Object.keys(T)
  .filter((k) => k.startsWith("font.weight."))
  .map((k) => k.replace("font.weight.", ""));

const SPACING = Object.keys(T)
  .filter((k) => k.startsWith("spacing."))
  .map((k) => k.replace("spacing.", ""))
  .sort((a, b) => Number(a) - Number(b));

const RADII = ["sm", "md", "lg", "xl", "full"];

/**
 * Downloadable brand assets.
 *
 * Both formats on purpose: SVG is the reference artwork, but a logo is asked
 * for far more often for a slide or a document, where SVG support is patchy.
 * The @2x PNG is there so nobody has to upscale one and post a blurry mark.
 */
const LOGO_ASSETS = [
  {
    file: "vianova-logo",
    name: "Logo",
    use: "Default. Light grounds.",
    note: "The primary asset — reach for this one unless a ground rules it out.",
    ground: "light",
    primary: true,
  },
  {
    file: "vianova-logo-dark",
    name: "Logo, dark ground",
    use: "Dark grounds, where you want the colour mark.",
    note: "Same gradient mark, wordmark set in white so it reads on dark.",
    ground: "dark",
  },
  {
    file: "vianova-logo-white",
    name: "Logo, white",
    use: "Monochrome, on dark or busy grounds.",
    note: "White, with the mark's strokes kept as tones of white. Use over photography.",
    ground: "dark",
  },
  {
    file: "vianova-logo-black",
    name: "Logo, black",
    use: "Monochrome, on light grounds.",
    note: "Black, with the mark's strokes kept as tones of black. Single-colour print.",
    ground: "light",
  },
  {
    file: "vianova-symbol",
    name: "Symbol",
    use: "Where the wordmark will not fit.",
    note: "Favicon, avatar, app icon. Holds down to 16px; the lockup does not.",
    ground: "dark",
    primarySymbol: true,
  },
  {
    file: "vianova-symbol-white",
    name: "Symbol, white",
    use: "Monochrome, dark grounds.",
    note: "White, tonal.",
    ground: "dark",
  },
  {
    file: "vianova-symbol-black",
    name: "Symbol, black",
    use: "Monochrome, light grounds.",
    note: "Black, tonal.",
    ground: "light",
  },
] as const;

/**
 * Download links for one asset.
 *
 * These sit on the logo itself, not only in the manifest lower down. The first
 * version put them in a table 700px below the section heading — past every
 * preview card — and the answer to "where do I get the logo" was "scroll".
 */
function LogoDownloads({ file, label }: { file: string; label: string }) {
  return (
    <span className="flex flex-wrap gap-1">
      {[
        { href: asset(`/brand/${file}.svg`), text: "SVG" },
        { href: asset(`/brand/${file}.png`), text: "PNG" },
        { href: asset(`/brand/${file}@2x.png`), text: "@2x" },
      ].map((f) => (
        <a
          key={f.text}
          href={f.href}
          download
          className="border-border hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Download aria-hidden className="size-3" />
          {f.text}
          <span className="sr-only"> — {label}</span>
        </a>
      ))}
    </span>
  );
}

const BRAND = Object.keys(T)
  .filter((k) => k.startsWith("brand."))
  .map((k) => k.replace("brand.", ""));

/** WCAG relative luminance, for picking a legible label on each swatch. */
function luminance(hex: string) {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Black or white, whichever is actually readable on the swatch.
 *
 * The brand sheet sets every label in white, which is 1.8:1 on the teal — a
 * label nobody can read. Choosing per swatch is the whole point of documenting
 * contrast rather than illustrating it.
 */
function labelOn(hex: string) {
  const l = luminance(hex);
  const onWhite = contrast(l, 1);
  const onBlack = contrast(l, 0);
  return onWhite >= onBlack
    ? { color: "#ffffff", ratio: onWhite }
    : { color: "#000000", ratio: onBlack };
}

/**
 * Copy affordances for colours.
 *
 * One rule holds across every swatch on this page: WHAT IS SHOWN IS WHAT IS
 * COPIED. A swatch labelled `--primary` puts `--primary` on the clipboard, and
 * nothing quietly rewrites it into `var(--primary)` or a hex. A docs page that
 * hands you something other than what it displayed is worse than one that
 * displays nothing.
 *
 * Which code that is differs by tier, because the tiers genuinely differ:
 *
 *   - Primitive ramps have NO CSS variable. `--tw-zinc-500` does not exist in
 *     the built theme (grep it); these are Tailwind's stock palette and the
 *     only thing you can write is the colour name, `zinc-500`. Printing a
 *     variable here would document something that does not resolve.
 *   - Semantic and brand tokens are variables, so the variable is the code.
 *   - Map ramps are variables too, and deliberately the SAME variable across
 *     all four schemes -- `data-map-scheme` picks the values. The hex differs
 *     per row; the code does not.
 *
 * Ramp cells are too narrow for a hex, so it lives in the tooltip and the
 * accessible name instead of being dropped.
 */

/**
 * The tick confirming a copy, drawn from a `data-copied` attribute CopyScope
 * sets on the clicked node.
 *
 * A glyph rather than an icon component: it renders inside all 359 copy
 * targets, and 359 copies of the same lucide SVG is ~50KB of markup for a
 * state that is on screen for a second.
 */
function CopiedMark({ className = "text-sm" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 hidden items-center justify-center rounded-[inherit] bg-background/90 font-semibold text-foreground group-data-copied:flex ${className}`}
    >
      &#10003;
    </span>
  );
}

/**
 * Shared focus treatment.
 *
 * `ring-offset` and `z-10` are both load-bearing on the ramps, where swatches
 * butt up against each other: without the offset the ring is invisible against
 * its own swatch, and without the lift the neighbour paints over half of it.
 * No ancestor of any of these may carry `overflow-hidden` -- a ring paints
 * outside the border box and would be sliced off. That is why the ramp strips
 * below round their end cells instead of clipping the row.
 */
const FOCUS =
  "focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * One step of a ramp: shows the step, copies the code.
 *
 * `showValue` is set only by the map ramps, which run the full width of the
 * column and so have room for one. The primitive ramps sit two or three to a
 * row and get about 45px, where a hex would wrap or truncate -- so there it
 * stays in the tooltip and the accessible name rather than being dropped.
 *
 * Below `sm` the map ramps are in exactly that position and take the same
 * answer. Eleven stops across a phone's 327px column leave 29px a cell against
 * the 42px a hex needs, and `flex-1` cannot shrink a cell below its own
 * min-content -- so the row did not truncate or wrap, it refused to fit and
 * pushed the whole PAGE to 487px, scrolling the document sideways on every
 * section of Foundations. Hidden rather than dropped: the hex is still in the
 * tooltip and the accessible name, which is where the primitive ramps keep it.
 */
function RampStep({
  code,
  step,
  value,
  scheme,
  showValue = false,
}: {
  code: string;
  step: number;
  value: string;
  scheme?: string;
  showValue?: boolean;
}) {
  const label = labelOn(value);
  const hex = value.toUpperCase();
  return (
    <button
      type="button"
      data-copy={code}
      aria-label={`Copy ${code}. ${scheme ? `${scheme} ` : ""}${hex}`}
      title={`${code}${scheme ? ` (${scheme})` : ""} \u2014 ${hex}`}
      style={{ background: value, color: label.color }}
      className={`group relative h-11 flex-1 cursor-pointer rounded-none first:rounded-l-[calc(var(--radius-md)-1px)] last:rounded-r-[calc(var(--radius-md)-1px)] ${FOCUS}`}
    >
      {/*
        No opacity on these. The first version dimmed them to 60% and 45% to
        keep the ramps calm, which cost 170 WCAG AA contrast failures -- down
        to 1.95:1 -- and undid the entire point of labelOn, which exists to
        pick a legible label. At full strength every one of the 286 ramp
        swatches clears 4.5:1 with black or white; measured, not assumed.
      */}
      <span className="font-mono text-[10px]">{step}</span>
      {showValue ? (
        <span className="hidden font-mono text-[10px] sm:block">{hex}</span>
      ) : null}
      <CopiedMark />
    </button>
  );
}

/**
 * The strip a ramp's steps sit in.
 *
 * No `overflow-hidden`, unlike the version this replaces: the steps are now
 * focusable and their rings would be cut off by it. The end cells round
 * themselves instead, inset by the container's 1px border.
 */
function RampStrip({ children }: { children: React.ReactNode }) {
  return <div className="flex rounded-md border border-border">{children}</div>;
}

/** A small code pill that copies itself. Used where a swatch has two codes. */
function CopyChip({ value }: { value: string }) {
  return (
    <button
      type="button"
      data-copy={value}
      aria-label={`Copy ${value}`}
      className={`group relative inline-flex cursor-pointer items-center rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${FOCUS}`}
    >
      {value}
      <CopiedMark />
    </button>
  );
}

const SECTIONS = [
  { id: "logo", label: "Logo" },
  { id: "brand-colours", label: "Brand colours" },
  { id: "typography", label: "Typography" },
  { id: "primitive-ramps", label: "Primitive ramps" },
  { id: "semantic-tokens", label: "Semantic tokens" },
  { id: "map-ramps", label: "Map ramps" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Radius" },
  { id: "motion", label: "Motion" },
  { id: "icons", label: "Icons" },
];
const RAMP_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function FoundationsPage() {
  const semantic = Object.keys(T)
    .filter((k) => k.startsWith("semantic.light."))
    .map((k) => k.replace("semantic.light.", ""));

  return (
    <div className="flex gap-10">
      <aside className="hidden w-44 shrink-0 xl:block">
        <div className="sticky top-20">
          <FoundationsNav sections={SECTIONS} />
        </div>
      </aside>

      {/*
        One scope around the whole column rather than one per colour section:
        the handler only reacts to [data-copy], and a single listener serves
        all 359 of them. See components/copy-scope.tsx.
      */}
      <CopyScope className="min-w-0 flex-1 space-y-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Foundations</h1>
        <p className="text-muted-foreground">
          Every swatch below is read from{" "}
          <code className="text-foreground">@vianova/tokens</code> at build time.
          Click any colour to copy the code shown on it.
        </p>
      </header>

      <section id="logo" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Logo</h2>
          <p className="text-sm text-muted-foreground">
            Seven files, one decision: pick by the ground it sits on.{" "}
            <code className="text-foreground">vianova-logo</code> is the primary
            asset — use it unless the background rules it out.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {LOGO_ASSETS.filter((a) => a.file.startsWith("vianova-logo")).map((logo) => (
            <div
              key={logo.file}
              className="space-y-2 overflow-hidden rounded-lg border border-border"
            >
              <div
                className={`flex h-28 items-center justify-center px-6 ${
                  logo.ground === "dark" ? "bg-zinc-950" : "bg-white"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(`/brand/${logo.file}.svg`)}
                  alt={`Vianova ${logo.name}`}
                  className="max-h-12 w-auto"
                />
              </div>
              <div className="space-y-1.5 px-3 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-xs">{logo.file}</code>
                  {"primary" in logo && logo.primary ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      PRIMARY
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{logo.note}</p>
                <LogoDownloads file={logo.file} label={logo.name} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Symbol — the favicon, and the mark in this page&rsquo;s header
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {LOGO_ASSETS.filter((a) => a.file.startsWith("vianova-symbol")).map((symbol) => (
              <div
                key={symbol.file}
                className="space-y-2 overflow-hidden rounded-lg border border-border"
              >
                <div
                  className={`flex h-24 items-center justify-center ${
                    symbol.ground === "dark" ? "bg-zinc-950" : "bg-white"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(`/brand/${symbol.file}.svg`)}
                    alt={`Vianova ${symbol.name}`}
                    className="h-12 w-auto"
                  />
                </div>
                <div className="space-y-1.5 px-3 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs">{symbol.file}</code>
                    {"primarySymbol" in symbol && symbol.primarySymbol ? (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        PRIMARY
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{symbol.note}</p>
                  <LogoDownloads file={symbol.file} label={symbol.name} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-6 rounded-lg border border-border p-6">
            {[64, 40, 32, 24, 16].map((size) => (
              <div key={size} className="space-y-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset("/brand/vianova-symbol.svg")}
                  alt=""
                  style={{ width: size, height: size }}
                  className="mx-auto"
                />
                <p className="text-xs tabular-nums text-muted-foreground">{size}px</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            The mark holds down to 16px, which is what the browser tab gets. The
            wordmark does not — below roughly 90px wide the counters close up, so
            the lockup is not a favicon.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-foreground text-[11px] font-semibold tracking-wider uppercase">
            Which one
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Choosing a Vianova logo file</caption>
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="py-1.5 pr-4 font-medium">File</th>
                  <th className="py-1.5 pr-4 font-medium">Use it</th>
                  <th className="py-1.5 font-medium">Files</th>
                </tr>
              </thead>
              <tbody>
                {LOGO_ASSETS.map((asset) => (
                  <tr key={asset.file} className="border-border border-t">
                    <td className="py-2 pr-4">
                      <code className="text-xs">{asset.file}</code>
                    </td>
                    <td className="text-muted-foreground py-2 pr-4">{asset.use}</td>
                    <td className="py-2">
                      <LogoDownloads file={asset.file} label={asset.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            The black files are Figma&rsquo;s own exports, unmodified. Their
            layers carry 70% opacity and a{" "}
            <code className="text-foreground">mix-blend-mode: color</code>{" "}
            overlay, which is what separates the strokes of the mark into
            distinguishable tones rather than one solid shape.
            <br />
            <br />
            The white files are <em>generated</em> from the black ones as their
            exact tonal negative, because that blend takes its luminosity from
            whatever sits beneath it. Under the black mark that is a black
            gradient, so it stays black; under Figma&rsquo;s white mark it is
            the pink-to-green brand gradient, which desaturates to mid-grey and
            pulls the whole mark grey with it — measured, 131/255 on a dark
            ground where a true mirror reads 228. Deriving the white from the
            black means the pair cannot drift:{" "}
            <code className="text-foreground">pnpm brand:verify</code> asserts
            that the white file rendered on black is the photographic negative
            of the black file rendered on white.
          </p>
        </div>
      </section>

      <section id="brand-colours" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Brand colours</h2>
          <p className="text-sm text-muted-foreground">
            The five colours of the logo gradient. Brand expression only — none
            of them is wired to a semantic role, because{" "}
            <code className="text-foreground">primary</code> is the product teal
            and a reachable <code className="text-foreground">brand.red-pink</code>{" "}
            would sooner or later be used as a destructive colour. Available as{" "}
            <code className="text-foreground">bg-brand-*</code> for marketing
            surfaces.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BRAND.map((name) => {
            const t = T[`brand.${name}`];
            if (!t) return null;
            const label = labelOn(t.value);
            const cssVar = `--brand-${name}`;
            return (
              <div key={name} className="space-y-1.5">
                <button
                  type="button"
                  data-copy={cssVar}
                  aria-label={`Copy ${cssVar}`}
                  style={{ background: t.value, color: label.color }}
                  className={`group relative flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg p-3 text-center ${FOCUS}`}
                >
                  <span className="text-sm font-medium capitalize">
                    {name.replace("-", " ")}
                  </span>
                  <span className="font-mono text-[11px]">{cssVar}</span>
                  <CopiedMark className="text-3xl" />
                </button>
                {/* The hex is the other thing anyone comes here for, so it gets
                    its own target rather than being the swatch's hidden
                    payload. */}
                <CopyChip value={t.value.toUpperCase()} />
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The gradient, in the order the mark uses it
          </p>
          <div
            className="h-10 rounded-lg"
            style={{
              backgroundImage: `linear-gradient(90deg, ${BRAND.map(
                (n) => T[`brand.${n}`]?.value,
              ).join(", ")})`,
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Brand colour contrast against black and white labels
            </caption>
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1.5 pr-4 font-medium">Token</th>
                <th className="py-1.5 pr-4 font-medium">Hex</th>
                <th className="py-1.5 pr-4 font-medium">Legible label</th>
                <th className="py-1.5 font-medium">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {BRAND.map((name) => {
                const t = T[`brand.${name}`];
                if (!t) return null;
                const label = labelOn(t.value);
                return (
                  <tr key={name} className="border-border border-t">
                    <td className="py-1.5 pr-4">
                      <code className="text-xs">--brand-{name}</code>
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-xs uppercase">{t.value}</td>
                    <td className="py-1.5 pr-4">
                      {label.color === "#ffffff" ? "White" : "Black"}
                    </td>
                    <td className="py-1.5 tabular-nums">{label.ratio.toFixed(2)}:1</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="typography" className="scroll-mt-20 space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Typography</h2>
          <p className="text-sm text-muted-foreground">
            The scale from the Figma library. It matches Tailwind&rsquo;s defaults from{" "}
            <code className="text-foreground">xs</code> up, so nothing fights the
            framework. <code className="text-foreground">xxs</code> is Vianova&rsquo;s
            own: indefensible for prose, necessary for a dense grid&rsquo;s unit
            suffixes.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Type scale</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {TYPE_SCALE.map((step) => {
              const t = T[`font.size.${step}`];
              if (!t) return null;
              return (
                <div
                  key={step}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3"
                >
                  <code className="w-20 shrink-0 text-xs text-muted-foreground">
                    text-{step}
                  </code>
                  <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t.value}
                  </span>
                  <span
                    style={{ fontSize: t.value }}
                    className="min-w-0 truncate leading-tight"
                  >
                    Vianova
                  </span>
                  {/* The usage note travels with the token, so the scale says
                      which step to reach for rather than only how big it is. */}
                  <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                    {t.description?.split(" — ")[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Weights</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {WEIGHTS.map((name) => {
              const t = T[`font.weight.${name}`];
              if (!t) return null;
              return (
                <div key={name} className="flex items-baseline gap-4 px-4 py-2.5">
                  <code className="w-28 shrink-0 text-xs text-muted-foreground">
                    font-{name}
                  </code>
                  <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t.value}
                  </span>
                  <span style={{ fontWeight: Number(t.value) }} className="truncate">
                    The quick brown fox
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Families</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {["sans", "mono"].map((name) => {
              const t = T[`font.family.${name}`];
              if (!t) return null;
              return (
                <div key={name} className="space-y-1 px-4 py-3">
                  <div className="flex items-baseline gap-4">
                    <code className="w-20 shrink-0 text-xs text-muted-foreground">
                      font-{name}
                    </code>
                    <span style={{ fontFamily: t.value }} className="truncate">
                      Le Havre — 1,240 trips at 08:15
                    </span>
                  </div>
                  <p className="truncate pl-24 text-xs text-muted-foreground">{t.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="primitive-ramps" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">
          Primitive ramps ({RAMPS.length} families)
        </h2>
        <p className="text-sm text-muted-foreground">
          Tailwind&rsquo;s palette, which the semantic layer references. These are
          the one tier with no CSS variable of their own, so a step copies its
          colour name — <code className="text-foreground">zinc-500</code>, to be
          written as <code className="text-foreground">bg-zinc-500</code>. Hover
          a step for its hex.
        </p>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {RAMPS.map((ramp) => (
            <div key={ramp} className="space-y-1">
              <p className="text-xs text-muted-foreground">tw.{ramp}</p>
              <RampStrip>
                {STEPS.map((step) => {
                  const t = T[`tw.${ramp}.${step}`];
                  if (!t) return null;
                  return (
                    <RampStep
                      key={step}
                      code={`${ramp}-${step}`}
                      step={step}
                      value={t.value}
                    />
                  );
                })}
              </RampStrip>
            </div>
          ))}
        </div>
      </section>

      <section id="semantic-tokens" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">
          Semantic tokens ({semantic.length} × light/dark)
        </h2>
        <p className="text-sm text-muted-foreground">
          These names are shadcn&rsquo;s CSS variable contract verbatim, which is
          what makes upstream components themeable without a mapping layer. Each
          swatch is painted from the live variable, so it shows the mode and
          white-label theme you are currently in.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {semantic.map((name) => (
            <button
              key={name}
              type="button"
              data-copy={`--${name}`}
              aria-label={`Copy --${name}`}
              className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-md border border-border p-2 text-left transition-colors hover:bg-accent/50 ${FOCUS}`}
            >
              {/*
                Painted from the live variable, not from the token's light
                value, so it follows the colour mode and the white-label theme
                the reader is actually in. That is also why no hex is printed
                here: there is no single one, and showing the light value next
                to a dark swatch would be a lie.
              */}
              <span
                style={{ background: `var(--${name})` }}
                className="size-8 shrink-0 rounded border border-border"
              />
              <code className="truncate text-xs">--{name}</code>
              <CopiedMark className="text-base" />
            </button>
          ))}
        </div>
      </section>

      <section id="map-ramps" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">Map ramps</h2>
        <p className="text-sm text-muted-foreground">
          An axis of their own, independent of light/dark and of the white-label
          themes. All four are shown here; a product selects one by setting{" "}
          <code className="text-foreground">data-map-scheme</code> on the root
          element. Brand is the default and needs no attribute.
        </p>
        <p className="text-sm text-muted-foreground">
          Every row copies the same variable, because that is the truth of it:{" "}
          <code className="text-foreground">--map-ramp-50</code> is
          scheme-independent and the attribute decides which of the four values
          below it resolves to. The hex under each stop is what that row&rsquo;s
          scheme resolves it to.
        </p>
        {SCHEMES.map((scheme) => (
          <div key={scheme} className="space-y-1">
            <p className="text-xs capitalize text-muted-foreground">{scheme}</p>
            <RampStrip>
              {RAMP_STOPS.map((stop) => {
                const t = T[`map.ramp.${scheme}.${stop}`];
                if (!t) return null;
                return (
                  <RampStep
                    key={stop}
                    // The same variable in all four rows, on purpose: the
                    // scheme attribute chooses the value, so the code you
                    // write never mentions the scheme.
                    code={`--map-ramp-${stop}`}
                    step={stop}
                    value={t.value}
                    scheme={scheme}
                    showValue
                  />
                );
              })}
            </RampStrip>
          </div>
        ))}
      </section>

      <section id="spacing" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">Spacing ({SPACING.length} steps)</h2>
        <p className="text-sm text-muted-foreground">
          A 4px base unit. Every gap, pad and inset in the system is a multiple
          of it, which is what keeps unrelated components aligning without
          anyone measuring.
        </p>
        <div className="space-y-1">
          {SPACING.map((step) => {
            const t = T[`spacing.${step}`];
            if (!t) return null;
            return (
              <div key={step} className="flex items-center gap-4">
                <code className="w-16 shrink-0 text-xs text-muted-foreground">
                  {step}
                </code>
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t.value}
                </span>
                <div className="h-3 rounded-sm bg-primary" style={{ width: t.value }} />
              </div>
            );
          })}
        </div>
      </section>

      <section id="radius" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">Radius</h2>
        <p className="text-sm text-muted-foreground">
          Derived from a single{" "}
          <code className="text-foreground">--radius</code>, so a product can
          re-round the entire system by changing one value. Figma&rsquo;s absolute
          4/6/8/12 are superseded by the preset&rsquo;s scale for exactly that
          reason.
        </p>
        <div className="flex flex-wrap gap-4">
          {RADII.map((name) => {
            const t = T[`radius.${name}`];
            if (!t) return null;
            return (
              <div key={name} className="space-y-1.5">
                <div
                  className="size-20 border-2 border-primary bg-primary/10"
                  style={{ borderRadius: t.value }}
                />
                <p className="text-xs text-muted-foreground">
                  <code>{name}</code> · {t.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="motion" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">Motion</h2>
        <p className="text-sm text-muted-foreground">
          Three durations and two curves. Anything slower than 240ms reads as
          lag in a tool people use all day.
        </p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {Object.keys(T)
            .filter((k) => k.startsWith("motion."))
            .map((key) => (
              <div key={key} className="flex items-baseline gap-4 px-4 py-2.5">
                <code className="w-40 shrink-0 text-xs text-muted-foreground">
                  {key.replace("motion.", "")}
                </code>
                <span className="text-sm tabular-nums">{T[key]!.value}</span>
              </div>
            ))}
        </div>
      </section>

      <section id="icons" className="scroll-mt-20 space-y-4">
        <h2 className="text-sm font-medium">Icons</h2>
        <p className="text-sm text-muted-foreground">
          Lucide, at 24&times;24 on a 2px stroke — the same set pasted into the
          the Figma library Foundations board, read here straight from{" "}
          <code className="text-foreground">lucide-react</code> so it cannot fall
          out of step with the version installed. Hover an icon to copy its
          import.
        </p>
        <IconBrowser />
      </section>
      </CopyScope>
    </div>
  );
}
