import { test } from "node:test";
import assert from "node:assert/strict";

import {
  byProvider,
  change,
  daysBetween,
  filterTrips,
  previousPeriod,
  readTrips,
  summarize,
  tripsByDay,
  weekHourGrid,
  type Trip,
} from "../registry/vianova/lib/trip-report.ts";

const HEADER = [
  "trip_id",
  "provider_name",
  "device_id",
  "vehicle_type",
  "start_time",
  "trip_duration",
  "trip_distance",
];

const row = (provider: string, device: string, vehicle: string, start: string, s: number, m: number) => [
  "x",
  provider,
  device,
  vehicle,
  start,
  String(s),
  String(m),
];

test("buckets by Lisbon time, not UTC: 23:30 UTC on the 1st is 00:30 on the 2nd", () => {
  const [t] = readTrips({ header: HEADER, rows: [row("Lime", "d1", "scooter", "2026-09-01T23:30:00Z", 60, 100)] });
  assert.equal(t!.day, "2026-09-02");
  assert.equal(t!.hour, 0);
  // 2 September 2026 is a Wednesday.
  assert.equal(t!.weekday, 2);
});

test("reads columns by name and drops rows with no start time", () => {
  const header = ["start_time", "provider_name"];
  const trips = readTrips({ header, rows: [["2026-09-03T10:00:00Z", "Bolt"], ["", "Bolt"]] });
  assert.equal(trips.length, 1);
  assert.equal(trips[0]!.provider, "Bolt");
});

test("returns nothing for a file that is not a trips feed", () => {
  assert.deepEqual(readTrips({ header: ["a", "b"], rows: [["1", "2"]] }), []);
});

const trip = (over: Partial<Trip>): Trip => ({
  provider: "Lime",
  vehicle: "scooter",
  device: "d1",
  day: "2026-09-10",
  hour: 12,
  weekday: 3,
  durationS: 600,
  distanceM: 2000,
  ...over,
});

test("an hour window that wraps midnight keeps 22:00-05:59 and nothing else", () => {
  const trips = [21, 22, 23, 0, 5, 6].map((hour) => trip({ hour }));
  const kept = filterTrips(trips, { from: "2026-09-01", to: "2026-09-30", hours: [22, 6] });
  assert.deepEqual(kept.map((t) => t.hour), [22, 23, 0, 5]);
});

test("day bounds are inclusive at both ends", () => {
  const trips = ["2026-08-31", "2026-09-01", "2026-09-07", "2026-09-08"].map((day) => trip({ day }));
  const kept = filterTrips(trips, { from: "2026-09-01", to: "2026-09-07" });
  assert.deepEqual(kept.map((t) => t.day), ["2026-09-01", "2026-09-07"]);
});

test("the previous period is the same length and ends the day before", () => {
  assert.deepEqual(previousPeriod({ from: "2026-09-21", to: "2026-09-27" }), {
    from: "2026-09-14",
    to: "2026-09-20",
  });
  assert.equal(daysBetween("2026-09-01", "2026-09-30").length, 30);
});

test("summary: median duration, mean distance, trips per vehicle per day", () => {
  const trips = [
    trip({ device: "a", durationS: 60, distanceM: 1000 }),
    trip({ device: "a", durationS: 120, distanceM: 2000 }),
    trip({ device: "b", durationS: 600, distanceM: 3000 }),
  ];
  const s = summarize(trips, 3);
  assert.equal(s.trips, 3);
  assert.equal(s.vehicles, 2);
  assert.equal(s.medianDurationMin, 2);
  assert.equal(s.avgDistanceKm, 2);
  assert.equal(s.tripsPerVehiclePerDay, 0.5);
});

test("an empty period summarises to zeros, not NaN", () => {
  const s = summarize([], 7);
  assert.deepEqual(s, { trips: 0, vehicles: 0, medianDurationMin: 0, avgDistanceKm: 0, tripsPerVehiclePerDay: 0 });
});

test("no change is reported against an empty period", () => {
  assert.equal(change(10, 0), null);
  assert.equal(change(15, 10), 0.5);
});

test("daily counts keep empty days and the provider order given", () => {
  const trips = [trip({ day: "2026-09-02", provider: "Bolt" }), trip({ day: "2026-09-02" })];
  const rows = tripsByDay(trips, daysBetween("2026-09-01", "2026-09-02"), ["Bolt", "Lime"]);
  assert.deepEqual(rows, [
    { day: "2026-09-01", counts: [0, 0] },
    { day: "2026-09-02", counts: [1, 1] },
  ]);
});

test("provider shares add up to one", () => {
  const trips = [trip({}), trip({}), trip({ provider: "Voi" })];
  const rows = byProvider(trips, ["Lime", "Voi", "Gira"]);
  assert.deepEqual(rows.map((r) => r.trips), [2, 1, 0]);
  assert.equal(rows.reduce((s, r) => s + r.share, 0), 1);
});

test("the week grid scales its busiest cell to 1", () => {
  const grid = weekHourGrid([trip({}), trip({}), trip({ weekday: 0, hour: 8 })]);
  assert.equal(grid[3]![12], 1);
  assert.equal(grid[0]![8], 0.5);
});
