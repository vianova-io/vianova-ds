/**
 * Reading an Esri shapefile in the browser, without a dependency.
 *
 * Cities hand over their zones as a shapefile far more often than as GeoJSON:
 * it is what their GIS exports, so a regulation tool that cannot read one
 * sends every city through a conversion step before they can begin. The
 * format is old and small -- a fixed header and a list of records -- so the
 * parts that matter are a few hundred lines rather than a library.
 *
 * A shapefile is never one file. The geometry is in `.shp`, the attributes
 * that name it in `.dbf`, and the coordinate system it is written in is in
 * `.prj`, which is why these arrive zipped and why the zip reader is here
 * too. Only `.shp` is required; without `.dbf` the shapes are numbered, and
 * without `.prj` they are taken at their word as longitude and latitude.
 */

import {
  circleAround,
  corridorAround,
  type Position,
} from "@/registry/vianova/lib/zone-geometry";

/** Carries a sentence meant for the person who chose the file. */
export class ShapefileError extends Error {}

/* -------------------------------------------------------------------------- */
/* Zip                                                                         */
/* -------------------------------------------------------------------------- */

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
/** End-of-central-directory, plus the longest comment it may carry. */
const EOCD_MAX_SCAN = 22 + 0xffff;

export type ZipEntry = { name: string; bytes: Uint8Array };

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // DecompressionStream is the platform's own inflate. Present in every
  // browser this design system targets; a project running these helpers under
  // an older runtime is the one case that needs a polyfill.
  if (typeof DecompressionStream === "undefined") {
    throw new ShapefileError(
      "This browser cannot unzip files. Unzip it yourself and choose the .shp.",
    );
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The files inside a zip, uncompressed.
 *
 * Read from the central directory at the end rather than by walking the local
 * headers from the front: a local header may say the sizes are "in the data
 * descriptor after the data", which cannot be followed without decompressing
 * blindly, while the central directory always carries the real sizes.
 */
export async function unzip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let eocd = -1;
  const from = Math.max(0, bytes.length - EOCD_MAX_SCAN);
  for (let i = bytes.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ShapefileError("This file is not a readable zip.");

  const total = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < total; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== ZIP_CENTRAL) {
      throw new ShapefileError("This zip's contents list is damaged.");
    }
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    at += 46 + nameLength + extraLength + commentLength;

    // Folders are entries too, and a zip from a Mac carries a __MACOSX copy of
    // every file that would otherwise read as a second, empty shapefile.
    if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue;

    const localNameLength = view.getUint16(localAt + 26, true);
    const localExtraLength = view.getUint16(localAt + 28, true);
    const start = localAt + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressed);
    if (method === 0) entries.push({ name, bytes: raw });
    else if (method === 8) entries.push({ name, bytes: await inflateRaw(raw) });
    else {
      throw new ShapefileError(
        `"${name}" uses a compression this reader does not know.`,
      );
    }
  }
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Geometry (.shp)                                                             */
/* -------------------------------------------------------------------------- */

const SHP_MAGIC = 9994;

/**
 * Shape types, by the number the format writes.
 *
 * The Z and M families (types 11-28) are the same geometry with a height or a
 * measure appended, and since those trail the x/y pairs rather than
 * interleaving with them, reading the first two doubles of each point reads
 * them all. That is why 3, 13 and 23 are one case here.
 */
const SHAPE_KIND: Record<number, "point" | "multipoint" | "line" | "area"> = {
  1: "point",
  11: "point",
  21: "point",
  8: "multipoint",
  18: "multipoint",
  28: "multipoint",
  3: "line",
  13: "line",
  23: "line",
  5: "area",
  15: "area",
  25: "area",
};

export type ShpGeometry =
  | { kind: "point"; points: Position[] }
  | { kind: "line"; parts: Position[][] }
  | { kind: "area"; parts: Position[][] };

/** Signed area of a ring. Positive is clockwise, which Esri uses for outers. */
function signedArea(ring: Position[]) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return sum / 2;
}

