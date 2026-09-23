import { Label } from "@/registry/vianova/ui/label";
import { Switch } from "@/registry/vianova/ui/switch";

export default function SwitchDefault() {
  return (
    <div className="grid gap-3">
      <Label>
        <Switch defaultChecked />
        3D buildings
      </Label>
      <Label>
        <Switch />
        Traffic overlay
      </Label>
    </div>
  );
}
