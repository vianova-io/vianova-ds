import {
  arity,
  isGroup,
  type FilterCondition,
  type FilterField,
  type FilterNode,
  type FilterPrimitive,
} from "@/registry/vianova/lib/filter-ast";

/**
 * Runs a FilterBuilder tree against records in the browser.
 *
 * filter-ast describes the query and says a backend can compile it to SQL.
 * This is the other compiler: the one you need when the rows are already in
 * memory -- a GeoJSON layer, a loaded page of a grid -- and shipping the query
 * to a server to ask about data you are holding would be absurd.
 *
 * Deliberately one predicate for everything that has to agree. A map layer and
 * the charts beside it MUST select the same rows, and the surest way to
 * guarantee that is for both to call the same function rather than for one to
 * use a MapLibre filter expression and the other a JavaScript pass. Two
 * compilers are two chances to disagree, and the disagreement shows up as a
 * total that does not match the map -- quietly, and only for some filters.
 */

/** An incomplete condition constrains nothing. */
const UNCONSTRAINED = () => true;

/**
 * Values arrive from text inputs as strings, so `speed > "30"` would compare
 * lexically and put "5" above "30". The field's declared type decides how both
 * sides are read, never the runtime type of whatever was typed.
 */
function coerce(value: unknown, type: FilterField["type"]): string | number | boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  }
  if (type === "date") {
    const t = new Date(String(value)).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return String(value);
}

function conditionPredicate(
  node: FilterCondition,
  fields: FilterField[],
): (record: Record<string, unknown>) => boolean {
  const field = fields.find((f) => f.name === node.field);
  // An unknown field is a bug in the caller's field list, not a reason to hide
  // every row: filtering everything out looks like "no results" and sends the
  // reader hunting through their data instead of their configuration.
  if (!field) return UNCONSTRAINED;

  const type = field.type;
  const need = arity(node.operator);
  const raw = node.value;

  if (node.operator === "is-null" || node.operator === "is-not-null") {
    const wantNull = node.operator === "is-null";
    return (record) => {
      const v = record[field.name];
      const empty = v === null || v === undefined || v === "";
      return empty === wantNull;
    };
  }

  if (need === "n") {
    const list = (Array.isArray(raw) ? raw : []).map((v) => coerce(v, type));
    if (!list.length) return UNCONSTRAINED;
    const set = new Set(list);
    const wantIn = node.operator === "in";
    return (record) => set.has(coerce(record[field.name], type)) === wantIn;
  }

  if (need === 2) {
    const pair = Array.isArray(raw) ? raw : [];
    const lo = coerce(pair[0], type);
    const hi = coerce(pair[1], type);
    if (lo === null || hi === null) return UNCONSTRAINED;
    // Inclusive at both ends, matching how the range reads in the chip bar:
    // "between 30 and 50" plainly includes 30 and 50.
    return (record) => {
      const v = coerce(record[field.name], type);
      return v !== null && v >= lo && v <= hi;
    };
  }

  const want = coerce(raw as FilterPrimitive, type);
  if (want === null) return UNCONSTRAINED;

  switch (node.operator) {
    case "eq":
      return (r) => coerce(r[field.name], type) === want;
    case "neq":
      return (r) => coerce(r[field.name], type) !== want;
    case "gt":
      return (r) => {
        const v = coerce(r[field.name], type);
        return v !== null && v > want;
      };
    case "gte":
      return (r) => {
        const v = coerce(r[field.name], type);
        return v !== null && v >= want;
      };
    case "lt":
      return (r) => {
        const v = coerce(r[field.name], type);
        return v !== null && v < want;
      };
    case "lte":
      return (r) => {
        const v = coerce(r[field.name], type);
        return v !== null && v <= want;
      };
    // Case-insensitive, because nobody typing a road name into a filter box
    // means "and mind the capitals".
    case "contains": {
      const needle = String(want).toLowerCase();
      return (r) => String(r[field.name] ?? "").toLowerCase().includes(needle);
    }
    case "starts-with": {
      const prefix = String(want).toLowerCase();
      return (r) => String(r[field.name] ?? "").toLowerCase().startsWith(prefix);
    }
    default:
      return UNCONSTRAINED;
  }
}

/**
 * Compiles a filter tree into a single predicate.
 *
 * Compiled once per tree rather than walked per record: the tree is small and
 * the records are not, so resolving fields and coercing the query's own values
 * 7,000 times over is pure waste.
 *
 * An empty group passes everything. That is the state a filter panel opens in,
 * and it should show you your data, not an empty map.
 */
export function compileFilter(
  tree: FilterNode,
  fields: FilterField[],
): (record: Record<string, unknown>) => boolean {
  if (!isGroup(tree)) return conditionPredicate(tree, fields);

  const children = tree.children.map((child) => compileFilter(child, fields));
  if (!children.length) return UNCONSTRAINED;
  if (children.length === 1) return children[0]!;

  return tree.combinator === "or"
    ? (record) => children.some((fn) => fn(record))
    : (record) => children.every((fn) => fn(record));
}
