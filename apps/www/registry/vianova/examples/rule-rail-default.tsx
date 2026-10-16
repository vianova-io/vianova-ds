"use client";

import * as React from "react";

import { RULE_TYPES, type RuleType } from "@/registry/vianova/product/rule-type-icon";
import {
  RULE_RAIL_GLOBAL,
  RuleRail,
  type RuleRailItem,
} from "@/registry/vianova/product/rule-rail";

export default function RuleRailDefault() {
  const [items, setItems] = React.useState<RuleRailItem[]>([
    { id: "parking-1", type: "parking", label: "Parking 1" },
    { id: "parking-2", type: "parking", label: "Parking 2" },
    { id: "no-parking-1", type: "no_parking", label: "No parking 1" },
  ]);
  const [value, setValue] = React.useState("parking-1");
  const counter = React.useRef(0);

  const nextLabel = (type: RuleType, list: RuleRailItem[]) =>
    `${RULE_TYPES[type].label} ${list.filter((i) => i.type === type).length + 1}`;

  const add = (type: RuleType) => {
    const id = `${type}-new-${++counter.current}`;
    setItems((list) => [...list, { id, type, label: nextLabel(type, list) }]);
    setValue(id);
  };

  const duplicate = (id: string) => {
    const copyId = `${id}-copy-${++counter.current}`;
    setItems((list) => {
      const at = list.findIndex((i) => i.id === id);
      const source = list[at];
      if (!source) return list;
      const copy = { ...source, id: copyId, label: `${source.label} copy` };
      return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
    });
    setValue(copyId);
  };

  const remove = (id: string) => {
    const at = items.findIndex((i) => i.id === id);
    const rest = items.filter((i) => i.id !== id);
    setItems(rest);
    // Deleting the open rule opens its neighbour, not nothing.
    if (value === id) setValue(rest[Math.min(at, rest.length - 1)]?.id ?? RULE_RAIL_GLOBAL);
  };

  return (
    <div className="flex h-[420px] items-stretch gap-4">
      <RuleRail
        aria-label="Multi-parking rules"
        items={items}
        value={value}
        onValueChange={setValue}
        addableTypes={["parking", "no_parking"]}
        onAdd={add}
        onDuplicate={duplicate}
        onDelete={remove}
      />
      <p className="self-center text-sm text-muted-foreground">
        Selected: <code className="text-foreground">{value}</code>
      </p>
    </div>
  );
}
