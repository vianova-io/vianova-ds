import { Label } from "@/registry/vianova/ui/label";
import { NativeSelect, NativeSelectOption } from "@/registry/vianova/ui/native-select";

export default function NativeSelectDefault() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="scheme">Map colour scheme</Label>
      <NativeSelect id="scheme" defaultValue="viridis">
        <NativeSelectOption value="brand">Brand</NativeSelectOption>
        <NativeSelectOption value="warm">Warm</NativeSelectOption>
        <NativeSelectOption value="viridis">Viridis</NativeSelectOption>
        <NativeSelectOption value="blue">Blue</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
