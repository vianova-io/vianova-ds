/**
 * Sample data and copy for the Citizen Platform workspace.
 *
 * Captured from the Munich tenant of the citizen reporting app on
 * 2026-10-23. The copy tree is the production one verbatim, both locales:
 * the app ships German-first with an EN/DE toggle on every screen, so a
 * single-language demo would misrepresent it. The CAPTCHA strings are the
 * one omission -- the real app gates every data call behind AWS WAF, which
 * is infrastructure rather than design.
 *
 * Vehicle positions are placed by hand around Marienplatz. There is no live
 * feed here: production reads signed vector tiles that a design-system demo
 * has no business holding credentials for.
 */

export type CitizenLocale = "en" | "de";

/** The six types the production app's `vehicle.types` tree enumerates. */
export type VehicleType =
  | "bicycle"
  | "cargo_bicycle"
  | "car"
  | "scooter"
  | "moped"
  | "other";

/** The six report reasons, in the order production renders them. */
export type ReportReason =
  | "bad_parking"
  | "traffic_obstruction"
  | "traffic_danger"
  | "defect_damage"
  | "vandalism"
  | "other";

/** How the reporter found the vehicle. Drives whether a photo is required. */
export type FindMethod = "qr" | "map" | "list" | "search" | "unlisted";

/**
 * Report lifecycle, polled on the done screen until it settles.
 * `received` and `sending` deliberately share a label in production.
 */
export type ReportStatus =
  | "received"
  | "sending"
  | "sent"
  | "parked"
  | "rejected"
  | "expired";

export type CitizenVehicle = {
  id: string;
  operator: string;
  type: VehicleType;
  /** [lon, lat] -- MapLibre order, not the lat/lon the API takes. */
  position: [number, number];
  /** Metres from the sample location, for the "near you" list. */
  distanceM: number;
  /** Already reported: the city is handling it, so it cannot be reported again. */
  reported?: boolean;
  /** Minutes until a reported vehicle can be reported again. */
  lockedForMinutes?: number;
};

export const VEHICLE_TYPES: readonly VehicleType[] = [
  "bicycle",
  "cargo_bicycle",
  "car",
  "scooter",
  "moped",
  "other",
];

export const REPORT_REASONS: readonly ReportReason[] = [
  "bad_parking",
  "traffic_obstruction",
  "traffic_danger",
  "defect_damage",
  "vandalism",
  "other",
];

/** Operators the Munich tenant lists in the unlisted-vehicle form. */
export const CITIZEN_OPERATORS: readonly string[] = [
  "Bolt",
  "Dott",
  "Lime",
  "MVG Rad",
  "TIER",
  "Voi",
];

/** Marienplatz. The map and the "near you" distances are measured from here. */
export const CITIZEN_CENTER: [number, number] = [11.5755, 48.1374];

/** Production caps photos at five and the comment at 500 characters. */
export const MAX_PHOTOS = 5;
export const MAX_COMMENT = 500;
/** `vehicle.near.hint` promises at most this many within 50 m. */
export const MAX_NEAR = 5;

export const SAMPLE_VEHICLES: readonly CitizenVehicle[] = [
  { id: "TIER-8F42K", operator: "TIER", type: "scooter", position: [11.5751, 48.1379], distanceM: 12 },
  { id: "LIME-QX907", operator: "Lime", type: "scooter", position: [11.5762, 48.1371], distanceM: 24 },
  { id: "MVG-R-20418", operator: "MVG Rad", type: "bicycle", position: [11.5744, 48.1368], distanceM: 31 },
  {
    id: "VOI-3310BC",
    operator: "Voi",
    type: "scooter",
    position: [11.5769, 48.1382],
    distanceM: 38,
    reported: true,
    lockedForMinutes: 42,
  },
  { id: "DOTT-77A1", operator: "Dott", type: "bicycle", position: [11.5738, 48.1377], distanceM: 46 },
  { id: "BOLT-5KD92", operator: "Bolt", type: "scooter", position: [11.5773, 48.1365], distanceM: 61 },
  { id: "MVG-C-0912", operator: "MVG Rad", type: "cargo_bicycle", position: [11.5729, 48.1384], distanceM: 88 },
  { id: "TIER-1A55M", operator: "TIER", type: "moped", position: [11.5784, 48.1358], distanceM: 134 },
  { id: "DOTT-44F0", operator: "Dott", type: "bicycle", position: [11.5717, 48.1361], distanceM: 190 },
];

