import { Marker, MarkerContent, MarkerIcon } from "@/registry/vianova/ui/marker";

export default function MarkerDefault() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Marker>
        <MarkerIcon />
        <MarkerContent>Origin</MarkerContent>
      </Marker>
      <Marker>
        <MarkerIcon />
        <MarkerContent>Destination</MarkerContent>
      </Marker>
    </div>
  );
}
