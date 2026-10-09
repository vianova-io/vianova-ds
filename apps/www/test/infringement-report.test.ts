import { test } from "node:test";
import assert from "node:assert/strict";

import {
  measureInfringements,
  readInfringements,
  type Infringement,
} from "../registry/vianova/lib/infringement-report.ts";
import {
  countBy,
  dailySeries,
  filterEvents,
} from "../registry/vianova/lib/trip-report.ts";

const HEADER = [
  "infringement_id",
  "provider_name",
  "device_id",
  "vehicle_type",
  "infringement_type",
  "status",
  "fine_eur",
  "detected_at",
  "resolved_at",
  "location",
];

test("reads an infringement in Lisbon time, with its place and resolution time", () => {
  const [e] = readInfringements({
    header: HEADER,
    rows: [
      [
        "x",
        "Bolt",
        "d1",
        "scooter",
        "Sidewalk parking",
        "Fined",
        "75",
        "2026-09-01T23:30:00Z",
        "2026-09-02T01:00:00Z",
        "POINT (-9.13930 38.71390)",
      ],
    ],
  });
  assert.equal(e!.day, "2026-09-02");
  assert.equal(e!.hour, 0);
  assert.equal(e!.lon, -9.1393);
  assert.equal(e!.fineEur, 75);
  assert.equal(e!.resolutionMin, 90);
});

test("an open case has no resolution time, and an unknown status reads as open", () => {
  const rows = [
    [
      "x",
      "Lime",
      "d1",
      "bicycle",
      "Fallen vehicle",
      "Open",
      "",
      "2026-09-03T10:00:00Z",
      "",
      "",
    ],
    [
      "y",
      "Lime",
      "d2",
      "bicycle",
      "Fallen vehicle",
      "Lost",
      "",
      "2026-09-03T10:00:00Z",
      "",
      "",
    ],
  ];
  const out = readInfringements({ header: HEADER, rows });
  assert.ok(Number.isNaN(out[0]!.resolutionMin));
  assert.equal(out[1]!.status, "Open");
});

const event = (over: Partial<Infringement>): Infringement => ({
  provider: "Lime",
  vehicle: "scooter",
  device: "d1",
  day: "2026-09-10",
  hour: 12,
  weekday: 3,
  lon: -9.14,
  lat: 38.72,
  type: "Sidewalk parking",
  status: "Resolved",
  fineEur: 0,
  resolutionMin: 60,
  ...over,
});

test("fines add up, and the median resolution leaves open cases out", () => {
  const events = [
    event({ status: "Fined", fineEur: 75, resolutionMin: 30 }),
    event({ status: "Fined", fineEur: 150, resolutionMin: 90 }),
    event({ status: "Open", resolutionMin: NaN }),
  ];
  assert.equal(measureInfringements(events, "fines"), 225);
  assert.equal(measureInfringements(events, "resolution"), 60);
  assert.equal(measureInfringements(events, "infringements"), 3);
});

test("a feed's own condition narrows the shared filter", () => {
  const events = [
    event({ type: "Sidewalk parking" }),
    event({ type: "Fallen vehicle" }),
    event({ type: "Sidewalk parking", provider: "Bolt" }),
  ];
  const kept = filterEvents(
    events,
    { from: "2026-09-01", to: "2026-09-30", providers: ["Lime"] },
    (e) => e.type === "Sidewalk parking",
  );
  assert.equal(kept.length, 1);
});

test("counts follow the order given and leave out values not in it", () => {
  const events = [
    event({}),
    event({}),
    event({ type: "Fallen vehicle" }),
    event({ type: "Other" }),
  ];
  const rows = countBy(events, (e) => e.type, [
    "Fallen vehicle",
    "Sidewalk parking",
  ]);
  assert.deepEqual(
    rows.map((r) => [r.value, r.count]),
    [
      ["Fallen vehicle", 1],
      ["Sidewalk parking", 2],
    ],
  );
});

test("a daily series takes any feed's measure", () => {
  const events = [
    event({ fineEur: 50 }),
    event({ fineEur: 25, provider: "Bolt" }),
  ];
  const rows = dailySeries(
    events,
    ["2026-09-10"],
    (own) => measureInfringements(own, "fines"),
    ["Lime", "Bolt"],
  );
  assert.deepEqual(rows[0]!.values, [50, 25]);
});
