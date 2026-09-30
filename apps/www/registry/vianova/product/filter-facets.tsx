"use client";

import {
  CalendarIcon,
  HashIcon,
  ListIcon,
  ToggleLeftIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import {
  newCondition,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
} from "@/registry/vianova/lib/filter-ast";
import { Button } from "@/registry/vianova/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/registry/vianova/ui/combobox";
import { Input } from "@/registry/vianova/ui/input";
import { Slider } from "@/registry/vianova/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/vianova/ui/toggle-group";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * One typed control per field, instead of a generic condition builder.
 *
 * A builder asks the reader to choose a field, then an operator, then a value,
 * for every question they want to ask. That is the right tool when the
 * questions are open-ended. It is the wrong one for exploring a layer, where
 * the fields are known, few, and asked about the same way every time: a range
 * on a number, a set of values on a category, yes or no on a flag. Here the
 * whole vocabulary is on screen at once and each control already knows what
 * its field can be.
 *
 * It edits the SAME filter tree the builder does, and the map and the charts
 * both read that tree through one compiler, so no view can disagree with
 * another about what is selected.
 *
 * Conditions this component has no facet for -- a nested group, an operator
 * outside the canonical one per type -- are passed through untouched rather
 * than dropped. Someone who built something more specific elsewhere does not
 * lose it by touching a slider here.
 */

/** The operator each field type is edited with. */
const FACET_OPERATOR: Record<FilterField["type"], FilterOperator> = {
  number: "between",
  date: "between",
  enum: "in",
  string: "in",
  boolean: "eq",
};

const FIELD_ICON: Record<
  FilterField["type"],
  React.ComponentType<{ className?: string }>
> = {
  number: HashIcon,
  date: CalendarIcon,
  enum: ListIcon,
  string: TypeIcon,
  boolean: ToggleLeftIcon,
};

/** Min and max actually present in the data, per numeric field. */
export type FacetBounds = Record<string, { min: number; max: number }>;

/** Selectable values per enum/string field, when they are not on the field. */
export type FacetChoices = Record<string, { value: string; label: string }[]>;

function isCondition(node: FilterNode): node is FilterCondition {
  return node.kind === "condition";
}

function FilterFacets({
  fields,
  value,
  onValueChange,
  bounds = {},
  choices = {},
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  fields: FilterField[];
  value: FilterGroup;
  onValueChange: (next: FilterGroup) => void;
  /**
   * Range limits per numeric field. A slider without them would invent its own
   * scale and let the reader ask for a range the data cannot answer.
   */
  bounds?: FacetBounds;
  choices?: FacetChoices;
}) {
  // Labels are referenced by id from the range inputs, so two FilterFacets on
  // one page must not mint the same ids.
  const uid = React.useId();

  /** The condition this facet owns, if the reader has set one. */
  const facetOf = (field: FilterField) =>
    value.children.find(
      (child) =>
        isCondition(child) &&
        child.field === field.name &&
        child.operator === FACET_OPERATOR[field.type],
    ) as FilterCondition | undefined;

  const write = (field: FilterField, next: FilterCondition["value"] | null) => {
    const existing = facetOf(field);
    let children: FilterNode[];
    if (next === null) {
      children = value.children.filter((child) => child !== existing);
    } else if (existing) {
      children = value.children.map((child) =>
        child === existing ? { ...existing, value: next } : child,
      );
    } else {
      children = [
        ...value.children,
        {
          ...newCondition(field.name, FACET_OPERATOR[field.type]),
          value: next,
        },
      ];
    }
    onValueChange({ ...value, children });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      {fields.map((field) => {
        const condition = facetOf(field);
        const Icon = FIELD_ICON[field.type];
        return (
          <div
            key={field.name}
            data-slot="filter-facet"
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1.5">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span id={`${uid}-${field.name}`} className="text-xs font-medium">
                {field.label}
              </span>
              {field.unit ? (
                <span className="text-[11px] text-muted-foreground">
                  {field.unit}
                </span>
              ) : null}
              {condition ? (
                <Button
                  variant="ghost"
                  size="icon"
                  // Only on a set facet: a clear button on an untouched control
                  // is a button that does nothing, on every row, forever.
                  className="ml-auto size-5 text-muted-foreground"
                  aria-label={`Clear ${field.label} filter`}
                  onClick={() => write(field, null)}
                >
                  <XIcon className="size-3" />
                </Button>
              ) : null}
            </div>

            <FacetControl
              field={field}
              labelId={`${uid}-${field.name}`}
              condition={condition}
              bounds={bounds[field.name]}
              choices={field.options ?? choices[field.name] ?? []}
              onWrite={(next) => write(field, next)}
            />
          </div>
        );
      })}
    </div>
  );
}

function FacetControl({
  field,
  labelId,
  condition,
  bounds,
  choices,
  onWrite,
}: {
  field: FilterField;
  labelId: string;
  condition: FilterCondition | undefined;
  bounds: { min: number; max: number } | undefined;
  choices: { value: string; label: string }[];
  onWrite: (next: FilterCondition["value"] | null) => void;
}) {
  if (field.type === "number") {
    return (
      <RangeFacet
        label={field.label}
        labelId={labelId}
        condition={condition}
        bounds={bounds}
        onWrite={onWrite}
      />
    );
  }

  if (field.type === "boolean") {
    const current = condition?.value;
    return (
      <ToggleGroup
        value={
          current === undefined || current === null ? [] : [String(current)]
        }
        onValueChange={(next: string[]) => {
          const picked = next[next.length - 1];
          onWrite(picked === undefined ? null : picked === "true");
        }}
        variant="outline"
        size="sm"
        className="w-fit"
      >
        <ToggleGroupItem value="true">Yes</ToggleGroupItem>
        <ToggleGroupItem value="false">No</ToggleGroupItem>
      </ToggleGroup>
    );
  }

  if (field.type === "date") {
    // Two native date inputs rather than a bespoke range calendar. The
    // component has to do something coherent for a declared field type, and a
    // control invented here would be the only one in the system not exercised
    // by a real layer.
    const pair = Array.isArray(condition?.value) ? condition.value : [];
    const set = (index: 0 | 1, raw: string) => {
      const next = [String(pair[0] ?? ""), String(pair[1] ?? "")];
      next[index] = raw;
      onWrite(next[0] || next[1] ? next : null);
    };
    return (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={`${field.label} from`}
          value={String(pair[0] ?? "")}
          onChange={(e) => set(0, e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          type="date"
          aria-label={`${field.label} to`}
          value={String(pair[1] ?? "")}
          onChange={(e) => set(1, e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    );
  }

  // enum and string: pick from the values the data actually contains.
  const selected = Array.isArray(condition?.value)
    ? condition.value.map(String)
    : [];
  const labels = new Map(choices.map((c) => [c.value, c.label]));
  return (
    <Combobox
      items={choices.map((c) => c.value)}
      multiple
      value={selected}
      onValueChange={(next: string[]) => onWrite(next.length ? next : null)}
    >
      <ComboboxChips className="min-h-8 py-1">
        {selected.map((item) => (
          <ComboboxChip key={item} aria-label={labels.get(item) ?? item}>
            {labels.get(item) ?? item}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          placeholder={selected.length ? "" : "Select values"}
          className="text-xs"
        />
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>No match.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {labels.get(item) ?? item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * A two-handle slider with both ends editable as numbers.
 *
 * The slider is for finding a range, the inputs are for stating one. Offering
 * only the slider makes "exactly 50 to 80" a game of pixel-hunting; offering
 * only the inputs hides the shape of what is available.
 */
function RangeFacet({
  label,
  labelId,
  condition,
  bounds,
  onWrite,
}: {
  label: string;
  labelId: string;
  condition: FilterCondition | undefined;
  bounds: { min: number; max: number } | undefined;
  onWrite: (next: FilterCondition["value"] | null) => void;
}) {
  const min = bounds?.min ?? 0;
  const max = bounds?.max ?? 100;
  const pair = Array.isArray(condition?.value)
    ? condition.value.map(Number)
    : null;
  const lo = pair?.[0] ?? min;
  const hi = pair?.[1] ?? max;

  // A range covering everything is not a filter. Dropping the condition rather
  // than storing the full span keeps the count honest and the predicate cheap.
  const commit = (next: [number, number]) => {
    const clamped: [number, number] = [
      Math.max(min, Math.min(next[0], next[1])),
      Math.min(max, Math.max(next[0], next[1])),
    ];
    onWrite(clamped[0] <= min && clamped[1] >= max ? null : clamped);
  };

  if (!bounds) return null;

  /**
   * Spinner arrows removed, not for tidiness: they claim ~16px inside a box
   * this narrow, which clipped a five-digit bound ("19778" read as "1977").
   * A filter that misreports the range it covers is worse than an ugly one.
   */
  const numberBox =
    "h-7 w-16 shrink-0 px-1 text-center text-xs [appearance:textfield] " +
    "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        aria-label={`${label} minimum`}
        value={lo}
        min={min}
        max={max}
        onChange={(e) => commit([Number(e.target.value), hi])}
        className={numberBox}
      />
      <Slider
        value={[lo, hi]}
        min={min}
        max={max}
        onValueChange={(next: number | readonly number[]) => {
          if (Array.isArray(next)) commit([next[0]!, next[1]!]);
        }}
        // Base UI renders the real <input> inside Slider.Thumb, so aria-label
        // on the root never reaches it -- axe reports the range inputs as
        // unlabelled, at critical impact. aria-labelledby pointing at the
        // visible facet label does reach them.
        aria-labelledby={labelId}
        // flex-1 AND min-w-0: the slider's own `w-full` resolves against a flex
        // item that, without these, is sized by its (zero) content -- so the
        // track renders at no width and the row looks like two loose number
        // boxes with nothing between them.
        className="min-w-0 flex-1"
      />
      <Input
        type="number"
        aria-label={`${label} maximum`}
        value={hi}
        min={min}
        max={max}
        onChange={(e) => commit([lo, Number(e.target.value)])}
        className={numberBox}
      />
    </div>
  );
}

export { FilterFacets };
