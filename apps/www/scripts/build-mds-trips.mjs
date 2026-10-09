#!/usr/bin/env node
/**
 * Builds public/data/mds-trips-lisbon.csv: a FAKE Mobility Data Specification
 * trips feed for shared scooters and bikes in Lisbon, September 2026.
 *
 * Nothing here is real operator data. What it does try to be is plausible
 * enough to design against, which a uniform scatter is not -- so:
 *
 *  - Trips start where people do: a weighted set of hotspots (the centre,
 *    offices, stations, the riverfront, tourist sites), with the mix shifting by
 *    hour and between weekdays and weekends.
 *  - Nothing starts in the Tagus, and almost nothing in Monsanto forest park.
 *  - A trip goes somewhere: its route runs from its start to a destination about
 *    as far away as the trip is long, not on a random walk.
 *  - Gira is a docked system, so its trips start and end at fixed stations.
 *
 * Seeded, so the file is reproducible: run it again and nothing changes unless
 * this script does.
 *
 *   node scripts/build-mds-trips.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "mds-trips-lisbon.csv");
const TRIPS = 2000;
const SEED = 20260901;

/* ----------------------------------------------------------------------------
 * Random numbers
 * ------------------------------------------------------------------------- */

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
const rnd = mulberry32(SEED);
const between = (lo, hi) => lo + (hi - lo) * rnd();
const int = (lo, hi) => Math.floor(between(lo, hi + 1));
const pick = (list) => list[Math.floor(rnd() * list.length)];
const gauss = (mean = 0, sd = 1) => {
  const u = 1 - rnd();
  const v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const lognormal = (median, sigma) => median * Math.exp(gauss(0, sigma));
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

/* ----------------------------------------------------------------------------
 * Geography
 * ------------------------------------------------------------------------- */

const LAT0 = 38.73;
/** Metres per degree at Lisbon's latitude. */
const M_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const M_LAT = 110_540;
const metres = (a, b) => Math.hypot((a[0] - b[0]) * M_LNG, (a[1] - b[1]) * M_LAT);

function inside(polygon, [x, y]) {
  let on = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}

/**
 * The Tagus: the city's waterfront from Belém to Parque das Nações, closed off
 * across the river. Approximate, which is all a scatter of fake trips needs.
 */
const RIVER = [
  [-9.223, 38.692], [-9.205, 38.6945], [-9.19, 38.6975], [-9.178, 38.7], [-9.165, 38.7035],
  [-9.1535, 38.705], [-9.144, 38.705], [-9.1365, 38.707], [-9.129, 38.709], [-9.1225, 38.712],
  [-9.113, 38.719], [-9.106, 38.73], [-9.1, 38.743], [-9.096, 38.755], [-9.088, 38.764],
  [-9.084, 38.77], [-9.07, 38.77], [-9.07, 38.67], [-9.23, 38.67],
];
/** Monsanto forest park: a large block of the west with almost no streets. */
const MONSANTO = [[-9.2, 38.715], [-9.17, 38.715], [-9.17, 38.735], [-9.2, 38.735]];

function allowed(p) {
  if (inside(RIVER, p)) return false;
  if (inside(MONSANTO, p) && rnd() < 0.9) return false;
  return true;
}

/**
 * Where people start, as [name, lng, lat, spread in degrees, weight, kind].
 * `kind` decides how the weight moves through the day.
 */
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

/** The riverside cycle path, Cais do Sodré to Belém: a ribbon, not a blob. */
const RIBBON = [
  [-9.144, 38.7066], [-9.1535, 38.7075], [-9.165, 38.7052], [-9.178, 38.7022],
  [-9.19, 38.6993], [-9.2, 38.6975], [-9.206, 38.6967],
];

function ribbonPoint() {
  const i = int(0, RIBBON.length - 2);
  const t = rnd();
  const [a, b] = [RIBBON[i], RIBBON[i + 1]];
  return [a[0] + (b[0] - a[0]) * t + gauss(0, 0.0004), a[1] + (b[1] - a[1]) * t + gauss(0, 0.0003)];
}

/** How much a kind of place is wanted at an hour, on a weekday or a weekend. */
function demand(kind, hour, weekend) {
  const peak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const day = hour >= 10 && hour <= 18;
  const late = hour >= 20 || hour <= 2;
  switch (kind) {
    case "office":
      return weekend ? 0.25 : peak ? 3 : 1;
    case "commute":
      return weekend ? 0.8 : peak ? 3 : 1;
    case "tourist":
      return day ? 3 : hour >= 8 ? 1.2 : 0.4;
    case "night":
      return late ? 3 : day ? 1 : 0.4;
    default:
      return 1;
  }
}

/** Voi runs a smaller area: the centre, and little out at the edges. */
const VOI_EDGES = new Set(["Belém", "Parque das Nações", "Lumiar / Telheiras", "Marvila / Beato"]);

function startPoint(provider, hour, weekend) {
  for (let tries = 0; tries < 50; tries++) {
    // The ribbon is a leisure route: it fills up on weekends and afternoons.
    const ribbonWeight = (weekend ? 7 : 3) * (hour >= 10 && hour <= 19 ? 1.6 : 0.5);
    const spot = weighted([...HOTSPOTS, "ribbon"], (h) => {
      if (h === "ribbon") return ribbonWeight;
      const [name, , , , weight, kind] = h;
      return weight * demand(kind, hour, weekend) * (provider === "Voi" && VOI_EDGES.has(name) ? 0.2 : 1);
    });
    const p =
      spot === "ribbon"
        ? ribbonPoint()
        : [spot[1] + gauss(0, spot[3]) / Math.cos((LAT0 * Math.PI) / 180), spot[2] + gauss(0, spot[3])];
    if (allowed(p)) return p;
  }
  return [-9.1393, 38.7139];
}

/* ----------------------------------------------------------------------------
 * Operators
 * ------------------------------------------------------------------------- */

const PROVIDERS = {
  Lime: { share: 0.32, vehicles: [["scooter", "electric", 15], ["bicycle", "electric_assist", 14]] },
  Bolt: { share: 0.27, vehicles: [["scooter", "electric", 16]] },
  Dott: { share: 0.21, vehicles: [["scooter", "electric", 15], ["bicycle", "electric_assist", 13]] },
  Voi: { share: 0.12, vehicles: [["scooter", "electric", 15]] },
  Gira: { share: 0.08, vehicles: [["bicycle", "electric_assist", 12]], docked: true },
};
const NAMES = Object.keys(PROVIDERS);

const providerId = Object.fromEntries(NAMES.map((n) => [n, uuid()]));

// A device keeps its type for life: the same scooter is not a bicycle tomorrow.
const fleet = Object.fromEntries(
  NAMES.map((n) => [
    n,
    Array.from({ length: Math.round(PROVIDERS[n].share * 400) }, () => ({
      id: uuid(),
      vehicle: pick(PROVIDERS[n].vehicles),
    })),
  ]),
);

// Gira's docking stations, spread like demand is and fixed for the whole month.
const STATIONS = [];
while (STATIONS.length < 70) {
  const p = startPoint("Gira", int(8, 19), false);
  if (STATIONS.every((s) => metres(s, p) > 250)) STATIONS.push(p);
}

/* ----------------------------------------------------------------------------
 * Trips
 * ------------------------------------------------------------------------- */

const HOUR_WEIGHTS = [1, 1, 1, 1, 1, 2, 4, 9, 12, 8, 6, 7, 9, 8, 7, 8, 10, 13, 12, 8, 5, 3, 2, 1];
const WEEKEND_HOUR_WEIGHTS = [3, 2, 1, 1, 1, 1, 2, 3, 4, 6, 8, 10, 11, 10, 10, 10, 10, 9, 8, 7, 6, 5, 4, 3];
/** September 2026 starts on a Tuesday, so these are its Saturdays and Sundays. */
const WEEKEND_DAYS = new Set([5, 6, 12, 13, 19, 20, 26, 27]);

/** A destination roughly `targetKm` from the start, where people actually go. */
function destination(provider, start, targetKm, hour, weekend) {
  if (PROVIDERS[provider].docked) {
    const near = STATIONS.filter((s) => s !== start && metres(s, start) > 300)
      .map((s) => [s, Math.abs(metres(s, start) / 1000 - targetKm)])
      .sort((a, b) => a[1] - b[1]);
    return near[0]?.[0] ?? pick(STATIONS);
  }
  let best = null;
  for (let i = 0; i < 40; i++) {
    const c = startPoint(provider, hour, weekend);
    const miss = Math.abs(metres(c, start) / 1000 - targetKm);
    if (!best || miss < best.miss) best = { c, miss };
  }
  return best.c;
}

/** Start to end with a gentle bow and a little jitter, kept out of the river. */
function route(a, b) {
  const length = metres(a, b);
  const steps = Math.max(4, Math.min(11, Math.round(length / 330)));
  const bow = between(-0.0022, 0.0022);
  const dx = (b[0] - a[0]) * M_LNG;
  const dy = (b[1] - a[1]) * M_LAT;
  const norm = Math.hypot(dx, dy) || 1;
  // Unit normal, in degrees, so the bow bends the line sideways.
  const nx = -dy / norm / M_LNG;
  const ny = dx / norm / M_LAT;

  const build = (k, jitter) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const ends = i === 0 || i === steps;
      const sway = ends ? 0 : Math.sin(Math.PI * t) * bow * k + gauss(0, 0.00018 * jitter);
      return [a[0] + (b[0] - a[0]) * t + nx * sway, a[1] + (b[1] - a[1]) * t + ny * sway];
    });

  let pts = build(1, 1);
  if (pts.some((p) => inside(RIVER, p))) pts = build(0, 0);
  return pts;
}

