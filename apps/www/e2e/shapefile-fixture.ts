/**
 * A real zipped shapefile, built in memory for the upload test.
 *
 * Checked-in binary fixtures are unreadable in a diff and go stale without
 * anyone noticing. Written out here, the bytes that matter -- the record
 * layout, the field widths, the zip's own directory -- are legible, and the
 * test exercises the same path a city's export takes: a zip, inflated, with
 * geometry, names and a coordinate system in three separate files.
 *
 * Entries are stored rather than deflated, which a zip is allowed to be and
 * which keeps this to a writer rather than a compressor.
 */

type Ring = [number, number][];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function shp(rings: Ring[]): Uint8Array {
  const bodies = rings.map((ring) => {
    const body = new ArrayBuffer(48 + ring.length * 16);
    const v = new DataView(body);
    v.setInt32(0, 5, true); // Polygon
    v.setInt32(36, 1, true); // one part
    v.setInt32(40, ring.length, true);
    v.setInt32(44, 0, true); // starting at point 0
    ring.forEach(([x, y], i) => {
      v.setFloat64(48 + i * 16, x, true);
      v.setFloat64(56 + i * 16, y, true);
    });
    return new Uint8Array(body);
  });

  const size = 100 + bodies.reduce((n, b) => n + 8 + b.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setInt32(0, 9994, false); // the file code every .shp starts with
  view.setInt32(24, size / 2, false); // length, in 16-bit words
  view.setInt32(28, 1000, true);
  view.setInt32(32, 5, true);
  let at = 100;
  bodies.forEach((body, i) => {
    view.setInt32(at, i + 1, false);
    view.setInt32(at + 4, body.length / 2, false);
    out.set(body, at + 8);
    at += 8 + body.length;
  });
  return out;
}

function dbf(names: string[], width = 24): Uint8Array {
  const headerLength = 65;
  const recordLength = 1 + width;
  const out = new Uint8Array(headerLength + names.length * recordLength + 1);
  const view = new DataView(out.buffer);
  out[0] = 0x03;
  view.setUint32(4, names.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  "NAME".split("").forEach((c, i) => (out[32 + i] = c.charCodeAt(0)));
  out[32 + 11] = "C".charCodeAt(0);
  out[32 + 16] = width;
  out[64] = 0x0d; // end of the field list
  names.forEach((name, row) => {
    const at = headerLength + row * recordLength;
    out[at] = 0x20;
    for (let i = 0; i < width; i++) {
      out[at + 1 + i] = i < name.length ? name.charCodeAt(i) : 0x20;
    }
  });
  out[out.length - 1] = 0x1a; // the end-of-file byte dBASE writes
  return out;
}

function zip(files: { name: string; bytes: Uint8Array }[]): Buffer {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.bytes);

    const local = new Uint8Array(30 + name.length + file.bytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.bytes.length, true);
    lv.setUint32(22, file.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(file.bytes, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true); // stored
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.bytes.length, true);
    cv.setUint32(24, file.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return Buffer.concat([...locals, ...centrals, end].map((a) => Buffer.from(a)));
}

/* Clockwise, which is how a shapefile marks an outline rather than a hole. */
const BLOCK = (west: number, south: number): Ring => [
  [west, south],
  [west, south + 0.008],
  [west + 0.008, south + 0.008],
  [west + 0.008, south],
  [west, south],
];

const WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const SWEREF =
  'PROJCS["SWEREF99_TM",GEOGCS["GCS_SWEREF99",DATUM["D_SWEREF99",SPHEROID["GRS_1980",6378137.0,298.257222101]]],PROJECTION["Transverse_Mercator"],UNIT["Meter",1.0]]';

/** Two Lisbon blocks, named, in the system named by `projection`. */
export function zippedShapefile(projection: "wgs84" | "sweref" = "wgs84") {
  return zip([
    { name: "zones/Zones.shp", bytes: shp([BLOCK(-9.15, 38.71), BLOCK(-9.13, 38.73)]) },
    { name: "zones/Zones.dbf", bytes: dbf(["Baixa core", "Alfama edge"]) },
    {
      name: "zones/Zones.prj",
      bytes: new TextEncoder().encode(projection === "wgs84" ? WGS84 : SWEREF),
    },
  ]);
}
