import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareBlockedReason,
  datesFromPeriod,
  dayFromDate,
  formatPeriod,
  formatTemporal,
  withinTemporal,
  withinHours,
  weekdayOf,
  DATE_SHORTCUTS,
  periodFromDates,
  compareCounts,
  divergingColor,
  divergingLegend,
  divergingOpacity,
  metricValue,
  percentChange,
  periodLength,
  previousPeriod,
  symmetricLimit,
  withinPeriod,
  type Period,
} from "../registry/vianova/lib/compare";

const SEPT_SECOND_HALF: Period = { start: "2026-09-16", end: "2026-09-30" };

describe("periods", () => {
  it("counts both ends of the range", () => {
    assert.equal(periodLength(SEPT_SECOND_HALF), 15);
    assert.equal(periodLength({ start: "2026-09-01", end: "2026-09-01" }), 1);
  });

  it("puts the previous period immediately before, at the same length", () => {
    assert.deepEqual(previousPeriod(SEPT_SECOND_HALF), {
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("crosses a month boundary without losing a day", () => {
    assert.deepEqual(previousPeriod({ start: "2026-03-01", end: "2026-03-07" }), {
      start: "2026-02-22",
      end: "2026-02-28",
    });
  });

  it("includes both endpoints", () => {
    assert.ok(withinPeriod("2026-09-16T00:00:00Z", SEPT_SECOND_HALF));
    assert.ok(withinPeriod("2026-09-30T23:59:59Z", SEPT_SECOND_HALF));
    assert.ok(!withinPeriod("2026-09-15T23:59:59Z", SEPT_SECOND_HALF));
    assert.ok(!withinPeriod("2026-10-01T00:00:00Z", SEPT_SECOND_HALF));
  });

  it("reads the day a timestamp names, whatever offset it carries", () => {
    // The point of comparing the date part as a string: an offset does not
    // drag the row into the previous day the way local parsing would.
    assert.ok(withinPeriod("2026-09-16T01:00:00+02:00", SEPT_SECOND_HALF));
  });
});

describe("compareCounts", () => {
  type Row = { zone: string; at: string };
  const rows: Row[] = [
    { zone: "Baixa", at: "2026-09-20T10:00:00Z" },
    { zone: "Baixa", at: "2026-09-21T10:00:00Z" },
    { zone: "Baixa", at: "2026-09-05T10:00:00Z" },
    { zone: "Alfama", at: "2026-09-03T10:00:00Z" },
    { zone: "Alfama", at: "2026-09-04T10:00:00Z" },
    { zone: "Belem", at: "2026-08-01T10:00:00Z" }, // outside both periods
  ];
  const run = (keys?: string[]) =>
    compareCounts({
      rows,
      keyOf: (r) => r.zone,
      timeOf: (r) => r.at,
      period: SEPT_SECOND_HALF,
      keys,
      floor: 0,
    });

  it("buckets each row into the right period", () => {
    const baixa = run().find((r) => r.key === "Baixa");
    assert.deepEqual(
      { now: baixa?.now, previous: baixa?.previous, delta: baixa?.delta },
      { now: 2, previous: 1, delta: 1 },
    );
  });

  it("reports a unit that fell to zero rather than dropping it", () => {
    const alfama = run().find((r) => r.key === "Alfama");
    assert.deepEqual(
      { now: alfama?.now, previous: alfama?.previous, delta: alfama?.delta },
      { now: 0, previous: 2, delta: -2 },
    );
  });

  it("ignores rows outside both periods", () => {
    assert.equal(run().find((r) => r.key === "Belem"), undefined);
  });

  it("keeps a unit with no rows at all when the vocabulary is given", () => {
    const empty = run(["Baixa", "Alfama", "Graca"]).find(
      (r) => r.key === "Graca",
    );
    assert.deepEqual(empty, {
      key: "Graca",
      now: 0,
      previous: 0,
      delta: 0,
      percent: null,
    });
  });

  it("drops a row whose unit is null", () => {
    const out = compareCounts({
      rows,
      keyOf: () => null,
      timeOf: (r) => r.at,
      period: SEPT_SECOND_HALF,
    });
    assert.deepEqual(out, []);
  });
});

describe("percentChange", () => {
  it("withholds a percentage below the floor", () => {
    // 1 -> 4 is +300%, and it is noise. This is the rule that stops a change
    // map becoming a map of small denominators.
    assert.equal(percentChange(4, 1, 20), null);
  });

  it("reports one above the floor", () => {
    assert.equal(percentChange(120, 100, 20), 20);
  });

  it("withholds rather than dividing by zero", () => {
    assert.equal(percentChange(50, 0, 0), null);
  });

  it("signs a fall negative", () => {
    assert.equal(percentChange(50, 100, 20), -50);
  });
});

describe("symmetricLimit", () => {
  it("takes the larger extreme so the scale straddles zero", () => {
    assert.equal(symmetricLimit([-80, 20, 35]), 80);
  });

  it("ignores the units held back from a percentage", () => {
    assert.equal(symmetricLimit([null, 12, null, -4]), 12);
  });

  it("is zero when nothing moved", () => {
    assert.equal(symmetricLimit([0, 0]), 0);
    assert.equal(symmetricLimit([]), 0);
  });
});

describe("the diverging ramp", () => {
  it("puts zero on the neutral midpoint", () => {
    assert.equal(divergingColor(0, 100), "#f5f5f5");
  });

  it("sends a rise teal and a fall brown", () => {
    assert.equal(divergingColor(100, 100), "#01665e");
    assert.equal(divergingColor(-100, 100), "#8c510a");
  });

  it("clamps past the limit instead of wrapping", () => {
    assert.equal(divergingColor(500, 100), divergingColor(100, 100));
    assert.equal(divergingColor(-500, 100), divergingColor(-100, 100));
  });

  it("stays neutral when nothing moved anywhere", () => {
    assert.equal(divergingColor(0, 0), "#f5f5f5");
  });

  it("fades the midpoint out and leaves the extremes solid", () => {
    assert.equal(divergingOpacity(0, 100), 0.08);
    assert.equal(divergingOpacity(100, 100), 0.8);
    // A unit held back from a percentage is drawn as unchanged, not as absent.
    assert.equal(divergingOpacity(null, 100), 0.08);
  });

  it("gives the legend an odd band count so a centre exists to label", () => {
    const legend = divergingLegend(50, 8);
    assert.equal(legend.length % 2, 1);
    const centre = legend[(legend.length - 1) / 2];
    assert.equal(centre?.value, 0);
    assert.equal(centre?.color, "#f5f5f5");
    assert.equal(legend[0]?.value, -50);
    assert.equal(legend.at(-1)?.value, 50);
  });
});

describe("metricValue", () => {
  const row = { key: "z", now: 4, previous: 1, delta: 3, percent: null };

  it("reads the absolute change", () => {
    assert.equal(metricValue(row, "absolute"), 3);
  });

  it("passes the withheld percentage straight through as null", () => {
    assert.equal(metricValue(row, "percent"), null);
  });
});

describe("compareBlockedReason", () => {
  it("blocks a snapshot, which has no period in it", () => {
    assert.match(compareBlockedReason("snapshot") ?? "", /snapshot/i);
  });

  it("blocks fixed geometry", () => {
    assert.match(compareBlockedReason("static") ?? "", /geometry/i);
  });

  it("allows the two kinds that carry a period", () => {
    assert.equal(compareBlockedReason("events"), null);
    assert.equal(compareBlockedReason("aggregate"), null);
  });
});

describe("calendar dates", () => {
  it("names the day the person picked, not the UTC one", () => {
    // 16 Sep at local midnight is the 15th in UTC for anyone east of
    // Greenwich. The picker means the 16th.
    const picked = new Date(2026, 8, 16);
    assert.equal(dayFromDate(picked), "2026-09-16");
  });

  it("round-trips a period through the calendar", () => {
    const period = { start: "2026-09-16", end: "2026-09-30" };
    const { from, to } = datesFromPeriod(period);
    assert.deepEqual(periodFromDates(from, to), period);
  });

  it("orders a range the user dragged backwards", () => {
    assert.deepEqual(
      periodFromDates(new Date(2026, 8, 30), new Date(2026, 8, 16)),
      { start: "2026-09-16", end: "2026-09-30" },
    );
  });
});

describe("formatPeriod", () => {
  it("says the month once when the period stays inside one", () => {
    assert.equal(
      formatPeriod({ start: "2026-09-16", end: "2026-09-30" }),
      "16–30 Sep",
    );
  });

  it("says a single day as a date, not as a range", () => {
    // The bug this pins read "16–16 Sep". A day is not a span of itself.
    assert.equal(
      formatPeriod({ start: "2026-09-16", end: "2026-09-16" }),
      "16 Sep",
    );
  });

  it("repeats the month when the period crosses one", () => {
    assert.equal(
      formatPeriod({ start: "2026-08-28", end: "2026-09-03" }),
      "28 Aug–3 Sep",
    );
  });

  it("carries the year once the two ends disagree about it", () => {
    // "28 Dec–3 Jan" does not say which December.
    assert.equal(
      formatPeriod({ start: "2025-12-28", end: "2026-01-03" }),
      "28 Dec 2025–3 Jan 2026",
    );
  });

  it("puts the day before the month, as the picker does", () => {
    // toLocaleDateString("en", ...) is en-US and gave "1–Sep 30".
    const label = formatPeriod({ start: "2026-09-01", end: "2026-09-30" });
    assert.equal(label, "1–30 Sep");
    assert.ok(!label.includes("Sep 30"));
  });
});

describe("temporal filter", () => {
  const week = { start: "2024-01-20", end: "2024-01-26" };

  it("numbers weekdays the way ISO does, not the way Date does", () => {
    // Date.getDay() calls Sunday 0; ISO calls it 7. Getting this wrong puts
    // Sunday in the work week.
    assert.equal(weekdayOf(new Date(2024, 0, 21)), 7); // a Sunday
    assert.equal(weekdayOf(new Date(2024, 0, 22)), 1); // a Monday
  });

  it("keeps a row the period covers", () => {
    assert.equal(withinTemporal("2024-01-22T09:00:00", { period: week }), true);
  });

  it("drops a row outside the period", () => {
    assert.equal(withinTemporal("2024-01-19T09:00:00", { period: week }), false);
  });

  it("filters by weekday", () => {
    const workdays = { period: week, days: [1, 2, 3, 4, 5] } as const;
    // 2024-01-22 is a Monday, 2024-01-21 a Sunday.
    assert.equal(withinTemporal("2024-01-22T09:00:00", workdays), true);
    assert.equal(withinTemporal("2024-01-21T09:00:00", workdays), false);
  });

  it("filters by hour, end exclusive", () => {
    const morning = { period: week, hours: { start: 6, end: 12 } };
    assert.equal(withinTemporal("2024-01-22T06:00:00", morning), true);
    assert.equal(withinTemporal("2024-01-22T11:59:00", morning), true);
    assert.equal(withinTemporal("2024-01-22T12:00:00", morning), false);
    assert.equal(withinTemporal("2024-01-22T05:59:00", morning), false);
  });

  it("wraps an hour range across midnight", () => {
    // Night is 18:00-06:00. Treated as a plain start<=end range it would
    // match nothing at all.
    const night = { start: 18, end: 6 };
    assert.equal(withinHours(23, night), true);
    assert.equal(withinHours(2, night), true);
    assert.equal(withinHours(12, night), false);
    assert.equal(withinHours(6, night), false);
    assert.equal(withinHours(18, night), true);
  });

  it("drops a date-only row when an hour filter is set", () => {
    // "2024-01-22" is a whole day; no hour in it can satisfy 06:00-12:00,
    // and guessing midnight would quietly widen the filter.
    const morning = { period: week, hours: { start: 6, end: 12 } };
    assert.equal(withinTemporal("2024-01-22", morning), false);
  });

  it("summarises a plain period as dates alone", () => {
    assert.equal(formatTemporal({ period: week }), "20 Jan 2024 \u2013 26 Jan 2024");
  });

  it("appends the hours, as the field in VIP does", () => {
    assert.equal(
      formatTemporal({ period: week, hours: { start: 6, end: 12 } }),
      "20 Jan 2024 \u2013 26 Jan 2024, 06:00 \u2013 12:00",
    );
  });

  it("leaves a full week of days unsaid", () => {
    assert.equal(
      formatTemporal({ period: week, days: [1, 2, 3, 4, 5, 6, 7] }),
      "20 Jan 2024 \u2013 26 Jan 2024",
    );
  });
});

describe("date shortcuts", () => {
  const today = new Date(2024, 0, 27);
  const byId = (id: string) => DATE_SHORTCUTS.find((s) => s.id === id)!;
  const base = { period: { start: "2024-01-20", end: "2024-01-26" } };

  it("offers VIP's eight, in VIP's order", () => {
    assert.deepEqual(
      DATE_SHORTCUTS.map((s) => s.label),
      [
        "Last week",
        "Last month",
        "Last 3 months",
        "Work days",
        "Weekend",
        "Morning",
        "Afternoon",
        "Night",
      ],
    );
  });

  it("counts a period back through yesterday, never a part-finished today", () => {
    assert.deepEqual(byId("last-week").apply(base, today).period, {
      start: "2024-01-20",
      end: "2024-01-26",
    });
  });

  it("sets Morning to the 06:00-12:00 read off the running app", () => {
    assert.deepEqual(byId("morning").apply(base, today).hours, {
      start: 6,
      end: 12,
    });
  });

  it("sets Work days to Monday through Friday", () => {
    assert.deepEqual(byId("work-days").apply(base, today).days, [1, 2, 3, 4, 5]);
  });

  it("changes only its own facet", () => {
    // The menu is flat but the facets are three. Picking Morning must not
    // move the period, and picking Last week must not drop the hours.
    const withHours = { ...base, hours: { start: 6, end: 12 } };
    assert.deepEqual(byId("last-week").apply(withHours, today).hours, {
      start: 6,
      end: 12,
    });
    assert.deepEqual(byId("morning").apply(base, today).period, base.period);
  });
});
