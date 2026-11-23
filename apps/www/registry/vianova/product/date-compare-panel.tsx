"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronDown,
  ListRestart,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/registry/vianova/ui/alert";
import { Button } from "@/registry/vianova/ui/button";
import { Calendar } from "@/registry/vianova/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/registry/vianova/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";
import {
  FieldDescription,
  FieldTitle,
} from "@/registry/vianova/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/registry/vianova/ui/input-group";
import { Label } from "@/registry/vianova/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";
import { Separator } from "@/registry/vianova/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/vianova/ui/toggle-group";
import {
  DATE_SHORTCUTS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  datesFromPeriod,
  formatHour,
  formatTemporal,
  periodFromDates,
  periodLength,
  type DateShortcut,
  type TemporalFilter,
  type Weekday,
} from "@/registry/vianova/lib/compare";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * How a layer is read over time, and what it is read against.
 *
 * Rebuilt from the running VIP app rather than designed fresh, so the shape
 * is VIP's: a `Date` row inside the layer's filters, a field per period, and
 * a "Select a period" popover that filters on three facets at once -- the
 * dates, the days of the week, and the hours of the day.
 *
 * Two of VIP's decisions are worth naming, because they are not the obvious
 * ones and both are right:
 *
 *   - The popover STAGES its edits behind Cancel / Apply changes. A draft is
 *     wrong when edits are live, because the label can then disagree with the
 *     data; it is right when there is an explicit Apply, because that is what
 *     Cancel restores. Same mechanism, opposite verdict, decided by whether
 *     an Apply exists.
 *   - The shortcut menu is one flat list over all three facets. "Morning"
 *     and "Last week" sit together and change different things, which reads
 *     oddly in a spec and well in use: a person thinking "mornings only" does
 *     not first ask which control owns that.
 */
