import { Clock, Gauge, Route, Users } from "lucide-react";

import { StatTile } from "@/registry/vianova/patterns/stat-tile";

export default function StatTileDefault() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Trips"
        value="1.24"
        unit="M"
        delta="+12.4%"
        trend="up"
        hint="vs. February"
        icon={<Route className="size-4" />}
      />
      <StatTile
        label="Unique travellers"
        value="86,410"
        delta="+3.1%"
        trend="up"
        hint="vs. February"
        icon={<Users className="size-4" />}
      />
      {/* Up is bad here, so intent is set rather than inferred from the arrow. */}
      <StatTile
        label="Median trip time"
        value="18.6"
        unit="min"
        delta="+2.4%"
        trend="up"
        intent="negative"
        hint="vs. February"
        icon={<Clock className="size-4" />}
      />
      <StatTile
        label="Avg. speed"
        value="24.1"
        unit="km/h"
        delta="0.0%"
        trend="flat"
        hint="vs. February"
        icon={<Gauge className="size-4" />}
      />
    </div>
  );
}