export const CITIZEN_COPY = {
  en: {
    app: {
      title: "Report a vehicle",
      intro: "Report a badly parked shared vehicle. You do not need an account.",
      start: "Start a report",
      openMap: "Find the vehicle on the map",
      language: "Deutsch",
      apiUnavailable: "The service is not available now. Please try again later.",
    },
    report: {
      vehicle: "Vehicle ID",
      vehicleHint: "The ID is on the vehicle, often next to the QR code.",
      reason: "Reason",
      reasons: {
        bad_parking: "Bad parking",
        traffic_obstruction: "Obstruction of traffic",
        traffic_danger: "Danger to traffic",
        defect_damage: "Defect or damage",
        vandalism: "Vandalism",
        other: "Other",
      },
      comment: "Comment",
      commentHint: "Optional, required for the reason \"Other\". Do not write personal data.",
      count: "{{n}} / {{max}}",
      send: "Send report",
      sending: "Sending …",
      errors: {
        vehicleRequired: "Enter the vehicle ID.",
        vehicleFormat: "Use letters, digits, spaces and . _ : - only.",
        reasonRequired: "Select a reason.",
        commentRequired: "Describe the problem for the reason \"Other\".",
      },
      failure: {
        invalid: "The report is not valid. Please check your input.",
        rate_limited: "Too many reports. Please try again in 5 minutes.",
        unavailable: "The report could not be sent. Please try again later.",
        vehicle_locked: "This vehicle was reported. It is available again in <timer>{{time}}</timer>.",
        vehicle_has_open_report: "This vehicle is already reported. The city handles it.",
        not_in_live_data: "This vehicle is not in the live data. Please choose the vehicle again.",
        photo_required: "A photo is required for this report.",
        photo_unknown: "The app cannot use one of the photos. Please add the photos again.",
        altcha_invalid: "The security check failed. Please send the report again.",
        intake_paused: "Reports are paused, try again later.",
        unlisted_disabled: "A report on a vehicle that is not on the map is not possible now.",
      },
      done: {
        title: "Thank you",
        text: "We received your report.",
        reference: "Your report reference:",
        new: "New report",
      },
      status: {
        received: "Received",
        sending: "Received",
        sent: "Sent to the city",
        parked: "Delayed, we will retry it",
        rejected: "Could not be sent to the city",
        expired: "Could not be sent to the city",
        already_reported: "This vehicle is already reported. The city handles it.",
      },
    },
    vehicle: {
      title: "Vehicle",
      operator: "Operator",
      type: "Type",
      id: "Vehicle ID",
      types: {
        bicycle: "Bike",
        cargo_bicycle: "Cargo bike",
        car: "Car",
        scooter: "Scooter",
        moped: "Moped",
        other: "Other",
      },
      report: "Report this vehicle",
      locked: "Reported, available again in {{time}}",
      openReport: "This vehicle is already reported. The city handles it.",
      loading: "Loading the vehicle …",
      search: {
        label: "Search a vehicle by its ID",
        hint: "The ID is on the vehicle. Press Enter to search.",
        searching: "Searching …",
      },
      near: {
        title: "Vehicles near you",
        hint: "Up to {{count}} vehicles within 50 m, the nearest first.",
        loading: "Loading the vehicles near you …",
        empty: "No vehicle within 50 m. Use the search or the map.",
        reported: "Reported",
        back: "Back to the list",
      },
      errors: {
        notFound: "Not found in the live data.",
        liveDataUnavailable: "Live data is not available, try again later.",
        unavailable: "The vehicles could not be loaded. Please try again later.",
      },
    },
    qr: {
      title: "Scan the QR code",
      video: "Camera view for the QR code scan",
      hint: "Hold the camera over the QR code on the vehicle.",
      starting: "Starting the camera …",
      resolving: "Looking up the vehicle …",
      scanAgain: "Scan again",
      cameraDenied: "The camera is off or not available, so the app cannot scan the QR code. You can find the vehicle in another way.",
      fallbackTitle: "Find the vehicle in another way",
      fallback: {
        map: "Use the map",
        list: "Use the list near me",
        search: "Use the search",
      },
      prompt: {
        title: "Scan the QR code first",
        text: "The QR code on the vehicle finds the vehicle with no typing.",
        scan: "Scan the QR code",
        skip: "Scan not possible",
      },
    },
    unlisted: {
      link: "Report a vehicle that is not on the map",
      title: "Report a vehicle that is not on the map",
      loading: "Loading the form …",
      operatorPlaceholder: "Select an operator",
      errors: {
        operatorRequired: "Select the operator.",
      },
    },
    photo: {
      title: "Photos of the problem",
      required: "A photo is required for this report.",
      optional: "A photo is optional after a QR scan.",
      warningTitle: "Before you take a photo",
      warningPeople: "Do not photograph people, vehicle plates or private property.",
      warningComment: "Do not write personal data in the comment.",
      add: "Add photos",
      continue: "Continue",
      count: "{{n}} of {{max}} photos added",
      uploading: "Sending the photos …",
      added: "Photo {{n}} added",
      remove: "Remove photo {{n}}",
      failure: {
        too_many: "You can add {{max}} photos at most.",
        invalid: "The app cannot use this photo. Please choose another photo.",
        rate_limited: "Too many photos. Please try again in a few minutes.",
        unavailable: "The photos could not be sent. Please try again later.",
      },
    },
    map: {
      title: "Find the vehicle",
      listTitle: "List view",
      label: "Map of the available vehicles",
      loading: "Loading the map …",
      back: "Back",
      listView: "List view",
      locate: "Locate me",
      locating: "Looking for your position …",
      locateDenied: "Your location is off, so the map stays where it is. You can still use the map, the QR scan and the search.",
      locateUnavailable: "Your position could not be found. You can still use the map, the QR scan and the search.",
      filter: "Filter",
      operator: "Operator",
      type: "Vehicle type",
      allOperators: "All operators",
      allTypes: "All types",
      types: {
        bicycle: "bicycle",
        cargo_bicycle: "cargo bike",
        car: "car",
        scooter: "scooter",
        moped: "moped",
        other: "other",
      },
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      attribution: "Show or hide the map credits",
      canvas: "Map",
    },
  },
  de: {
    app: {
      title: "Fahrzeug melden",
      intro: "Melden Sie ein falsch abgestelltes Leihfahrzeug. Sie brauchen kein Konto.",
      start: "Meldung starten",
      openMap: "Fahrzeug auf der Karte finden",
      language: "English",
      apiUnavailable: "Der Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.",
    },
    report: {
      vehicle: "Fahrzeug-ID",
      vehicleHint: "Die ID steht auf dem Fahrzeug, oft neben dem QR-Code.",
      reason: "Meldegrund",
      reasons: {
        bad_parking: "Falschabstellung",
        traffic_obstruction: "Behinderung oder Einschränkung des Verkehrs",
        traffic_danger: "Gefährdung des Verkehrs",
        defect_damage: "Defekt oder Beschädigung",
        vandalism: "Vandalismus",
        other: "Sonstiges",
      },
      comment: "Kommentar",
      commentHint: "Optional, beim Meldegrund „Sonstiges“ erforderlich. Bitte schreiben Sie keine persönlichen Daten.",
      count: "{{n}} / {{max}}",
      send: "Meldung senden",
      sending: "Wird gesendet …",
      errors: {
        vehicleRequired: "Geben Sie die Fahrzeug-ID ein.",
        vehicleFormat: "Verwenden Sie nur Buchstaben, Ziffern, Leerzeichen und . _ : -",
        reasonRequired: "Wählen Sie einen Meldegrund.",
        commentRequired: "Beschreiben Sie das Problem beim Meldegrund „Sonstiges“.",
      },
      failure: {
        invalid: "Die Meldung ist nicht gültig. Bitte prüfen Sie Ihre Angaben.",
        rate_limited: "Zu viele Meldungen. Bitte versuchen Sie es in 5 Minuten noch einmal.",
        unavailable: "Die Meldung konnte nicht gesendet werden. Bitte versuchen Sie es später noch einmal.",
        vehicle_locked: "Dieses Fahrzeug wurde gemeldet. Es ist wieder verfügbar in <timer>{{time}}</timer>.",
        vehicle_has_open_report: "Dieses Fahrzeug ist bereits gemeldet. Die Stadt kümmert sich darum.",
        not_in_live_data: "Dieses Fahrzeug ist nicht in den Live-Daten. Bitte wählen Sie das Fahrzeug erneut aus.",
        photo_required: "Für diese Meldung ist ein Foto erforderlich.",
        photo_unknown: "Die App kann eines der Fotos nicht verwenden. Bitte fügen Sie die Fotos erneut hinzu.",
        altcha_invalid: "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte senden Sie die Meldung erneut.",
        intake_paused: "Meldungen sind pausiert. Bitte versuchen Sie es später noch einmal.",
        unlisted_disabled: "Eine Meldung zu einem Fahrzeug, das nicht auf der Karte ist, ist gerade nicht möglich.",
      },
      done: {
        title: "Vielen Dank",
        text: "Wir haben Ihre Meldung erhalten.",
        reference: "Ihre Meldungsnummer:",
        new: "Neue Meldung",
      },
      status: {
        received: "Eingegangen",
        sending: "Eingegangen",
        sent: "An die Stadt gesendet",
        parked: "Verzögert, wir versuchen es erneut",
        rejected: "Konnte nicht an die Stadt gesendet werden",
        expired: "Konnte nicht an die Stadt gesendet werden",
        already_reported: "Dieses Fahrzeug ist bereits gemeldet. Die Stadt kümmert sich darum.",
      },
    },
    vehicle: {
      title: "Fahrzeug",
      operator: "Anbieter",
      type: "Fahrzeugart",
      id: "Fahrzeug-ID",
      types: {
        bicycle: "Fahrrad",
        cargo_bicycle: "Lastenrad",
        car: "Auto",
        scooter: "E-Scooter",
        moped: "Moped",
        other: "Sonstiges",
      },
      report: "Dieses Fahrzeug melden",
      locked: "Gemeldet, wieder verfügbar in {{time}}",
      openReport: "Dieses Fahrzeug ist bereits gemeldet. Die Stadt kümmert sich darum.",
      loading: "Das Fahrzeug wird geladen …",
      search: {
        label: "Fahrzeug über die ID suchen",
        hint: "Die ID steht auf dem Fahrzeug. Drücken Sie die Eingabetaste zum Suchen.",
        searching: "Es wird gesucht …",
      },
      near: {
        title: "Fahrzeuge in Ihrer Nähe",
        hint: "Bis zu {{count}} Fahrzeuge im Umkreis von 50 m, das nächste zuerst.",
        loading: "Die Fahrzeuge in Ihrer Nähe werden geladen …",
        empty: "Kein Fahrzeug im Umkreis von 50 m. Nutzen Sie die Suche oder die Karte.",
        reported: "Gemeldet",
        back: "Zurück zur Liste",
      },
      errors: {
        notFound: "In den Live-Daten nicht gefunden.",
        liveDataUnavailable: "Die Live-Daten sind gerade nicht verfügbar. Bitte versuchen Sie es später noch einmal.",
        unavailable: "Die Fahrzeuge konnten nicht geladen werden. Bitte versuchen Sie es später noch einmal.",
      },
    },
    qr: {
      title: "QR-Code scannen",
      video: "Kameraansicht für den QR-Code-Scan",
      hint: "Halten Sie die Kamera auf den QR-Code am Fahrzeug.",
      starting: "Die Kamera wird gestartet …",
      resolving: "Das Fahrzeug wird gesucht …",
      scanAgain: "Erneut scannen",
      cameraDenied: "Die Kamera ist nicht freigegeben oder nicht verfügbar, deshalb kann die App den QR-Code nicht scannen. Sie können das Fahrzeug auch anders finden.",
      fallbackTitle: "Fahrzeug anders finden",
      fallback: {
        map: "Karte nutzen",
        list: "Liste in meiner Nähe nutzen",
        search: "Suche nutzen",
      },
      prompt: {
        title: "Zuerst den QR-Code scannen",
        text: "Der QR-Code am Fahrzeug findet das Fahrzeug ohne Tippen.",
        scan: "QR-Code scannen",
        skip: "Scan nicht möglich",
      },
    },
    unlisted: {
      link: "Ein Fahrzeug melden, das nicht auf der Karte ist",
      title: "Ein Fahrzeug melden, das nicht auf der Karte ist",
      loading: "Das Formular wird geladen …",
      operatorPlaceholder: "Anbieter auswählen",
      errors: {
        operatorRequired: "Wählen Sie den Anbieter.",
      },
    },
    photo: {
      title: "Fotos vom Problem",
      required: "Für diese Meldung ist ein Foto erforderlich.",
      optional: "Nach einem QR-Scan ist ein Foto freiwillig.",
      warningTitle: "Bevor Sie ein Foto machen",
      warningPeople: "Fotografieren Sie keine Personen, Kfz-Kennzeichen oder Privatgrundstücke.",
      warningComment: "Schreiben Sie keine personenbezogenen Daten in den Kommentar.",
      add: "Fotos hinzufügen",
      continue: "Weiter",
      count: "{{n}} von {{max}} Fotos hinzugefügt",
      uploading: "Die Fotos werden gesendet …",
      added: "Foto {{n}} hinzugefügt",
      remove: "Foto {{n}} entfernen",
      failure: {
        too_many: "Sie können höchstens {{max}} Fotos hinzufügen.",
        invalid: "Die App kann dieses Foto nicht verwenden. Bitte wählen Sie ein anderes Foto.",
        rate_limited: "Zu viele Fotos. Bitte versuchen Sie es in einigen Minuten noch einmal.",
        unavailable: "Die Fotos konnten nicht gesendet werden. Bitte versuchen Sie es später noch einmal.",
      },
    },
    map: {
      title: "Fahrzeug finden",
      listTitle: "Listenansicht",
      label: "Karte der verfügbaren Fahrzeuge",
      loading: "Die Karte wird geladen …",
      back: "Zurück",
      listView: "Listenansicht",
      locate: "Mein Standort",
      locating: "Ihr Standort wird gesucht …",
      locateDenied: "Ihr Standort ist nicht freigegeben, die Karte bleibt deshalb, wo sie ist. Karte, QR-Scan und Suche funktionieren weiterhin.",
      locateUnavailable: "Ihr Standort wurde nicht gefunden. Karte, QR-Scan und Suche funktionieren weiterhin.",
      filter: "Filter",
      operator: "Anbieter",
      type: "Fahrzeugart",
      allOperators: "Alle Anbieter",
      allTypes: "Alle Fahrzeugarten",
      types: {
        bicycle: "Fahrrad",
        cargo_bicycle: "Lastenrad",
        car: "Auto",
        scooter: "E-Scooter",
        moped: "Moped",
        other: "Sonstiges",
      },
      zoomIn: "Vergrößern",
      zoomOut: "Verkleinern",
      attribution: "Kartenquellen ein- oder ausblenden",
      canvas: "Karte",
    },
  },
} as const;

