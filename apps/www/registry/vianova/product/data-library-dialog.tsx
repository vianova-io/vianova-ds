"use client";

import * as React from "react";
import { Check, Database, Upload, Scale, Search } from "lucide-react";

import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/vianova/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/registry/vianova/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";
import { DrawZoneIcon } from "@/registry/vianova/product/draw-zone-icon";
import {
  GeometryThumbnail,
  MapThumbnail,
  thumbnailSeed,
  type ThumbPoint,
  type ThumbShape,
} from "@/registry/vianova/product/map-thumbnail";
import {
  CATEGORY_PALETTE,
  readStyleSet,
  resolveStyles,
} from "@/registry/vianova/lib/category-style";
import {
  SAMPLE_FEEDS,
  defaultCategoryColumn,
  parseSample,
  pointsBy,
  shapesBy,
  type SampleFeed,
  type SampleSection,
} from "@/registry/vianova/lib/sample-datasets";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The catalogue a workspace adds layers from.
 *
 * The panel behind it lists what you have added; this lists what you could
 * add. That split is the whole point of the control, and it is why the data
 * panel no longer arrives with every sample feed already in it: a button that
 * adds something has to have something left to add.
 *
 * Sections come from the catalogue rather than from a list kept here --
 * `SampleFeed.section` is already "data" | "zones" | "regulations", the same
 * three tabs, so a feed added to the fixtures appears under the right tab
 * without this file knowing it exists.
 */

const SECTIONS: {
  value: SampleSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "data", label: "Data", icon: Database },
  { value: "zones", label: "Zones", icon: DrawZoneIcon },
  { value: "regulations", label: "Regulations", icon: Scale },
];

const SORTS = {
  recent: "Most recent",
  oldest: "Oldest first",
  name: "Name (A–Z)",
} as const;

type Sort = keyof typeof SORTS;

/**
 * UTC, pinned at module scope.
 *
 * `4a596b7` fixed exactly this bug in the reports list: a date formatted in the
 * machine's zone renders one string on the server and another in the browser,
 * and React throws a hydration error for everyone who is not on UTC. The
 * formatter is built once rather than per card, which also keeps a grid of a
 * dozen cheap.
 */
type Geometry = {
  points: ThumbPoint[];
  shapes: ThumbShape[];
  colour: (c: string) => string;
};

/**
 * Parsed geometry, kept for the session.
 *
 * Module scope on purpose: the dialog unmounts nothing when it closes, but a
 * reader who opens it, closes it and opens it again should not re-download and
 * re-parse 670KB of trips to redraw the same picture. Misses are cached as
 * null so a file that failed is not retried on every open either.
 */
const geometryCache = new Map<string, Geometry | null>();

/**
 * The dataset's own points and polygons, drawn on the card.
 *
 * Loaded per card and only once it is near the viewport. The data tab's four
 * files are 1.6MB between them, and a picker that downloads all of that to
 * decide what a card looks like would cost more than the layer it is offering
 * to add. Until the file is in, the card keeps the stylised street grid --
 * which is also what it keeps if the fetch fails, since a card with no picture
 * at all would read as a broken dataset rather than a slow one.
 */
