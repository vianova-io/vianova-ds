#!/usr/bin/env node
/**
 * Builds the rest of the data hub's sample catalogue, in public/data/: FAKE
 * Lisbon datasets for September 2026, to sit beside mds-trips-lisbon.csv and
 * infringements-lisbon.csv.
 *
 *   mds-events-lisbon.csv         vehicle events (MDS "events"), as points
 *   mds-vehicles-lisbon.csv       a snapshot of every vehicle's status, as points
 *   parking-zones-lisbon.csv      parking, no-parking and slow zones, as polygons
 *   districts-lisbon.csv          twelve neighbourhoods, as polygons
 *   regulation-*.csv              four regulations, one row per area it covers
 *
 * They share the trips script's logic -- the same hotspots, hour-of-day demand,
 * operators and river -- so the datasets agree: a vehicle is where trips start,
 * a parking zone sits where vehicles are left, a regulation covers the centre.
 * Nothing here is real. Seeded, so the files are reproducible.
 *
 *   node scripts/build-datahub-samples.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(1);
const between = (lo, hi) => lo + (hi - lo) * rnd();
const int = (lo, hi) => Math.floor(between(lo, hi + 1));
const pick = (list) => list[Math.floor(rnd() * list.length)];
const gauss = (mean = 0, sd = 1) => mean + sd * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
function weighted(items, weightOf) {
  const weights = items.map(weightOf);
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
const uuid = () => {
  const hex = Array.from({ length: 32 }, () => int(0, 15).toString(16));
  hex[12] = "4";
  hex[16] = "89ab"[int(0, 3)];
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/* Geography: as build-mds-trips.mjs ------------------------------------------ */

const LAT0 = 38.73;
const COS = Math.cos((LAT0 * Math.PI) / 180);

function inside(polygon, [x, y]) {
  let on = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}
const RIVER = [
  [-9.223, 38.692], [-9.205, 38.6945], [-9.19, 38.6975], [-9.178, 38.7], [-9.165, 38.7035],
  [-9.1535, 38.705], [-9.144, 38.705], [-9.1365, 38.707], [-9.129, 38.709], [-9.1225, 38.712],
  [-9.113, 38.719], [-9.106, 38.73], [-9.1, 38.743], [-9.096, 38.755], [-9.088, 38.764],
  [-9.084, 38.77], [-9.07, 38.77], [-9.07, 38.67], [-9.23, 38.67],
];
const MONSANTO = [[-9.2, 38.715], [-9.17, 38.715], [-9.17, 38.735], [-9.2, 38.735]];
const allowed = (p) => !inside(RIVER, p) && !(inside(MONSANTO, p) && rnd() < 0.9);

const HOTSPOTS = [
  ["Baixa", -9.1393, 38.7139, 0.0035, 10, "mixed"],
  ["Chiado / Bairro Alto", -9.145, 38.711, 0.003, 7, "night"],
  ["Cais do Sodré", -9.144, 38.7062, 0.0025, 6, "night"],
  ["Alfama / Graça", -9.13, 38.715, 0.003, 4, "tourist"],
  ["Santa Apolónia", -9.1225, 38.714, 0.003, 3, "commute"],
  ["Marquês / Liberdade", -9.15, 38.725, 0.004, 7, "office"],
  ["Saldanha", -9.145, 38.735, 0.004, 7, "office"],
  ["Campo Pequeno", -9.145, 38.742, 0.004, 4, "office"],
  ["Alvalade / Roma", -9.14, 38.753, 0.005, 4, "mixed"],
  ["Areeiro", -9.133, 38.742, 0.004, 3, "mixed"],
  ["Estrela / Campo de Ourique", -9.16, 38.714, 0.005, 4, "mixed"],
  ["Alcântara / LX", -9.178, 38.703, 0.003, 3, "tourist"],
  ["Belém", -9.206, 38.697, 0.004, 4, "tourist"],
  ["Parque das Nações", -9.097, 38.765, 0.006, 6, "commute"],
  ["Marvila / Beato", -9.11, 38.735, 0.004, 1.5, "mixed"],
  ["Lumiar / Telheiras", -9.158, 38.764, 0.006, 1.5, "mixed"],
];

