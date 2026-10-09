#!/usr/bin/env node
/**
 * Builds public/data/infringements-lisbon.csv: a FAKE log of parking
 * infringements by shared scooters and bikes in Lisbon, September 2026.
 *
 * The companion to build-mds-trips.mjs, and like it, nothing here is real. It
 * shares that script's geography and operators, so the two datasets can sit in
 * one report and be filtered by the same zones and hours:
 *
 *  - Infringements happen where vehicles are left: the same hotspots, weighted
 *    by hour, with sidewalk parking crowding the centre and fallen vehicles
 *    clustering late at night.
 *  - Operators differ: Voi and Bolt are cited more per vehicle, Gira (docked)
 *    almost never.
 *  - Enforcement works: sidewalk parking falls through the month, which gives
 *    the charts a trend to show.
 *  - Each case is Resolved, Fined or still Open; a fine has an amount, and a
 *    resolution has a time.
 *
 * Seeded, so the file is reproducible.
 *
 *   node scripts/build-mds-infringements.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "infringements-lisbon.csv");
const COUNT = 1200;
const SEED = 20260902;

/* ----------------------------------------------------------------------------
 * Random numbers (as in build-mds-trips.mjs)
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
const int = (lo, hi) => Math.floor(lo + (hi + 1 - lo) * rnd());
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
 * Geography (as in build-mds-trips.mjs)
 * ------------------------------------------------------------------------- */

const LAT0 = 38.73;

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

/** [name, lng, lat, spread in degrees, weight, kind], as in the trips script. */
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

/** Where a vehicle was left, and the kind of place that is. */
function spotAt(hour, weekend) {
  for (let tries = 0; tries < 50; tries++) {
    const spot = weighted(HOTSPOTS, ([, , , , weight, kind]) => weight * demand(kind, hour, weekend));
    const p = [
      spot[1] + gauss(0, spot[3]) / Math.cos((LAT0 * Math.PI) / 180),
      spot[2] + gauss(0, spot[3]),
    ];
    if (inside(RIVER, p)) continue;
    if (inside(MONSANTO, p) && rnd() < 0.9) continue;
    return { p, kind: spot[5] };
  }
  return { p: [-9.1393, 38.7139], kind: "mixed" };
}

/* ----------------------------------------------------------------------------
 * Operators: the trips script's shares, times how often each is cited
 * ------------------------------------------------------------------------- */

const PROVIDERS = {
  Lime: { share: 0.32, rate: 1, vehicles: ["scooter", "bicycle"] },
  Bolt: { share: 0.27, rate: 1.25, vehicles: ["scooter"] },
  Dott: { share: 0.21, rate: 0.9, vehicles: ["scooter", "bicycle"] },
  Voi: { share: 0.12, rate: 1.4, vehicles: ["scooter"] },
  Gira: { share: 0.08, rate: 0.15, vehicles: ["bicycle"] },
};
const NAMES = Object.keys(PROVIDERS);
const fleet = Object.fromEntries(
  NAMES.map((n) => [
    n,
    Array.from({ length: Math.round(PROVIDERS[n].share * 400) }, () => ({
      id: uuid(),
      vehicle: pick(PROVIDERS[n].vehicles),
    })),
  ]),
);

/* ----------------------------------------------------------------------------
 * Infringements
 * ------------------------------------------------------------------------- */

/** [type, base weight, fine in euros]. */
const TYPES = [
  ["Sidewalk parking", 38, 75],
  ["Outside parking zone", 24, 50],
  ["No-parking zone", 16, 100],
  ["Blocking access", 12, 150],
  ["Fallen vehicle", 10, 50],
];

function typeWeight([type, base], { kind, hour, day }) {
  const late = hour >= 22 || hour <= 3;
  switch (type) {
    // Enforcement in the centre pays off: down by a third over the month.
    case "Sidewalk parking":
      return base * (kind === "mixed" || kind === "tourist" ? 1.4 : 0.8) * (1 - (0.35 * day) / 29);
    case "No-parking zone":
      return base * (kind === "tourist" ? 1.8 : 0.8);
    case "Blocking access":
      return base * (kind === "office" || kind === "commute" ? 1.7 : 0.7);
    case "Fallen vehicle":
      return base * (late ? 3 : 0.7);
    default:
      return base;
  }
}

/** When cases are logged: patrols and reports by day, a night-out bump late. */
const HOUR_WEIGHTS = [4, 3, 2, 1, 1, 1, 2, 5, 9, 10, 9, 9, 10, 9, 9, 9, 10, 11, 11, 9, 7, 6, 5, 5];
const WEEKEND_HOUR_WEIGHTS = [7, 6, 4, 2, 1, 1, 1, 2, 4, 6, 8, 10, 11, 11, 11, 10, 10, 9, 8, 8, 7, 7, 7, 7];
const WEEKEND_DAYS = new Set([5, 6, 12, 13, 19, 20, 26, 27]);

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const rows = [];
for (let n = 0; n < COUNT; n++) {
  const provider = weighted(NAMES, (name) => PROVIDERS[name].share * PROVIDERS[name].rate);
  const day = int(0, 29);
  const weekend = WEEKEND_DAYS.has(day + 1);
  const hour = weighted([...Array(24).keys()], (h) => (weekend ? WEEKEND_HOUR_WEIGHTS : HOUR_WEIGHTS)[h]);
  const { p, kind } = spotAt(hour, weekend);
  const [type, , fine] = weighted(TYPES, (t) => typeWeight(t, { kind, hour, day }));
  const device = pick(fleet[provider]);

  const detected = new Date(Date.UTC(2026, 8, 1 + day, hour, int(0, 59), int(0, 59)));
  // Recent cases are more often still open.
  const status = weighted(["Resolved", "Fined", "Open"], (s) =>
    s === "Open" ? 0.08 + (0.3 * day) / 29 : s === "Fined" ? 0.3 : 0.55,
  );
  const minutes = Math.round(Math.min(48 * 60, Math.max(8, lognormal(type === "Fallen vehicle" ? 55 : 95, 0.7))));
  const resolved = status === "Open" ? "" : iso(new Date(detected.getTime() + minutes * 60_000));

  rows.push([
    uuid(), provider, device.id, device.vehicle, type, status,
    status === "Fined" ? fine : "", iso(detected), resolved,
    `POINT (${p[0].toFixed(5)} ${p[1].toFixed(5)})`,
  ]);
}
rows.sort((a, b) => a[7].localeCompare(b[7]));

const quote = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const header = [
  "infringement_id", "provider_name", "device_id", "vehicle_type", "infringement_type",
  "status", "fine_eur", "detected_at", "resolved_at", "location",
];
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, [header, ...rows].map((r) => r.map(quote).join(",")).join("\n") + "\n");

const count = (i) => Object.fromEntries([...new Set(rows.map((r) => r[i]))].map((v) => [v, rows.filter((r) => r[i] === v).length]));
console.log(`wrote ${rows.length} infringements -> ${OUT}`);
console.log("by provider:", count(1));
console.log("by type:", count(4));
console.log("by status:", count(5));
