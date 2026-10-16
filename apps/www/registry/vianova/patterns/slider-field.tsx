"use client";

import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";
import { Field, FieldDescription, FieldLabel } from "@/registry/vianova/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/registry/vianova/ui/input-group";
import { Slider } from "@/registry/vianova/ui/slider";

/**
 * Formats a number for display with a real minus sign (U+2212).
 *
 * The hyphen-minus that `String(-20)` produces is shorter than the digits and
 * sits too low, so "-20" next to "20" reads as a different weight of number.
 * Only labels get this treatment: the input keeps the hyphen-minus, because
 * that is what a keyboard types and what a paste into anything else expects.
 */
function formatSigned(n: number) {
  return String(n).replace("-", "−");
}

/** Decimal places in `step`, so rounding to it does not leave 0.30000000000000004. */
function decimalsOf(step: number) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * A slider paired with a numeric input and a unit, under one label.
 *
 * The slider is for getting close, the input for being exact, and both always
 * show the same number. The input is a text field rather than
 * `type="number"`: a number input reports "" for every intermediate state, so
 * "-" on the way to "-5" would be indistinguishable from an empty field and
 * the component could not tell a half-typed value from a cleared one. Here
 * the text is held as typed, the slider follows every parseable keystroke,
 * and the value is clamped and rounded to `step` only on blur or Enter.
 *
 * Marks are placed with the same arithmetic as the thumb. The underlying
 * Slider uses `thumbAlignment="edge"`, which keeps the 12px thumb inside the
 * track, so the thumb centre travels from 6px to `100% - 6px`, not 0 to 100%.
 * A mark placed at a plain percentage drifts off its thumb towards the ends.
 */
export function SliderField({
  label,
  description,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  marks,
  recommended,
  disabled,
  id,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown as a suffix in the input and after the recommended value, e.g. "m". */
  unit?: string;
  /** Values to label under the track. Each must lie within min..max. */
  marks?: number[];
  /** Shows a "Recommended" hint, and emphasises the matching mark if there is one. */
  recommended?: number;
  disabled?: boolean;
  /** Id of the number input. Generated when omitted. */
  id?: string;
  className?: string;
}) {
  const generatedId = React.useId();
  const inputId = id ?? `${generatedId}-input`;
  const labelId = `${inputId}-label`;
  const hintId = `${inputId}-hint`;

  // null while the input shows the value itself; a string while someone is
  // typing and the text may not be a number yet.
  const [draft, setDraft] = React.useState<string | null>(null);

  const decimals = decimalsOf(step);
  const normalise = React.useCallback(
    (n: number) => {
      const clamped = Math.min(max, Math.max(min, n));
      const stepped = Math.round((clamped - min) / step) * step + min;
      // Rounding can push past max when (max - min) is not a multiple of step.
      return Number(Math.min(max, stepped).toFixed(decimals));
    },
    [min, max, step, decimals],
  );

  /** Accepts the typographic minus and a decimal comma, as people paste both. */
  const parse = (text: string) => {
    const cleaned = text.trim().replace("−", "-").replace(",", ".");
    if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const commit = () => {
    if (draft === null) return;
    const n = parse(draft);
    // An empty or unparseable field snaps back to the last good value rather
    // than to min: clearing a box and tabbing away is not a request for -20.
    const next = n === null ? value : normalise(n);
    setDraft(null);
    if (next !== value) onValueChange(next);
  };

  const fraction = (n: number) => (max === min ? 0 : (n - min) / (max - min));
  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <Field data-slot="slider-field" data-disabled={disabled || undefined} className={cn("gap-3", className)}>
      <FieldLabel id={labelId} htmlFor={inputId}>
        {label}
      </FieldLabel>
      {description ? <FieldDescription className="-mt-1.5">{description}</FieldDescription> : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          // The real <input> lives in the thumb; labelledby reaches it, a
          // root aria-label does not.
          aria-labelledby={labelId}
          aria-describedby={recommended !== undefined ? hintId : undefined}
          onValueChange={(next) => {
            const n = Array.isArray(next) ? next[0] : next;
            if (n === undefined) return;
            setDraft(null);
            onValueChange(n);
          }}
        />

        <InputGroup className="w-24">
          <InputGroupInput
            id={inputId}
            // Signed ranges need a minus key, which the numeric keypads lack.
            inputMode={min < 0 ? "text" : "decimal"}
            autoComplete="off"
            disabled={disabled}
            className="text-right tabular-nums"
            aria-describedby={recommended !== undefined ? hintId : undefined}
            value={draft ?? String(value)}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = parse(e.target.value);
              // Live, but clamped: the thumb cannot leave the track, so it
              // should not be asked to.
              if (n !== null) {
                const clamped = Math.min(max, Math.max(min, n));
                if (clamped !== value) onValueChange(clamped);
              }
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              // The arrow keys a number input would have given for free.
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const base = (draft !== null ? parse(draft) : null) ?? value;
                const next = normalise(base + (e.key === "ArrowUp" ? step : -step));
                setDraft(null);
                if (next !== value) onValueChange(next);
              }
            }}
          />
          {unit ? (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{unit}</InputGroupText>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        {marks?.length ? (
          <div
            aria-hidden
            data-slot="slider-field-marks"
            className="text-muted-foreground relative h-4 text-xs tabular-nums"
          >
            {marks.map((mark) => {
              const f = fraction(mark);
              const isRecommended = mark === recommended;
              // The end labels hug the track ends instead of centring on the
              // thumb, which would push half of "−20" outside the field.
              const style: React.CSSProperties =
                f <= 0
                  ? { left: 0 }
                  : f >= 1
                    ? { right: 0 }
                    : { left: `calc(6px + (100% - 12px) * ${f})`, transform: "translateX(-50%)" };
              return (
                <span
                  key={mark}
                  style={style}
                  className={cn(
                    "absolute top-0 whitespace-nowrap",
                    isRecommended && "text-foreground font-medium",
                  )}
                >
                  {formatSigned(mark)}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {recommended !== undefined ? (
        <FieldDescription id={hintId} className="text-xs">
          Recommended: {formatSigned(recommended)}
          {unitSuffix}
        </FieldDescription>
      ) : null}
    </Field>
  );
}
