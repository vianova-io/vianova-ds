"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { cn } from "@/registry/vianova/lib/utils";
import {
  appendTo,
  arity,
  isGroup,
  newCondition,
  newGroup,
  OPERATOR_LABELS,
  OPERATORS_BY_TYPE,
  removeNode,
  updateNode,
  validateFilter,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  type FilterPrimitive,
} from "@/registry/vianova/lib/filter-ast";

/**
 * Nested AND/OR filter builder over a set of typed fields.
 *
 * The tree it edits is the query itself (see lib/filter-ast), not a view model
 * that has to be translated on submit -- so what the user sees and what the
 * backend receives cannot drift apart.
 *
 * Validation is advisory rather than blocking: a half-built row is the normal
 * state of a filter mid-edit, so issues are shown quietly under the row and
 * `onValidityChange` lets the surrounding form gate Apply.
 */
export function FilterBuilder({
  fields,
  value,
  defaultValue,
  onValueChange,
  onValidityChange,
  maxDepth = 3,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  fields: FilterField[];
  value?: FilterGroup;
  defaultValue?: FilterGroup;
  onValueChange?: (next: FilterGroup) => void;
  onValidityChange?: (valid: boolean) => void;
  /** Nesting limit. Groups stop offering "Add group" at the last level. */
  maxDepth?: number;
}) {
  const [internal, setInternal] = React.useState<FilterGroup>(
    () => defaultValue ?? newGroup("and", [newCondition(fields[0]?.name ?? "")]),
  );
  const tree = value ?? internal;

  const issues = React.useMemo(() => validateFilter(tree, fields), [tree, fields]);
  const issueFor = (id: string) => issues.find((issue) => issue.id === id)?.message;

  const valid = issues.length === 0;
  React.useEffect(() => onValidityChange?.(valid), [valid, onValidityChange]);

  const apply = (next: FilterNode) => {
    const group = next as FilterGroup;
    if (value === undefined) setInternal(group);
    onValueChange?.(group);
  };

  return (
    <div data-slot="filter-builder" className={cn("space-y-2", className)} {...props}>
      <FilterGroupEditor
        group={tree}
        fields={fields}
        depth={0}
        maxDepth={maxDepth}
        issueFor={issueFor}
        onChange={apply}
        tree={tree}
      />
    </div>
  );
}