function demand(kind, hour, weekend) {
  const peak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const day = hour >= 10 && hour <= 18;
  const late = hour >= 20 || hour <= 2;
  switch (kind) {
    case "office": return weekend ? 0.25 : peak ? 3 : 1;
    case "commute": return weekend ? 0.8 : peak ? 3 : 1;
    case "tourist": return day ? 3 : hour >= 8 ? 1.2 : 0.4;
    case "night": return late ? 3 : day ? 1 : 0.4;
    default: return 1;
  }
}

function pointAt(hour, weekend, spread = 1) {
  for (let tries = 0; tries < 50; tries++) {
    const [, lng, lat, sd] = weighted(HOTSPOTS, (h) => h[4] * demand(h[5], hour, weekend));
    const p = [lng + (gauss(0, sd) * spread) / COS, lat + gauss(0, sd) * spread];
    if (allowed(p)) return p;
  }
  return [-9.1393, 38.7139];
}

const PROVIDERS = {
  Lime: { share: 0.32, vehicles: [["scooter", 15], ["bicycle", 14]] },
  Bolt: { share: 0.27, vehicles: [["scooter", 16]] },
  Dott: { share: 0.21, vehicles: [["scooter", 15], ["bicycle", 13]] },
  Voi: { share: 0.12, vehicles: [["scooter", 15]] },
  Gira: { share: 0.08, vehicles: [["bicycle", 12]] },
};
const NAMES = Object.keys(PROVIDERS);
const providerId = Object.fromEntries(NAMES.map((n) => [n, uuid()]));

/* Output -------------------------------------------------------------------- */

const cell = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function write(name, header, rows) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, name), [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n");
  console.log(`${name}: ${rows.length} rows`);
}
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const point = ([x, y]) => `POINT (${x.toFixed(5)} ${y.toFixed(5)})`;
const ring = (pts) => `POLYGON ((${[...pts, pts[0]].map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(", ")}))`;
const blob = ([x, y], r, sides = 8, wobble = 0.25) =>
  Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * 2 * Math.PI;
    const k = r * (1 + (rnd() - 0.5) * wobble);
    return [x + (Math.cos(a) * k) / COS, y + Math.sin(a) * k];
  });
const square = ([x, y], r) => [[x - r / COS, y - r], [x + r / COS, y - r], [x + r / COS, y + r], [x - r / COS, y + r]];

const START = Date.UTC(2026, 8, 1);
const DAY = 86_400_000;
function when() {
  const day = int(0, 29);
  const weekend = [0, 6].includes(new Date(START + day * DAY).getUTCDay());
  const hour = weighted([...Array(24).keys()], (h) => (weekend ? (h >= 10 && h <= 20 ? 3 : 1) : [7, 8, 9, 17, 18, 19].includes(h) ? 4 : h >= 10 && h <= 16 ? 2 : 0.6));
  return { ts: START + day * DAY + hour * 3_600_000 + int(0, 3599) * 1000, hour, weekend };
}

/* Events -------------------------------------------------------------------- */