const pathMetres = (pts) => pts.slice(1).reduce((sum, p, i) => sum + metres(pts[i], p), 0);

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const wkt = (pts) => `LINESTRING (${pts.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(", ")})`;

const rows = [];
for (let n = 0; n < TRIPS; n++) {
  const provider = weighted(NAMES, (name) => PROVIDERS[name].share);
  const day = int(0, 29);
  const weekend = WEEKEND_DAYS.has(day + 1);
  const hour = weighted([...Array(24).keys()], (h) => (weekend ? WEEKEND_HOUR_WEIGHTS : HOUR_WEIGHTS)[h]);
  const device = pick(fleet[provider]);
  const [vehicleType, propulsion, kmh] = device.vehicle;

  const targetKm = Math.min(8, Math.max(0.5, lognormal(1.9, 0.55)));
  const start = PROVIDERS[provider].docked ? pick(STATIONS) : startPoint(provider, hour, weekend);
  const end = destination(provider, start, targetKm, hour, weekend);
  const pts = route(start, end);

  const distance = Math.round(pathMetres(pts));
  const seconds = Math.max(60, Math.round((distance / 1000 / Math.max(6, gauss(kmh, 2.5))) * 3600));
  const begin = new Date(Date.UTC(2026, 8, 1 + day, hour, int(0, 59), int(0, 59)));

  rows.push([
    uuid(), providerId[provider], provider, device.id, vehicleType, propulsion,
    iso(begin), iso(new Date(begin.getTime() + seconds * 1000)),
    seconds, distance, wkt(pts),
  ]);
}
rows.sort((a, b) => a[6].localeCompare(b[6]));

const quote = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const header = [
  "trip_id", "provider_id", "provider_name", "device_id", "vehicle_type",
  "propulsion_types", "start_time", "end_time", "trip_duration", "trip_distance", "route",
];
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, [header, ...rows].map((r) => r.map(quote).join(",")).join("\n") + "\n");

const counts = Object.fromEntries(NAMES.map((n) => [n, rows.filter((r) => r[2] === n).length]));
console.log(`wrote ${rows.length} trips -> ${OUT}`);
console.log("by provider:", counts);
