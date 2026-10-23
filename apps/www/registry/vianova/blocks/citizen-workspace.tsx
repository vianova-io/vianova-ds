"use client";

import * as React from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Crosshair,
  ImagePlus,
  List,
  MapIcon,
  QrCode,
  Search,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/registry/vianova/ui/alert";
import { Button } from "@/registry/vianova/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/registry/vianova/ui/card";
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
import { Separator } from "@/registry/vianova/ui/separator";
import { Textarea } from "@/registry/vianova/ui/textarea";
import { PhoneFrame } from "@/registry/vianova/patterns/phone-frame";
import { StatusBadge } from "@/registry/vianova/patterns/status-badge";
import { MapCanvas } from "@/registry/vianova/product/map-canvas";
import { useCategoryPointLayer } from "@/registry/vianova/hooks/use-category-point-layer";
import { resolveStyles } from "@/registry/vianova/lib/category-style";
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
  vehiclesNear,
  type CitizenLocale,
  type CitizenVehicle,
  type FindMethod,
  type ReportReason,
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

/**
 * The view union is production's, name for name.
 *
 * It is a union rather than a string plus loose state because several views
 * only make sense carrying something: `list` has to know whether Back goes to
 * the map or the start, and `form` cannot be reached without a vehicle. Keeping
 * the shape identical also means a reviewer can diff this against the real app
 * without first translating between two vocabularies.
 */
type View =
  | { name: "start" }
  | { name: "prompt"; target: "map" | "list" }
  | { name: "scan" }
  | { name: "map" }
  | {
      name: "list";
      from: "start" | "map";
      notLive?: boolean;
      qrNotFound?: boolean;
    }
  | { name: "unlisted" }
  | { name: "photo"; vehicle: CitizenVehicle; method: FindMethod }
  | {
      name: "form";
      vehicle: CitizenVehicle | null;
      method: FindMethod;
      photos: string[];
    }
  | { name: "done"; reportId: string };

/** The vehicle a simulated QR scan lands on. */
const QR_VEHICLE = SAMPLE_VEHICLES[0]!;

/* -------------------------------------------------------------------------- */
/* Shared screen furniture                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Title, body, Back -- production's one screen wrapper, including the focus
 * move. Each view takes the whole screen on a phone, so without sending focus
 * to the new heading a screen-reader user is left wherever the old screen's
 * button was and never hears that the screen changed.
 */
function Screen({
  title,
  onBack,
  backLabel,
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel: string;
  children: React.ReactNode;
}) {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-base font-semibold tracking-tight outline-none"
      >
        {title}
      </h1>
      {children}
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft />
        {backLabel}
      </Button>
    </div>
  );
}

/** A vehicle as production summarises it: operator, type, ID, and its state. */
function VehicleSummary({
  vehicle,
  locale,
}: {
  vehicle: CitizenVehicle;
  locale: CitizenLocale;
}) {
  const t = citizenCopy(locale);
  return (
    <section
      aria-label={t("vehicle.title")}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("vehicle.title")}</h2>
        {vehicle.reported ? (
          <StatusBadge tone="warning">{t("vehicle.near.reported")}</StatusBadge>
        ) : null}
      </div>
      {/*
        A description list, because that is what this is: three labelled
        facts. Production labels them too -- `vehicle.operator`, `.type` and
        `.id` exist for exactly this card -- and an unlabelled operator name
        over a mono string reads as decoration until you already know which
        is which.
      */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("vehicle.operator")}</dt>
        <dd className="truncate">{vehicle.operator}</dd>
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

/* -------------------------------------------------------------------------- */
/* Views                                                                       */
/* -------------------------------------------------------------------------- */

function StartView({
  locale,
  onStart,
  onMap,
}: {
  locale: CitizenLocale;
  onStart: () => void;
  onMap: () => void;
}) {
  const t = citizenCopy(locale);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("app.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{t("app.intro")}</p>
        <Button onClick={onStart}>{t("app.start")}</Button>
        <Button variant="outline" onClick={onMap}>
          {t("app.openMap")}
        </Button>
      </CardContent>
    </Card>
  );
}

function PromptView({
  locale,
  onScan,
  onSkip,
}: {
  locale: CitizenLocale;
  onScan: () => void;
  onSkip: () => void;
}) {
  const t = citizenCopy(locale);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("qr.prompt.title")}</h2>
      <p className="text-muted-foreground text-sm">{t("qr.prompt.text")}</p>
      <Button onClick={onScan}>
        <QrCode />
        {t("qr.prompt.scan")}
      </Button>
      <Button variant="outline" onClick={onSkip}>
        {t("qr.prompt.skip")}
      </Button>
    </div>
  );
}

