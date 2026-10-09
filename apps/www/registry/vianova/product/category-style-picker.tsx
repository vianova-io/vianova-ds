"use client";

import * as React from "react";
import { ImagePlus, TriangleAlert, X } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import { CategoryBadge } from "@/registry/vianova/product/category-badge";
import {
  CATEGORY_PALETTE,
  adviseLogo,
  badgeColor,
  prepareLogo,
  type CategoryStyle,
} from "@/registry/vianova/lib/category-style";
import { cn } from "@/registry/vianova/lib/utils";

/** Ready-made badges: the two a logo most often needs, so it is one click away. */
const BADGE_CHOICES = [
  { label: "White", hex: "#ffffff" },
  { label: "Dark", hex: "#111827" },
] as const;

/**
 * One category value's colour and logo, and how they will look on a map.
 *
 * The colour is the dot a map draws zoomed out. The badge -- the logo on a disc
 * -- is what it draws zoomed in, and its disc is the same colour unless it is
 * given its own, because what makes a dot easy to tell apart and what makes a
 * logo easy to read are often different colours. The picker shows both, and
 * says so when a logo will not read on its badge.
 */
export function CategoryStylePicker({
  value,
  style,
  logoZoom,
  onChange,
}: {
  value: string;
  style: CategoryStyle;
  logoZoom: number;
  onChange: (next: CategoryStyle) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const advice = adviseLogo(style);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { logoColor, ...logo } = await prepareLogo(file);
      // The dot takes the logo's own colour, so the dot and the logo that
      // replaces it read as the same thing. The badge is cleared first, then
      // given a white or dark disc if the logo would be lost on its own colour,
      // which is the usual case: a logo in its own colour on a disc of that colour.
      const next: CategoryStyle = {
        ...style,
        ...logo,
        badge: undefined,
        color: logoColor ?? style.color,
      };
      const fix = adviseLogo(next).find(
        (a) => a.kind === "warning",
      )?.suggestion;
      onChange(fix ? { ...next, badge: fix } : next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Colour and logo for ${value}`}
          />
        }
      >
        <CategoryBadge
          color={badgeColor(style)}
          logo={style.logo}
          logoKind={style.logoKind}
          size={22}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">On the map</p>
          <div className="bg-muted/50 flex items-center justify-around rounded-lg border p-3">
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className="border-border size-3.5 rounded-full border"
                style={{ backgroundColor: style.color }}
              />
              <span className="text-muted-foreground text-[11px]">
                Below zoom {logoZoom}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <CategoryBadge
                color={badgeColor(style)}
                logo={style.logo}
                logoKind={style.logoKind}
                size={44}
              />
              <span className="text-muted-foreground text-[11px]">
                From zoom {logoZoom}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Colour</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                aria-pressed={style.color === swatch}
                onClick={() => onChange({ ...style, color: swatch })}
                className="focus-visible:ring-ring size-6 rounded-full border focus-visible:ring-2 focus-visible:outline-none aria-pressed:ring-2 aria-pressed:ring-offset-1 aria-pressed:ring-offset-background aria-pressed:ring-foreground"
                style={{ backgroundColor: swatch }}
              />
            ))}
            <label className="text-muted-foreground hover:text-foreground focus-within:ring-ring flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed text-[10px] focus-within:ring-2">
              <span aria-hidden>+</span>
              <span className="sr-only">Custom colour</span>
              <input
                type="color"
                className="sr-only"
                value={
                  /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : "#0f766e"
                }
                onChange={(e) => onChange({ ...style, color: e.target.value })}
              />
            </label>
          </div>
        </div>

        {style.logo ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Badge</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={style.badge === undefined}
                onClick={() => onChange({ ...style, badge: undefined })}
                className="focus-visible:ring-ring hover:bg-muted text-muted-foreground aria-pressed:text-foreground aria-pressed:border-foreground h-6 rounded-full border px-2 text-[11px] focus-visible:ring-2 focus-visible:outline-none"
              >
                Same as dot
              </button>
              {BADGE_CHOICES.map(({ label, hex }) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`${label} badge`}
                  aria-pressed={style.badge === hex}
                  onClick={() => onChange({ ...style, badge: hex })}
                  className="focus-visible:ring-ring size-6 rounded-full border focus-visible:ring-2 focus-visible:outline-none aria-pressed:ring-2 aria-pressed:ring-offset-1 aria-pressed:ring-offset-background aria-pressed:ring-foreground"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <label className="text-muted-foreground hover:text-foreground focus-within:ring-ring flex size-6 cursor-pointer items-center justify-center rounded-full border border-dashed text-[10px] focus-within:ring-2">
                <span aria-hidden>+</span>
                <span className="sr-only">Custom badge colour</span>
                <input
                  type="color"
                  className="sr-only"
                  value={
                    /^#[0-9a-f]{6}$/i.test(badgeColor(style))
                      ? badgeColor(style)
                      : "#ffffff"
                  }
                  onChange={(e) =>
                    onChange({ ...style, badge: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="text-muted-foreground text-[11px]">
              What the logo sits on. The dot keeps its own colour.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Logo</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus data-icon="inline-start" />
              {busy ? "Reading…" : style.logo ? "Replace" : "Upload"}
            </Button>
            {style.logo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ color: style.color })}
              >
                <X data-icon="inline-start" />
                Remove
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-label={`Logo file for ${value}`}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          ) : null}
          {advice.map((a) => (
            <div
              key={a.message}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-xs",
                a.kind === "warning"
                  ? "border-destructive/40 text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {a.kind === "warning" ? (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              ) : null}
              <div className="space-y-1.5">
                <p>{a.message}</p>
                {a.suggestion ? (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onChange({ ...style, badge: a.suggestion! })}
                  >
                    Use {a.suggestion === "#ffffff" ? "a white" : "a dark"}{" "}
                    badge
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
