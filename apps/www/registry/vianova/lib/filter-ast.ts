/**
 * The query model behind FilterBuilder.
 *
 * Deliberately a plain serialisable tree rather than a string: it round-trips
 * through a URL or a saved view, and the backend can compile it to SQL without
 * parsing anything. Nothing here imports React, so the same module validates
 * on the server.
 */

export type FilterFieldType = "string" | "number" | "date" | "boolean" | "enum";

export type FilterField = {
  name: string;
  label: string;
  type: FilterFieldType;
  /** Required for `enum`; ignored otherwise. */
  options?: { value: string; label: string }[];
  /** Shown after the value input, e.g. "min" or "km/h". */
  unit?: string;
};

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "starts-with"
  | "in"
  | "not-in"
  | "is-null"
  | "is-not-null";

export type FilterPrimitive = string | number | boolean;

export type FilterCondition = {
  id: string;
  kind: "condition";
  field: string;
  operator: FilterOperator;
  /** Scalar for most operators, a [min, max] pair for `between`, a list for `in`. */
  value?: FilterPrimitive | FilterPrimitive[] | null;
};

export type FilterGroup = {
  id: string;
  kind: "group";
  combinator: "and" | "or";
  children: FilterNode[];
};

export type FilterNode = FilterCondition | FilterGroup;

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "is",
  neq: "is not",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  between: "between",
  contains: "contains",
  "starts-with": "starts with",
  in: "is any of",
  "not-in": "is none of",
  "is-null": "is empty",
  "is-not-null": "is not empty",
};

