import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/registry/vianova/ui/alert";

export default function AlertDefault() {
  return (
    <div className="w-full space-y-3">
      <Alert>
        <TriangleAlert />
        <AlertTitle>Feed delayed</AlertTitle>
        <AlertDescription>
          The GBFS feed for Le Havre last updated 42 minutes ago.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Ingestion failed</AlertTitle>
        <AlertDescription>Three operators returned malformed data.</AlertDescription>
      </Alert>
    </div>
  );
}