function FilterGroupEditor({
  group,
  fields,
  depth,
  maxDepth,
  issueFor,
  onChange,
  tree,
  onRemove,
}: {
  group: FilterGroup;
  fields: FilterField[];
  depth: number;
  maxDepth: number;
  issueFor: (id: string) => string | undefined;
  onChange: (next: FilterNode) => void;
  tree: FilterNode;
  onRemove?: () => void;
}) {
  const setCombinator = (combinator: string) =>
    onChange(updateNode(tree, group.id, (n) => ({ ...(n as FilterGroup), combinator: combinator as "and" | "or" })));

  return (
    <div
      data-slot="filter-group"
      data-depth={depth}
      className={cn(
        "space-y-2",
        depth > 0 && "border-border/70 bg-muted/30 rounded-lg border border-dashed p-2",
      )}
    >
      <div className="flex items-center gap-2">
        <SegmentedControl
          size="sm"
          aria-label="Combine conditions with"
          className="w-28 shrink-0"
          value={group.combinator}
          onValueChange={setCombinator}
          items={[
            { value: "and", label: "AND" },
            { value: "or", label: "OR" },
          ]}
        />
        <span className="text-muted-foreground text-xs">
          {group.combinator === "and" ? "All must match" : "Any may match"}
        </span>
        <div className="flex-1" />
        {onRemove ? (
          <Button variant="ghost" size="icon-sm" aria-label="Remove group" onClick={onRemove}>
            <Trash2 />
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 pl-1">
        {group.children.map((child) =>
          isGroup(child) ? (
            <FilterGroupEditor
              key={child.id}
              group={child}
              fields={fields}
              depth={depth + 1}
              maxDepth={maxDepth}
              issueFor={issueFor}
              onChange={onChange}
              tree={tree}
              onRemove={() => onChange(removeNode(tree, child.id))}
            />
          ) : (
            <FilterConditionRow
              key={child.id}
              condition={child}
              fields={fields}
              issue={issueFor(child.id)}
              onChange={(next) => onChange(updateNode(tree, child.id, () => next))}
              onRemove={() => onChange(removeNode(tree, child.id))}
            />
          ),
        )}
      </div>

      <div className="flex gap-2 pl-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(appendTo(tree, group.id, newCondition(fields[0]?.name ?? "")))}
        >
          <Plus /> Condition
        </Button>
        {depth + 1 < maxDepth ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange(
                appendTo(
                  tree,
                  group.id,
                  // A nested group starts on the opposite combinator, which is
                  // the only reason to nest one in the first place.
                  newGroup(group.combinator === "and" ? "or" : "and", [
                    newCondition(fields[0]?.name ?? ""),
                  ]),
                ),
              )
            }
          >
            <Plus /> Group
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterConditionRow({
  condition,
  fields,
  issue,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  fields: FilterField[];
  issue?: string;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.name === condition.field) ?? fields[0];
  const operators = field ? OPERATORS_BY_TYPE[field.type] : [];

  // Base UI's Select yields `string | null`; null only on a programmatic
  // clear, which nothing here does, so it is treated as a no-op.
  const setField = (name: string | null) => {
    const next = name ? fields.find((f) => f.name === name) : undefined;
    if (!next) return;
    // Keep the operator when the new field still supports it, so switching
    // between two numeric fields does not silently reset "at least" to "is".
    const operator = OPERATORS_BY_TYPE[next.type].includes(condition.operator)
      ? condition.operator
      : OPERATORS_BY_TYPE[next.type][0]!;
    onChange({ ...condition, field: next.name, operator, value: resetValue(operator) });
  };

  const setOperator = (operator: string | null) => {
    if (!operator) return;
    const next = operator as FilterOperator;
    const sameShape = arity(next) === arity(condition.operator);
    onChange({ ...condition, operator: next, value: sameShape ? condition.value : resetValue(next) });
  };

  return (
    <div data-slot="filter-condition" className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={condition.field} onValueChange={setField}>
          <SelectTrigger size="sm" className="w-40" aria-label="Field">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={condition.operator} onValueChange={setOperator}>
          <SelectTrigger size="sm" className="w-36" aria-label="Operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {field ? (
          <FilterValueInput
            condition={condition}
            field={field}
            invalid={Boolean(issue)}
            onChange={(value) => onChange({ ...condition, value })}
          />
        ) : null}

        <Button variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      {issue ? <p className="text-muted-foreground pl-1 text-xs">{issue}</p> : null}
    </div>
  );
}

const resetValue = (operator: FilterOperator): FilterCondition["value"] =>
  arity(operator) === "n" ? [] : arity(operator) === 2 ? ["", ""] : undefined;

function FilterValueInput({
  condition,
  field,
  invalid,
  onChange,
}: {
  condition: FilterCondition;
  field: FilterField;
  invalid: boolean;
  onChange: (value: FilterCondition["value"]) => void;
}) {
  const needed = arity(condition.operator);
  if (needed === 0) return null;

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  const scalar = Array.isArray(condition.value) ? "" : (condition.value ?? "");

  if (needed === 2) {
    const [min = "", max = ""] = Array.isArray(condition.value) ? condition.value : [];
    return (
      <div className="flex items-center gap-1">
        <Input
          type={inputType}
          aria-label="Lower bound"
          aria-invalid={invalid || undefined}
          className="h-8 w-24"
          value={String(min)}
          onChange={(e) => onChange([e.target.value, max])}
        />
        <span className="text-muted-foreground text-xs">and</span>
        <Input
          type={inputType}
          aria-label="Upper bound"
          aria-invalid={invalid || undefined}
          className="h-8 w-24"
          value={String(max)}
          onChange={(e) => onChange([min, e.target.value])}
        />
        {field.unit ? <span className="text-muted-foreground text-xs">{field.unit}</span> : null}
      </div>
    );
  }

  if (needed === "n") {
    const selected = (Array.isArray(condition.value) ? condition.value : []).map(String);
    const options = field.options ?? [];
    return (
      <Combobox
        items={options.map((o) => o.value)}
        multiple
        value={selected}
        onValueChange={(next: string[]) => onChange(next)}
      >
        <ComboboxChips className="min-w-52">
          {selected.map((v) => (
            <ComboboxChip key={v}>
              {options.find((o) => o.value === v)?.label ?? v}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            aria-label="Values"
            aria-invalid={invalid || undefined}
            placeholder={selected.length ? "" : "Pick values…"}
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No match.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {options.find((o) => o.value === item)?.label ?? item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  }

  if (field.type === "boolean" || field.type === "enum") {
    const options =
      field.type === "boolean"
        ? [
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]
        : (field.options ?? []);
    return (
      <Select
        value={String(scalar)}
        onValueChange={(next: string | null) =>
          onChange(next === null ? undefined : field.type === "boolean" ? next === "true" : next)
        }
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Value" aria-invalid={invalid || undefined}>
          <SelectValue placeholder="Pick a value" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type={inputType}
        aria-label="Value"
        aria-invalid={invalid || undefined}
        className="h-8 w-44"
        value={String(scalar)}
        onChange={(e) =>
          onChange(field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)
        }
      />
      {field.unit ? <span className="text-muted-foreground text-xs">{field.unit}</span> : null}
    </div>
  );
}

export type { FilterField, FilterGroup, FilterNode } from "@/registry/vianova/lib/filter-ast";
