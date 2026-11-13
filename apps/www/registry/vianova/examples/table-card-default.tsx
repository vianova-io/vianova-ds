"use client";

import * as React from "react";

import {
  nextSort,
  SortableTableHead,
  TableCard,
  type SortDirection,
} from "@/registry/vianova/patterns/table-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";

type Column = "site" | "road" | "vehicles";

const ROWS = [
  { site: "TP-100", road: "Spoordreef", vehicles: 19035 },
  { site: "TP-101", road: "Havendreef", vehicles: 5076 },
  { site: "TP-102", road: "Hogering", vehicles: 47815 },
  { site: "TP-103", road: "Waterlandseweg", vehicles: 24266 },
  { site: "TP-104", road: "Grote Markt", vehicles: 15134 },
];

export default function TableCardDefault() {
  const [sort, setSort] = React.useState<
    { id: Column; dir: SortDirection } | undefined
  >({ id: "site", dir: "asc" });

  /**
   * Undefined is the third state, so the rows go back to the order they
   * arrived in rather than being stuck sorted once a reader has sorted once.
   */
  const rows = React.useMemo(() => {
    if (!sort) return ROWS;
    const out = [...ROWS];
    out.sort((a, b) => {
      const [x, y] = [a[sort.id], b[sort.id]];
      const cmp = typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [sort]);

  const head = (id: Column, label: string, className?: string) => (
    <SortableTableHead
      className={className}
      direction={sort?.id === id ? sort.dir : undefined}
      onSort={() => setSort((current) => nextSort(id, current))}
    >
      {label}
    </SortableTableHead>
  );

  return (
    <TableCard className="w-full">
      <Table inset>
        <TableHeader>
          <TableRow>
            {head("site", "Site")}
            {head("road", "Road")}
            {head("vehicles", "Vehicles / day", "text-right")}
            <TableHead className="text-right">Direction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.site}>
              <TableCell className="font-medium">{row.site}</TableCell>
              <TableCell>{row.road}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.vehicles.toLocaleString("en-GB")}
              </TableCell>
              <TableCell className="text-muted-foreground text-right">
                Northbound
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
