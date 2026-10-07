/**
 * Reading a CSV in the browser, and guessing what its columns are.
 *
 * Deliberately small: no streaming, no schema. It exists so a data hub can show
 * a file the moment it is picked, without sending it anywhere.
 */

export type ColumnType = "id" | "category" | "geometry" | "timestamp" | "number" | "text";

export type InferredColumn = {
  name: string;
  type: ColumnType;
  /** Category columns only: distinct values, most frequent first. */
  values?: string[];
};

export type ParsedCsv = {
  delimiter: string;
  header: string[];
  rows: string[][];
};

const DELIMITERS = [",", ";", "\t", "|"] as const;

/** A column with this many distinct values or fewer is a category, not free text. */
export const CATEGORY_LIMIT = 20;

/**
 * The delimiter is whichever candidate appears most on the first line, outside
 * quotes. French and Belgian exports use ";" because "," is their decimal mark,
 * so assuming a comma would read a whole file as a single column.
 */
function detectDelimiter(text: string): string {
  const end = text.search(/\r\n|\r|\n/);
  const line = end === -1 ? text : text.slice(0, end);
  let best: string = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 fields: quoted values may hold delimiters, newlines and "" escapes. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      table.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // A file need not end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    table.push(row);
  }

  const nonEmpty = table.filter((r) => r.some((c) => c.trim() !== ""));
  const [header = [], ...rows] = nonEmpty;
  return { delimiter, header: header.map((h) => h.trim()), rows };
}

const GEOMETRY_WKT = /^(SRID=\d+;)?(MULTI)?(POINT|LINESTRING|POLYGON|GEOMETRYCOLLECTION)\b/i;
/** PostGIS EWKB/WKB as hex: a byte-order marker (00 or 01) then a long run of hex. */
const GEOMETRY_HEX = /^0[01][0-9a-f]{16,}$/i;
const GEOMETRY_GEOJSON = /^\{\s*"type"\s*:\s*"(Point|LineString|Polygon|Multi|Geometry|Feature)/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMBER = /^-?\d+([.,]\d+)?$/;

function isGeometry(v: string): boolean {
  return GEOMETRY_HEX.test(v) || GEOMETRY_WKT.test(v) || GEOMETRY_GEOJSON.test(v);
}

export function inferColumns({ header, rows }: Pick<ParsedCsv, "header" | "rows">): InferredColumn[] {
  return header.map((name, index) => {
    const cells = rows.map((r) => (r[index] ?? "").trim()).filter((v) => v !== "");
    if (cells.length === 0) return { name, type: "text" };

    if (cells.every(isGeometry)) return { name, type: "geometry" };
    if (cells.every((v) => TIMESTAMP.test(v))) return { name, type: "timestamp" };
    if (/(^|_|\s)id$/i.test(name) && cells.every((v) => !/\s/.test(v))) return { name, type: "id" };
    if (cells.every((v) => NUMBER.test(v))) return { name, type: "number" };

    const counts = new Map<string, number>();
    for (const v of cells) counts.set(v, (counts.get(v) ?? 0) + 1);
    if (counts.size <= CATEGORY_LIMIT) {
      const values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
      return { name, type: "category", values };
    }
    return { name, type: "text" };
  });
}
