"use client";

import * as React from "react";
import { enGB } from "date-fns/locale";

import { Calendar } from "@/registry/vianova/ui/calendar";

// Two things are pinned deliberately, both to survive server rendering:
//
//   defaultMonth — otherwise it defaults to "today", and server and client can
//     land on different sides of a date boundary.
//   locale       — the day cells carry data-day={date.toLocaleDateString(locale?.code)}.
//     With no locale that resolves to the runtime default, which is en-US in
//     Node and whatever the browser is set to, so every cell hydration-
//     mismatches (4/28/2024 vs 28/04/2024).
const MONTH = new Date(2024, 4, 1);

export default function CalendarDefault() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2024, 4, 25));
  return (
    <Calendar
      mode="single"
      locale={enGB}
      defaultMonth={MONTH}
      selected={date}
      onSelect={setDate}
      className="rounded-lg border border-border"
    />
  );
}
