"use client";

import * as React from "react";
import { Download, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";

import { asset } from "@/lib/asset";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * A workspace at a chosen breakpoint, in a frame that actually has that width.
 *
 * `PreviewFrame` -- the one on the component pages -- switches a wrapper div
 * between 100%, 768px and 375px. That is right for a button and wrong for a
 * workspace, because a workspace reads the VIEWPORT, not its container, to
 * decide its layout. Narrow the div and the docked panel stays docked while
 * `useIsMobile()` still reports the reader's window. The preview would be
 * confidently wrong, which is worse than absent.
 *
 * So this embeds `/workspace/<slug>/` in an iframe. The frame is a viewport,
 * the media queries resolve against it, and the phone layout is the real one.
 *
 * The frame renders at its true pixel width and is then scaled DOWN with a
 * transform to fit the docs column. Scaling after layout rather than before
 * is the point: at 1280 the grid breaks where it breaks on a 1280 screen, and
 * the reader sees that arrangement smaller, rather than seeing a different
 * arrangement at full size.
 */
const BREAKPOINTS = [
  { id: "desktop", label: "Desktop", icon: Monitor, w: 1280, h: 800 },
  { id: "tablet", label: "Tablet", icon: Tablet, w: 768, h: 1024 },
  { id: "phone", label: "Phone", icon: Smartphone, w: 375, h: 812 },
] as const;

type BreakpointId = (typeof BREAKPOINTS)[number]["id"];

export function WorkspaceFrame({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [bp, setBp] = React.useState<BreakpointId>("desktop");
  const [scale, setScale] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const holderRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  const active = BREAKPOINTS.find((b) => b.id === bp)!;

  /**
   * Fit the frame to the column, never magnify it.
   *
   * A ResizeObserver rather than a window listener: the docs column changes
   * width when the sidebar collapses, which is not a window resize.
   */
  React.useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    const fit = () => {
      const available = holder.clientWidth;
      setScale(available > 0 ? Math.min(1, available / active.w) : 1);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(holder);
    return () => ro.disconnect();
  }, [active.w]);

  /**
   * Save the frame as a PNG.
   *
   * `html-to-image` is loaded on click, not at module scope -- it is only
   * ever needed by a reader who presses the button, and every other visitor
   * to the page would otherwise pay for it in the bundle.
   *
   * The capture is taken from the iframe's own document. That works because
   * the frame is same-origin; it would throw on a cross-origin one, which is
   * why the route it points at is ours and not an embed.
   */
  const save = React.useCallback(async () => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const node = doc?.body;
    if (!node) {
      setError("The frame has not finished loading.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");

      const url = await toPng(node, {
        width: active.w,
        height: active.h,
        pixelRatio: 2,
        // The frame's own background, not the docs page's. Without this a
        // dark-theme capture arrives transparent and reads as white wherever
        // it is pasted.
        backgroundColor: getComputedStyle(doc.documentElement).backgroundColor,
        // Fonts are same-origin here, so they embed. A webfont served from a
        // third party would taint the canvas and `toPng` would reject.
        cacheBust: true,
      });

      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${active.id}-${active.w}x${active.h}.png`;
      a.click();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The capture could not be produced.",
      );
    } finally {
      setSaving(false);
    }
  }, [active, slug]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
          role="group"
          aria-label="Preview width"
        >
          {BREAKPOINTS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBp(b.id)}
              aria-pressed={bp === b.id}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
                bp === b.id && "bg-accent text-accent-foreground",
              )}
            >
              <b.icon className="size-3.5" aria-hidden />
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {active.w} × {active.h}
            {scale < 1 ? ` · ${Math.round(scale * 100)}%` : null}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs transition-colors hover:bg-accent disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            {saving ? "Saving…" : "Save PNG"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/*
        Two boxes, and they do different jobs. The outer one is measured and
        reserves the SCALED height, so the page below it does not jump when
        the breakpoint changes. The inner one is the true pixel size and is
        transformed. Collapsing them into one means either a jumping page or
        a frame that lays out at the wrong width.
      */}
      <div
        ref={holderRef}
        className="flex justify-center overflow-hidden rounded-xl border border-border bg-muted/30"
        style={{ height: active.h * scale }}
      >
        {/*
          A wrapper sized to the SCALED dimensions, because `transform` does
          not change an element's layout box: the iframe still occupies its
          true width in flow. Centre it directly and at Desktop the 1280px box
          would be centred inside a narrower holder, putting its left edge off
          the holder and -- with `transformOrigin: top left` -- clipping the
          scaled content. This wrapper is what the centring acts on.
        */}
        <div
          className="relative shrink-0"
          style={{ width: active.w * scale, height: active.h * scale }}
        >
          <iframe
            ref={frameRef}
            key={`${slug}-${active.id}`}
            src={asset(`/workspace/${slug}/`)}
            title={`${title} at ${active.label} width`}
            width={active.w}
            height={active.h}
            /*
              Three of these pages already mount a live maplibre map above
              this frame -- the variant comparisons on map, dashboard and
              regulations. Loading a second one eagerly would put two WebGL
              contexts on the page before the reader has scrolled to either.
            */
            loading="lazy"
            className="absolute top-0 left-0 block border-0 bg-background"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </section>
  );
}
