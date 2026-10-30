"use client";

import * as React from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Crosshair,
  ImagePlus,
  List,
  MapIcon,
  Minus,
  Plus,
  QrCode,
  Search,
  RotateCw,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/registry/vianova/ui/alert";
import { Button } from "@/registry/vianova/ui/button";
import { Card, CardContent } from "@/registry/vianova/ui/card";
import {
  ChoiceCard,
  ChoiceCardGroup,
} from "@/registry/vianova/ui/choice-card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/registry/vianova/ui/field";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import { Input } from "@/registry/vianova/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/registry/vianova/ui/item";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/registry/vianova/ui/native-select";
import { Skeleton } from "@/registry/vianova/ui/skeleton";
import { Spinner } from "@/registry/vianova/ui/spinner";
import { Textarea } from "@/registry/vianova/ui/textarea";
import { CopyButton } from "@/registry/vianova/patterns/copy-button";
import { PhoneFrame } from "@/registry/vianova/patterns/phone-frame";
import { StatusBadge } from "@/registry/vianova/patterns/status-badge";
import { Timeline, TimelineItem } from "@/registry/vianova/patterns/timeline";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { SegmentedControl } from "@/registry/vianova/product/segmented-control";
import { useCategoryPointLayer } from "@/registry/vianova/hooks/use-category-point-layer";
import {
  badgeColor,
  resolveStyles,
} from "@/registry/vianova/lib/category-style";
import {
  operatorStyle,
  operatorStyles,
} from "@/registry/vianova/lib/sample-datasets";
import { CategoryBadge } from "@/registry/vianova/product/category-badge";
import { resolveCssColor } from "@/registry/vianova/lib/css-color";
import {
  CITIZEN_CENTER,
  CITIZEN_OPERATORS,
  MAX_COMMENT,
  MAX_PHOTOS,
  MAX_NEAR,
  REPORT_REASONS,
  SAMPLE_VEHICLES,
  VEHICLE_TYPES,
  citizenCopy,
  formatDistance,
  formatLockTime,
  photoRequired,
  sampleReportId,
  validVehicleId,
  vehiclesNear,
  type CitizenLocale,
  type CitizenScenario,
  type CitizenVehicle,
  type FindMethod,
  type ReportReason,
  type ReportStatus,
  type VehicleType,
} from "@/registry/vianova/lib/sample-citizen";
import { cn } from "@/registry/vianova/lib/utils";

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Declared locally so this file compiles in a project without @types/node. The
 * expression must read `process.env.NEXT_PUBLIC_BASE_PATH` VERBATIM, because
 * Next substitutes that exact text at build time.
 */
declare const process: { env: Record<string, string | undefined> };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WORKER_URL = `${BASE_PATH}/maplibre/maplibre-gl-worker.mjs`;

/** The hook names its layers `<id>-dots` and `<id>-logos`. */
const POINTS_ID = "citizen-vehicles";
const DOTS_LAYER = `${POINTS_ID}-dots`;
const LOGOS_LAYER = `${POINTS_ID}-logos`;

/**
 * The zoom at which `useCategoryPointLayer` hands the dot over to the badge.
 *
 * Shared rather than passed inline, because two things here have to agree with
 * it: the hit test, which must query whichever of the two layers is the one
 * currently drawn, and the selection ring, whose radius has to clear a marker
 * whose size changes at this zoom.
 */
const LOGO_ZOOM = 15;

/**
 * The badge image is composed at 64px and added at `pixelRatio: 2`, so it is
 * 32 CSS px across -- 16px of radius before `icon-size` scales it.
 */
const BADGE_RADIUS = 16;

/** Clear air between the marker's edge and the ring drawn round it. */
const RING_GAP = 6;

/** The ring drawn round the chosen vehicle. Local to this block. */
const SELECTED_SOURCE = "citizen-selected";
const SELECTED_LAYER = `${SELECTED_SOURCE}-ring`;

/**
 * Half the side of the box a tap is tested against, in screen pixels.
 *
 * A bare `queryRenderedFeatures(point)` is a one-pixel hit test, which a thumb
 * loses against a small dot often enough to read as the map ignoring you. 12
 * gives a 24px target around the tap -- close to the 44px recommendation once
 * the dot's own radius is counted -- and the handler still resolves to the dot
 * nearest the tap, so a padded box never picks the wrong neighbour.
 */
const HIT_PADDING = 12;

/**
 * Long enough for a pending state to be seen, short enough not to annoy.
 *
 * Every one of these stands in for a round trip the block does not make. They
 * exist because a state nobody can reach is a state nobody designed: the
 * spinner on Send, the skeletons under "Vehicles near you" and the status the
 * done screen settles on are all real screens in production, and all of them
 * were invisible here until something took time.
 */
const SEND_DELAY = 700;
/** The photos go first; the report cannot be sent without them. */
const UPLOAD_DELAY = 600;
/** The camera, then the lookup the scanned code triggers. */
const CAMERA_DELAY = 500;
const LOOKUP_DELAY = 600;
/** The vehicle feed, on first open of a screen that needs it. */
const FEED_DELAY = 700;
/** Typing settles before the search runs, as it would against a server. */
const SEARCH_DEBOUNCE = 250;
/** The done screen polls until the report stops moving. */
const STATUS_DELAY = 1_200;

/**
 * How far above the map's centre the chosen vehicle is parked, in pixels.
 *
 * The card floats over the lower half of the map, so a dot tapped near the
 * bottom ends up underneath it -- the one dot you need to see is the one the
 * card hides. Easing the map lifts it clear. 90px puts it in the upper third
 * of a phone-sized map, which is above the card at every height this block
 * is drawn at.
 */
const SELECTED_OFFSET_Y = -90;

/**
 * A picked photo. The object URL is its identity as well as its source: it is
 * unique per file, which saves inventing a key, and it is what the thumbnail
 * renders. There is no stored label -- numbering a photo at the moment it is
 * picked survives neither a removal (photo 3 stays "photo 3" with two photos
 * left) nor a locale switch (it stays in the language it was added in).
 */
type Photo = { id: string; url: string };

/**
 * Five views, where production has nine.
 *
 * Production's flow is this block's starting point, not its specification:
 * reporting a vehicle found on the map took nine interactions there, two of
 * them spent declining a QR prompt the reporter had already answered by
 * choosing the map. Four views were friction or duplication, so four are gone:
 *
 * - `prompt` -- the "scan the QR code first" interstitial. The start screen
 *   now names both ways in, so asking again is asking twice.
 * - `map` and `list` are one `find` view with a toggle. They are two
 *   presentations of one set of vehicles, and jumping between them used to
 *   reset the filters and lose the selection.
 * - `photo` is folded into `report`. A screen of its own put a Continue
 *   between the reporter and the only screen that decides anything.
 * - `unlisted` is `report` with no vehicle, which is what it always was --
 *   the form already branched on the method rather than on the view.
 *
 * What a view carries is still only what it cannot be entered without, so a
 * reviewer can read the union and tell which screens need a vehicle.
 */
type View =
  | { name: "start" }
  | { name: "scan" }
  | { name: "find"; tab: "map" | "list" }
  | { name: "report"; vehicle: CitizenVehicle | null; method: FindMethod }
  | { name: "done"; reportId: string; vehicle: CitizenVehicle | null };

/** The vehicle a simulated QR scan lands on. */
const QR_VEHICLE = SAMPLE_VEHICLES[0]!;

/* -------------------------------------------------------------------------- */
/* Shared screen furniture                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The one header, above every screen.
 *
 * Production put Back at the BOTTOM of each screen, after the content. On the
 * map and the list that is below the fold of a 390x812 phone: the control that
 * undoes a wrong turn was the one thing you had to scroll to find. The locale
 * toggle had the same problem for the opposite reason -- it sat at the top of
 * the scrolling column, so it left the screen as soon as you read anything.
 *
 * Both live here now, in a bar that does not move, and the heading is the
 * focus target when the view changes: each view fills the screen, so without
 * moving focus a screen-reader user is left wherever the old screen's button
 * was and never hears that the screen changed.
 */
