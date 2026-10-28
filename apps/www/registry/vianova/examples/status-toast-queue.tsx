"use client";

import { Button } from "@/registry/vianova/ui/button";
import {
  StatusToaster,
  announceStatus,
  type Announcement,
} from "@/registry/vianova/patterns/status-toast";

const MUNICH: Announcement = {
  id: "sm-munich-f061-nov",
  kind: "maintenance",
  title: "Planned maintenance on Munich shared mobility",
  startsAt: "2026-11-07T22:00:00+01:00",
  endsAt: "2026-11-08T02:00:00+01:00",
  timeZone: "Europe/Berlin",
  href: "#",
};

const DEGRADED: Announcement = {
  id: "gbfs-ingest-degraded",
  kind: "incident",
  title: "Some operator feeds are updating slowly",
  updatedAt: "2026-11-07T13:04:00Z",
  endsAt: "2026-11-07T18:00:00Z",
  href: "#",
};

const NOW = Date.parse("2026-11-07T14:00:00Z");

/**
 * The same cards through the real queue: they stack, they swipe away, and
 * they stay until dismissed rather than timing out.
 */
export default function StatusToastQueue() {
  return (
    <StatusToaster>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => announceStatus(MUNICH, NOW)}>
          Announce maintenance
        </Button>
        <Button variant="outline" onClick={() => announceStatus(DEGRADED, NOW)}>
          Announce incident
        </Button>
      </div>
    </StatusToaster>
  );
}
