import type { Vehicle } from "@/registry/vianova/lib/sample-regulations";

/**
 * Fake operator feeds for the feeds workspace: Lisbon, as of 1 October 2026.
 *
 * The five connected operators are the same five whose MDS trips the data hub
 * lists and the regulations workspace filters by, so a feed that is connected
 * here is one whose data exists elsewhere in the system. The rest are the
 * catalogue: feeds Vianova can reach, which this organization has requested,
 * been refused, or never asked for.
 *
 * Declared rather than generated. A feed is a nested thing (incidents, each
 * with its own updates; agreements; a daily series), and there are fourteen of
 * them -- a generator would be longer than the data.
 */

/* -------------------------------------------------------------------------- */
/* Model                                                                       */
/* -------------------------------------------------------------------------- */

/** "Now", for every relative time in the workspace. Matches the regulations sample. */
export const FEEDS_NOW = "2026-10-01T09:00:00Z";

export const ORGANIZATION = "Lisbon";

export type FeedStandard = "MDS" | "GBFS";

/**
 * Where a feed stands between this organization and its operator.
 *
 * `available` is the catalogue: nothing has been asked. An open incident is
 * not a status of its own -- it is a connected feed having a bad day -- so it
 * is derived (see `feedHealth`), never stored.
 */
export type FeedStatus = "connected" | "pending" | "rejected" | "available";

export type IncidentState = "investigating" | "identified" | "resolved";

export type IncidentUpdate = {
  state: IncidentState;
  at: string;
  message: string;
};

export type Incident = {
  id: string;
  /** What the monitor watches, as the operator's data names it. */
  metric: string;
  title: string;
  /** Oldest first. The last update is the incident's current state. */
  updates: IncidentUpdate[];
};

export type Agreement = {
  id: string;
  title: string;
  version: string;
  signedAt: string;
  signedBy: string;
};

export type Feed = {
  id: string;
  operator: string;
  name: string;
  standard: FeedStandard;
  /** Null when the operator has not said which version it publishes. */
  version: string | null;
  vehicles: Vehicle[];
  status: FeedStatus;
  /** The endpoints this organization receives, or would. */
  endpoints: string[];
  requestedAt?: string;
  /** When the operator answered: approved or refused. */
  respondedAt?: string;
  /** In the operator's words, verbatim. Rejected feeds only. */
  rejectionReason?: string;
  lastRecordAt?: string;
  /** Records received per day, oldest first, ending yesterday. Connected feeds only. */
  daily?: number[];
  incidents: Incident[];
  agreements: Agreement[];
};

export const STANDARD_ENDPOINTS: Record<FeedStandard, string[]> = {
  MDS: ["Trips", "Events", "Vehicles", "Vehicle status"],
  GBFS: ["Station information", "Station status", "Free bike status", "System alerts"],
};

/** The versions an operator can be asked for, newest first. */
export const STANDARD_VERSIONS: Record<FeedStandard, string[]> = {
  MDS: ["2.0.0", "1.2.0"],
  GBFS: ["2.3", "2.2"],
};

export const PURPOSES = {
  compliance: "Compliance monitoring",
  planning: "Planning and analysis",
  reporting: "Public reporting",
} as const;

export type Purpose = keyof typeof PURPOSES;

/* -------------------------------------------------------------------------- */
/* Derived                                                                     */
/* -------------------------------------------------------------------------- */

export const isOpen = (incident: Incident) =>
  incident.updates.at(-1)?.state !== "resolved";

export const openIncidents = (feed: Feed) => feed.incidents.filter(isOpen);

/**
 * What the list shows for a feed. Only a connected feed has health; for the
 * rest the request status is the whole story.
 */
export type FeedHealth = "healthy" | "incident" | FeedStatus;

export function feedHealth(feed: Feed): FeedHealth {
  if (feed.status !== "connected") return feed.status;
  return openIncidents(feed).length ? "incident" : "healthy";
}

export const HEALTH_LABELS: Record<FeedHealth, string> = {
  healthy: "Connected",
  incident: "Incident open",
  connected: "Connected",
  pending: "Awaiting operator",
  rejected: "Rejected",
  available: "Not requested",
};

/* -------------------------------------------------------------------------- */
/* Samples                                                                     */
/* -------------------------------------------------------------------------- */

/** A steady month with weekend dips, so a chart has a shape before an incident cuts it. */
function series(base: number, seed: number, drop?: { day: number; to: number }) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return Array.from({ length: 30 }, (_, i) => {
    // 1 Sep 2026 is a Tuesday; i = 4 and 5 are the first weekend.
    const weekday = (i + 2) % 7;
    const weekend = weekday === 6 || weekday === 0 ? 0.78 : 1;
    const v = Math.round(base * weekend * (0.92 + next() * 0.16));
    return drop && i === drop.day ? Math.round(v * drop.to) : v;
  });
}

