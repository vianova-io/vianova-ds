"use client";

import * as React from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ListFilter,
  MoreHorizontal,
} from "lucide-react";

import { Badge } from "@/registry/vianova/ui/badge";
import { Button } from "@/registry/vianova/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/registry/vianova/ui/collapsible";
import { Separator } from "@/registry/vianova/ui/separator";
import { LegendRamp } from "@/registry/vianova/product/legend-ramp";
import {
  VISUALIZATION_TYPES,
  VisualizationPicker,
  type VisualizationTypeId,
} from "@/registry/vianova/product/visualization-picker";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * One data layer in the map's data panel.
 *
 * Two shapes in one component, matching the design: an expanded card showing
 * the legend, visualisation picker and filter count, and a collapsed row that
 * is just a name plus a visibility toggle. `expanded={false}` gives the
 * collapsed form — a separate component would duplicate the header logic.
 */
export function DataLayerCard({
  name,
  meta,
  metaIcon,
  legend,
  visualization,
  filters,
  filterCount,
  filtersContent,
  filtersAction,
  visible = true,
  expanded = true,
  defaultVisualization = "lines",
  visualizationType,
  onVisualizationTypeChange,
  unavailableVisualizations,
  unavailableVisualizationReason,
  onVisibilityChange,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  name: string;
  /** Date range and measure, e.g. "Jan 1 – Dec 31, 2024 · Count distinct trip id". */
  meta?: string;
  /** Glyph for the measure the meta line describes, e.g. `<Hash />` for a count. */
  metaIcon?: React.ReactNode;
  /**
   * Defaults to a LegendRamp, which suits a layer coloured by magnitude. Pass
   * a LegendCategorical for a layer coloured by category, or `null` for a
   * layer whose styling needs no legend at all.
   */
  legend?: React.ReactNode;
  /**
   * Overrides the badge text. Omit it and the badge names whichever
   * visualisation is actually selected, which is the only way the two cannot
   * drift apart.
   */
  visualization?: string;
  /** Show the filters row. Defaults to true whenever `filterCount` is given. */
  filters?: boolean;
  filterCount?: number;
  /**
   * Revealed under the filters row when it is expanded. Supply the actual
   * filter UI here; without it the row is a label and a count, which is all
   * the design calls for until a layer can really be filtered.
   */
  filtersContent?: React.ReactNode;
  /** Replaces the default icon button at the end of the filters row. */
  filtersAction?: React.ReactNode;
  visible?: boolean;
  expanded?: boolean;
  defaultVisualization?: VisualizationTypeId;
  /** Controlled counterpart of `defaultVisualization`. */
  visualizationType?: VisualizationTypeId;
  onVisualizationTypeChange?: (value: VisualizationTypeId) => void;
  /** Types this layer's geometry cannot be drawn as; shown greyed. */
  unavailableVisualizations?: readonly VisualizationTypeId[];
  /** Why those are greyed, shown on hover. */
  unavailableVisualizationReason?: string;
  onVisibilityChange?: (visible: boolean) => void;
  /** Extra controls for the active visualisation, e.g. its source file. */
  children?: React.ReactNode;
}) {
  const VisibilityIcon = visible ? Eye : EyeOff;
  const showFilters = filters ?? filterCount !== undefined;

  // Tracked here even when uncontrolled, so the badge can name the selection
  // rather than the caller having to pass the same fact twice.
  const [internalType, setInternalType] = React.useState(defaultVisualization);
  const activeType = visualizationType ?? internalType;
  const badge =
    visualization ?? VISUALIZATION_TYPES.find((t) => t.value === activeType)?.label;

  if (!expanded) {
    return (
      <div
        data-slot="data-layer-card"
        data-expanded="false"
        className={cn(
          "flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5",
          className,
        )}
        {...props}
      >
        <span className="truncate text-sm text-muted-foreground">{name}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={visible ? `Hide ${name}` : `Show ${name}`}
          onClick={() => onVisibilityChange?.(!visible)}
        >
          <VisibilityIcon />
        </Button>
      </div>
    );
  }

  return (
    <div
      data-slot="data-layer-card"
      data-expanded="true"
      className={cn(
        "space-y-3 rounded-lg border border-border bg-background/40 p-3",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Layer options">
            <MoreHorizontal />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Layer charts">
            <BarChart3 />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={visible ? `Hide ${name}` : `Show ${name}`}
            onClick={() => onVisibilityChange?.(!visible)}
          >
            <VisibilityIcon />
          </Button>
        </div>
      </div>

      {meta ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
          {metaIcon}
          {meta}
        </p>
      ) : null}

      {legend === undefined ? <LegendRamp /> : legend}

      <Collapsible defaultOpen>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="xs" className="gap-1 px-1">
                <ChevronDown className="size-3.5" />
                Visualization
              </Button>
            }
          />
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </div>
        <CollapsibleContent className="space-y-2 pt-2">
          <VisualizationPicker
            value={activeType}
            unavailable={unavailableVisualizations}
            unavailableReason={unavailableVisualizationReason}
            onValueChange={(next) => {
              if (visualizationType === undefined) setInternalType(next);
              onVisualizationTypeChange?.(next);
            }}
          />
          {children}
        </CollapsibleContent>
      </Collapsible>

      {showFilters ? (
        <>
          <Separator />
          <Collapsible>
            <div className="flex items-center justify-between gap-2">
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" size="xs" className="group/filters gap-1 px-1">
                    <ChevronRight className="size-3.5 transition-transform group-data-panel-open/filters:rotate-90" />
                    Filters
                    {filterCount !== undefined ? (
                      <Badge variant="secondary">{filterCount}</Badge>
                    ) : null}
                  </Button>
                }
              />
              {filtersAction === undefined ? (
                <Button variant="ghost" size="icon-xs" aria-label={`Edit ${name} filters`}>
                  <ListFilter />
                </Button>
              ) : (
                filtersAction
              )}
            </div>
            {filtersContent ? (
              <CollapsibleContent className="pt-2">{filtersContent}</CollapsibleContent>
            ) : null}
          </Collapsible>
        </>
      ) : null}
    </div>
  );
}
