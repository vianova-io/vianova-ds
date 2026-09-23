"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/registry/vianova/ui/combobox";

const districts = ["Port district", "City centre", "Sainte-Adresse", "Graville"];

export default function ComboboxDefault() {
  return (
    <Combobox items={districts}>
      <ComboboxInput aria-label="Filter districts" placeholder="Filter districts…" className="w-full max-w-sm" />
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
  );
}
