"use client";

import * as React from "react";

import { ScheduleEditor, type Schedule } from "@/registry/vianova/patterns/schedule-editor";

export default function ScheduleEditorDefault() {
  const [schedule, setSchedule] = React.useState<Schedule>({
    start: "2026-05-04",
    allDay: false,
    from: "07:00",
    to: "19:00",
    days: ["mon", "tue", "wed", "thu", "fri"],
  });

  return (
    <div className="w-full max-w-md">
      <ScheduleEditor value={schedule} onChange={setSchedule} />
    </div>
  );
}
