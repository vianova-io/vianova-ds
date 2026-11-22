"use client";

import * as React from "react";

import {
  Barlist,
  Donut,
  Kpi,
  Matrix,
  Sankey,
  SeriesBar,
  SeriesLine,
  SeriesTable,
} from "../treatments";
import { CompactContext } from "../vocabulary";

/**
 * Every compare treatment at the widths a real dashboard widget can have.
 *
 * TEMPORARY, like the page it sits beside.
 *
 * ## Why this page exists
 *
 * The treatments page renders every card at 544px, with two at 1104px. The
 * dashboard canvas is a 12-column grid, a chart's minimum is 3 by 2, and the
 * default when you add one from the library is 4 by 2. So the proposal had
 * been judged at the two most comfortable sizes and at neither size a user
 * actually gets by default. A treatment that only works at half-width is not
 * a treatment, it is a wide-card refinement, and the two are worth telling
 * apart before any of this is built.
 *
 * ## What the numbers are
 *
 * From `dashboard-workspace`: `GRID_COLUMNS = 12`, `ROW_PX = 132`,
 * `GAP_PX = 16`, `minCells` is 3 by 2 for charts and 2 by 1 for a KPI. On a
 * 1000px canvas -- roughly what the dashboard gets at a 1280px viewport --
 * one column is 68.7px, so a span of n columns is `68.7n + 16(n - 1)`.
 *
 * Height is held at `h = 2` for every probe. One variable at a time: the
 * question here is what width does to each treatment, and a card that is
 * also changing height answers two questions at once and neither of them
 * clearly.
 */
const CANVAS = 1000;
const GRID_COLUMNS = 12;
const GAP_PX = 16;
const ROW_PX = 132;

const COL_PX = (CANVAS - GAP_PX * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const span = (cols: number) => Math.round(COL_PX * cols + GAP_PX * (cols - 1));
const rows = (h: number) => h * ROW_PX + (h - 1) * GAP_PX;

const WIDTHS = [3, 4, 6, 12].map((cols) => ({
  cols,
  px: span(cols),
  /** What a widget of this width is, in the product rather than in maths. */
  role:
    cols === 3
      ? "the minimum"
      : cols === 4
        ? "the default"
        : cols === 6
          ? "half width"
          : "full width",
}));

const CARD_H = rows(2);

/**
 * One card at one width, clipped to the card's real height.
 *
 * The clip is the point. `overflow-hidden` here is not tidiness: a treatment
 * that needs more than 280px in a 280px card is a treatment that gets cut on
 * a real dashboard, and the only honest way to show that is to cut it. The
 * overflow is measured and reported rather than left to the eye, because the
 * difference between "just fits" and "clipped by 9px" is invisible and
 * decides the question.
 */
function Probe({
  cols,
  px,
  role,
  children,
}: {
  cols: number;
  px: number;
  role: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [over, setOver] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () =>
      setOver(Math.max(0, el.scrollHeight - el.clientHeight));

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="shrink-0 space-y-1.5" style={{ width: px }}>
      <p className="flex items-baseline justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>
          {cols} × 2 · {px} × {CARD_H}
        </span>
        <span className="opacity-70">{role}</span>
      </p>

      <div ref={ref} className="overflow-hidden" style={{ height: CARD_H }}>
        {children}
      </div>

      {over > 0 ? (
        <p className="font-mono text-[11px] text-[#8c510a] dark:text-[#d8b365]">
          clipped by {over}px
        </p>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground opacity-60">
          fits
        </p>
      )}
    </div>
  );
}

function Row({
  title,
  kind,
  children,
}: {
  title: string;
  kind: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="font-mono text-[11px] text-muted-foreground">{kind}</p>
      </header>

      {/*
        One scrollable track rather than a wrapping grid. The comparison being
        made is left-to-right along one chart, so the four probes have to stay
        on one line; the first three fit the column, and full width is a scroll
        away on purpose -- it is the size that is never the problem.
      */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-start gap-4">
          {WIDTHS.map((w) => (
            <Probe key={w.cols} cols={w.cols} px={w.px} role={w.role}>
              {children}
            </Probe>
          ))}
        </div>
      </div>
    </section>
  );
}

const TREATMENTS: { title: string; kind: string; node: React.ReactNode }[] = [
  { title: "Trips per day", kind: "series · line", node: <SeriesLine /> },
  { title: "Trips per day", kind: "series · bar", node: <SeriesBar /> },
  { title: "Trips by operator", kind: "barlist", node: <Barlist /> },
  { title: "Trips by operator", kind: "series · table", node: <SeriesTable /> },
  { title: "Headline metrics", kind: "kpi", node: <Kpi /> },
  { title: "Trips by vehicle type", kind: "donut", node: <Donut /> },
  { title: "Trips by weekday and hour", kind: "matrix", node: <Matrix /> },
  { title: "Trips from origin to destination", kind: "sankey", node: <Sankey /> },
];

export default function CompareSizesPage() {
  return (
    <CompactContext value={true}>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-3">
          <div>
            <h1 className="text-lg font-semibold">
              Compare date — at real widget sizes
            </h1>
            <p className="text-sm text-muted-foreground">
              Every treatment at the four widths a dashboard widget can have.
              Mockup, not shipped code.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              A {GRID_COLUMNS}-column canvas {CANVAS}px wide, {GAP_PX}px gaps,
              rows of {ROW_PX}px — the real constants from{" "}
              <span className="font-mono">dashboard-workspace</span>. A chart
              cannot be made smaller than 3 × 2; the library adds one at 4 × 2.
              Height is held at 2 rows ({CARD_H}px) throughout, so width is the
              only thing changing.
            </p>
            <p>
              Each card is clipped to its real height. “clipped by” is measured,
              not estimated — it is how far the content runs past the card.
            </p>
            <p>
              The argument for each treatment is dropped here; it is on the
              treatments page. One caveat on the KPI row: this card holds three
              metrics, while the dashboard’s <span className="font-mono">kpi</span>{" "}
              widget holds one and can go down to 2 × 1. Read that row as three
              KPIs crammed into one card, which is not a size a user would get.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {TREATMENTS.map((t) => (
            <Row key={`${t.kind}-${t.title}`} title={t.title} kind={t.kind}>
              {t.node}
            </Row>
          ))}
        </div>
      </main>
    </CompactContext>
  );
}