rnd = mulberry32(20260903);
{
  const kinds = [
    ["trip_start", 30], ["trip_end", 30], ["reserve", 9], ["cancel_reservation", 2],
    ["rebalance_drop_off", 5], ["rebalance_pick_up", 5], ["low_battery", 8],
    ["maintenance", 3], ["provider_pick_up", 3], ["provider_drop_off", 3],
  ];
  const fleet = new Map();
  const rows = Array.from({ length: 3000 }, () => {
    const { ts, hour, weekend } = when();
    const provider = weighted(NAMES, (n) => PROVIDERS[n].share);
    const [vehicleType] = pick(PROVIDERS[provider].vehicles);
    const key = `${provider}-${int(1, 60)}`;
    if (!fleet.has(key)) fleet.set(key, uuid());
    const kind = weighted(kinds, (k) => k[1])[0];
    const battery = kind === "low_battery" ? int(3, 15) : kind === "maintenance" ? int(20, 80) : int(25, 100);
    return [ts, [uuid(), providerId[provider], provider, fleet.get(key), vehicleType, kind, battery, iso(ts), point(pointAt(hour, weekend))]];
  })
    .sort((a, b) => a[0] - b[0])
    .map((r) => r[1]);
  write("mds-events-lisbon.csv", ["event_id", "provider_id", "provider_name", "device_id", "vehicle_type", "event_type", "battery_pct", "event_time", "location"], rows);
}

/* Vehicle status ------------------------------------------------------------ */

rnd = mulberry32(20260904);
{
  const rows = Array.from({ length: 1500 }, () => {
    const provider = weighted(NAMES, (n) => PROVIDERS[n].share);
    const [vehicleType] = pick(PROVIDERS[provider].vehicles);
    const state = weighted(
      [["available", 62], ["reserved", 9], ["non_operational", 14], ["unknown", 4], ["removed", 11]],
      (s) => s[1],
    )[0];
    // Idle vehicles collect where demand is, in the evening.
    const p = pointAt(int(18, 23), false, 1.1);
    const battery = state === "non_operational" ? int(0, 18) : int(20, 100);
    return [uuid(), providerId[provider], provider, vehicleType, state, battery, iso(START + 30 * DAY - int(0, 3 * 3600) * 1000), point(p)];
  });
  write("mds-vehicles-lisbon.csv", ["device_id", "provider_id", "provider_name", "vehicle_type", "state", "battery_pct", "last_event_time", "location"], rows);
}

/* Parking zones ------------------------------------------------------------- */

rnd = mulberry32(20260905);
{
  const kinds = [["Parking bay", 52], ["No-parking zone", 24], ["Slow zone", 24]];
  const rows = [];
  for (let i = 0; i < 64; i++) {
    const kind = weighted(kinds, (k) => k[1])[0];
    const [name, lng, lat, sd] = weighted(HOTSPOTS, (h) => h[4]);
    let c = [lng + gauss(0, sd * 1.4) / COS, lat + gauss(0, sd * 1.4)];
    if (!allowed(c)) c = [lng, lat];
    const bay = kind === "Parking bay";
    const shape = bay ? square(c, 0.00022) : blob(c, kind === "Slow zone" ? 0.0035 : 0.0016);
    rows.push([
      `PZ-${String(i + 1).padStart(3, "0")}`,
      `${name} ${bay ? "bay" : kind === "Slow zone" ? "slow zone" : "restricted area"} ${i + 1}`,
      kind,
      bay ? int(8, 40) : "",
      kind === "Slow zone" ? 15 : "",
      ring(shape),
    ]);
  }
  write("parking-zones-lisbon.csv", ["zone_id", "name", "zone_type", "max_vehicles", "speed_limit_kmh", "geometry"], rows);
}

/* Districts ----------------------------------------------------------------- */

rnd = mulberry32(20260906);
{
  const districts = [
    ["Baixa", "Historic", -9.1393, 38.7139, 0.0045], ["Alfama", "Historic", -9.13, 38.7125, 0.0038],
    ["Chiado", "Historic", -9.1425, 38.7105, 0.0034], ["Cais do Sodré", "Waterfront", -9.144, 38.7065, 0.0032],
    ["Belém", "Waterfront", -9.206, 38.697, 0.005], ["Parque das Nações", "Waterfront", -9.097, 38.765, 0.0075],
    ["Avenidas Novas", "Business", -9.147, 38.736, 0.0065], ["Alvalade", "Residential", -9.14, 38.753, 0.0065],
    ["Campo de Ourique", "Residential", -9.16, 38.714, 0.0055], ["Arroios", "Residential", -9.135, 38.7285, 0.0048],
    ["Lumiar", "Residential", -9.158, 38.764, 0.007], ["Alcântara", "Business", -9.178, 38.7035, 0.0042],
  ];
  const rows = districts.map(([name, kind, lng, lat, r], i) => [
    `D-${String(i + 1).padStart(2, "0")}`, name, kind, Math.round((r / 0.0045) * 6200 + int(500, 3000)),
    ring(blob([lng, lat], r, 9, 0.35)),
  ]);
  write("districts-lisbon.csv", ["district_id", "name", "area_type", "population", "geometry"], rows);
}

