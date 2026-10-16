import { Braces, FileUp, Link2, Shapes } from "lucide-react";

import { ChoiceCard, ChoiceCardGroup } from "@/registry/vianova/ui/choice-card";

export default function ChoiceCardDefault() {
  return (
    <ChoiceCardGroup
      aria-label="Where the zones come from"
      defaultValue="zones"
      columns={2}
      className="max-w-xl"
    >
      <ChoiceCard
        value="zones"
        icon={<Shapes />}
        title="Your zones"
        description="Pick from zones already saved in Vianova."
      />
      <ChoiceCard
        value="paste"
        icon={<Braces />}
        title="Paste GeoJSON"
        description="Paste a shape and preview it before adding."
      />
      <ChoiceCard
        value="upload"
        icon={<FileUp />}
        title="Upload file"
        description="Shapefile, KML or GeoJSON."
        badge="Soon"
        disabled
      />
      <ChoiceCard
        value="url"
        icon={<Link2 />}
        title="From a URL"
        description="Keep zones in sync with a hosted file."
        badge="Soon"
        disabled
      />
    </ChoiceCardGroup>
  );
}