/** The geometry records of a .shp, in file order. Null shapes are dropped. */
export function parseShp(buffer: ArrayBuffer): ShpGeometry[] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 100 || view.getInt32(0, false) !== SHP_MAGIC) {
    throw new ShapefileError("This is not a .shp file.");
  }
  // The header's length is in 16-bit words, and counts the header itself.
  const end = Math.min(buffer.byteLength, view.getInt32(24, false) * 2);

  const out: ShpGeometry[] = [];
  let at = 100;
  while (at + 8 <= end) {
    const words = view.getInt32(at + 4, false);
    const content = at + 8;
    const length = words * 2;
    if (length <= 0 || content + length > buffer.byteLength) break;
    at = content + length;

    const kind = SHAPE_KIND[view.getInt32(content, true)];
    if (!kind) continue;

    const point = (offset: number): Position => [
      view.getFloat64(offset, true),
      view.getFloat64(offset + 8, true),
    ];

    if (kind === "point") {
      out.push({ kind: "point", points: [point(content + 4)] });
      continue;
    }
    if (kind === "multipoint") {
      const n = view.getInt32(content + 36, true);
      const points: Position[] = [];
      for (let i = 0; i < n; i++) points.push(point(content + 40 + i * 16));
      out.push({ kind: "point", points });
      continue;
    }

    // Polygons and polylines share a layout: a bounding box, then the index
    // at which each part starts within one flat list of points.
    const partCount = view.getInt32(content + 36, true);
    const pointCount = view.getInt32(content + 40, true);
    const partsAt = content + 44;
    const pointsAt = partsAt + partCount * 4;
    const starts: number[] = [];
    for (let i = 0; i < partCount; i++) {
      starts.push(view.getInt32(partsAt + i * 4, true));
    }
    const parts: Position[][] = [];
    for (let i = 0; i < partCount; i++) {
      const stop = i + 1 < partCount ? starts[i + 1]! : pointCount;
      const part: Position[] = [];
      for (let p = starts[i]!; p < stop; p++) {
        part.push(point(pointsAt + p * 16));
      }
      if (part.length) parts.push(part);
    }
    out.push({ kind, parts });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Attributes (.dbf)                                                           */
/* -------------------------------------------------------------------------- */

/** Where a name is most likely to be, in the languages these files arrive in. */
const NAME_FIELDS =
  /^(name|nom|nome|namn|naam|nombre|label|titre|titel|zone|zone_name|street|gatunamn|strasse|designation)$/i;

/**
 * The text column that names each record, if the file has one.
 *
 * dBASE is fixed-width: every field is a fixed number of bytes, padded with
 * spaces, with no separator. The header says how wide each is, so a record is
 * read by walking those widths. Bytes are latin-1, which is what a GIS writes
 * unless its own header byte says otherwise -- and reading an accented street
 * name as latin-1 beats refusing the file over its encoding.
 */
export function parseDbfNames(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 33) return [];
  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const bytes = new Uint8Array(buffer);

  const fields: { name: string; type: string; length: number }[] = [];
  for (let at = 32; at + 32 <= headerLength; at += 32) {
    if (bytes[at] === 0x0d) break;
    const raw = bytes.subarray(at, at + 11);
    const zero = raw.indexOf(0);
    fields.push({
      name: String.fromCharCode(...raw.subarray(0, zero < 0 ? 11 : zero)),
      type: String.fromCharCode(bytes[at + 11]!),
      length: bytes[at + 16]!,
    });
  }

  const text = fields.filter((f) => f.type === "C");
  const chosen = text.find((f) => NAME_FIELDS.test(f.name)) ?? text[0];
  if (!chosen) return [];
  let offset = 1; // The first byte of a record says whether it was deleted.
  for (const field of fields) {
    if (field === chosen) break;
    offset += field.length;
  }

  const names: string[] = [];
  for (let i = 0; i < records; i++) {
    const at = headerLength + i * recordLength;
    if (at + recordLength > bytes.length) break;
    if (bytes[at] === 0x2a) continue; // '*' marks a deleted record.
    const raw = bytes.subarray(at + offset, at + offset + chosen.length);
    names.push(String.fromCharCode(...raw).trim());
  }
  return names;
}

/* -------------------------------------------------------------------------- */
/* Coordinate system (.prj)                                                    */
/* -------------------------------------------------------------------------- */

export type Projection =
  | { kind: "wgs84" }
  | { kind: "webmercator" }
  | { kind: "unknown"; name: string };

/**
 * What a .prj says the coordinates are in.
 *
 * This matters more than it looks. A Swedish file in SWEREF99 holds numbers
 * like 6176000, and taken as degrees those land in the sea off west Africa --
 * silently, with no error anywhere, because they are perfectly good numbers.
 * So anything not recognised is named and refused rather than drawn.
 *
 * Two are recognised. WGS84 is already longitude and latitude. Web Mercator
 * is metres on a sphere and converts back exactly, with no parameters to get
 * wrong, so it is worth the dozen lines. Everything else needs a projection
 * library and a datum shift, which is a dependency this does not take.
 */