/* Regulations --------------------------------------------------------------- */

const REGULATIONS = [
  {
    file: "regulation-speed-limit-baixa.csv", code: "SPD", seed: 20260910, rule: ["Speed limit 15 km/h"],
    areas: [["Baixa", 0.0042], ["Chiado", 0.003], ["Alfama", 0.0034], ["Cais do Sodré", 0.0028], ["Santa Apolónia", 0.0028]],
    operators: ["All operators"], from: "2026-03-01", to: "2026-12-31",
  },
  {
    file: "regulation-no-parking-historic-centre.csv", code: "NPK", seed: 20260911, rule: ["No parking", "No parking", "Parking bays only"],
    areas: [["Baixa", 0.0038], ["Alfama", 0.003], ["Graça", 0.0028], ["Chiado", 0.0026], ["Bairro Alto", 0.0026], ["Mouraria", 0.0024]],
    operators: ["All operators"], from: "2026-01-15", to: "2027-01-14",
  },
  {
    file: "regulation-fleet-cap-per-operator.csv", code: "CAP", seed: 20260912, rule: ["Fleet cap"],
    areas: [["Baixa", 0.005], ["Avenidas Novas", 0.0065], ["Parque das Nações", 0.0075], ["Belém", 0.005], ["Alvalade", 0.0065], ["Alcântara", 0.0042]],
    operators: NAMES, from: "2026-06-01", to: "2026-12-31",
  },
  {
    file: "regulation-night-curfew-bairro-alto.csv", code: "CUR", seed: 20260913, rule: ["Curfew 00:00-06:00", "Curfew 01:00-06:00"],
    areas: [["Bairro Alto", 0.0028], ["Cais do Sodré", 0.0028], ["Príncipe Real", 0.0022]],
    operators: ["All operators"], from: "2025-06-01", to: "2025-09-30",
  },
];
const CENTRES = {
  Baixa: [-9.1393, 38.7139], Chiado: [-9.1425, 38.7105], Alfama: [-9.13, 38.7125], "Cais do Sodré": [-9.144, 38.7065],
  "Santa Apolónia": [-9.1225, 38.714], Graça: [-9.1285, 38.7195], "Bairro Alto": [-9.1455, 38.7135], Mouraria: [-9.1355, 38.716],
  "Avenidas Novas": [-9.147, 38.736], "Parque das Nações": [-9.097, 38.765], Belém: [-9.206, 38.697], Alvalade: [-9.14, 38.753],
  Alcântara: [-9.178, 38.7035], "Príncipe Real": [-9.1495, 38.7165],
};
for (const reg of REGULATIONS) {
  rnd = mulberry32(reg.seed);
  const rows = [];
  let n = 0;
  for (const [area, r] of reg.areas)
    for (const operator of reg.operators.length > 1 && reg.operators[0] !== "All operators" ? reg.operators : [reg.operators[0]]) {
      const cap = reg.rule[0] === "Fleet cap" ? int(150, 900) : "";
      rows.push([
        `${reg.code}-${String(++n).padStart(3, "0")}`,
        area, pick(reg.rule), operator, cap, reg.from, reg.to,
        ring(blob(CENTRES[area], r, 8, 0.3)),
      ]);
    }
  write(reg.file, ["rule_id", "area", "rule", "applies_to", "vehicle_cap", "valid_from", "valid_to", "geometry"], rows);
}
