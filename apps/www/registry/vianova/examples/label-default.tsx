import { Input } from "@/registry/vianova/ui/input";
import { Label } from "@/registry/vianova/ui/label";

export default function LabelDefault() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="operator">Operator</Label>
      <Input id="operator" placeholder="All operators" />
    </div>
  );
}
