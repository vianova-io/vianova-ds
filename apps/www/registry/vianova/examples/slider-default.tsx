import { Label } from "@/registry/vianova/ui/label";
import { Slider } from "@/registry/vianova/ui/slider";

// Base UI renders the real <input> inside Slider.Thumb, so aria-label on the
// root never reaches it. aria-labelledby pointing at the visible label does.
export default function SliderDefault() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-3">
        <Label id="opacity-label">Layer opacity</Label>
        <Slider defaultValue={[70]} max={100} step={1} aria-labelledby="opacity-label" />
      </div>
      <div className="space-y-3">
        <Label id="duration-label">Trip duration (min)</Label>
        <Slider
          defaultValue={[5, 45]}
          max={120}
          step={5}
          aria-labelledby="duration-label"
        />
      </div>
    </div>
  );
}
