import { MapPinOff } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/vianova/ui/empty";

export default function EmptyDefault() {
  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MapPinOff />
        </EmptyMedia>
        <EmptyTitle>No zones selected</EmptyTitle>
        <EmptyDescription>
          Pick an origin district on the map to see its outbound flows.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm">
          Browse districts
        </Button>
      </EmptyContent>
    </Empty>
  );
}
