"use client";

import * as React from "react";
import { Sankey, Tooltip } from "recharts";

import { CATEGORY_PALETTE } from "@/registry/vianova/lib/category-style";
import { ChartContainer, type ChartConfig } from "@/registry/vianova/ui/chart";
import { cn } from "@/registry/vianova/lib/utils";

export type SankeyFlowNode = {
  /** Stable across both sides: an origin and a destination that are the same
   *  place share one id, and therefore one colour. */
  id: string;
  /** Defaults to the id. */
  label?: string;
  /** Overrides the palette, e.g. a category style already chosen on the map. */
  color?: string;
};

export type SankeyFlowLink = {
  /** A node id, not an index. */
  source: string;
  target: string;
  value: number;
};

type Side = "start" | "end";

/**
 * Flow between places: origins on the left, destinations on the right, ribbon
 * width proportional to volume.
 *
 * ## Why ids, when Recharts wants indices
 *
 * `<Sankey>` takes `links: {source: number, target: number}` where the numbers
 * are positions in the `nodes` array. That is a serialisable format, not an
 * authoring one: inserting a node silently re-points every link after it, and
 * the failure is a chart that renders perfectly while describing different
 * journeys. This component takes ids and does the mapping once, so the data
 * you write is the data you can read.
 *
 * A node that appears on both sides -- Châtelet as an origin AND a destination
 * -- is TWO Recharts nodes, because the layout places each column separately,
 * but ONE id. That is what keeps it the same colour in both columns, which is
 * the whole point: you follow a place across the chart by its colour.
 *
 * ## Colour
 *
 * From `--chart-categorical-*` via CATEGORY_PALETTE, so a district is the same
 * colour here as on the map beside it. Assigned by id in first-appearance
 * order and never by position, so filtering the data does not repaint the
 * survivors.
 *
 * Past `CATEGORY_PALETTE.length` nodes the palette would have to repeat, and
 * two different places sharing a colour in a chart about following places is
 * worse than not drawing them. `maxNodes` keeps the largest and folds the rest
 * into one neutral "Other", which is the honest version of the same picture.
 *
 * ## Reading it
 *
 * Every node is labelled with its name AND its total, outside the bar, because
 * a flow chart whose quantities live only in tooltips cannot be read on a
 * printout or by anyone not using a mouse. Colour here traces a ribbon; the
 * label carries the identity. That is also what lets the palette sit at the
 * directly-labelled separation floors rather than the stricter colour-only
 * ones -- see the token test.
 */
export function SankeyFlow({
  nodes,
  links,
  maxNodes = CATEGORY_PALETTE.length,
  valueFormatter = (n) => n.toLocaleString("en-GB"),
  nodeWidth = 12,
  nodePadding = 16,
  className,
  ...props
}: Omit<React.ComponentProps<typeof ChartContainer>, "config" | "children"> & {
  nodes: SankeyFlowNode[];
  links: SankeyFlowLink[];
  /** Largest N by total volume; the rest fold into "Other". */
  maxNodes?: number;
  valueFormatter?: (value: number) => string;
  nodeWidth?: number;
  nodePadding?: number;
}) {
  const model = React.useMemo(
    () => buildModel(nodes, links, maxNodes),
    [nodes, links, maxNodes],
  );

  // ChartContainer wants a config to drive its CSS variables; the colours here
  // are per-node rather than per-series, so this exists only to satisfy the
  // contract and to give the container its text styles.
  const config = React.useMemo<ChartConfig>(() => ({}), []);

  if (!model.data.links.length) return null;

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-full w-full", className)}
      {...props}
    >
      <Sankey
        data={model.data}
        nodeWidth={nodeWidth}
        nodePadding={nodePadding}
        // Room for the labels, which sit OUTSIDE the end columns. Without it
        // the first and last labels are simply clipped off the chart.
        margin={{ top: 8, right: 148, bottom: 8, left: 148 }}
        link={<FlowLink colors={model.colorById} />}
        node={
          <FlowNode
            colors={model.colorByIndex}
            labels={model.labelByIndex}
            maxDepth={model.maxDepth}
            format={valueFormatter}
          />
        }
      >
        <Tooltip
          content={
            <FlowTooltip labels={model.labelById} format={valueFormatter} />
          }
          // The default cursor is a rectangle sized to a cartesian band, which
          // a Sankey has none of; it paints a grey slab over the ribbons.
          cursor={false}
        />
      </Sankey>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type Model = {
  data: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] };
  /** Recharts node index -> colour. For the node renderer, which gets an index. */
  colorByIndex: string[];
  labelByIndex: string[];
  /**
   * Keyed by id, for the link renderer and the tooltip.
   *
   * Recharts' SankeyNode carries `name`, `depth` and `value` and NO index, so
   * anything reached through a link's payload has to be looked up by the id we
   * put in `name`. Nodes are the exception: NodeProps has its own `index`.
   */
  colorById: Record<string, string>;
  labelById: Record<string, string>;
  maxDepth: number;
};