type CopyTree = typeof CITIZEN_COPY.en;

/**
 * Dot-path lookup with `{{var}}` interpolation, matching how the production
 * app calls i18next. Tags such as `<timer>…</timer>` are stripped: they exist
 * so production can wrap a live countdown, and there is nothing to count here.
 *
 * A missing key returns the path itself rather than throwing -- a demo block
 * should render a visible wrong string, not blank the whole workspace.
 */
export function citizenCopy(locale: CitizenLocale) {
  const tree = CITIZEN_COPY[locale];
  return function t(
    path: string,
    vars?: Record<string, string | number>,
  ): string {
    let node: unknown = tree;
    for (const key of path.split(".")) {
      if (typeof node !== "object" || node === null) return path;
      node = (node as Record<string, unknown>)[key];
    }
    if (typeof node !== "string") return path;
    return node
      .replace(/<\/?[a-z]+>/g, "")
      .replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
        vars && name in vars ? String(vars[name]) : whole,
      );
  };
}

/** Type-safe access to the copy tree, for callers that want the object. */
export function citizenTree(locale: CitizenLocale): CopyTree {
  return CITIZEN_COPY[locale] as CopyTree;
}

/**
 * A photo is mandatory unless the vehicle was identified by its QR code.
 * Production calls this on both the photo step and the form's failure path.
 */
export function photoRequired(method: FindMethod): boolean {
  return method !== "qr";
}

/** Metres below a kilometre, matching the "within 50 m" copy's register. */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}

/** `42` -> `42:00`, the shape `vehicle.locked` interpolates. */
export function formatLockTime(minutes: number): string {
  return `${minutes}:00`;
}

/** Nearest first, capped the way `vehicle.near.hint` promises. */
export function vehiclesNear(
  vehicles: readonly CitizenVehicle[] = SAMPLE_VEHICLES,
  withinM = 50,
  limit = MAX_NEAR,
): CitizenVehicle[] {
  return vehicles
    .filter((v) => v.distanceM <= withinM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** Production's reference format: a short opaque token the city can quote. */
export function sampleReportId(): string {
  return "MUC-7F3K-2908";
}