/** Which operators make sense for each field type, in menu order. */
export const OPERATORS_BY_TYPE: Record<FilterFieldType, FilterOperator[]> = {
  string: ["eq", "neq", "contains", "starts-with", "in", "not-in", "is-null", "is-not-null"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is-null", "is-not-null"],
  date: ["eq", "neq", "gt", "lt", "between", "is-null", "is-not-null"],
  boolean: ["eq", "is-null", "is-not-null"],
  enum: ["eq", "neq", "in", "not-in", "is-null", "is-not-null"],
};

/** How many values an operator takes. `n` means a list of any length. */
export function arity(operator: FilterOperator): 0 | 1 | 2 | "n" {
  if (operator === "is-null" || operator === "is-not-null") return 0;
  if (operator === "between") return 2;
  if (operator === "in" || operator === "not-in") return "n";
  return 1;
}

/**
 * Monotonic ids rather than random ones.
 *
 * A filter tree is often built during the first render of a saved view, on the
 * server and again on the client. Random or time-based ids differ between the
 * two and React reports a hydration mismatch; a counter that starts at 1 in
 * each runtime produces the same ids in the same order.
 */
let sequence = 0;
export const nextFilterId = () => `f${++sequence}`;

export const newCondition = (field: string, operator: FilterOperator = "eq"): FilterCondition => ({
  id: nextFilterId(),
  kind: "condition",
  field,
  operator,
  value: arity(operator) === "n" ? [] : undefined,
});

export const newGroup = (combinator: "and" | "or" = "and", children: FilterNode[] = []): FilterGroup => ({
  id: nextFilterId(),
  kind: "group",
  combinator,
  children,
});

export const isGroup = (node: FilterNode): node is FilterGroup => node.kind === "group";

/** Depth-first walk, parents before children. */
export function walkFilter(node: FilterNode, visit: (node: FilterNode) => void): void {
  visit(node);
  if (isGroup(node)) node.children.forEach((child) => walkFilter(child, visit));
}

export function countConditions(node: FilterNode): number {
  let total = 0;
  walkFilter(node, (n) => {
    if (!isGroup(n)) total += 1;
  });
  return total;
}

/**
 * Replaces one node by id and returns a new tree.
 *
 * Returning a fresh tree rather than mutating keeps this usable straight from
 * a useState setter, and means an unchanged branch keeps its identity so React
 * can skip it.
 */
export function updateNode(tree: FilterNode, id: string, update: (node: FilterNode) => FilterNode): FilterNode {
  if (tree.id === id) return update(tree);
  if (!isGroup(tree)) return tree;

  let changed = false;
  const children = tree.children.map((child) => {
    const next = updateNode(child, id, update);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...tree, children } : tree;
}

/**
 * Removes a node by id.
 *
 * A group left with no children is removed too, rather than lingering as an
 * empty box the user has to clean up by hand. The root always survives.
 */
export function removeNode(tree: FilterNode, id: string): FilterNode {
  if (!isGroup(tree)) return tree;

  let changed = false;
  const children: FilterNode[] = [];
  for (const child of tree.children) {
    if (child.id === id) {
      changed = true;
      continue;
    }
    const next = removeNode(child, id);
    if (next !== child) changed = true;
    if (isGroup(next) && next.children.length === 0) continue;
    children.push(next);
  }
  return changed ? { ...tree, children } : tree;
}

export function appendTo(tree: FilterNode, groupId: string, node: FilterNode): FilterNode {
  return updateNode(tree, groupId, (target) =>
    isGroup(target) ? { ...target, children: [...target.children, node] } : target,
  );
}

export type FilterIssue = { id: string; message: string };

/**
 * Reports conditions that cannot be executed yet.
 *
 * Incompleteness is not an error state to shout about -- a half-built row is
 * the normal condition of a filter being edited -- so this returns issues for
 * the caller to render quietly and to gate Apply on, rather than throwing.
 */
export function validateFilter(tree: FilterNode, fields: FilterField[]): FilterIssue[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const issues: FilterIssue[] = [];

  walkFilter(tree, (node) => {
    if (isGroup(node)) {
      if (!node.children.length) issues.push({ id: node.id, message: "Group is empty." });
      return;
    }

    const field = byName.get(node.field);
    if (!field) {
      issues.push({ id: node.id, message: `Unknown field "${node.field}".` });
      return;
    }
    if (!OPERATORS_BY_TYPE[field.type].includes(node.operator)) {
      issues.push({
        id: node.id,
        message: `${OPERATOR_LABELS[node.operator]} does not apply to ${field.label}.`,
      });
      return;
    }

    const needed = arity(node.operator);
    const value = node.value;

    if (needed === 0) return;
    if (needed === "n") {
      if (!Array.isArray(value) || value.length === 0) {
        issues.push({ id: node.id, message: "Pick at least one value." });
      }
      return;
    }
    if (needed === 2) {
      const pair = Array.isArray(value) ? value : [];
      if (pair.length !== 2 || pair.some((v) => v === "" || v === undefined || v === null)) {
        issues.push({ id: node.id, message: "Needs both a lower and an upper bound." });
      } else if (field.type === "number" && Number(pair[0]) > Number(pair[1])) {
        issues.push({ id: node.id, message: "Lower bound is above the upper bound." });
      }
      return;
    }
    if (value === undefined || value === null || value === "") {
      issues.push({ id: node.id, message: "Needs a value." });
    }
  });

  return issues;
}

/** True when every condition is executable. */
export const isFilterComplete = (tree: FilterNode, fields: FilterField[]) =>
  validateFilter(tree, fields).length === 0;

function formatValue(node: FilterCondition, field: FilterField | undefined): string {
  const label = (v: FilterPrimitive) =>
    field?.type === "enum"
      ? (field.options?.find((o) => o.value === String(v))?.label ?? String(v))
      : String(v);

  const unit = field?.unit ? ` ${field.unit}` : "";
  if (Array.isArray(node.value)) {
    return node.operator === "between"
      ? `${label(node.value[0]!)}${unit} and ${label(node.value[1]!)}${unit}`
      : node.value.map(label).join(", ");
  }
  return node.value === undefined || node.value === null ? "…" : `${label(node.value)}${unit}`;
}

/** One condition as a sentence, e.g. `Mode is any of Car, Bike`. */
export function describeCondition(node: FilterCondition, fields: FilterField[]): string {
  const field = fields.find((f) => f.name === node.field);
  const head = `${field?.label ?? node.field} ${OPERATOR_LABELS[node.operator]}`;
  return arity(node.operator) === 0 ? head : `${head} ${formatValue(node, field)}`;
}

/** The whole tree as a sentence, parenthesised where the combinator changes. */
export function describeFilter(tree: FilterNode, fields: FilterField[]): string {
  if (!isGroup(tree)) return describeCondition(tree, fields);
  if (!tree.children.length) return "";

  const parts = tree.children.map((child) => {
    const text = describeFilter(child, fields);
    return isGroup(child) && child.children.length > 1 ? `(${text})` : text;
  });
  return parts.filter(Boolean).join(tree.combinator === "and" ? " and " : " or ");
}

/**
 * Strips ids so two equivalent filters compare equal.
 *
 * Ids are render bookkeeping, not part of the query. Keeping them in a saved
 * view or a URL means the same filter written twice looks like two filters.
 */
export function toQuery(tree: FilterNode): unknown {
  if (!isGroup(tree)) {
    const { id: _id, kind: _kind, ...rest } = tree;
    return rest;
  }
  return { combinator: tree.combinator, children: tree.children.map(toQuery) };
}

export const serializeFilter = (tree: FilterNode): string => JSON.stringify(toQuery(tree));

/** Rebuilds a tree from `toQuery` output, assigning fresh ids. */
export function fromQuery(value: unknown): FilterNode {
  const node = value as Record<string, unknown>;
  if (node && Array.isArray(node.children)) {
    return {
      id: nextFilterId(),
      kind: "group",
      combinator: node.combinator === "or" ? "or" : "and",
      children: node.children.map(fromQuery),
    };
  }
  return {
    id: nextFilterId(),
    kind: "condition",
    field: String(node?.field ?? ""),
    operator: (node?.operator as FilterOperator) ?? "eq",
    value: node?.value as FilterCondition["value"],
  };
}
