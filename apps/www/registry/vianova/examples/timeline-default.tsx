import { Timeline, TimelineItem } from "@/registry/vianova/patterns/timeline";

export default function TimelineDefault() {
  return (
    <Timeline className="w-full max-w-lg">
      <TimelineItem
        tone="success"
        title="Resolved"
        time={<time dateTime="2026-09-15T07:30:00Z">15 Sept, 07:30</time>}
      >
        Daily trip count returned to 98% of the prior week&apos;s average.
      </TimelineItem>
      <TimelineItem
        tone="info"
        title="Identified"
        time={<time dateTime="2026-09-14T10:12:00Z">14 Sept, 10:12</time>}
      >
        The operator confirmed their trips endpoint was returning empty pages.
      </TimelineItem>
      <TimelineItem
        tone="warning"
        title="Investigating"
        time={<time dateTime="2026-09-14T06:05:00Z">14 Sept, 06:05</time>}
      >
        Daily trip count dropped to 41% of the prior week&apos;s average.
      </TimelineItem>
    </Timeline>
  );
}