const OTHER_ID = "__other__";

/**
 * Ids and sides in, Recharts indices out.
 *
 * Each (id, side) pair becomes its own Recharts node, because the layout needs
 * a left-column node and a right-column node even when they are the same
 * place. Colour is looked up by ID, so both get the same one.
 */
function buildModel(
  nodes: SankeyFlowNode[],
  links: SankeyFlowLink[],
  maxNodes: number,
): Model {
  const declared = new Map(nodes.map((n) => [n.id, n]));

  // Rank by total volume through the id, both directions, so "largest" means
  // busiest place rather than busiest origin.
  const volume = new Map<string, number>();
  for (const l of links) {
    volume.set(l.source, (volume.get(l.source) ?? 0) + l.value);
    volume.set(l.target, (volume.get(l.target) ?? 0) + l.value);
  }
  const ranked = [...volume.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const kept = new Set(ranked.slice(0, Math.max(1, maxNodes)));
  const foldedAway = ranked.length > kept.size;
  const idOf = (id: string) => (kept.has(id) ? id : OTHER_ID);

  // Colours are assigned over the KEPT ids in volume order, so the busiest
  // place is always the primary and the assignment does not shuffle when a
  // filter removes something.
  const colorById = new Map<string, string>();
  ranked.filter((id) => kept.has(id)).forEach((id, i) => {
    colorById.set(id, declared.get(id)?.color ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]!);
  });
  // "Other" is deliberately not from the palette: it is an absence of identity,
  // and giving it a hue would make it look like one more place.
  colorById.set(OTHER_ID, "var(--muted-foreground)");

  const labelOf = (id: string) =>
    id === OTHER_ID ? "Other" : declared.get(id)?.label ?? id;

  // Merge links after folding, so several small origins collapse into one
  // ribbon rather than several identical ones.
  const merged = new Map<string, number>();
  for (const l of links) {
    const key = `${idOf(l.source)}\u0000${idOf(l.target)}`;
    merged.set(key, (merged.get(key) ?? 0) + l.value);
  }

  const index = new Map<string, number>();
  const outNodes: { name: string }[] = [];
  const colorByIndex: string[] = [];
  const labelByIndex: string[] = [];
  const indexFor = (id: string, side: Side) => {
    const key = `${side}\u0000${id}`;
    const existing = index.get(key);
    if (existing !== undefined) return existing;
    const i = outNodes.length;
    index.set(key, i);
    outNodes.push({ name: id });
    colorByIndex.push(colorById.get(id) ?? "var(--muted-foreground)");
    labelByIndex.push(labelOf(id));
    return i;
  };

  const outLinks = [...merged.entries()]
    .map(([key, value]) => {
      const [source, target] = key.split("\u0000") as [string, string];
      return { source: indexFor(source, "start"), target: indexFor(target, "end"), value };
    })
    // Biggest first: Recharts lays nodes out in link order, and a sorted input
    // puts the heaviest ribbons at the top where they are easiest to compare.
    .sort((a, b) => b.value - a.value);

  void foldedAway;
  return {
    data: { nodes: outNodes, links: outLinks },
    colorByIndex,
    labelByIndex,
    colorById: Object.fromEntries(colorById),
    labelById: Object.fromEntries(
      [...colorById.keys()].map((id) => [id, labelOf(id)]),
    ),
    // Bipartite by construction: every node is either a start or an end.
    maxDepth: 1,
  };
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

function FlowLink({ colors, ...rest }: { colors: Record<string, string> } & Record<string, unknown>) {
  const p = rest as unknown as {
    sourceX: number; targetX: number; sourceY: number; targetY: number;
    sourceControlX: number; targetControlX: number; linkWidth: number;
    payload: { source: { name: string } };
  };
  const [hover, setHover] = React.useState(false);
  const color = colors[p.payload?.source?.name ?? ""] ?? "var(--muted-foreground)";

  return (
    <path
      // Same cubic Recharts draws itself, stroked at the link's own width.
      d={`M${p.sourceX},${p.sourceY}C${p.sourceControlX},${p.sourceY} ${p.targetControlX},${p.targetY} ${p.targetX},${p.targetY}`}
      fill="none"
      stroke={color}
      strokeWidth={Math.max(1, p.linkWidth)}
      // Tinted by SOURCE, so a column of ribbons leaving one place reads as one
      // family. Translucent because ribbons cross: overlaps darken, which is
      // the honest rendering of two flows sharing the same space.
      strokeOpacity={hover ? 0.75 : 0.4}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="transition-[stroke-opacity]"
    />
  );
}

function FlowNode({
  colors, labels, maxDepth, format, ...rest
}: {
  colors: string[]; labels: string[]; maxDepth: number;
  format: (value: number) => string;
} & Record<string, unknown>) {
  const p = rest as unknown as {
    x: number; y: number; width: number; height: number; index: number;
    payload: { depth: number; value: number };
  };
  const isEnd = p.payload.depth >= maxDepth;
  const label = labels[p.index] ?? "";
  const gap = 10;

  return (
    <g>
      <rect
        x={p.x}
        y={p.y}
        width={p.width}
        height={Math.max(1, p.height)}
        rx={2}
        fill={colors[p.index] ?? "var(--muted-foreground)"}
      />
      {/* Outside the bar, not on it. A label inside a 12px node is unreadable,
          and one drawn over the ribbons competes with them. */}
      <text
        x={isEnd ? p.x + p.width + gap : p.x - gap}
        y={p.y + p.height / 2}
        textAnchor={isEnd ? "start" : "end"}
        dominantBaseline="middle"
        className="pointer-events-none"
      >
        <tspan x={isEnd ? p.x + p.width + gap : p.x - gap} dy="-0.35em" className="fill-foreground text-xs">
          {label}
        </tspan>
        {/* The total, under the name. Tooltips are an enhancement; this is the
            chart being readable without one. */}
        <tspan
          x={isEnd ? p.x + p.width + gap : p.x - gap}
          dy="1.25em"
          className="fill-muted-foreground text-xs tabular-nums"
        >
          {format(p.payload.value)}
        </tspan>
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/**
 * One tooltip, two shapes, because a Sankey has two kinds of thing to hover.
 *
 * A NODE answers "how much goes through here"; a LINK answers "how much goes
 * from here to there", and the second needs both endpoints named or the number
 * is meaningless. Recharts hands both through the same payload, so this picks
 * them apart on whether the entry carries a source and target.
 */
function FlowTooltip({
  active, payload, labels, format,
}: {
  active?: boolean;
  payload?: { payload?: unknown }[];
  labels: Record<string, string>;
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  /*
   * Three levels, and the two outer ones look like the one you want.
   *
   *   payload[0]                 the tooltip entry: name, value, settings
   *   payload[0].payload         Sankey's own { payload, name, value }
   *   payload[0].payload.payload the actual node or link
   *
   * Only the innermost carries `depth` and the resolved `source`/`target`
   * nodes, and the middle one's `name` for a link is the pre-joined
   * "source - target" string built from raw ids. Reading either outer level
   * gives you something that renders -- ids instead of labels, and a link
   * described as if it were a node -- which is why this is spelled out.
   */
  const wrapper = payload[0]?.payload as
    | { name?: string; value?: number; payload?: unknown }
    | undefined;
  const raw = wrapper?.payload as
    | {
        name?: string;
        depth?: number;
        value?: number;
        source?: { name?: string };
        target?: { name?: string };
      }
    | undefined;
  if (!raw) return null;

  const named = (id: string | undefined) => (id ? labels[id] ?? id : "?");
  const value = format(raw.value ?? wrapper?.value ?? 0);
  const isLink = typeof raw.source === "object" && typeof raw.target === "object";

  return (
    <div
      data-slot="sankey-tooltip"
      className="grid min-w-[9rem] gap-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
    >
      {isLink ? (
        <>
          <div className="flex items-center gap-1.5 font-medium text-popover-foreground">
            <span>{named(raw.source?.name)}</span>
            <span aria-hidden className="text-muted-foreground">
              &rarr;
            </span>
            <span>{named(raw.target?.name)}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">{value}</span> trips
          </div>
        </>
      ) : (
        <>
          <div className="font-medium text-popover-foreground">{named(raw.name)}</div>
          <div className="text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">{value}</span>{" "}
            {raw.depth === 0 ? "leaving" : "arriving"}
          </div>
        </>
      )}
    </div>
  );
}