function AppHeader({
  title,
  step,
  headingRef,
  onBack,
  backLabel,
  locale,
  onLocale,
}: {
  title: string;
  /** e.g. "Step 2 of 2". Shown under the title while a report is in progress. */
  step?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  /** Omitted on the screens there is nothing to go back to. */
  onBack?: () => void;
  backLabel: string;
  locale: CitizenLocale;
  onLocale: () => void;
}) {
  const t = citizenCopy(locale);
  const other: CitizenLocale = locale === "de" ? "en" : "de";

  return (
    <div className="bg-background sticky top-0 z-30 flex shrink-0 items-center gap-1 border-b px-2 py-2">
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
      ) : (
        <span aria-hidden className="w-2 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="truncate text-base font-semibold tracking-tight outline-none"
        >
          {title}
        </h1>
        {step ? <p className="text-muted-foreground text-xs">{step}</p> : null}
      </div>
      {/*
        The accessible name says what the button DOES. It used to be the
        target language alone -- "Deutsch" -- which names a language but not an
        action, and read identically to a label on a static field.
      */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 shrink-0"
        aria-label={t("app.switchLanguage")}
        onClick={onLocale}
      >
        <span lang={other} aria-hidden>
          {t("app.language")}
        </span>
      </Button>
    </div>
  );
}

/**
 * The operator's mark, where its name is written.
 *
 * The same badge the map draws the vehicle as, so the card a resident opens
 * after tapping a pin carries the thing they tapped. Decorative: the name is
 * right beside it in every use, and CategoryBadge is aria-hidden.
 *
 * Nothing for an operator without a shipped look -- Munich runs two that the
 * sample data does not describe, and an empty disc beside a name says less
 * than the name alone.
 */
function OperatorBadge({ operator }: { operator: string }) {
  const style = operatorStyle(operator);
  if (!style) return null;
  return (
    <CategoryBadge
      color={badgeColor(style)}
      logo={style.logo}
      logoKind={style.logoKind}
      size={18}
    />
  );
}
/**
 * A vehicle as production summarises it: operator, type, ID, and its state.
 *
 * `bare` drops the box for a caller that already draws one -- the selection
 * card over the map, where a second border round this would be two boxes where
 * the reader sees one.
 */
function VehicleSummary({
  vehicle,
  locale,
  bare = false,
  className,
}: {
  vehicle: CitizenVehicle;
  locale: CitizenLocale;
  bare?: boolean;
  className?: string;
}) {
  const t = citizenCopy(locale);
  return (
    <section
      aria-label={t("vehicle.title")}
      className={cn(
        "flex flex-col gap-2",
        !bare && "rounded-lg border p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("vehicle.title")}</h2>
        {vehicle.reported ? (
          <StatusBadge tone="warning">{t("vehicle.near.reported")}</StatusBadge>
        ) : null}
      </div>
      {/*
        A description list, because that is what this is: three labelled facts.
        Production labels them too -- `vehicle.operator`, `.type` and `.id`
        exist for exactly this card -- and an unlabelled operator name over a
        mono string reads as decoration until you already know which is which.
      */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("vehicle.operator")}</dt>
        <dd className="flex min-w-0 items-center gap-1.5">
          <OperatorBadge operator={vehicle.operator} />
          <span className="truncate">{vehicle.operator}</span>
        </dd>
        <dt className="text-muted-foreground">{t("vehicle.type")}</dt>
        <dd>{t(`vehicle.types.${vehicle.type}`)}</dd>
        <dt className="text-muted-foreground">{t("vehicle.id")}</dt>
        <dd className="truncate font-mono text-xs">{vehicle.id}</dd>
      </dl>
      {vehicle.reported ? (
        <p className="text-muted-foreground text-sm">
          {t("vehicle.openReport")}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Report, or say why not.
 *
 * A reported vehicle used to be a DISABLED button whose label was the reason
 * it was disabled -- so the explanation could not be focused, read on its own,
 * or reached by anything that skips disabled controls. The explanation is text
 * now and the button is simply absent, which is the honest shape: there is no
 * action to offer.
 */
function ReportAction({
  vehicle,
  locale,
  onReport,
}: {
  vehicle: CitizenVehicle;
  locale: CitizenLocale;
  onReport: () => void;
}) {
  const t = citizenCopy(locale);
  if (vehicle.reported) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("vehicle.locked", {
          time: formatLockTime(vehicle.lockedForMinutes ?? 0),
        })}
      </p>
    );
  }
  return (
    <Button type="button" className="min-h-11" onClick={onReport}>
      {t("vehicle.report")}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Start                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The first screen, and the whole reason the flow got shorter.
 *
 * Production offered "Start a report" and "Find the vehicle on the map". The
 * first does not say that it opens a camera, and the second was followed by a
 * prompt asking whether you would rather scan after all. So both ways in are
 * named for what they do, the scan is primary because it is the shortest path
 * by two steps, and typing an ID -- previously buried in the camera-denied
 * fallback -- is offered here too.
 *
 * `app.start` is left unused: a generic verb was the problem.
 */
function StartView({
  locale,
  onScan,
  onMap,
  onList,
}: {
  locale: CitizenLocale;
  onScan: () => void;
  onMap: () => void;
  onList: () => void;
}) {
  const t = citizenCopy(locale);
  return (
    // No card title: the header above already says "Report a vehicle", and
    // production said it twice, once in each place.
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">{t("app.intro")}</p>
        <Button className="min-h-11" onClick={onScan}>
          <QrCode />
          {t("qr.prompt.scan")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("qr.prompt.text")}</p>
        <Button variant="outline" className="min-h-11" onClick={onMap}>
          <MapIcon />
          {t("app.openMap")}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onList}>
          <Search />
          {t("qr.fallback.search")}
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Scan                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The scanner, and the state every desktop browser actually shows.
 *
 * No camera can run in a documentation page, and production's own fallback is
 * the richer screen anyway -- it is the one carrying the three ways to find a
 * vehicle without scanning. So both are here and neither is on a timer: the
 * viewfinder is a button that resolves a sample vehicle, and a link switches
 * to the camera-denied state. A timed auto-advance would read as a real scan
 * but would make this block's visual snapshot depend on when it was taken.
 */
function ScanView({
  locale,
  scenario,
  onResolved,
  onChooseMethod,
}: {
  locale: CitizenLocale;
  scenario: CitizenScenario;
  onResolved: (vehicle: CitizenVehicle) => void;
  onChooseMethod: (method: "map" | "list") => void;
}) {
  const t = citizenCopy(locale);
  const [denied, setDenied] = React.useState(false);

  /**
   * A scan is three states, and production wrote copy for all three.
   *
   * `starting` is the camera waking up, `scanning` is the viewfinder, and
   * `resolving` is the lookup the code triggers -- which can fail, because a
   * code can name a vehicle the feed no longer has. Until now this screen
   * went from nothing to a filled-in form in one frame, so two of the three
   * strings had nowhere to be.
   */
  const [phase, setPhase] = React.useState<
    "starting" | "scanning" | "resolving" | "notFound"
  >("starting");
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => {
    timer.current = setTimeout(() => setPhase("scanning"), CAMERA_DELAY);
    return () => clearTimeout(timer.current);
  }, []);

  const scan = () => {
    setPhase("resolving");
    timer.current = setTimeout(() => {
      // The code reads fine; it is the lookup behind it that needs the feed.
      if (scenario === "vehicles-down") {
        setPhase("notFound");
        return;
      }
      onResolved(QR_VEHICLE);
    }, LOOKUP_DELAY);
  };

  if (denied) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>
          <CameraOff />
          <AlertDescription>{t("qr.cameraDenied")}</AlertDescription>
        </Alert>
        <h2 className="text-sm font-semibold">{t("qr.fallbackTitle")}</h2>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => onChooseMethod("map")}
        >
          <MapIcon />
          {t("qr.fallback.map")}
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => onChooseMethod("list")}
        >
          <List />
          {t("qr.fallback.list")}
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => onChooseMethod("list")}
        >
          <Search />
          {t("qr.fallback.search")}
        </Button>
      </div>
    );
  }

  if (phase === "notFound") {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertDescription>{t("vehicle.errors.notFound")}</AlertDescription>
        </Alert>
        <Button
          className="min-h-11"
          onClick={() => {
            setPhase("scanning");
          }}
        >
          <RotateCw />
          {t("qr.scanAgain")}
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => onChooseMethod("list")}
        >
          <Search />
          {t("qr.fallback.search")}
        </Button>
      </div>
    );
  }

  const busy = phase === "starting" || phase === "resolving";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-label={t("qr.video")}
        disabled={busy}
        onClick={scan}
        className="border-border bg-muted focus-visible:border-ring focus-visible:ring-ring/50 relative flex aspect-square w-full items-center justify-center rounded-lg border focus-visible:ring-3 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="border-primary absolute inset-6 rounded-md border-2 border-dashed"
        />
        {busy ? (
          <Spinner className="size-8" />
        ) : (
          <Camera className="text-muted-foreground size-8" aria-hidden />
        )}
      </button>
      <p role="status" className="text-muted-foreground text-sm">
        {phase === "starting"
          ? t("qr.starting")
          : phase === "resolving"
            ? t("qr.resolving")
            : t("qr.hint")}
      </p>
      <Button
        variant="ghost"
        className="min-h-11"
        onClick={() => setDenied(true)}
      >
        <CameraOff />
        {t("qr.fallbackTitle")}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Find: one view, two presentations                                           */