/**
 * The scanner, and the state every desktop browser actually shows.
 *
 * No camera can run in a documentation page, and production's own fallback is
 * the richer screen anyway -- it is the one carrying the three ways to find a
 * vehicle without scanning. So both are here and neither is on a timer: the
 * viewfinder is a button that resolves a sample vehicle, and a link switches to
 * the camera-denied state. A timed auto-advance would read as a real scan but
 * would make this block's visual snapshot depend on when it was taken.
 */
function ScanView({
  locale,
  onResolved,
  onChooseMethod,
}: {
  locale: CitizenLocale;
  onResolved: (vehicle: CitizenVehicle) => void;
  onChooseMethod: (method: "map" | "list") => void;
}) {
  const t = citizenCopy(locale);
  const [denied, setDenied] = React.useState(false);

  if (denied) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>
          <CameraOff />
          <AlertDescription>{t("qr.cameraDenied")}</AlertDescription>
        </Alert>
        <h2 className="text-sm font-semibold">{t("qr.fallbackTitle")}</h2>
        <Button variant="outline" onClick={() => onChooseMethod("map")}>
          <MapIcon />
          {t("qr.fallback.map")}
        </Button>
        <Button variant="outline" onClick={() => onChooseMethod("list")}>
          <List />
          {t("qr.fallback.list")}
        </Button>
        <Button variant="outline" onClick={() => onChooseMethod("list")}>
          <Search />
          {t("qr.fallback.search")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-label={t("qr.video")}
        onClick={() => onResolved(QR_VEHICLE)}
        className="border-border bg-muted focus-visible:border-ring focus-visible:ring-ring/50 relative flex aspect-square w-full items-center justify-center rounded-lg border focus-visible:ring-3 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="border-primary absolute inset-6 rounded-md border-2 border-dashed"
        />
        <Camera className="text-muted-foreground size-8" aria-hidden />
      </button>
      <p className="text-muted-foreground text-sm">{t("qr.hint")}</p>
      <Button variant="ghost" onClick={() => setDenied(true)}>
        <CameraOff />
        {t("qr.fallbackTitle")}
      </Button>
    </div>
  );
}

