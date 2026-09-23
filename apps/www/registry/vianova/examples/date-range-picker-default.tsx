"use client";

import { enGB } from "date-fns/locale";

import { DateRangePicker } from "@/registry/vianova/patterns/date-range-picker";

// Fixed dates, and an explicit locale and defaultMonth: anything derived from
// "today" or the runtime locale renders differently on the server and the
// client, which React reports as a hydration mismatch.
const FROM = new Date(2026, 2, 2);
const TO = new Date(2026, 2, 29);

export default function DateRangePickerDefault() {
  return (
    <DateRangePicker
      locale={enGB}
      defaultMonth={FROM}
      defaultValue={{ from: FROM, to: TO }}
      presets={[
        { label: "March 2026", range: () => ({ from: FROM, to: TO }) },
        { label: "First week", range: () => ({ from: FROM, to: new Date(2026, 2, 8) }) },
        { label: "Last week", range: () => ({ from: new Date(2026, 2, 23), to: TO }) },
      ]}
    />
  );
}
