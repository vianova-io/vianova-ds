"use client";

import { StatusToast } from "@/registry/vianova/patterns/status-toast";

/**
 * The three states, pinned to one instant so "last updated" does not drift.
 *
 * Laid out the width the toast viewport gives them (max-w-sm), because a
 * status card that only reads well at full width is not the card we ship.
 */
const NOW = Date.parse("2026-11-07T14:00:00Z");

export default function StatusToastDefault() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <StatusToast
        now={NOW}
        onDismiss={() => {}}
        announcement={{
          id: "sm-munich-f061-nov",
          kind: "maintenance",
          title: "Planned maintenance on Munich shared mobility",
          startsAt: "2026-11-07T22:00:00+01:00",
          endsAt: "2026-11-08T02:00:00+01:00",
          timeZone: "Europe/Berlin",
          href: "#",
        }}
      />

      <StatusToast
        now={NOW}
        onDismiss={() => {}}
        announcement={{
          id: "gbfs-ingest-degraded",
          kind: "incident",
          title: "Some operator feeds are updating slowly",
          updatedAt: "2026-11-07T13:04:00Z",
          endsAt: "2026-11-07T18:00:00Z",
          href: "#",
        }}
      />

      <StatusToast
        now={NOW}
        onDismiss={() => {}}
        announcement={{
          id: "api-outage",
          kind: "incident",
          title: "The data API is not responding",
          updatedAt: "2026-11-07T13:52:00Z",
          href: "#",
        }}
      />
    </div>
  );
}
