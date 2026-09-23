"use client";

import * as React from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
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
  visualization,
  filterCount,
  visible = true,
  expanded = true,
  defaultVisualization = "lines",
  onVisibilityChange,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  name: string;
  /** Date range and measure, e.g. "Jan 1 – Dec 31, 2024 · Count distinct trip id". */
  meta?: string;
  /** Label of the active visualisation, shown as a badge. */
  visualization?: string;
  filterCount?: number;
  visible?: boolean;
  expanded?: boolean;
  defaultVisualization?: VisualizationTypeId;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const VisibilityIcon = visible ? Eye : EyeOff;

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

      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}

      <LegendRamp />

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
          {visualization ? <Badge variant="secondary">{visualization}</Badge> : null}
        </div>
        <CollapsibleContent className="pt-2">
          <VisualizationPicker defaultValue={defaultVisualization} />
        </CollapsibleContent>
      </Collapsible>

      {filterCount !== undefined ? (
        <>
          <Separator />
          <Button variant="ghost" size="xs" className="gap-1 px-1">
            <ChevronRight className="size-3.5" />
            Filters
            <Badge variant="secondary">{filterCount}</Badge>
          </Button>
        </>
      ) : null}
    </div>
  );
}
