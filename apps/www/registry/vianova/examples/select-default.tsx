import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/vianova/ui/select";

export default function SelectDefault() {
  return (
    <Select defaultValue="trips">
      <SelectTrigger className="w-[220px]" aria-label="Metric">
        <SelectValue placeholder="Select a metric" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="trips">Trips</SelectItem>
        <SelectItem value="vehicles">Unique vehicles</SelectItem>
        <SelectItem value="duration">Average duration</SelectItem>
      </SelectContent>
    </Select>
  );
}
