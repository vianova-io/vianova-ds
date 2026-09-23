import { ToggleGroup, ToggleGroupItem } from "@/registry/vianova/ui/toggle-group";

export default function ToggleGroupDefault() {
  return (
    <ToggleGroup defaultValue={["week"]}>
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month">Month</ToggleGroupItem>
    </ToggleGroup>
  );
}
