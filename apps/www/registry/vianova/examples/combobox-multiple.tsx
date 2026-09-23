"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/registry/vianova/ui/combobox";
import { Label } from "@/registry/vianova/ui/label";

const districts = [
  "Port district",
  "City centre",
  "Sainte-Adresse",
  "Graville",
  "Caucriauville",
  "Bléville",
];

export default function ComboboxMultiple() {
  const [value, setValue] = React.useState<string[]>(["Port district", "Graville"]);

  return (
    <div className="w-full max-w-sm space-y-2">
      <Label htmlFor="districts">Districts</Label>
      <Combobox items={districts} multiple value={value} onValueChange={setValue}>
        <ComboboxChips>
          {value.map((item) => (
            <ComboboxChip key={item} aria-label={item}>
              {item}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput id="districts" placeholder={value.length ? "" : "Add districts…"} />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No district found.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