export function readProjection(wkt: string): Projection {
  const text = wkt.toUpperCase();
  const projected = text.includes("PROJCS");
  if (!projected) {
    if (text.includes("WGS_1984") || text.includes("WGS 84")) {
      return { kind: "wgs84" };
    }
    if (text.includes("GEOGCS")) {
      // A geographic system on another datum is still degrees, and within a
      // few metres of WGS84 everywhere a city cares about.
      return { kind: "wgs84" };
    }
  } else if (
    text.includes("MERCATOR_AUXILIARY_SPHERE") ||
    text.includes("WGS_1984_WEB_MERCATOR") ||
    text.includes("PSEUDO-MERCATOR") ||
    text.includes("3857")
  ) {
    return { kind: "webmercator" };
  }
  const named = /(?:PROJCS|GEOGCS)\s*\[\s*"([^"]+)"/i.exec(wkt);
  return { kind: "unknown", name: named?.[1] ?? "an unnamed system" };
}

const EARTH_RADIUS_M = 6_378_137;

/** Web Mercator metres back to longitude and latitude. */
function fromWebMercator([x, y]: Position): Position {
  return [
    (x / EARTH_RADIUS_M) * (180 / Math.PI),
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) *
      (180 / Math.PI),
  ];
}

/* -------------------------------------------------------------------------- */
/* The whole bundle                                                            */
/* -------------------------------------------------------------------------- */

export type ShapefileZone = { name: string; ring: Position[] };

/**
 * Turns the files of a shapefile into zone outlines, or a sentence saying why
 * it could not.
 *
 * Shares its rules with the paste box, so a city gets the same zones whichever
 * way the same data arrives: one zone per outer ring, holes dropped, and
 * points and lines only becoming zones when given a radius.
 */
export function readShapefile(
  files: { shp: ArrayBuffer; dbf?: ArrayBuffer; prj?: string },
  opts: { radiusMeters?: number } = {},
): { zones: ShapefileZone[] } | { error: string } {
  const radius = opts.radiusMeters ?? 0;
  try {
    const projection = files.prj
      ? readProjection(files.prj)
      : ({ kind: "wgs84" } as Projection);
    if (projection.kind === "unknown") {
      return {
        error: `These shapes are in ${projection.name}, which this reader cannot convert. Re-export them as WGS 84 (EPSG:4326).`,
      };
    }
    const toLngLat =
      projection.kind === "webmercator" ? fromWebMercator : (p: Position) => p;

    const geometries = parseShp(files.shp);
    const names = files.dbf ? parseDbfNames(files.dbf) : [];
    const zones: ShapefileZone[] = [];
    let needsRadius: "points" | "lines" | null = null;

    geometries.forEach((geometry, index) => {
      const given = names[index]?.trim();
      const rings: Position[][] = [];

      if (geometry.kind === "area") {
        // A hole is wound the other way round. A zone here is one outline, so
        // the holes go and each island becomes a zone of its own.
        for (const part of geometry.parts) {
          if (part.length >= 3 && signedArea(part) >= 0) rings.push(part);
        }
        // A file written counter-clockwise throughout would otherwise read as
        // all holes and no zones.
        if (!rings.length) {
          for (const part of geometry.parts) {
            if (part.length >= 3) rings.push(part);
          }
        }
      } else if (geometry.kind === "line") {
        if (radius > 0) {
          for (const part of geometry.parts) {
            if (part.length >= 2) {
              rings.push(corridorAround(part.map(toLngLat), radius / 2));
            }
          }
        } else needsRadius ??= "lines";
      } else if (radius > 0) {
        for (const p of geometry.points) {
          rings.push(circleAround(toLngLat(p), radius / 2));
        }
      } else needsRadius ??= "points";

      rings.forEach((ring, part) => {
        // Lines and points were converted before they were grown; areas are
        // still in the file's own numbers.
        const outline = geometry.kind === "area" ? ring.map(toLngLat) : ring;
        const n = zones.length + 1;
        const base = given || `Shape ${index + 1}`;
        zones.push({
          name: rings.length > 1 ? `${base} ${part + 1}` : base,
          ring: outline,
        });
      });
    });

    if (zones.length) return { zones };
    if (needsRadius === "lines") return { error: "Lines need a width above 0" };
    if (needsRadius === "points")
      return { error: "Points need a width above 0" };
    return { error: "This shapefile holds no shapes." };
  } catch (e) {
    if (e instanceof ShapefileError) return { error: e.message };
    return { error: "This shapefile could not be read." };
  }
}

/** Picks the .shp, .dbf and .prj out of whatever was dropped or unzipped. */
export function collectShapefileParts(entries: ZipEntry[]) {
  const by = (extension: string) =>
    entries.find((e) => e.name.toLowerCase().endsWith(extension));
  const shp = by(".shp");
  const dbf = by(".dbf");
  const prj = by(".prj");
  return {
    shp: shp?.bytes,
    dbf: dbf?.bytes,
    prj: prj ? new TextDecoder().decode(prj.bytes) : undefined,
    /** Every .shp found, so a bundle holding several can say so. */
    shpCount: entries.filter((e) => e.name.toLowerCase().endsWith(".shp"))
      .length,
  };
}
