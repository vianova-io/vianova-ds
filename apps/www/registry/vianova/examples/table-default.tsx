import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/vianova/ui/table";

const rows = [
  { zone: "Port district", trips: "12,480", avg: "14.2 min" },
  { zone: "City centre", trips: "9,140", avg: "11.8 min" },
  { zone: "Sainte-Adresse", trips: "3,205", avg: "18.4 min" },
];

export default function TableDefault() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Zone</TableHead>
          <TableHead className="text-right">Trips</TableHead>
          <TableHead className="text-right">Avg. duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.zone}>
            <TableCell className="font-medium">{r.zone}</TableCell>
            <TableCell className="text-right tabular-nums">{r.trips}</TableCell>
            <TableCell className="text-right tabular-nums">{r.avg}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