/* -------------------------------------------------------------------------- */

type LocateState = "idle" | "locating" | "denied" | "failed";

/**
 * The map and the list, sharing their filters.
 *
 * They were two views in production, and *List view* was a one-way button into
 * a screen with its own independent state: switching lost the operator filter
 * and whatever you had picked. They are one view with a toggle now, which is
 * what they always were -- one set of vehicles, drawn two ways.
 *
 * The division of labour between them is deliberate. The map is a pointer
 * surface, where a tap selects and a card confirms before committing, because
 * a tap near three dots needs confirming. The list is the keyboard and
 * screen-reader surface, where a row goes straight to the report -- one tap,
 * nothing to confirm, because a row names exactly one vehicle.
 */
function FindView({
  locale,
  scenario,
  initialTab,
  notice,
  onDismissNotice,
  onReport,
  onUnlisted,
}: {
  locale: CitizenLocale;
  scenario: CitizenScenario;
  initialTab: "map" | "list";
  /** Why you are back here, when a send sent you back. */
  notice?: string;
  onDismissNotice: () => void;
  onReport: (vehicle: CitizenVehicle, method: FindMethod) => void;
  onUnlisted: () => void;
}) {
  const t = citizenCopy(locale);
  const [tab, setTab] = React.useState<"map" | "list">(initialTab);

  /**
   * The feed settles once, briefly, on the way in.
   *
   * Two different loading states share one flag. `scenario === "loading"` is
   * the documented one and never resolves -- it is how a consumer renders
   * "the feed has not arrived". This short one is how a reader of the docs
   * meets `vehicle.near.loading` at all, since the sample data is already in
   * memory and would otherwise appear in the same frame as the screen.
   */
  const [settling, setSettling] = React.useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettling(false), FEED_DELAY);
    return () => clearTimeout(timer);
  }, []);
  const feedDown = scenario === "vehicles-down";
  const [operator, setOperator] = React.useState("all");
  const [type, setType] = React.useState<VehicleType | "all">("all");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const visible = React.useMemo(
    () =>
      SAMPLE_VEHICLES.filter(
        (v) =>
          (operator === "all" || v.operator === operator) &&
          (type === "all" || v.type === type),
      ),
    [operator, type],
  );

  const activeFilters = (operator === "all" ? 0 : 1) + (type === "all" ? 0 : 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice ? (
        <Alert variant="destructive" className="mx-4 mt-3 w-auto">
          <AlertDescription className="flex items-start justify-between gap-2">
            <span className="flex-1">{notice}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("vehicle.close")}
              onClick={onDismissNotice}
            >
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <SegmentedControl
          className="min-w-0 flex-1"
          size="sm"
          value={tab}
          onValueChange={(next) => setTab(next as "map" | "list")}
          items={[
            { value: "map", label: t("map.canvas") },
            { value: "list", label: t("map.listView") },
          ]}
        />
        <Button
          type="button"
          variant={activeFilters > 0 ? "secondary" : "outline"}
          size="sm"
          className="min-h-11 shrink-0"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal />
          {activeFilters > 0
            ? `${t("map.filter")} (${activeFilters})`
            : t("map.filter")}
        </Button>
      </div>

      {filtersOpen ? (
        <FilterPanel
          locale={locale}
          operator={operator}
          type={type}
          onOperator={setOperator}
          onType={setType}
          onDone={() => setFiltersOpen(false)}
        />
      ) : null}

      {tab === "map" ? (
        <MapPane
          locale={locale}
          // The basemap is fine when the feed is not: the map still orients
          // you, it just has nothing to put on it. Hiding the map too would
          // take away the one thing that still works.
          visible={feedDown || scenario === "loading" ? [] : visible}
          feedDown={feedDown}
          onReport={(vehicle) => onReport(vehicle, "map")}
        />
      ) : (
        <ListPane
          locale={locale}
          visible={visible}
          loading={scenario === "loading" || settling}
          feedDown={feedDown}
          onReport={onReport}
          onUnlisted={onUnlisted}
        />
      )}
    </div>
  );
}

/**
 * The two filters, behind one button.
 *
 * In production they were two always-open selects above the map. On a 390px
 * screen that is a third of the height spent on controls most reporters never
 * touch, before they have seen a single vehicle -- and it was the main reason
 * the selection card ended up below the fold. The count on the Filter button
 * is what a collapsed control owes the reader: you can see that something is
 * filtered without opening it.
 */
