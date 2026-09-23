import { Label } from "@/registry/vianova/ui/label";
import { RadioGroup, RadioGroupItem } from "@/registry/vianova/ui/radio-group";

export default function RadioGroupDefault() {
  return (
    <RadioGroup defaultValue="quantile">
      <Label>
        <RadioGroupItem value="quantile" />
        Quantile
      </Label>
      <Label>
        <RadioGroupItem value="equal" />
        Equal interval
      </Label>
      <Label>
        <RadioGroupItem value="jenks" />
        Natural breaks
      </Label>
    </RadioGroup>
  );
}
