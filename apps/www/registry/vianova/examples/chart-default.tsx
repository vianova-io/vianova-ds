"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/registry/vianova/ui/chart";

const data = [
  { month: "Dec", bike: 4200, scooter: 2100 },
  { month: "Jan", bike: 3800, scooter: 1900 },
  { month: "Feb", bike: 4600, scooter: 2400 },
  { month: "Mar", bike: 5200, scooter: 3100 },
  { month: "Apr", bike: 6100, scooter: 3600 },
  { month: "May", bike: 7400, scooter: 4200 },
];

const config = {
  bike: { label: "Bike", color: "var(--chart-1)" },
  scooter: { label: "Scooter", color: "var(--chart-3)" },
} satisfies ChartConfig;

export default function ChartDefault() {
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="bike" fill="var(--color-bike)" radius={4} />
        <Bar dataKey="scooter" fill="var(--color-scooter)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
