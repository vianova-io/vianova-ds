"use client";

import * as React from "react";
import {
  CircleHelp,
  FileChartColumn,
  Layers,
  Map,
  Settings,
  ShieldCheck,
} from "lucide-react";

import {
  NavRail,
  NavRailFooter,
  NavRailGroup,
  NavRailHeader,
  NavRailItem,
  NavRailSeparator,
} from "@/registry/vianova/patterns/nav-rail";

// One `--tool-accent-*` per Tool. Each is theme-aware, so the same variable
// clears 3:1 on the accent tile in light and in all four white-label themes.
// Omit `color` and the item falls back to `--sidebar-primary-ink`, which is
// the whole of the single-colour case.
const DESTINATIONS = [
  { id: "map", label: "Map", icon: Map, color: "var(--tool-accent-5)" },
  { id: "reports", label: "Reports", icon: FileChartColumn, color: "var(--tool-accent-6)" },
  { id: "data", label: "Data Hub", icon: Layers, color: "var(--tool-accent-8)" },
  { id: "regulations", label: "Regulations", icon: ShieldCheck, color: "var(--tool-accent-1)" },
];

export default function NavRailDefault() {
  const [current, setCurrent] = React.useState("reports");

  return (
    <div className="flex h-[360px] w-full overflow-hidden rounded-lg border">
      <NavRail aria-label="Solution">
        <NavRailHeader>
          <span
            aria-hidden
            className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-md text-xs font-semibold"
          >
            V
          </span>
        </NavRailHeader>
        <NavRailSeparator />
        <NavRailGroup>
          {DESTINATIONS.map((d) => (
            <NavRailItem
              key={d.id}
              label={d.label}
              icon={<d.icon />}
              color={d.color}
              active={current === d.id}
              onClick={() => setCurrent(d.id)}
            />
          ))}
        </NavRailGroup>
        <NavRailFooter>
          <NavRailItem label="Help" icon={<CircleHelp />} />
          <NavRailItem label="Settings" icon={<Settings />} />
        </NavRailFooter>
      </NavRail>

      <div className="bg-background flex min-w-0 flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">
          {DESTINATIONS.find((d) => d.id === current)?.label}
        </p>
      </div>
    </div>
  );
}
