"use client";

import * as React from "react";
import { Braces, FileUp, Link2, Shapes } from "lucide-react";

import { ChoiceCard, ChoiceCardGroup } from "@/registry/vianova/ui/choice-card";

/**
 * `action` mode: the first click is the decision, so there is no footer button
 * and no card left sitting in a checked state.
 *
 * Reach for it when picking a thing and doing it are the same gesture -- a
 * "what do you want to create" dialog, most often. Keep the default `select`
 * mode when the choice is one field among several and something further down
 * commits the form.
 */
export default function ChoiceCardAction() {
  const [chosen, setChosen] = React.useState<string | null>(null);

  return (
    // w-full matters: the group is the container the columns are queried
    // against, and a wrapper that shrank to its content would hand it a width
    // narrow enough to collapse the grid back to one column.
    <div className="flex w-full max-w-xl flex-col gap-3">
      <ChoiceCardGroup
        aria-label="Where the zones come from"
        mode="action"
        columns={2}
        onChoose={setChosen}
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
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {chosen ? `Opened: ${chosen}` : "Pick one — a single click acts."}
      </p>
    </div>
  );
}
