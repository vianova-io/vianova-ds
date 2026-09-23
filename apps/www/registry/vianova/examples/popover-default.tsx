import { Button } from "@/registry/vianova/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/registry/vianova/ui/popover";

export default function PopoverDefault() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Legend</Button>} />
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>Trips per district</PopoverTitle>
          <PopoverDescription>Quantile bins, 5 classes.</PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 flex overflow-hidden rounded">
          {/* Ramp stops are multiples of 10; --map-ramp-25 does not exist. */}
          {[0, 20, 50, 80, 100].map((s) => (
            <div
              key={s}
              className="h-4 flex-1"
              style={{ background: `var(--map-ramp-${s})` }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
