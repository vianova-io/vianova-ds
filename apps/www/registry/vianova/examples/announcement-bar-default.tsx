import {
  AnnouncementBar,
  type Announcement,
} from "@/registry/vianova/patterns/announcement-bar";

/**
 * The Munich window, read at three different moments.
 *
 * `now` and `viewerTimeZone` are both pinned so the phases are the point of
 * the example rather than whatever time it happens to be rendered at.
 */
const MUNICH: Announcement = {
  id: "sm-munich-f061-nov",
  kind: "maintenance",
  title: "Planned maintenance — Munich",
  scope: ["Shared mobility"],
  startsAt: "2026-11-07T22:00:00+01:00",
  endsAt: "2026-11-08T02:00:00+01:00",
  timeZone: "Europe/Berlin",
  href: "#",
};

const VIEWER = "Europe/Lisbon";

export default function AnnouncementBarDefault() {
  return (
    <div className="w-full space-y-3">
      {/* Three days out: info, and the reader can wave it away. */}
      <AnnouncementBar
        announcement={MUNICH}
        now={Date.parse("2026-11-04T09:00:00Z")}
        viewerTimeZone={VIEWER}
        className="rounded-lg"
      />

      {/* Inside the 24-hour lead time: the tone escalates on its own. */}
      <AnnouncementBar
        announcement={MUNICH}
        now={Date.parse("2026-11-07T14:00:00Z")}
        viewerTimeZone={VIEWER}
        className="rounded-lg"
      />

      {/* Under way: no dismiss, because the bar explains what the reader sees. */}
      <AnnouncementBar
        announcement={MUNICH}
        now={Date.parse("2026-11-07T23:30:00Z")}
        viewerTimeZone={VIEWER}
        className="rounded-lg"
      />

      {/* Unplanned, for contrast. Same component, different kind. */}
      <AnnouncementBar
        announcement={{
          id: "gbfs-ingest-incident",
          kind: "incident",
          title: "Ingestion degraded",
          body: "Three operators are returning malformed data. We are on it.",
          scope: ["Data hub"],
          startsAt: "2026-11-07T21:10:00+01:00",
          timeZone: "Europe/Berlin",
        }}
        now={Date.parse("2026-11-07T21:40:00Z")}
        viewerTimeZone={VIEWER}
        className="rounded-lg"
      />
    </div>
  );
}
