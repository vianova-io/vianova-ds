"use client";

import * as React from "react";

import {
  BadgeCell,
  BarCell,
  DateCell,
  DeltaCell,
  NumberCell,
} from "@/registry/vianova/product/cell-renderers";
import { ColumnManager } from "@/registry/vianova/product/column-manager";
import {
  createDataGridColumns,
  DataGrid,
  type DataGridColumn,
} from "@/registry/vianova/product/data-grid";
import { ExportMenu } from "@/registry/vianova/product/export-menu";

type Zone = {
  id: string;
  zone: string;
  mode: string;
  trips: number;
  share: number;
  avgDuration: number;
  delta: number;
  updated: string;
};

const MODES = ["Car", "Bike", "Scooter", "Walk"];
const NAMES = [
  "Port district", "City centre", "Sainte-Adresse", "Graville", "Caucriauville",
  "Bléville", "Aplemont", "Sanvic", "Dollemard", "Rouelles", "Mont-Gaillard", "Soquence",
];

// Generated deterministically, not randomly: the same rows must render on the
// server and the client, and the screenshot test needs a stable image.
const data: Zone[] = Array.from({ length: 5000 }, (_, i) => {
  const trips = 400 + ((i * 7919) % 24_000);
  return {
    id: `z${i}`,
    zone: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`,
    mode: MODES[i % MODES.length]!,
    trips,
    share: ((i * 37) % 100) / 100,
    avgDuration: 6 + ((i * 13) % 40),
    delta: (((i * 29) % 41) - 20) / 100,
    updated: new Date(Date.UTC(2026, 2, 1 + (i % 28))).toISOString(),
  };
});

const helper = createDataGridColumns<Zone>();

const columns = helper.columns([
  helper.accessor("zone", {
    header: "Zone",
    meta: { width: "minmax(11rem, 1.4fr)" },
  }),
  helper.accessor("mode", {
    header: "Mode",
    meta: { width: "7rem" },
    cell: (c) => <BadgeCell value={c.getValue()} />,
  }),
  helper.accessor("trips", {
    header: "Trips",
    meta: { width: "9rem" },
    cell: (c) => <NumberCell value={c.getValue()} />,
  }),
  helper.accessor("share", {
    header: "Share of mode",
    meta: { width: "minmax(9rem, 1fr)" },
    // Percent against a fixed 100, so the bar and the printed figure say the
    // same thing. Scaling the share by maxTrips would draw the right bar next
    // to a trip count that does not exist.
    cell: (c) => <BarCell value={Math.round(c.getValue() * 100)} max={100} unit="%" />,
  }),
  helper.accessor("avgDuration", {
    header: "Avg. duration",
    meta: { width: "9rem" },
    cell: (c) => <NumberCell value={c.getValue()} unit="min" />,
  }),
  helper.accessor("delta", {
    header: "vs. February",
    meta: { width: "8rem" },
    // Up is not good here for duration-like measures, but trips rising is
    // genuinely positive, so the default sign reading is right for this column.
    cell: (c) => <DeltaCell value={c.getValue()} />,
  }),
  helper.accessor("updated", {
    header: "Updated",
    meta: { width: "8rem" },
    cell: (c) => <DateCell value={c.getValue()} />,
  }),
]) as DataGridColumn<Zone>[];

const LABELS: Record<string, string> = {
  zone: "Zone",
  mode: "Mode",
  trips: "Trips",
  share: "Share of mode",
  avgDuration: "Avg. duration",
  delta: "vs. February",
  updated: "Updated",
};

export default function DataGridDefault() {
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>({});

  const managed = Object.keys(LABELS).map((id) => ({
    id,
    label: LABELS[id]!,
    // Absent means visible; only an explicit false hides a column.
    visible: visibility[id] !== false,
    locked: id === "zone",
  }));

  const exportColumns = managed.filter((c) => c.visible).map(({ id, label }) => ({ id, label }));

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          <span className="tabular-nums">{data.length.toLocaleString("en-GB")}</span> zones ·
          virtualised, so only the visible rows are in the DOM
        </p>
        <div className="flex items-center gap-2">
          <ColumnManager
            columns={managed}
            onToggle={(id, visible) => setVisibility((v) => ({ ...v, [id]: visible }))}
            onReset={() => setVisibility({})}
          />
          <ExportMenu
            rows={data.slice(0, 500) as unknown as Record<string, unknown>[]}
            columns={exportColumns}
            filename="le-havre-zones"
          />
        </div>
      </div>

      <DataGrid
        caption="Trips by zone and mode"
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        height={420}
        columnVisibility={visibility}
        onColumnVisibilityChange={setVisibility}
      />
    </div>
  );
}
