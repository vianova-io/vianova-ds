"use client";

import * as React from "react";

import { ScheduleEditor, type Schedule } from "@/registry/vianova/patterns/schedule-editor";

export default function ScheduleEditorDatesOnly() {
  const [schedule, setSchedule] = React.useState<Schedule>({
    start: "2026-05-04",
    allDay: true,
    days: [],
  });

  return (
    <div className="w-full max-w-md">
      <ScheduleEditor value={schedule} onChange={setSchedule} showTimes={false} />
    </div>
  );
}
