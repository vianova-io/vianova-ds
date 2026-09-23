import { Layers, Map, Route } from "lucide-react";

import { Toggle } from "@/registry/vianova/ui/toggle";

export default function ToggleDefault() {
  return (
    <div className="flex items-center gap-2">
      <Toggle aria-label="Layers" defaultPressed>
        <Layers />
      </Toggle>
      <Toggle aria-label="Routes">
        <Route />
      </Toggle>
      <Toggle aria-label="Basemap">
        <Map />
      </Toggle>
    </div>
  );
}
