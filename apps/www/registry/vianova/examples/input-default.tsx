import { Input } from "@/registry/vianova/ui/input";
import { Label } from "@/registry/vianova/ui/label";

export default function InputDefault() {
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="grid gap-2">
        <Label htmlFor="zone">Zone name</Label>
        <Input id="zone" placeholder="Port district" />
      </div>
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Invalid" aria-invalid />
    </div>
  );
}
