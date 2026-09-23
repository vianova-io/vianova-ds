import { Checkbox } from "@/registry/vianova/ui/checkbox";
import { Label } from "@/registry/vianova/ui/label";

export default function CheckboxDefault() {
  return (
    <div className="grid gap-3">
      <Label>
        <Checkbox defaultChecked />
        Show district labels
      </Label>
      <Label>
        <Checkbox />
        Cluster nearby points
      </Label>
      <Label>
        <Checkbox disabled />
        Unavailable on this layer
      </Label>
    </div>
  );
}