function FilterPanel({
  locale,
  operator,
  type,
  onOperator,
  onType,
  onDone,
}: {
  locale: CitizenLocale;
  operator: string;
  type: VehicleType | "all";
  onOperator: (next: string) => void;
  onType: (next: VehicleType | "all") => void;
  onDone: () => void;
}) {
  const t = citizenCopy(locale);
  return (
    <div className="bg-card mx-4 mb-2 flex shrink-0 flex-col gap-3 rounded-lg border p-3">
      <Field>
        <FieldLabel htmlFor="citizen-operator">{t("map.operator")}</FieldLabel>
        <NativeSelect
          id="citizen-operator"
          className="w-full"
          value={operator}
          onChange={(e) => onOperator(e.target.value)}
        >
          <NativeSelectOption value="all">
            {t("map.allOperators")}
          </NativeSelectOption>
          {CITIZEN_OPERATORS.map((o) => (
            <NativeSelectOption key={o} value={o}>
              {o}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="citizen-type">{t("map.type")}</FieldLabel>
        <NativeSelect
          id="citizen-type"
          className="w-full"
          value={type}
          onChange={(e) => onType(e.target.value as VehicleType | "all")}
        >
          <NativeSelectOption value="all">
            {t("map.allTypes")}
          </NativeSelectOption>
          {/*
            `vehicle.types`, not `map.types`. Production carries both, and in
            English they disagree: the map filter reads "bicycle, cargo bike"
            in lower case while the vehicle card reads "Bike, Cargo bike", so
            the same thing is labelled two ways one tap apart. German has the
            capitalised set in both. The copy tree keeps `map.types` as
            captured; this picks the set that is consistent across locales.
          */}
          {VEHICLE_TYPES.map((v) => (
            <NativeSelectOption key={v} value={v}>
              {t(`vehicle.types.${v}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={onDone}
      >
        {t("map.filterDone")}
      </Button>
    </div>
  );
}

/**
 * The map, filling the screen, with its own controls over it.
 *
 * Production drew a 256px map inside a scrolling column, under a title, two
 * buttons and two selects, and put the selected vehicle's card BELOW it. On a
 * 390x812 phone that card opened off-screen, so tapping a dot looked exactly
 * like tapping nothing: the one piece of feedback the gesture produced was in
 * the part of the page you could not see. The card floats over the map now,
 * and the map is the screen.
 */
function MapPane({
  locale,
  visible,
  feedDown,
  onReport,
}: {
  locale: CitizenLocale;
  visible: CitizenVehicle[];
  feedDown: boolean;
  onReport: (vehicle: CitizenVehicle) => void;
}) {
  const t = citizenCopy(locale);
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const [selected, setSelected] = React.useState<CitizenVehicle | null>(null);
  const [locate, setLocate] = React.useState<LocateState>("idle");

  // Colour by operator: it is the axis a resident filters on, and the one a
  // city asks about. The operators that ship a look get it -- the same disc
  // and the same mark the city sees on its own map, so a resident reporting a
  // scooter and an analyst counting them are looking at one thing. Munich runs
  // two that Lisbon does not; those keep the house palette, which is where
  // every operator used to start.
  const styles = React.useMemo(
    () =>
      resolveStyles(
        [...CITIZEN_OPERATORS],
        undefined,
        operatorStyles(CITIZEN_OPERATORS),
      ),
    [],
  );
  const points = React.useMemo(
    () => visible.map((v) => ({ position: v.position, category: v.operator })),
    [visible],
  );

  useCategoryPointLayer({
    map,
    enabled: points.length > 0,
    points,
    styles,
    logoZoom: LOGO_ZOOM,
    id: POINTS_ID,
  });

  // A vehicle filtered out from under the selection must not stay selected:
  // the card would offer a report on a dot that is no longer drawn.
  React.useEffect(() => {
    setSelected((current) =>
      current && visible.some((v) => v.id === current.id) ? current : null,
    );
  }, [visible]);

  /* ---- the ring round the chosen dot ----------------------------------- */

  /**
   * Created once per map; the data is set by the effect below.
   *
   * Two effects rather than one: a single effect keyed on the selection would
   * tear the layer down and rebuild it on every tap, which flickers and loses
   * the layer's place in the style's draw order.
   */
  React.useEffect(() => {
    if (!map) return;
    // No hex fallback: the stroke is the theme's primary, or there is no ring.
    const stroke = resolveCssColor("--primary");
    if (!stroke) return;
    try {
      if (!map.getSource(SELECTED_SOURCE)) {
        map.addSource(SELECTED_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(SELECTED_LAYER)) {
        map.addLayer(
          {
            id: SELECTED_LAYER,
            type: "circle",
            source: SELECTED_SOURCE,
            paint: {
              /*
                The marker is not one size. Below `LOGO_ZOOM` it is a circle
                that grows 3px -> 9px, and above it a badge of `BADGE_RADIUS`
                scaled 0.7 -> 1.3 across the next three zooms. A fixed radius
                was right at exactly one zoom: the ring used to be swallowed
                whole from about `LOGO_ZOOM` + 1.7, so zooming in to read a
                plate lost the mark showing which vehicle was chosen. Follow
                the marker's own curve and keep `RING_GAP` of clear air.
              */
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                3 + RING_GAP,
                LOGO_ZOOM,
                BADGE_RADIUS * 0.7 + RING_GAP,
                LOGO_ZOOM + 3,
                BADGE_RADIUS * 1.3 + RING_GAP,
              ],
              // Fully transparent rather than unset: a circle layer always
              // paints a fill, and the default is an opaque blue disc that
              // would hide the dot it is meant to point at.
              "circle-color": "rgba(0, 0, 0, 0)",
              "circle-stroke-width": 3,
              "circle-stroke-color": stroke,
            },
          },
          /*
            On top, not under the markers. The fill is transparent and the
            radius clears the marker, so nothing is hidden by drawing it last
            -- and a ring that is last can never be bitten into by the vehicle
            parked next to the chosen one, which at close zoom reads as a
            rendering fault rather than as a selection.
          */
          undefined,
        );
      }
    } catch {
      /* the style is not ready, or the map is being torn down */
    }
    return () => {
      try {
        if (map.getLayer(SELECTED_LAYER)) map.removeLayer(SELECTED_LAYER);
        if (map.getSource(SELECTED_SOURCE)) map.removeSource(SELECTED_SOURCE);
      } catch {
        /* the map is gone */
      }
    };
  }, [map]);

  React.useEffect(() => {
    if (!map) return;
    // Lift the chosen dot clear of the card that is about to cover it.
    if (selected) {
      map.easeTo({
        center: selected.position,
        offset: [0, SELECTED_OFFSET_Y],
        duration: 300,
      });
    }
    try {
      // The marker layers are torn down and re-added whenever the filter
      // changes or the style reloads, which puts them back above the ring.
      // Raising the ring with the selection keeps it last without having to
      // watch the hook for rebuilds.
      if (map.getLayer(SELECTED_LAYER)) map.moveLayer(SELECTED_LAYER);
      const source = map.getSource(SELECTED_SOURCE) as
        | GeoJSONSource
        | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: selected
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: selected.position },
                properties: {},
              },
            ]
          : [],
      });
    } catch {
      /* the source is not added yet; the effect above will catch up */
    }
  }, [map, selected]);

  /* ---- selection -------------------------------------------------------- */

  // Selection by hit-test rather than by binding to the layer: the layer is
  // added asynchronously once the style settles, and binding a listener to a
  // layer id that does not exist yet never fires.
  React.useEffect(() => {
    if (!map) return;

    /** The marker under this point, or null for a tap on bare map. */
    const vehicleAt = (point: MapMouseEvent["point"]) => {
      let hits;
      try {
        // Both marker layers, not the dots alone. The hook draws a vehicle as
        // a circle below `LOGO_ZOOM` and as a badge above it, and
        // `queryRenderedFeatures` reports only layers that are actually drawn.
        // Naming `DOTS_LAYER` by itself made every tap miss from the first
        // zoom step on: the badge sat plainly under the thumb, the query came
        // back empty, and because an empty hit also clears the selection,
        // tapping a vehicle *dismissed* the card instead of opening it.
        const layers = [DOTS_LAYER, LOGOS_LAYER].filter((layer) =>
          map.getLayer(layer),
        );
        if (layers.length === 0) return null;
        hits = map.queryRenderedFeatures(
          [
            [point.x - HIT_PADDING, point.y - HIT_PADDING],
            [point.x + HIT_PADDING, point.y + HIT_PADDING],
          ],
          { layers },
        );
      } catch {
        return null; // the style is not ready yet
      }
      if (!hits || hits.length === 0) return null;

      // A box can return several dots, and the order it returns them in is
      // not distance from the tap. Pick the closest in screen space, which is
      // the one the thumb was aiming at.
      let hit: [number, number] | null = null;
      let hitDistance = Infinity;
      for (const feature of hits) {
        if (feature.geometry.type !== "Point") continue;
        const coordinates = feature.geometry.coordinates as [number, number];
        const projected = map.project(coordinates);
        const distance =
          (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
        if (distance < hitDistance) {
          hitDistance = distance;
          hit = coordinates;
        }
      }
      if (!hit) return null;

      // Nearest, not equal. MapLibre re-encodes the GeoJSON through its own
      // vector tiler, which quantises coordinates to the tile grid -- what
      // comes back sits within about a metre of what went in and is never
      // identical to it. Comparing for equality (even to nine decimals) finds
      // nothing, which is a silent miss: the dot is plainly there, the click
      // lands on it, and the card simply never opens. A dot was hit, so the
      // closest vehicle to it is the one meant.
      const [lon, lat] = hit;
      let best: CitizenVehicle | null = null;
      let bestDistance = Infinity;
      for (const vehicle of visible) {
        const dx = vehicle.position[0] - lon;
        const dy = vehicle.position[1] - lat;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = vehicle;
        }
      }
      return best;
    };

    const onClick = (event: MapMouseEvent) => {
      // A tap on bare map clears, rather than leaving the last card up: the
      // card covers part of the map, so dismissing it has to be possible
      // without hunting for the close button.
      setSelected(vehicleAt(event.point));
    };

    // The pointer is the only hint on a map that a mark is a control, and the
    // phone frame is shown on a desktop docs page where there is a cursor to
    // change. A real phone has none, which is what `map.tapHint` is for.
    const onMove = (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = vehicleAt(event.point) ? "pointer" : "";
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.getCanvas().style.cursor = "";
    };
  }, [map, visible]);

  /* ---- locate ----------------------------------------------------------- */

  /**
   * Production shipped this control with no handler at all -- it looked like
   * the way to centre the map on yourself and did nothing when pressed. All
   * three outcome strings were already written and unused, so all three are
   * wired: a dead control is worse than no control.
   */
  const locateMe = () => {
    if (!map || typeof navigator === "undefined" || !navigator.geolocation) {
      setLocate("failed");
      return;
    }
    setLocate("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocate("idle");
        map.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
        });
      },
      (error) =>
        setLocate(error.code === error.PERMISSION_DENIED ? "denied" : "failed"),
      { timeout: 8_000 },
    );
  };

  const locateMessage =
    locate === "locating"
      ? t("map.locating")
      : locate === "denied"
        ? t("map.locateDenied")
        : locate === "failed"
          ? t("map.locateUnavailable")
          : null;

  return (
    <div className="relative min-h-0 flex-1">
      {/*
        No `cooperativeGesturesBelow`. It exists so an embedded map does not
        swallow the page scroll -- but this map IS the screen and has no scroll
        to protect, so below 1024px it was claiming every one-finger pan and
        telling the reporter to use two fingers to move a full-screen map.
      */}
      <MapCanvas
        className="absolute inset-0"
        workerUrl={WORKER_URL}
        center={CITIZEN_CENTER}
        zoom={14.4}
        onStyleReady={setMap}
        aria-label={t("map.label")}
        fallback={
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
            {t("map.loading")}
          </div>
        }
      />

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background size-11"
          aria-label={t("map.zoomIn")}
          onClick={() => map?.zoomIn()}
        >
          <Plus />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background size-11"
          aria-label={t("map.zoomOut")}
          onClick={() => map?.zoomOut()}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="bg-background size-11"
          aria-label={t("map.locate")}
          onClick={locateMe}
        >
          {locate === "locating" ? <Spinner /> : <Crosshair />}
        </Button>
      </div>

      {locateMessage ? (
        <div
          role="status"
          className="bg-background absolute top-2 left-2 flex max-w-[14rem] items-start gap-1 rounded-md border p-2 text-xs shadow-sm"
        >
          <span className="flex-1">{locateMessage}</span>
          {locate === "locating" ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("vehicle.close")}
              onClick={() => setLocate("idle")}
            >
              <X />
            </Button>
          )}
        </div>
      ) : null}

      {/*
        bottom-10, not bottom-2: MapLibre's compact attribution badge sits
        bottom-right, and a card docked to the edge covers the credit the tiles
        are served under. 40px is the number the map workspace settled on for
        the same reason.
      */}
      {selected ? (
        <div className="bg-card absolute inset-x-2 bottom-10 flex flex-col gap-2 rounded-lg border p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <VehicleSummary
              vehicle={selected}
              locale={locale}
              bare
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("vehicle.close")}
              onClick={() => setSelected(null)}
            >
              <X />
            </Button>
          </div>
          {/*
            Said here rather than on the next screen. The photo used to be a
            surprise: you chose a vehicle, pressed Report, and only then met a
            camera you had to satisfy before the form would open.
          */}
          {!selected.reported && photoRequired("map") ? (
            <p className="text-muted-foreground text-xs">
              {t("photo.required")}
            </p>
          ) : null}
          <ReportAction
            vehicle={selected}
            locale={locale}
            onReport={() => onReport(selected)}
          />
        </div>
      ) : feedDown ? (
        // Destructive, not muted: this is not a hint about an empty map, it
        // is the reason the map is empty, and a resident who cannot tell the
        // difference will stand in the street waiting for dots.
        <Alert
          variant="destructive"
          className="bg-background absolute inset-x-2 bottom-10 w-auto"
        >
          <AlertDescription>
            {t("vehicle.errors.liveDataUnavailable")}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="bg-background/90 text-muted-foreground absolute inset-x-2 bottom-10 rounded-md px-2 py-1 text-center text-xs">
          {t("map.tapHint")}
        </p>
      )}

      {/* The tap is confirmed to a screen reader too, not only on screen. */}
      <div role="status" className="sr-only">
        {selected
          ? t("vehicle.selected", {
              operator: selected.operator,
              type: t(`vehicle.types.${selected.type}`),
              id: selected.id,
            })
          : ""}
      </div>
    </div>
  );
}

/**
 * The list, and the search that narrows it.
 *
 * Production's search matched the WHOLE id, exactly, and only when the form
 * was submitted -- with no submit button on screen. Typing `LIME` found
 * nothing, which is indistinguishable from `LIME` not existing. It filters as
 * you type now, across the id and the operator, and across every vehicle
 * rather than only the five near ones: a search whose job is to find one
 * specific vehicle cannot be scoped to the ones you could already see.
 */
function ListPane({
  locale,
  visible,
  loading,
  feedDown,
  onReport,
  onUnlisted,
}: {
  locale: CitizenLocale;
  visible: CitizenVehicle[];
  loading: boolean;
  feedDown: boolean;
  onReport: (vehicle: CitizenVehicle, method: FindMethod) => void;
  onUnlisted: () => void;
}) {
  const t = citizenCopy(locale);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  /**
   * The typed value and the value the list is filtered by are not the same.
   *
   * Filtering on every keystroke is what makes this feel instant, and it is
   * also why `vehicle.search.searching` had nowhere to live. A debounce gives
   * the state somewhere to be without giving the search back the latency the
   * redesign removed: the list still settles a quarter of a second after you
   * stop typing, not after a round trip.
   */
  const [term, setTerm] = React.useState("");
  React.useEffect(() => {
    const next = query.trim().toUpperCase();
    if (next === term) return;
    const timer = setTimeout(() => setTerm(next), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [query, term]);

  const searching = term.length > 0;
  const settlingSearch = query.trim().toUpperCase() !== term;

  const rows = React.useMemo(() => {
    if (!searching) return vehiclesNear(visible);
    return visible.filter(
      (v) =>
        v.id.toUpperCase().includes(term) ||
        v.operator.toUpperCase().includes(term),
    );
  }, [searching, term, visible]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <search>
        {/* The form only stops Enter reloading the page; filtering is live. */}
        <form onSubmit={(event) => event.preventDefault()}>
          <Field>
            <FieldLabel htmlFor="citizen-search">
              {t("vehicle.search.label")}
            </FieldLabel>
            <Input
              id="citizen-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <FieldDescription>
              {settlingSearch
                ? t("vehicle.search.searching")
                : t("vehicle.search.hintLive")}
            </FieldDescription>
          </Field>
        </form>
      </search>

      <section
        aria-labelledby={searching ? undefined : "citizen-near"}
        aria-label={searching ? t("vehicle.search.label") : undefined}
        className="flex flex-col gap-2"
      >
        {/*
          The count, not the list. Making the list itself a live region reads
          every row out again on every keystroke, which is what a reporter
          typing a six-character id would hear six times.
        */}
        <p role="status" className="sr-only">
          {searching ? t("vehicle.search.results", { n: rows.length }) : ""}
        </p>
        {searching ? null : (
          <>
            <h2 id="citizen-near" className="text-sm font-semibold">
              {t("vehicle.near.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("vehicle.near.hint", { count: MAX_NEAR })}
            </p>
          </>
        )}

        {feedDown ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TriangleAlert />
              </EmptyMedia>
              <EmptyTitle>{t("vehicle.near.title")}</EmptyTitle>
              <EmptyDescription>
                {t("vehicle.errors.unavailable")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {/*
                The unlisted form is the one route that needs no feed: it is a
                typed operator and a typed id. Offering it here is the
                difference between "come back later" and "report it anyway".
              */}
              <Button variant="outline" className="min-h-11" onClick={onUnlisted}>
                {t("unlisted.link")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : loading ? (
          <div
            role="status"
            aria-label={t("vehicle.near.loading")}
            className="flex flex-col gap-2"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          searching ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t("vehicle.errors.notFound")}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("vehicle.near.empty")}
            </p>
          )
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {rows.map((vehicle) => (
              <li key={vehicle.id} className="flex flex-col gap-1">
                <Item
                  // Outline, not the default transparent border: every row
                  // here is a control that goes straight to a report, and an
                  // unbordered row reads as a line of text you happen to be
                  // able to press.
                  variant="outline"
                  render={
                    <button
                      type="button"
                      // A reported vehicle discloses why instead of
                      // navigating: there is nothing to report, and
                      // `aria-expanded` is what tells a screen reader that
                      // this row behaves differently from its neighbours.
                      aria-expanded={
                        vehicle.reported ? expanded === vehicle.id : undefined
                      }
                      onClick={() =>
                        vehicle.reported
                          ? setExpanded((open) =>
                              open === vehicle.id ? null : vehicle.id,
                            )
                          : onReport(vehicle, searching ? "search" : "list")
                      }
                      className="min-h-11 w-full text-left"
                    />
                  }
                >
                  <ItemContent>
                    {/* ItemTitle is already a flex row that clamps to one
                        line, so the badge just becomes its first child. */}
                    <ItemTitle>
                      <OperatorBadge operator={vehicle.operator} />
                      {vehicle.operator}
                    </ItemTitle>
                    <ItemDescription>
                      {t(`vehicle.types.${vehicle.type}`)} ·{" "}
                      {formatDistance(vehicle.distanceM)} ·{" "}
                      <span className="font-mono">{vehicle.id}</span>
                    </ItemDescription>
                  </ItemContent>
                  {vehicle.reported ? (
                    <StatusBadge tone="warning">
                      {t("vehicle.near.reported")}
                    </StatusBadge>
                  ) : null}
                </Item>
                {vehicle.reported && expanded === vehicle.id ? (
                  <p className="text-muted-foreground px-3 text-sm">
                    {t("vehicle.openReport")}{" "}
                    {t("vehicle.locked", {
                      time: formatLockTime(vehicle.lockedForMinutes ?? 0),
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {feedDown ? null : (
          <Button variant="outline" className="min-h-11" onClick={onUnlisted}>
            {t("unlisted.link")}
          </Button>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report: the photos and the details, on one screen                           */
/* -------------------------------------------------------------------------- */

/**
 * Everything the report needs, in one screen.
 *
 * Production split this in two: a photo screen with a Continue button, then
 * the form. The split bought nothing -- the photo rules are three lines of
 * text and the reason is six options -- and cost every non-QR reporter a whole
 * screen plus a Continue. Merged, the reason comes first because it is the
 * only field most reports need, the camera is a camera rather than a file
 * field, and Send is always on screen in a bar that does not scroll away.
 */
function ReportView({
  locale,
  scenario,
  vehicle,
  method,
  onStale,
  onSent,
}: {
  locale: CitizenLocale;
  scenario: CitizenScenario;
  vehicle: CitizenVehicle | null;
  method: FindMethod;
  /** The vehicle left the feed while this form was open. */
  onStale: () => void;
  onSent: (reportId: string) => void;
}) {
  const t = citizenCopy(locale);
  const unlisted = method === "unlisted";
  const photosRequired = photoRequired(method);

  const [operator, setOperator] = React.useState("");
  const [typedId, setTypedId] = React.useState("");
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [comment, setComment] = React.useState("");
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [trimmed, setTrimmed] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [badPhoto, setBadPhoto] = React.useState(false);

  /**
   * Sending is three things, and only one of them is "sending".
   *
   * The photos go up first and can fail on their own, which is why
   * `photo.uploading` and `photo.failure.*` exist separately from
   * `report.sending` and `report.failure.*`. A single boolean could not tell
   * a reporter which half went wrong, so it told them nothing.
   */
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "sending">(
    "idle",
  );
  const [failure, setFailure] = React.useState<string | null>(null);
  const sending = phase !== "idle";

  /**
   * The operator list is fetched in production, so the unlisted form has a
   * moment where it is not yet a form. `unlisted.loading` is for exactly that
   * moment and had nowhere to be while the list was a constant in memory.
   */
  const [formReady, setFormReady] = React.useState(!unlisted);
  React.useEffect(() => {
    if (!unlisted) return;
    const timer = setTimeout(() => setFormReady(true), FEED_DELAY);
    return () => clearTimeout(timer);
  }, [unlisted]);

  const operatorRef = React.useRef<HTMLSelectElement>(null);
  const idRef = React.useRef<HTMLInputElement>(null);
  const reasonRef = React.useRef<HTMLDivElement>(null);
  const photoRef = React.useRef<HTMLButtonElement>(null);
  const commentRef = React.useRef<HTMLTextAreaElement>(null);
  const cameraInput = React.useRef<HTMLInputElement>(null);
  const libraryInput = React.useRef<HTMLInputElement>(null);
  const sendTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // The comment is required for "Other", so choosing it has to open the field
  // rather than leave the requirement behind a disclosure nobody opened.
  const commentRequired = reason === "other";
  React.useEffect(() => {
    if (commentRequired) setCommentOpen(true);
  }, [commentRequired]);

  /** Object URLs outlive React's render, so they are revoked by hand. */
  const urls = React.useRef<string[]>([]);
  React.useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      clearTimeout(sendTimer.current);
    },
    [],
  );

  /**
   * `accept="image/*"` is a hint to the picker, not a guarantee: several
   * platforms let you choose "All files" past it. Production has
   * `photo.failure.invalid` for the file that comes back and cannot be
   * decoded, so the check is a real decode rather than a trusted mime type.
   */
  const decodes = (url: string) =>
    new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });

  const addPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    // Take what fits instead of refusing the batch. Picking seven photos used
    // to add none of them and show an error, which punishes the reporter for
    // the limit rather than applying it.
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const kept = picked.slice(0, room);
    setTrimmed(kept.length < picked.length);
    if (kept.length === 0) return;
    const made = kept.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return url;
    });
    const usable = await Promise.all(made.map(decodes));
    const good = made.filter((_, index) => usable[index]);
    const bad = made.filter((_, index) => !usable[index]);
    for (const url of bad) URL.revokeObjectURL(url);
    setBadPhoto(bad.length > 0);
    if (good.length === 0) return;
    setPhotos((current) => [
      ...current,
      ...good.map((url) => ({ id: url, url })),
    ]);
  };

  const removePhoto = (id: string) => {
    const gone = photos.find((photo) => photo.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setTrimmed(false);
    setBadPhoto(false);
    setPhotos(photos.filter((photo) => photo.id !== id));
  };

  const operatorError = submitted && unlisted && !operator;
  const idMissing = unlisted && !typedId.trim();
  const idMalformed = unlisted && !idMissing && !validVehicleId(typedId.trim());
  const idError = submitted && (idMissing || idMalformed);
  const reasonError = submitted && !reason;
  const photoError = submitted && photosRequired && photos.length === 0;
  const commentError = submitted && commentRequired && !comment.trim();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    // Focus the first thing that is wrong, in the order it appears on screen.
    // Production showed a summary alert and left focus on Send, so a
    // screen-reader user heard that something was invalid and had to go
    // looking for it.
    if (unlisted && !operator) {
      operatorRef.current?.focus();
      return;
    }
    if (idMissing || idMalformed) {
      idRef.current?.focus();
      return;
    }
    if (!reason) {
      // ChoiceCard does not forward a ref, so the group's first radio is found
      // in the DOM. Base UI renders a radio as a button carrying the role.
      reasonRef.current
        ?.querySelector<HTMLElement>('[role="radio"], input[type="radio"]')
        ?.focus();
      return;
    }
    if (photosRequired && photos.length === 0) {
      photoRef.current?.focus();
      return;
    }
    if (reason === "other" && !comment.trim()) {
      setCommentOpen(true);
      commentRef.current?.focus();
      return;
    }

    setFailure(null);
    send();
  };

  /**
   * Photos first, then the report, because that is the order production uses
   * and the order the failures are written for: a photo that cannot be sent
   * stops the report, and the reporter is told which half stopped.
   */
  const send = () => {
    const submitReport = () => {
      setPhase("sending");
      sendTimer.current = setTimeout(() => {
        // Picked from the map, gone from the feed by the time Send was
        // pressed. Nothing on this form can fix that, so it is not an error
        // on this form.
        if (vehicle?.intake === "stale") {
          setPhase("idle");
          onStale();
          return;
        }
        if (scenario === "intake-paused") {
          setPhase("idle");
          setFailure(
            unlisted
              ? t("report.failure.unlisted_disabled")
              : t("report.failure.intake_paused"),
          );
          return;
        }
        if (scenario === "rate-limited") {
          setPhase("idle");
          setFailure(t("report.failure.rate_limited"));
          return;
        }
        if (scenario === "send-failed") {
          setPhase("idle");
          setFailure(t("report.failure.unavailable"));
          return;
        }
        onSent(sampleReportId());
      }, SEND_DELAY);
    };

    if (photos.length === 0) {
      submitReport();
      return;
    }
    setPhase("uploading");
    sendTimer.current = setTimeout(() => {
      if (scenario === "photos-failed") {
        setPhase("idle");
        setFailure(t("photo.failure.unavailable"));
        return;
      }
      submitReport();
    }, UPLOAD_DELAY);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        {unlisted && !formReady ? (
          <div
            role="status"
            aria-label={t("unlisted.loading")}
            className="flex flex-col gap-4"
          >
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : unlisted ? (
          <>
            <Field data-invalid={operatorError || undefined}>
              <FieldLabel htmlFor="citizen-unlisted-operator">
                {t("vehicle.operator")}
              </FieldLabel>
              <NativeSelect
                ref={operatorRef}
                id="citizen-unlisted-operator"
                className="w-full"
                value={operator}
                aria-invalid={operatorError || undefined}
                onChange={(e) => setOperator(e.target.value)}
              >
                <NativeSelectOption value="">
                  {t("unlisted.operatorPlaceholder")}
                </NativeSelectOption>
                {CITIZEN_OPERATORS.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {o}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {operatorError ? (
                <FieldError>{t("unlisted.errors.operatorRequired")}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={idError || undefined}>
              <FieldLabel htmlFor="citizen-typed-id">
                {t("report.vehicle")}
              </FieldLabel>
              <Input
                ref={idRef}
                id="citizen-typed-id"
                value={typedId}
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={idError || undefined}
                onChange={(e) => setTypedId(e.target.value)}
              />
              <FieldDescription>{t("report.vehicleHint")}</FieldDescription>
              {idError ? (
                <FieldError>
                  {idMissing
                    ? t("report.errors.vehicleRequired")
                    : t("report.errors.vehicleFormat")}
                </FieldError>
              ) : null}
            </Field>
          </>
        ) : vehicle ? (
          <VehicleSummary vehicle={vehicle} locale={locale} />
        ) : null}

        <Field data-invalid={reasonError || undefined}>
          <FieldLabel htmlFor="citizen-reason">{t("report.reason")}</FieldLabel>
          <div ref={reasonRef}>
            <ChoiceCardGroup
              aria-label={t("report.reason")}
              value={reason}
              onValueChange={(value) => setReason(value as ReportReason)}
            >
              {REPORT_REASONS.map((value) => (
                <ChoiceCard
                  key={value}
                  value={value}
                  title={t(`report.reasons.${value}`)}
                />
              ))}
            </ChoiceCardGroup>
          </div>
          {reasonError ? (
            <FieldError>{t("report.errors.reasonRequired")}</FieldError>
          ) : null}
        </Field>

        <PhotoField
          locale={locale}
          photos={photos}
          required={photosRequired}
          trimmed={trimmed}
          invalid={photoError}
          rejected={badPhoto}
          takeRef={photoRef}
          cameraInput={cameraInput}
          libraryInput={libraryInput}
          onAdd={addPhotos}
          onRemove={removePhoto}
        />

        {commentOpen ? (
          <Field data-invalid={commentError || undefined}>
            <FieldLabel htmlFor="citizen-comment">
              {t("report.comment")}
            </FieldLabel>
            <Textarea
              ref={commentRef}
              id="citizen-comment"
              rows={3}
              maxLength={MAX_COMMENT}
              value={comment}
              aria-invalid={commentError || undefined}
              onChange={(e) => setComment(e.target.value)}
            />
            <FieldDescription>
              {t("report.commentHint")}{" "}
              {t("report.count", { n: comment.length, max: MAX_COMMENT })}
            </FieldDescription>
            {commentError ? (
              <FieldError>{t("report.errors.commentRequired")}</FieldError>
            ) : null}
          </Field>
        ) : (
          // Collapsed until wanted. It is optional for five of the six reasons,
          // and a 500-character box between the reason and Send reads as
          // something that has to be filled in.
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 self-start"
            onClick={() => setCommentOpen(true)}
          >
            {t("report.addComment")}
          </Button>
        )}
      </div>

      {/*
        Send does not scroll away. With the photos, six reasons and a comment on
        one screen the button would otherwise sit two screenfuls below the first
        thing you decide.
      */}
      <div className="bg-background sticky bottom-0 mt-auto flex flex-col gap-2 border-t px-4 py-3">
        {/*
          The failure sits with the control that caused it, not at the top of
          a form you would have to scroll back up to read. `role="alert"` so
          it is announced: the button goes back to saying "Send report", and
          without the announcement the only evidence of a failure is a spinner
          that stopped.
        */}
        {failure ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="min-h-11 w-full" disabled={sending}>
          {sending ? <Spinner /> : null}
          {phase === "uploading"
            ? t("photo.uploading")
            : phase === "sending"
              ? t("report.sending")
              : t("report.send")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The camera, then the library, then what you took.
 *
 * Production used one `<input type="file">` labelled "Add photos", which is a
 * desktop control: on a phone the thing you want is a button that opens the
 * camera, and the picker second. `FileDropzone` is the registry's upload
 * affordance and is not it -- "drop files here" means nothing on a phone --
 * which is why this draws its own.
 */
function PhotoField({
  locale,
  photos,
  required,
  trimmed,
  invalid,
  rejected,
  takeRef,
  cameraInput,
  libraryInput,
  onAdd,
  onRemove,
}: {
  locale: CitizenLocale;
  photos: Photo[];
  required: boolean;
  trimmed: boolean;
  invalid: boolean;
  /** At least one picked file did not decode as an image. */
  rejected: boolean;
  takeRef: React.RefObject<HTMLButtonElement | null>;
  cameraInput: React.RefObject<HTMLInputElement | null>;
  libraryInput: React.RefObject<HTMLInputElement | null>;
  onAdd: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
}) {
  const t = citizenCopy(locale);
  const full = photos.length >= MAX_PHOTOS;

  return (
    <div
      role="group"
      aria-labelledby="citizen-photo-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="citizen-photo-heading" className="text-sm font-semibold">
        {t("photo.title")}
      </h2>

      <div
        id="citizen-photo-warning"
        role="note"
        className="flex flex-col gap-1 rounded-md border p-3 text-sm"
      >
        <p className="font-medium">{t("photo.warningTitle")}</p>
        <ul className="list-disc pl-5">
          <li>{t("photo.warningPeople")}</li>
          <li>{t("photo.warningComment")}</li>
        </ul>
      </div>

      <p id="citizen-photo-requirement" className="text-sm">
        {required ? t("photo.required") : t("photo.optional")}
      </p>

      {/*
        Hidden inputs driven by the buttons. `capture="environment"` is what
        makes the first one the camera rather than the picker; both accept
        several files so a reporter can add two angles in one go.
      */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={onAdd}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={onAdd}
      />

      <div className="flex flex-col gap-2">
        <Button
          ref={takeRef}
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={full}
          aria-describedby="citizen-photo-warning citizen-photo-requirement"
          onClick={() => cameraInput.current?.click()}
        >
          <Camera />
          {t("photo.take")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={full}
          onClick={() => libraryInput.current?.click()}
        >
          <ImagePlus />
          {t("photo.choose")}
        </Button>
      </div>

      {trimmed ? (
        <Alert>
          <AlertDescription>
            {t("photo.trimmed", { max: MAX_PHOTOS })}
          </AlertDescription>
        </Alert>
      ) : null}

      {rejected ? (
        <Alert variant="destructive">
          <AlertDescription>{t("photo.failure.invalid")}</AlertDescription>
        </Alert>
      ) : null}

      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("report.failure.photo_required")}
          </AlertDescription>
        </Alert>
      ) : null}

      {photos.length > 0 ? (
        <>
          <p className="text-sm">
            {t("photo.count", { n: photos.length, max: MAX_PHOTOS })}
          </p>
          {/* The photo itself, not its filename: a reporter checks that the
              problem is in frame, which only the image can answer. */}
          <ul role="list" className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    blob URL from the camera has no intrinsic size to give
                    next/image, and nothing for it to optimise. */}
                <img
                  src={photo.url}
                  alt={t("photo.added", { n: index + 1 })}
                  className="aspect-square w-full rounded-md border object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-1 right-1"
                  aria-label={t("photo.remove", { n: index + 1 })}
                  onClick={() => onRemove(photo.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Done                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What happened, and what happens next.
 *
 * Production showed one static badge reading "Sent to the city". It carries
 * six status strings and polls for them, so this screen is a history: the
 * timeline says the report was received AND passed on, newest first, which is
 * the order the Timeline pattern asks for. The reference gets a copy button
 * because it is the one thing here a resident needs to keep.
 */
function DoneView({
  locale,
  reportId,
  vehicle,
  onNew,
}: {
  locale: CitizenLocale;
  reportId: string;
  /** Whose intake decides what the city does with this report. */
  vehicle: CitizenVehicle | null;
  onNew: () => void;
}) {
  const t = citizenCopy(locale);

  /**
   * The report is received first and passed on second, and the second part
   * can go wrong.
   *
   * Production polls this screen until the report stops moving, and carries
   * six strings for where it can stop. This block showed one of them, fixed,
   * the instant the form closed -- so "Delayed, we will retry it" and "Could
   * not be sent to the city" existed in the copy and nowhere else. Which one
   * you get is the vehicle's fixture, so it is reachable by reporting that
   * vehicle rather than by setting a prop.
   */
  const outcome: ReportStatus =
    vehicle?.intake === "parked"
      ? "parked"
      : vehicle?.intake === "rejected"
        ? "rejected"
        : "sent";

  const [status, setStatus] = React.useState<ReportStatus>("received");
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(outcome), STATUS_DELAY);
    return () => clearTimeout(timer);
  }, [outcome]);

  const settled = status !== "received";

  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
      {/*
        The lead has to agree with the status under it. Production says "We
        received your report." whatever the poll settles on, so a refused
        report read as thanks followed by a red line saying it went nowhere,
        and a resident could not tell whether anything had happened at all.
      */}
      <p className="text-sm">
        {settled && outcome === "rejected"
          ? t("report.done.textRejected")
          : t("report.done.text")}
      </p>

      {/*
        Newest first, which is the order the Timeline pattern asks for and the
        order that answers the only question on this screen: where is it now?
      */}
      <Timeline aria-live="polite">
        {/*
          One item until the poll settles, not two.
          `report.status.sending` and `.received` are the SAME words in both
          locales -- production says so in the type's own comment -- so a
          pending item above a received item read "Received" twice, which
          looks like a rendering fault rather than a report in flight. The
          spinner carries "still moving" instead, and `sending` stays unused
          for the same reason it is a duplicate.
        */}
        {settled ? (
          <TimelineItem
            tone={
              outcome === "sent"
                ? "success"
                : outcome === "parked"
                  ? "warning"
                  : "destructive"
            }
            title={t(`report.status.${outcome}`)}
          />
        ) : null}
        <TimelineItem
          tone="neutral"
          title={t("report.status.received")}
          time={settled ? undefined : <Spinner className="size-3" />}
        />
      </Timeline>

      {/*
        No second sentence under the timeline. The obvious thing to add was an
        alert repeating the outcome, and in both locales it came out as the
        same words twice -- `report.status.rejected` and `.expired` ARE the
        sentence, and `.parked` already says the app will retry, so an alert
        beside it would be the screen arguing with itself.
      */}

      <div className="flex flex-col gap-1 rounded-lg border p-3">
        <p className="text-muted-foreground text-sm">
          {t("report.done.reference")}
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm break-all">{reportId}</code>
          <CopyButton
            value={reportId}
            label={t("report.done.copy")}
            copiedLabel={t("report.done.copied")}
          />
        </div>
      </div>

      <Button variant="outline" className="min-h-11" onClick={onNew}>
        {t("report.done.new")}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The Citizen Platform: a resident reports a badly parked shared vehicle,
 * without an account, on a phone.
 *
 * The one workspace in this registry that is not a desktop surface, so it is
 * the one shown in a `PhoneFrame`. The copy is production's own, both locales
 * -- the toggle in the header is part of the design rather than a demo
 * control, because a Munich resident meets this screen in German and a visitor
 * meets it in English.
 *
 * The FLOW is not production's. Reporting a vehicle found on the map took nine
 * interactions there, two of them spent declining a prompt, and the one piece
 * of feedback a tap on the map produced appeared below the fold. It takes six
 * here. Every divergence is commented where it happens, and the five views --
 * what used to be nine -- are documented on the `View` union.
 *
 * The STATES are production's too, and they are the part a demo normally
 * loses. A block with no network shows the one path where nothing goes wrong,
 * which is the path nobody needs help designing. So the rule here is:
 *
 *   a state the RESIDENT causes is reachable by causing it
 *   a state the CITY causes is the `scenario` prop
 *
 * Reachable by doing something: the camera starting and the code resolving;
 * the near-you list settling; a search that has not caught up with the
 * typing; the unlisted form before its operators arrive; a photo the app
 * cannot decode; a batch over the limit; an id in the wrong shape; a vehicle
 * that left the feed while the form was open; a report the city holds, and
 * one it refuses. The last three are fixtures on the sample vehicles -- the
 * cargo bike has gone stale, the moped is held, the Dott bike is refused --
 * so a reader who explores the demo meets them without being told to.
 *
 * Behind `scenario`: a feed that is loading or down, a service that is down,
 * intake paused, rate limiting, a send that fails, photos that fail. See
 * `CitizenScenario`. It defaults to `ready`, so the docs page shows the
 * working app, as `FeedsWorkspace`'s `status` does.
 *
 * What is deliberately absent: there is no live vehicle feed and no security
 * check. Production gates every data call behind signed tiles and an AWS WAF
 * CAPTCHA, neither of which belongs in a component demo. `notLive` and
 * `qrNotFound` went with it -- they were props on the list view that nothing
 * ever set, so the two error states they drew were unreachable.
 */
export function CitizenWorkspace({
  className,
  scenario = "ready",
}: {
  className?: string;
  /**
   * What the service is doing. See `CitizenScenario`: the states a resident
   * causes are reachable by causing them, and these are the ones only a
   * server can cause. `FeedsWorkspace` takes a `status` for the same reason.
   */
  scenario?: CitizenScenario;
}) {
  const [locale, setLocale] = React.useState<CitizenLocale>("en");

  /**
   * A stack, not a view.
   *
   * Production hard-coded each screen's Back target, and three of them were
   * wrong: Back from the photo, the form and the unlisted form all went to
   * `{ list, from: "start" }`, so reporting a vehicle picked on the map and
   * then pressing Back dropped you in a list you had never opened -- and Back
   * from the form skipped the photo step, discarding the photos. A stack
   * cannot be wrong about where you came from.
   */
  const [stack, setStack] = React.useState<View[]>([{ name: "start" }]);
  const view = stack[stack.length - 1]!;

  const go = (next: View) => setStack((current) => [...current, next]);
  const back = () =>
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));

  const t = citizenCopy(locale);

  const heading = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    // Not on the first render: this block sits on a documentation page, and
    // focusing its heading on load would scroll the page to the phone and take
    // focus off whatever the reader was doing.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [view.name]);

  /** QR skips the photo requirement; everything else cannot. Production's rule. */
  const toReport = (vehicle: CitizenVehicle, method: FindMethod) =>
    go({ name: "report", vehicle, method });

  /**
   * The vehicle was on the map when it was picked and is not in the feed now.
   *
   * Production's `not_in_live_data`, and the only failure that sends you
   * BACKWARDS: there is nothing to correct on the form, because the thing the
   * form is about has gone. So the report screen is left behind and the find
   * screen says why, which is also where you can pick another one.
   */
  const [staleNotice, setStaleNotice] = React.useState(false);
  const onStale = () => {
    setStaleNotice(true);
    setStack([{ name: "start" }, { name: "find", tab: "map" }]);
  };

  const title =
    view.name === "scan"
      ? t("qr.title")
      : view.name === "find"
        ? t("map.title")
        : view.name === "report"
          ? view.method === "unlisted"
            ? t("unlisted.title")
            : t("app.title")
          : view.name === "done"
            ? t("report.done.title")
            : t("app.title");

  return (
    <div
      data-slot="citizen-workspace"
      className={cn("h-[max(480px,75svh)] md:h-[700px]", className)}
    >
      <PhoneFrame label={t("app.title")}>
        <div className="flex min-h-full flex-col">
          <AppHeader
            title={title}
            // Two steps: find the vehicle, then describe the problem. Shown on
            // both of them rather than only on the form -- "Step 2 of 2" on a
            // screen reached from one that said nothing reads as though
            // something was missed, where the pair reads as a short flow with
            // one screen left.
            step={
              view.name === "scan" || view.name === "find"
                ? t("app.step", { n: 1, max: 2 })
                : view.name === "report"
                  ? t("app.step", { n: 2, max: 2 })
                  : undefined
            }
            headingRef={heading}
            onBack={stack.length > 1 ? back : undefined}
            backLabel={t("map.back")}
            locale={locale}
            onLocale={() => setLocale(locale === "de" ? "en" : "de")}
          />

          {/*
            Nothing below this is worth drawing when the service is gone.
            Production's `app.apiUnavailable` is a whole-app state, not a
            banner over a form that cannot submit: offering the camera and
            the map while neither can resolve a vehicle is a worse lie than
            saying so once.
          */}
          {scenario === "service-down" ? (
            <div className="p-4">
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TriangleAlert />
                  </EmptyMedia>
                  <EmptyTitle>{t("app.title")}</EmptyTitle>
                  <EmptyDescription>{t("app.apiUnavailable")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : null}

          {scenario !== "service-down" && view.name === "start" ? (
            <div className="p-4">
              <StartView
                locale={locale}
                onScan={() => go({ name: "scan" })}
                onMap={() => go({ name: "find", tab: "map" })}
                onList={() => go({ name: "find", tab: "list" })}
              />
            </div>
          ) : null}

          {scenario !== "service-down" && view.name === "scan" ? (
            <div className="p-4">
              <ScanView
                locale={locale}
                scenario={scenario}
                onResolved={(vehicle) => toReport(vehicle, "qr")}
                onChooseMethod={(method) => go({ name: "find", tab: method })}
              />
            </div>
          ) : null}

          {scenario !== "service-down" && view.name === "find" ? (
            <FindView
              locale={locale}
              scenario={scenario}
              initialTab={view.tab}
              notice={
                staleNotice ? t("report.failure.not_in_live_data") : undefined
              }
              onDismissNotice={() => setStaleNotice(false)}
              onReport={(vehicle, method) => {
                setStaleNotice(false);
                toReport(vehicle, method);
              }}
              onUnlisted={() =>
                go({ name: "report", vehicle: null, method: "unlisted" })
              }
            />
          ) : null}

          {scenario !== "service-down" && view.name === "report" ? (
            <ReportView
              locale={locale}
              scenario={scenario}
              vehicle={view.vehicle}
              method={view.method}
              onStale={onStale}
              // The stack is replaced rather than pushed: a sent report is not
              // somewhere you go Back from, so the only way on is a new one.
              onSent={(reportId) =>
                setStack([{ name: "done", reportId, vehicle: view.vehicle }])
              }
            />
          ) : null}

          {scenario !== "service-down" && view.name === "done" ? (
            <DoneView
              locale={locale}
              reportId={view.reportId}
              vehicle={view.vehicle}
              onNew={() => setStack([{ name: "start" }])}
            />
          ) : null}
        </div>
      </PhoneFrame>
    </div>
  );
}

export default CitizenWorkspace;