const LISBON_DSA: Omit<Agreement, "id" | "signedAt"> = {
  title: "Lisbon micromobility data sharing agreement",
  version: "3.1",
  signedBy: "Ana Ribeiro",
};

export const SAMPLE_FEEDS: Feed[] = [
  {
    id: "lime-lisbon",
    operator: "Lime",
    name: "Lime Lisbon",
    standard: "MDS",
    version: "2.0.0",
    vehicles: ["scooter", "bike"],
    status: "connected",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2025-03-04T10:12:00Z",
    respondedAt: "2025-03-06T08:40:00Z",
    lastRecordAt: "2026-10-01T08:57:00Z",
    daily: series(14200, 11),
    incidents: [
      {
        id: "lime-1",
        metric: "Trip count",
        title: "Low trip count",
        updates: [
          {
            state: "investigating",
            at: "2026-09-14T06:05:00Z",
            message: "Daily trip count dropped to 41% of the prior week's average (14,310 to 5,867).",
          },
          {
            state: "resolved",
            at: "2026-09-15T07:30:00Z",
            message: "Daily trip count returned to 98% of the prior week's average (14,310 to 14,024).",
          },
        ],
      },
    ],
    agreements: [
      { id: "lime-dsa", ...LISBON_DSA, signedAt: "2025-03-06T08:40:00Z" },
    ],
  },
  {
    id: "voi-lisbon",
    operator: "Voi",
    name: "Voi Lisbon",
    standard: "MDS",
    version: "2.0.0",
    vehicles: ["scooter"],
    status: "connected",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2025-03-04T10:15:00Z",
    respondedAt: "2025-03-11T14:02:00Z",
    lastRecordAt: "2026-09-30T23:41:00Z",
    daily: series(9100, 23, { day: 29, to: 0.06 }),
    incidents: [
      {
        id: "voi-2",
        metric: "Trip count",
        title: "Low trip count",
        updates: [
          {
            state: "investigating",
            at: "2026-10-01T06:04:00Z",
            message: "Daily trip count dropped to 6% of the prior week's average (9,240 to 554).",
          },
          {
            state: "identified",
            at: "2026-10-01T08:15:00Z",
            message: "Voi confirmed their trips endpoint has been returning empty pages since 23:45. A fix is being deployed.",
          },
        ],
      },
      {
        id: "voi-1",
        metric: "Trip distance (km)",
        title: "Low trip distance",
        updates: [
          {
            state: "investigating",
            at: "2026-09-03T06:02:00Z",
            message: "Daily trip distance dropped to 0% of the prior week's average (2.1 km to 0 km).",
          },
          {
            state: "resolved",
            at: "2026-09-03T15:48:00Z",
            message: "Daily trip distance returned to 101% of the prior week's average (2.1 km to 2.1 km).",
          },
        ],
      },
    ],
    agreements: [
      { id: "voi-dsa", ...LISBON_DSA, signedAt: "2025-03-11T14:02:00Z" },
    ],
  },
  {
    id: "bolt-lisbon",
    operator: "Bolt",
    name: "Bolt Lisbon",
    standard: "MDS",
    version: "1.2.0",
    vehicles: ["scooter", "bike"],
    status: "connected",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2025-04-22T09:00:00Z",
    respondedAt: "2025-05-02T11:20:00Z",
    lastRecordAt: "2026-10-01T08:52:00Z",
    daily: series(11800, 37),
    incidents: [
      {
        id: "bolt-1",
        metric: "Count destination",
        title: "Low count destination",
        updates: [
          {
            state: "investigating",
            at: "2026-09-21T06:06:00Z",
            message: "Daily count destination dropped to 0% of the prior week's average (11,640 to 0).",
          },
          {
            state: "resolved",
            at: "2026-09-22T13:36:00Z",
            message: "Daily count destination returned to 102% of the prior week's average (11,640 to 11,873).",
          },
        ],
      },
      {
        id: "bolt-2",
        metric: "Trip duration (minutes)",
        title: "Low trip duration",
        updates: [
          {
            state: "investigating",
            at: "2026-09-21T06:06:00Z",
            message: "Daily trip duration dropped to 0% of the prior week's average (9 min to 0 min).",
          },
          {
            state: "resolved",
            at: "2026-09-22T13:36:00Z",
            message: "Daily trip duration returned to 67% of the prior week's average (9 min to 6 min).",
          },
        ],
      },
    ],
    agreements: [
      { id: "bolt-dsa", ...LISBON_DSA, signedAt: "2025-05-02T11:20:00Z" },
      {
        id: "bolt-addendum",
        title: "Event data addendum",
        version: "1.0",
        signedAt: "2026-02-17T16:05:00Z",
        signedBy: "Ana Ribeiro",
      },
    ],
  },
  {
    id: "dott-lisbon",
    operator: "Dott",
    name: "Dott Lisbon",
    standard: "MDS",
    version: "2.0.0",
    vehicles: ["scooter", "bike"],
    status: "connected",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2025-06-10T13:30:00Z",
    respondedAt: "2025-06-12T09:00:00Z",
    lastRecordAt: "2026-10-01T08:59:00Z",
    daily: series(10400, 41),
    incidents: [],
    agreements: [
      { id: "dott-dsa", ...LISBON_DSA, signedAt: "2025-06-12T09:00:00Z" },
    ],
  },
  {
    id: "gira-lisbon",
    operator: "Gira",
    name: "Gira Lisbon",
    standard: "GBFS",
    version: "2.3",
    vehicles: ["bike"],
    status: "connected",
    endpoints: STANDARD_ENDPOINTS.GBFS,
    requestedAt: "2025-01-15T10:00:00Z",
    respondedAt: "2025-01-15T16:45:00Z",
    lastRecordAt: "2026-10-01T09:00:00Z",
    daily: series(4300, 53),
    incidents: [],
    agreements: [
      {
        id: "gira-open",
        title: "EMEL open data licence",
        version: "2.0",
        signedAt: "2025-01-15T16:45:00Z",
        signedBy: "Ana Ribeiro",
      },
    ],
  },
  {
    id: "bird-lisbon",
    operator: "Bird",
    name: "Bird Lisbon",
    standard: "MDS",
    version: "2.0.0",
    vehicles: ["scooter"],
    status: "pending",
    endpoints: ["Trips", "Vehicles", "Vehicle status"],
    requestedAt: "2026-09-24T15:20:00Z",
    incidents: [],
    agreements: [],
  },
  {
    id: "felyx-lisbon",
    operator: "Felyx",
    name: "Felyx Lisbon",
    standard: "MDS",
    version: "1.2.0",
    vehicles: ["moped"],
    status: "pending",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2026-09-29T10:02:00Z",
    incidents: [],
    agreements: [],
  },
  {
    id: "cooltra-lisbon",
    operator: "Cooltra",
    name: "Cooltra Lisbon",
    standard: "MDS",
    version: "1.2.0",
    vehicles: ["moped", "scooter"],
    status: "rejected",
    endpoints: STANDARD_ENDPOINTS.MDS,
    requestedAt: "2026-08-18T09:40:00Z",
    respondedAt: "2026-08-27T12:10:00Z",
    rejectionReason:
      "We can share trips and vehicle status, but not events. Please send a request without the events endpoint.",
    incidents: [],
    agreements: [],
  },
  {
    id: "acciona-lisbon",
    operator: "Acciona",
    name: "Acciona Lisbon",
    standard: "MDS",
    version: null,
    vehicles: ["moped"],
    status: "rejected",
    endpoints: ["Trips", "Vehicles"],
    requestedAt: "2026-07-02T11:00:00Z",
    respondedAt: "2026-07-20T08:30:00Z",
    rejectionReason:
      "Our MDS feed for Lisbon is not live yet. We expect it before the end of the year.",
    incidents: [],
    agreements: [],
  },
  {
    id: "hopp-lisbon",
    operator: "Hopp",
    name: "Hopp Lisbon",
    standard: "MDS",
    version: "2.0.0",
    vehicles: ["scooter"],
    status: "available",
    endpoints: STANDARD_ENDPOINTS.MDS,
    incidents: [],
    agreements: [],
  },
  {
    id: "emov-lisbon",
    operator: "Emov",
    name: "Emov Lisbon",
    standard: "MDS",
    version: null,
    vehicles: ["car"],
    status: "available",
    endpoints: STANDARD_ENDPOINTS.MDS,
    incidents: [],
    agreements: [],
  },
  {
    id: "free2move-lisbon",
    operator: "Free2Move",
    name: "Free2Move Lisbon",
    standard: "MDS",
    version: "1.2.0",
    vehicles: ["car"],
    status: "available",
    endpoints: STANDARD_ENDPOINTS.MDS,
    incidents: [],
    agreements: [],
  },
  {
    id: "lime-gbfs",
    operator: "Lime",
    name: "Lime Lisbon (public)",
    standard: "GBFS",
    version: "2.2",
    vehicles: ["scooter", "bike"],
    status: "available",
    endpoints: ["Free bike status", "System alerts"],
    incidents: [],
    agreements: [],
  },
  {
    id: "cityscoot-lisbon",
    operator: "Cityscoot",
    name: "Cityscoot Lisbon",
    standard: "GBFS",
    version: null,
    vehicles: ["moped"],
    status: "available",
    endpoints: ["Free bike status", "System alerts"],
    incidents: [],
    agreements: [],
  },
];
