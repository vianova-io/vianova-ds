"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { TagInput } from "@/registry/vianova/patterns/tag-input";

const DISTRICTS = [
  { id: "baixa", name: "Baixa" },
  { id: "chiado", name: "Chiado" },
  { id: "alfama", name: "Alfama" },
  { id: "belem", name: "Belém" },
  { id: "avenidas-novas", name: "Avenidas Novas" },
  { id: "parque-nacoes", name: "Parque das Nações" },
  { id: "campo-ourique", name: "Campo de Ourique" },
  { id: "graca", name: "Graça" },
];

/**
 * As a picker's chip field: chips are chosen from a list by id, the text
 * filters the list, and Enter picks the top match. Free text never becomes a
 * tag. The zone picker uses it this way.
 */
export default function TagInputPicker() {
  const [ids, setIds] = React.useState(["baixa", "chiado", "alfama"]);
  const [query, setQuery] = React.useState("");
  const name = (id: string) => DISTRICTS.find((d) => d.id === id)?.name ?? id;

  const matches = DISTRICTS.filter(
    (d) => !ids.includes(d.id) && d.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="w-full max-w-sm space-y-2">
      <TagInput
        startAddon={<Search />}
        inputLabel="Search districts"
        placeholder="Type a district"
        value={ids}
        onValueChange={setIds}
        getTagLabel={name}
        maxVisible={2}
        draft={query}
        onDraftChange={setQuery}
        onDraftCommit={() => {
          const top = matches[0];
          if (!top) return;
          setIds([...ids, top.id]);
          setQuery("");
        }}
      />
      <ul aria-label="Matching districts" className="divide-border divide-y rounded-lg border text-sm">
        {matches.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setIds([...ids, d.id])}
              className="hover:bg-muted focus-visible:ring-ring/50 w-full px-3 py-2 text-left focus-visible:ring-[3px] focus-visible:outline-none"
            >
              {d.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
