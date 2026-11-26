"use client";

import { StatusToast } from "@/registry/vianova/patterns/status-toast";

/**
 * `impact` decides the tone of an incident, and it disagrees with the dates on
 * purpose -- both cards here would be the other colour without it.
 *
 * The minor one has no known end, which on its own reads as an outage and
 * turns the card red. The major one has an end two hours out, which on its own
 * reads as scoped and turns it amber. How bad it is and how long it lasts are
 * different questions, and Statuspage answers the first one.
 *
 * Pinned to one instant, like the other status-toast examples, so "last
 * updated" does not drift between a local run and the runner.
 */
const NOW = Date.parse("2026-11-07T14:00:00Z");

export default function StatusToastImpact() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <StatusToast
        now={NOW}
        onDismiss={() => {}}
        announcement={{
          id: "gbfs-ingest-slow",
          kind: "incident",
          title: "Some operator feeds are updating slowly",
          impact: "minor",
          updatedAt: "2026-11-07T13:41:00Z",
          href: "#",
        }}
      />

      <StatusToast
        now={NOW}
        onDismiss={() => {}}
        announcement={{
          id: "trips-api-down",
          kind: "incident",
          title: "The trips API is returning errors",
          impact: "major",
          updatedAt: "2026-11-07T13:52:00Z",
          endsAt: "2026-11-07T16:00:00Z",
          href: "#",
        }}
      />
    </div>
  );
}