export function DateComparePanel({
  showHeader = true,
  onClose,
  filter,
  onFilterChange,
  comparing = false,
  onComparingChange,
  compareFilter,
  onCompareFilterChange,
  blockedReason,
  compareEmpty = false,
  shortcuts = DATE_SHORTCUTS,
  weekStartsOn = 1,
  today,
  noun = "rows",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  showHeader?: boolean;
  onClose?: () => void;
  filter: TemporalFilter;
  onFilterChange?: (filter: TemporalFilter) => void;
  /** Whether the comparison field is present at all. */
  comparing?: boolean;
  onComparingChange?: (comparing: boolean) => void;
  /**
   * The period to compare against, and `undefined` while the field is empty.
   *
   * VIP adds an empty field reading "Pick a date" rather than deriving the
   * preceding period, and this follows it. Deriving reads better in a demo --
   * one click and a comparison appears -- but it also puts a number on screen
   * that nobody chose, and the first thing anyone does with a derived
   * comparison is check what it was derived from.
   */
  compareFilter?: TemporalFilter;
  onCompareFilterChange?: (filter: TemporalFilter | undefined) => void;
  /**
   * Why this layer has no period, from `compareBlockedReason`.
   *
   * Given one, the explanation REPLACES the whole body. A snapshot, a static
   * zone set and a feed whose date column nobody declared are not layers
   * whose comparison is unavailable; they are layers with no period at all.
   * VIP has no such layers -- every one of its data layers carries a date
   * column -- so this branch is ours, not a rebuild of theirs.
   */
  blockedReason?: string | null;
  /** The comparison period holds no rows. */
  compareEmpty?: boolean;
  shortcuts?: readonly DateShortcut[];
  /** 0 is Sunday. VIP's calendar heads its columns Su-Sa and then orders its
   *  day chips Mon-Sun; this picks one and uses it for both. */
  weekStartsOn?: 0 | 1;
  /** Injectable for tests and stories; defaults to the real today. */
  today?: Date;
  noun?: string;
}) {
  const days = periodLength(filter.period);
  const compareDays = compareFilter ? periodLength(compareFilter.period) : null;

  return (
    <div
      data-slot="date-compare-panel"
      className={cn(
        "bg-popover text-popover-foreground w-80 rounded-lg border shadow-md",
        className,
      )}
      {...props}
    >
      {showHeader ? (
        <>
          <header className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold">Date</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Close"
              className="ml-auto"
              onClick={onClose}
            >
              <X />
            </Button>
          </header>
          <Separator />
        </>
      ) : null}

      <div className="space-y-2 p-3">
        {blockedReason ? (
          <Alert>
            <CalendarDays />
            <AlertTitle>No date range</AlertTitle>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-3.5" />
              <Label className="text-sm">Date</Label>
              {comparing ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove the comparison period"
                  className="text-muted-foreground ml-auto"
                  onClick={() => {
                    onComparingChange?.(false);
                    onCompareFilterChange?.(undefined);
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>

            <TemporalField
              label="Date range"
              value={filter}
              onChange={(next) => next && onFilterChange?.(next)}
              shortcuts={shortcuts}
              weekStartsOn={weekStartsOn}
              today={today}
            />

            {comparing ? (
              <TemporalField
                label="Comparison period"
                value={compareFilter}
                placeholder="Pick a date"
                onChange={(next) => onCompareFilterChange?.(next)}
                shortcuts={shortcuts}
                weekStartsOn={weekStartsOn}
                today={today}
              />
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground h-auto px-1 py-0 text-xs font-normal"
                onClick={() => onComparingChange?.(!comparing)}
              >
                {comparing ? "Remove compare" : "Compare"}
              </Button>
              <span className="text-muted-foreground text-xs">
                {days} day{days === 1 ? "" : "s"}
              </span>
            </div>

            {compareEmpty ? (
              <Alert>
                <TriangleAlert />
                <AlertDescription>
                  No {noun} in that period, so everything will read as a fall.
                  Pick a period the data covers.
                </AlertDescription>
              </Alert>
            ) : null}

            {compareDays != null && compareDays !== days ? (
              // VIP does not say this, and the omission is the one thing here
              // worth changing. Comparing 20-26 Jan against 13-28 Jan in the
              // running app produced "+114%" with nothing on screen to say
              // that seven days were being measured against sixteen.
              <Alert>
                <TriangleAlert />
                <AlertDescription>
                  {compareDays} days against {days}: these totals are not
                  directly comparable.
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * One period: the field, its shortcut menu, and the popover behind it
 * ---------------------------------------------------------------------- */

function TemporalField({
  label,
  value,
  placeholder = "Select a period",
  onChange,
  shortcuts,
  weekStartsOn,
  today,
}: {
  label: string;
  value: TemporalFilter | undefined;
  placeholder?: string;
  onChange: (filter: TemporalFilter | undefined) => void;
  shortcuts: readonly DateShortcut[];
  weekStartsOn: 0 | 1;
  today?: Date;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <InputGroup>
      {/* The leading icon is an addon rather than a child of the trigger, so
          the whole group reads as one control: the addon's inline-start
          padding is what tightens the gap, not a hand-picked px value. */}
      <InputGroupAddon className="pointer-events-none">
        <CalendarDays className="size-3.5" />
      </InputGroupAddon>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <InputGroupButton
              aria-label={label}
              size="sm"
              className="h-full min-w-0 flex-1 justify-start rounded-l-lg rounded-r-none px-1.5 text-xs font-normal"
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  !value && "text-muted-foreground",
                )}
              >
                {value ? formatTemporal(value) : placeholder}
              </span>
            </InputGroupButton>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <SelectPeriod
            value={value}
            weekStartsOn={weekStartsOn}
            onCancel={() => setOpen(false)}
            onApply={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <InputGroupAddon align="inline-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <InputGroupButton
                aria-label={`Shortcuts for ${label.toLowerCase()}`}
                size="icon-xs"
              >
                <ListRestart />
              </InputGroupButton>
            }
          />
          <DropdownMenuContent align="end" className="min-w-40">
            {shortcuts.map((shortcut) => (
              <DropdownMenuItem
                key={shortcut.id}
                onClick={() =>
                  onChange(
                    shortcut.apply(
                      // A shortcut that sets only hours still needs a period
                      // to attach them to, and an empty comparison field has
                      // none.
                      value ?? { period: blankPeriod(today) },
                      today ?? new Date(),
                    ),
                  )
                }
              >
                {shortcut.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  );
}

function blankPeriod(today?: Date) {
  const end = today ?? new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return periodFromDates(start, end);
}

/**
 * "Select a period" -- the staged editor.
 *
 * Everything here edits a draft. Cancel drops it; Apply changes hands it up.
 * That is why the calendar may legitimately hold an incomplete range: an
 * incomplete draft cannot reach the layer, so it cannot make a label lie.
 */
function SelectPeriod({
  value,
  weekStartsOn,
  onCancel,
  onApply,
}: {
  value: TemporalFilter | undefined;
  weekStartsOn: 0 | 1;
  onCancel: () => void;
  onApply: (filter: TemporalFilter) => void;
}) {
  const [range, setRange] = React.useState<DateRange | undefined>(() =>
    value ? datesFromPeriod(value.period) : undefined,
  );
  const [days, setDays] = React.useState<Weekday[]>(() => [
    ...(value?.days ?? []),
  ]);
  const [hours, setHours] = React.useState(value?.hours);

  const complete = range?.from != null && range.to != null;

  return (
    <div className="w-fit">
      <FieldTitle className="px-3 py-2.5">Select a period</FieldTitle>
      <Separator />

      <Calendar
        mode="range"
        autoFocus
        numberOfMonths={2}
        captionLayout="dropdown"
        weekStartsOn={weekStartsOn}
        selected={range}
        onSelect={setRange}
        defaultMonth={range?.from}
        className="p-3"
      />

      <Separator />

      <Section
        title="Day of week"
        summary={
          days.length && days.length < 7
            ? days
                .slice()
                .sort((a, b) => a - b)
                .map((d) => WEEKDAY_LABELS[d])
                .join(", ")
            : null
        }
        onClear={() => setDays([])}
      >
        <ToggleGroup
          // Base UI, not Radix: the prop is `multiple`, and there is no
          // `type`. Several days at once is the whole point -- Mon-Fri is
          // what "Work days" sets.
          multiple
          variant="outline"
          size="sm"
          value={days.map(String)}
          onValueChange={(next: string[]) =>
            setDays(next.map(Number) as Weekday[])
          }
          className="flex-wrap justify-start"
        >
          {WEEKDAY_ORDER.map((d) => (
            <ToggleGroupItem key={d} value={String(d)} className="px-2.5">
              {WEEKDAY_LABELS[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>

      <Separator />

      <Section
        title="Hour of day"
        summary={
          hours
            ? `${formatHour(hours.start)} – ${formatHour(hours.end)}`
            : null
        }
        onClear={() => setHours(undefined)}
      >
        <div className="flex items-center gap-2">
          <HourSelect
            label="Start time"
            value={hours?.start}
            onValueChange={(h) =>
              setHours((prev) => ({ start: h, end: prev?.end ?? h }))
            }
          />
          <span className="text-muted-foreground text-xs">to</span>
          <HourSelect
            label="End time"
            value={hours?.end}
            onValueChange={(h) =>
              setHours((prev) => ({ start: prev?.start ?? h, end: h }))
            }
          />
        </div>
        {hours && hours.start > hours.end ? (
          // 18:00-06:00 is a real selection, not a mistake, but it is also
          // the one a person is most likely to have made by accident.
          <FieldDescription className="mt-1.5 text-xs">
            Wraps midnight: {formatHour(hours.start)} to midnight, then
            midnight to {formatHour(hours.end)}.
          </FieldDescription>
        ) : null}
      </Section>

      <Separator />

      <div className="flex items-center justify-between gap-2 p-3">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!complete}
          onClick={() => {
            if (!range?.from || !range.to) return;
            onApply({
              period: periodFromDates(range.from, range.to),
              ...(days.length ? { days } : {}),
              ...(hours ? { hours } : {}),
            });
          }}
        >
          Apply changes
        </Button>
      </div>
    </div>
  );
}

/** A collapsible facet, with the Clear that appears once it has a value. */
function Section({
  title,
  summary,
  onClear,
  children,
}: {
  title: string;
  summary: string | null;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={summary != null}>
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="group/trigger -ml-1 h-auto px-1 py-0 text-sm font-normal"
            >
              {title}
              {/* Base UI puts `data-panel-open` on the trigger, not on the
                  root, so the chevron reads it from its own button. */}
              <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]/trigger:rotate-180" />
            </Button>
          }
        />
        {summary ? (
          <span className="text-muted-foreground text-xs">{summary}</span>
        ) : null}
        {summary ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground ml-auto h-auto px-1 py-0 text-xs font-normal"
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function HourSelect({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number | undefined;
  onValueChange: (hour: number) => void;
}) {
  return (
    <Select
      value={value == null ? null : String(value)}
      onValueChange={(next) => next !== null && onValueChange(Number(next))}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-28">
        <SelectValue placeholder={label}>
          {(v: string) => formatHour(Number(v))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {HOURS.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {formatHour(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