function LibraryThumbnail({
  feed,
  dataUrl,
  className,
}: {
  feed: SampleFeed;
  dataUrl?: string;
  className?: string;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  const [geometry, setGeometry] = React.useState<Geometry | null | undefined>(
    () => geometryCache.get(feed.file),
  );

  React.useEffect(() => {
    const node = host.current;
    if (!node || near) return;
    // No IntersectionObserver (jsdom, an old browser) means draw everything
    // rather than nothing: degrade to the eager path, not to a blank card.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  React.useEffect(() => {
    if (!near || !dataUrl || geometry !== undefined) return;
    const controller = new AbortController();
    const src = /^(?:blob:|data:|https?:|\/)/.test(feed.file)
      ? feed.file
      : `${dataUrl}/${feed.file}`;
    fetch(src, { signal: controller.signal })
      .then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
      )
      .then((text) => {
        const sample = parseSample(text);
        if (!sample) throw new Error("no geometry");
        const column = defaultCategoryColumn(sample);
        const values = sample.columns.find((c) => c.name === column)
          ?.values ?? [""];
        // The saved styles, so a colour chosen in the hub or on the map shows
        // up here too -- the same dataset should not be two different colours
        // in the picker and on the map it is about to join.
        const styles = resolveStyles(
          values,
          column ? readStyleSet(feed.id, column) : undefined,
        );
        // Points or areas, never both, and decided the way the map decides it
        // (sample-map-layer: `geometry === "area" ? "zones" : "points"`).
        // `ringOf` takes any cell with enough number pairs, so a trip's
        // LINESTRING passes as a ring: asking for shapes here regardless drew
        // Trips (MDS) as two thousand filled polygons -- a scribble, and a
        // card the map would never agree with, since it paints those trips as
        // points.
        const area = sample.geometry === "area";
        const next: Geometry = {
          points: area ? [] : pointsBy(sample, column),
          shapes: area ? shapesBy(sample, column) : [],
          colour: (category) => styles[category]?.color ?? CATEGORY_PALETTE[0]!,
        };
        geometryCache.set(feed.file, next);
        setGeometry(next);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        geometryCache.set(feed.file, null);
        setGeometry(null);
      });
    return () => controller.abort();
  }, [near, dataUrl, feed.file, feed.id, geometry]);

  if (geometry) {
    return (
      <GeometryThumbnail
        points={geometry.points}
        shapes={geometry.shapes}
        colour={geometry.colour}
        className={className}
      />
    );
  }
  // The wrapper carries the sizing, because an element the observer can watch
  // has to have a box of its own -- `display: contents` has none, and the
  // callback would never fire.
  return (
    <div ref={host} className={className}>
      <MapThumbnail seed={thumbnailSeed(feed.id)} className="size-full" />
    </div>
  );
}

const uploadedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function DataLibraryDialog({
  open,
  onOpenChange,
  added,
  onAdd,
  onUpload,
  feeds = SAMPLE_FEEDS,
  dataUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids already in the workspace. They show as added and cannot be picked. */
  added: string[];
  onAdd: (ids: string[]) => void;
  /** Omit to hide the upload control rather than show one that does nothing. */
  onUpload?: (file: File) => void;
  feeds?: SampleFeed[];
  /**
   * Where the catalogue's CSVs are served from, without a trailing slash.
   * Omit it and the cards keep the drawn stand-in rather than fetching
   * anything -- which is what the docs example does.
   */
  dataUrl?: string;
}) {
  const [section, setSection] = React.useState<SampleSection>("data");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("recent");
  const [picked, setPicked] = React.useState<string[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // A fresh selection each time it opens. Carrying one over would mean a
  // reader who cancelled, then reopened, is one Enter away from adding what
  // they just decided against.
  React.useEffect(() => {
    if (open) {
      setPicked([]);
      setQuery("");
    }
  }, [open]);

  const addedSet = React.useMemo(() => new Set(added), [added]);

  const shown = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = feeds.filter(
      (f) =>
        f.section === section &&
        (!needle ||
          f.title.toLowerCase().includes(needle) ||
          f.description.toLowerCase().includes(needle)),
    );
    const by = {
      recent: (a: SampleFeed, b: SampleFeed) =>
        b.uploadedAt.localeCompare(a.uploadedAt),
      oldest: (a: SampleFeed, b: SampleFeed) =>
        a.uploadedAt.localeCompare(b.uploadedAt),
      name: (a: SampleFeed, b: SampleFeed) => a.title.localeCompare(b.title),
    }[sort];
    // Sorted on a copy: filter already made one, but saying so here keeps the
    // next edit from sorting `feeds` itself.
    return [...matched].sort(by);
  }, [feeds, section, query, sort]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const confirm = () => {
    if (!picked.length) return;
    onAdd(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="data-library"
        // Wide and tall, because the grid is the content: three cards across
        // at the sizes this is used, and a page of them without the dialog
        // itself scrolling -- only the grid does, so the tabs, the search and
        // the Add button stay put while you look.
        className="flex h-[min(44rem,calc(100vh-4rem))] max-w-[min(72rem,calc(100vw-2rem))] flex-col gap-0 p-0 sm:max-w-[min(72rem,calc(100vw-2rem))]"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle>Add from library</DialogTitle>
            <DialogDescription className="sr-only">
              Pick datasets to add to this map as layers.
            </DialogDescription>
          </div>
          {onUpload ? (
            <>
              {/* Real, and the only control here that leaves the catalogue:
                  it hands the file to the workspace, which parses it the same
                  way the data hub's importer does. The input is the control --
                  a button that opens it keeps the dialog's own styling without
                  reimplementing a file picker. */}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(file);
                  // Reset, so choosing the same file twice fires twice.
                  event.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label="Upload a CSV"
                title="Upload a CSV"
                className="mr-7 shrink-0"
                onClick={() => fileRef.current?.click()}
              >
                <Upload />
              </Button>
            </>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-3 px-4 py-3">
          <Tabs
            value={section}
            onValueChange={(value: string) => {
              setSection(value as SampleSection);
              // Picks do not survive a tab change: "Add layers" names what is
              // on screen, and carrying a hidden pick across tabs would add
              // something the reader can no longer see.
              setPicked([]);
            }}
          >
            <TabsList>
              {SECTIONS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${SECTIONS.find((s) => s.value === section)?.label.toLowerCase()}`}
                aria-label="Search the library"
              />
            </InputGroup>
            <Select
              value={sort}
              // Base UI hands back `string | null` -- null when a select is
              // cleared, which this one cannot be. Guarded rather than cast,
              // so clearing it would keep the last sort instead of producing
              // an undefined comparator and an unsorted grid.
              onValueChange={(value: string | null) => {
                if (value) setSort(value as Sort);
              }}
            >
              <SelectTrigger className="w-44 shrink-0" aria-label="Sort by">
                {/* Mapped here rather than left to the default. Base UI's
                    Select.Value renders the raw value until the popup has
                    mounted its items once, so a trigger that has never been
                    opened reads "recent" instead of "Most recent". */}
                <SelectValue>
                  {(value: string) => SORTS[value as Sort] ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* The only scrolling region. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {shown.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((feed) => {
                const isAdded = addedSet.has(feed.id);
                const isPicked = picked.includes(feed.id);
                return (
                  <button
                    key={feed.id}
                    type="button"
                    data-slot="library-card"
                    disabled={isAdded}
                    aria-pressed={isPicked}
                    onClick={() => toggle(feed.id)}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
                      "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                      isAdded
                        ? "cursor-default opacity-60"
                        : "hover:border-foreground/25 cursor-pointer",
                      isPicked && "border-primary ring-primary/30 ring-2",
                    )}
                  >
                    <LibraryThumbnail
                      feed={feed}
                      dataUrl={dataUrl}
                      className="h-24 w-full border-b"
                    />
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">
                          {feed.title}
                        </span>
                        {isAdded ? (
                          <Badge variant="secondary" className="shrink-0">
                            <Check data-icon="inline-start" />
                            Added
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground line-clamp-2 text-xs">
                        {feed.description}
                      </span>
                      <span className="text-muted-foreground mt-auto pt-2 text-xs">
                        {uploadedFormat.format(new Date(feed.uploadedAt))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty className="py-16">
              <EmptyTitle>Nothing matches</EmptyTitle>
              <EmptyDescription>
                {query.trim()
                  ? `No ${section} in the library match “${query.trim()}”.`
                  : `The library has no ${section} yet.`}
              </EmptyDescription>
            </Empty>
          )}
        </div>

        <DialogFooter // mx-0/mb-0 undo DialogFooter's own -mx-4 -mb-4, which exist to let a
          // footer bleed to the edges of a p-4 dialog. This one is p-0, so the
          // negative margins pushed it outside the box and clipped the count.
          className="mx-0 mb-0 items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between"
        >
          {/* Live, so a reader using a screen reader hears the count change as
              they pick, rather than discovering it at the Add button. */}
          <span aria-live="polite" className="text-muted-foreground text-sm">
            {picked.length
              ? `${picked.length} selected`
              : "Select one or more to add"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!picked.length} onClick={confirm}>
              {picked.length > 1 ? `Add ${picked.length} layers` : "Add layer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
