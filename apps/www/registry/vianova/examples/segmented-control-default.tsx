import { SegmentedControl } from "@/registry/vianova/product/segmented-control";

export default function SegmentedControlDefault() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <SegmentedControl
        aria-label="Colour mode"
        defaultValue="continuous"
        items={[
          { value: "discrete", label: "Discrete" },
          { value: "continuous", label: "Continuous" },
        ]}
      />
      <SegmentedControl
        aria-label="Range"
        size="sm"
        defaultValue="week"
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
    </div>
  );
}