function MapView({
  locale,
  onList,
  onReport,
}: {
  locale: CitizenLocale;
  onList: () => void;
  onReport: (vehicle: CitizenVehicle) => void;
}) {
  const t = citizenCopy(locale);
  const [operator, setOperator] = React.useState("all");
  const [type, setType] = React.useState<VehicleType | "all">("all");
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const [selected, setSelected] = React.useState<CitizenVehicle | null>(null);

  const visible = React.useMemo(
    () =>
      SAMPLE_VEHICLES.filter(
        (v) =>
          (operator === "all" || v.operator === operator) &&
          (type === "all" || v.type === type),
      ),
    [operator, type],
  );

  // Colour by operator: it is the axis a resident filters on, and the one a
  // city asks about. `resolveStyles` hands out the house palette in value
  // order, so the same operator is the same colour wherever it is drawn.
  const styles = React.useMemo(
    () => resolveStyles([...CITIZEN_OPERATORS]),
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
    logoZoom: 15,
    id: POINTS_ID,
  });

  // Selection by hit-test rather than by binding to the layer: the layer is
  // added asynchronously once the style settles, and binding a listener to a
  // layer id that does not exist yet never fires.
  React.useEffect(() => {
    if (!map) return;

    /** The dot under this point, or null for a click on bare map. */
    const vehicleAt = (point: MapMouseEvent["point"]) => {
      let hits;
      try {
        hits = map.queryRenderedFeatures(point, { layers: [DOTS_LAYER] });
      } catch {
        return null; // the layer is not on the map yet
      }
      const feature = hits?.[0];
      if (!feature || feature.geometry.type !== "Point") return null;

      // Nearest, not equal. MapLibre re-encodes the GeoJSON through its own
      // vector tiler, which quantises coordinates to the tile grid -- what
      // comes back sits within about a metre of what went in and is never
      // identical to it. Comparing for equality (even to nine decimals) finds
      // nothing, which is a silent miss: the dot is plainly there, the click
      // lands on it, and the card simply never opens. A dot was hit, so the
      // closest vehicle to it is the one meant.
      const [lon, lat] = feature.geometry.coordinates as [number, number];
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
      const hit = vehicleAt(event.point);
      if (hit) setSelected(hit);
    };

    // Without this the dots look like decoration. A pointer is the only hint
    // on a map that a mark is a control, and the phone frame is shown on a
    // desktop docs page where there is a cursor to change.
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onList}>
          <List />
          {t("map.listView")}
        </Button>
        <Button variant="outline" size="sm">
          <Crosshair />
          {t("map.locate")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel htmlFor="citizen-operator">{t("map.operator")}</FieldLabel>
          <NativeSelect
            id="citizen-operator"
            className="w-full"
            size="sm"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
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
            size="sm"
            value={type}
            onChange={(e) => setType(e.target.value as VehicleType | "all")}
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
      </div>

      <div className="relative h-64 overflow-hidden rounded-lg border">
        <MapCanvas
          className="absolute inset-0"
          workerUrl={WORKER_URL}
          center={CITIZEN_CENTER}
          zoom={14.4}
          cooperativeGesturesBelow={1024}
          onStyleReady={setMap}
          aria-label={t("map.label")}
          fallback={
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-xs">
              {t("map.loading")}
            </div>
          }
        />
      </div>

      {selected ? (
        <div className="flex flex-col gap-2">
          <VehicleSummary vehicle={selected} locale={locale} />
          <Button
            disabled={selected.reported}
            onClick={() => onReport(selected)}
          >
            {selected.reported
              ? t("vehicle.locked", {
                  time: formatLockTime(selected.lockedForMinutes ?? 0),
                })
              : t("vehicle.report")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ListView({
  locale,
  notLive,
  qrNotFound,
  onReport,
  onUnlisted,
}: {
  locale: CitizenLocale;
  notLive?: boolean;
  qrNotFound?: boolean;
  onReport: (vehicle: CitizenVehicle, method: FindMethod) => void;
  onUnlisted: () => void;
}) {
  const t = citizenCopy(locale);
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<CitizenVehicle | null>(null);
  const [missed, setMissed] = React.useState(false);
  const near = React.useMemo(() => vehiclesNear(), []);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim().toUpperCase();
    if (!term) return;
    const hit = SAMPLE_VEHICLES.find((v) => v.id.toUpperCase() === term) ?? null;
    setFound(hit);
    setMissed(!hit);
  };

  return (
    <div className="flex flex-col gap-4">
      {notLive ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("report.failure.not_in_live_data")}
          </AlertDescription>
        </Alert>
      ) : null}
      {qrNotFound ? (
        <Alert variant="destructive">
          <AlertDescription>{t("vehicle.errors.notFound")}</AlertDescription>
        </Alert>
      ) : null}

      <search>
        <form onSubmit={search} className="flex flex-col gap-2">
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
            <FieldDescription>{t("vehicle.search.hint")}</FieldDescription>
          </Field>
        </form>
      </search>

      {missed ? (
        <div className="flex flex-col gap-2">
          <Alert variant="destructive">
            <AlertDescription>{t("vehicle.errors.notFound")}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={onUnlisted}>
            {t("unlisted.link")}
          </Button>
        </div>
      ) : null}

      {found ? (
        <div className="flex flex-col gap-2">
          <VehicleSummary vehicle={found} locale={locale} />
          <Button
            disabled={found.reported}
            onClick={() => onReport(found, "search")}
          >
            {found.reported
              ? t("vehicle.locked", {
                  time: formatLockTime(found.lockedForMinutes ?? 0),
                })
              : t("vehicle.report")}
          </Button>
        </div>
      ) : null}

      <Separator />

      <section aria-labelledby="citizen-near" className="flex flex-col gap-2">
        <h2 id="citizen-near" className="text-sm font-semibold">
          {t("vehicle.near.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("vehicle.near.hint", { count: MAX_NEAR })}
        </p>
        {near.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("vehicle.near.empty")}
          </p>
        ) : (
          <ul role="list" className="flex flex-col gap-2">
            {near.map((vehicle) => (
              <li key={vehicle.id}>
                <Item
                  render={
                    <button
                      type="button"
                      disabled={vehicle.reported}
                      onClick={() => onReport(vehicle, "list")}
                      className="min-h-11 w-full text-left disabled:opacity-60"
                    />
                  }
                >
                  <ItemContent>
                    <ItemTitle>{vehicle.operator}</ItemTitle>
                    <ItemDescription>
                      {t(`vehicle.types.${vehicle.type}`)} ·{" "}
                      {formatDistance(vehicle.distanceM)}
                    </ItemDescription>
                  </ItemContent>
                  {vehicle.reported ? (
                    <StatusBadge tone="warning">
                      {t("vehicle.near.reported")}
                    </StatusBadge>
                  ) : null}
                </Item>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={onUnlisted}>
          {t("unlisted.link")}
        </Button>
      </section>
    </div>
  );
}

/**
 * The photo step.
 *
 * `FileDropzone` is the registry's upload affordance, but it is a desktop one:
 * "drop files here" means nothing on a phone, where the control opens the
 * camera roll. So this uses the plain file input the production app uses and
 * keeps the dropzone for the desktop workspaces.
 */
function PhotoView({
  locale,
  method,
  photos,
  onPhotos,
  onContinue,
}: {
  locale: CitizenLocale;
  method: FindMethod;
  photos: string[];
  onPhotos: (next: string[]) => void;
  onContinue: () => void;
}) {
  const t = citizenCopy(locale);
  const required = photoRequired(method);
  const full = photos.length >= MAX_PHOTOS;
  const [tooMany, setTooMany] = React.useState(false);

  const add = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    if (photos.length + picked.length > MAX_PHOTOS) {
      setTooMany(true);
      return;
    }
    setTooMany(false);
    onPhotos([...photos, ...picked.map((f, i) => `${f.name}-${photos.length + i}`)]);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("photo.title")}</h2>

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

      <Field>
        <FieldLabel htmlFor="citizen-photo">{t("photo.add")}</FieldLabel>
        <Input
          id="citizen-photo"
          type="file"
          accept="image/*"
          multiple
          disabled={full}
          aria-describedby="citizen-photo-warning citizen-photo-requirement"
          onChange={add}
        />
      </Field>

      {tooMany ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("photo.failure.too_many", { max: MAX_PHOTOS })}
          </AlertDescription>
        </Alert>
      ) : null}

      {photos.length > 0 ? (
        <>
          <p className="text-sm">
            {t("photo.count", { n: photos.length, max: MAX_PHOTOS })}
          </p>
          <ul className="flex flex-col gap-2">
            {photos.map((photo, index) => (
              <li
                key={photo}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <ImagePlus className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {t("photo.added", { n: index + 1 })}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("photo.remove", { n: index + 1 })}
                  onClick={() =>
                    onPhotos(photos.filter((_, i) => i !== index))
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Button disabled={required && photos.length === 0} onClick={onContinue}>
        {t("photo.continue")}
      </Button>
    </div>
  );
}

function FormView({
  locale,
  vehicle,
  method,
  onSent,
}: {
  locale: CitizenLocale;
  vehicle: CitizenVehicle | null;
  method: FindMethod;
  onSent: (reportId: string) => void;
}) {
  const t = citizenCopy(locale);
  const unlisted = method === "unlisted";
  const [operator, setOperator] = React.useState("");
  const [typedId, setTypedId] = React.useState("");
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [comment, setComment] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const operatorError = submitted && unlisted && !operator;
  const idError = submitted && unlisted && !typedId.trim();
  const reasonError = submitted && !reason;
  const commentError = submitted && reason === "other" && !comment.trim();
  const invalid = operatorError || idError || reasonError || commentError;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (
      (unlisted && (!operator || !typedId.trim())) ||
      !reason ||
      (reason === "other" && !comment.trim())
    ) {
      return;
    }
    onSent(sampleReportId());
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {unlisted ? (
        <>
          <Field data-invalid={operatorError || undefined}>
            <FieldLabel htmlFor="citizen-unlisted-operator">
              {t("vehicle.operator")}
            </FieldLabel>
            <NativeSelect
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
              id="citizen-typed-id"
              value={typedId}
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={idError || undefined}
              onChange={(e) => setTypedId(e.target.value)}
            />
            <FieldDescription>{t("report.vehicleHint")}</FieldDescription>
            {idError ? (
              <FieldError>{t("report.errors.vehicleRequired")}</FieldError>
            ) : null}
          </Field>
        </>
      ) : vehicle ? (
        <VehicleSummary vehicle={vehicle} locale={locale} />
      ) : null}

      <Field data-invalid={reasonError || undefined}>
        <FieldLabel htmlFor="citizen-reason">{t("report.reason")}</FieldLabel>
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
        {reasonError ? (
          <FieldError>{t("report.errors.reasonRequired")}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={commentError || undefined}>
        <FieldLabel htmlFor="citizen-comment">{t("report.comment")}</FieldLabel>
        <Textarea
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

      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription>{t("report.failure.invalid")}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit">{t("report.send")}</Button>
    </form>
  );
}

function DoneView({
  locale,
  reportId,
  onNew,
}: {
  locale: CitizenLocale;
  reportId: string;
  onNew: () => void;
}) {
  const t = citizenCopy(locale);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{t("report.done.text")}</p>
      <p className="text-sm">
        {t("report.done.reference")}
        <br />
        <code className="font-mono text-sm break-all">{reportId}</code>
      </p>
      <div>
        <StatusBadge tone="success">{t("report.status.sent")}</StatusBadge>
      </div>
      <Button variant="outline" onClick={onNew}>
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
 * the one shown in a `PhoneFrame`. The flow is production's nine views, and the
 * copy is production's own, both locales -- the toggle in the corner is part of
 * the design rather than a demo control, because a Munich resident meets this
 * screen in German and a visitor meets it in English.
 *
 * What is deliberately absent: there is no live vehicle feed and no security
 * check. Production gates every data call behind signed tiles and an AWS WAF
 * CAPTCHA, neither of which belongs in a component demo.
 */
export function CitizenWorkspace({ className }: { className?: string }) {
  const [locale, setLocale] = React.useState<CitizenLocale>("en");
  const [view, setView] = React.useState<View>({ name: "start" });
  const [scanned, setScanned] = React.useState(false);
  const [photos, setPhotos] = React.useState<string[]>([]);

  const t = citizenCopy(locale);
  const other: CitizenLocale = locale === "de" ? "en" : "de";

  /** Production's `f`: QR skips the photo step, everything else cannot. */
  const toReport = (vehicle: CitizenVehicle, method: FindMethod) => {
    setPhotos([]);
    setView(
      photoRequired(method)
        ? { name: "photo", vehicle, method }
        : { name: "form", vehicle, method, photos: [] },
    );
  };

  /**
   * The QR prompt is shown once per session, then the chosen method is taken
   * at its word -- production's `l` flag. Asking a second time reads as the
   * app not having listened.
   */
  const chooseMethod = (target: "map" | "list") => {
    if (scanned) {
      setView(target === "map" ? { name: "map" } : { name: "list", from: "start" });
      return;
    }
    setScanned(true);
    setView({ name: "prompt", target });
  };

  const startScan = () => {
    setScanned(true);
    setView({ name: "scan" });
  };

  return (
    <div
      data-slot="citizen-workspace"
      className={cn("h-[max(480px,75svh)] md:h-[700px]", className)}
    >
      <PhoneFrame label={t("app.title")}>
        <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(other)}
              aria-label={`${t("app.language")}`}
            >
              <span lang={other}>{t("app.language")}</span>
            </Button>
          </div>

          {view.name === "start" ? (
            <StartView
              locale={locale}
              onStart={startScan}
              onMap={() => chooseMethod("map")}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                {view.name === "prompt" ? (
                  <Screen
                    title={t("app.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "start" })}
                  >
                    <PromptView
                      locale={locale}
                      onScan={startScan}
                      onSkip={() =>
                        setView(
                          view.target === "map"
                            ? { name: "map" }
                            : { name: "list", from: "start" },
                        )
                      }
                    />
                  </Screen>
                ) : null}

                {view.name === "scan" ? (
                  <Screen
                    title={t("app.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "start" })}
                  >
                    <ScanView
                      locale={locale}
                      onResolved={(vehicle) => toReport(vehicle, "qr")}
                      onChooseMethod={(method) =>
                        setView(
                          method === "map"
                            ? { name: "map" }
                            : { name: "list", from: "start" },
                        )
                      }
                    />
                  </Screen>
                ) : null}

                {view.name === "map" ? (
                  <Screen
                    title={t("map.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "start" })}
                  >
                    <MapView
                      locale={locale}
                      onList={() => setView({ name: "list", from: "map" })}
                      onReport={(vehicle) => toReport(vehicle, "map")}
                    />
                  </Screen>
                ) : null}

                {view.name === "list" ? (
                  <Screen
                    title={t("map.listTitle")}
                    backLabel={t("map.back")}
                    onBack={() =>
                      setView(
                        view.from === "map"
                          ? { name: "map" }
                          : { name: "start" },
                      )
                    }
                  >
                    <ListView
                      locale={locale}
                      notLive={view.notLive}
                      qrNotFound={view.qrNotFound}
                      onReport={toReport}
                      onUnlisted={() => setView({ name: "unlisted" })}
                    />
                  </Screen>
                ) : null}

                {view.name === "unlisted" ? (
                  <Screen
                    title={t("unlisted.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "list", from: "start" })}
                  >
                    <FormView
                      locale={locale}
                      vehicle={null}
                      method="unlisted"
                      onSent={(reportId) => setView({ name: "done", reportId })}
                    />
                  </Screen>
                ) : null}

                {view.name === "photo" ? (
                  <Screen
                    title={t("app.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "list", from: "start" })}
                  >
                    <PhotoView
                      locale={locale}
                      method={view.method}
                      photos={photos}
                      onPhotos={setPhotos}
                      onContinue={() =>
                        setView({
                          name: "form",
                          vehicle: view.vehicle,
                          method: view.method,
                          photos,
                        })
                      }
                    />
                  </Screen>
                ) : null}

                {view.name === "form" ? (
                  <Screen
                    title={t("app.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "list", from: "start" })}
                  >
                    <FormView
                      locale={locale}
                      vehicle={view.vehicle}
                      method={view.method}
                      onSent={(reportId) => setView({ name: "done", reportId })}
                    />
                  </Screen>
                ) : null}

                {view.name === "done" ? (
                  <Screen
                    title={t("report.done.title")}
                    backLabel={t("map.back")}
                    onBack={() => setView({ name: "start" })}
                  >
                    <DoneView
                      locale={locale}
                      reportId={view.reportId}
                      onNew={() => {
                        setPhotos([]);
                        setView({ name: "start" });
                      }}
                    />
                  </Screen>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </PhoneFrame>
    </div>
  );
}

export default CitizenWorkspace;
