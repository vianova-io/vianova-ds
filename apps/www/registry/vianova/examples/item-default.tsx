import { Bike, ChevronRight } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/registry/vianova/ui/item";

const layers = [
  { name: "Shared bikes", detail: "12,480 trips this week" },
  { name: "Scooters", detail: "8,102 trips this week" },
];

export default function ItemDefault() {
  return (
    <ItemGroup className="w-full">
      {layers.map((l) => (
        <Item key={l.name}>
          <ItemMedia variant="icon">
            <Bike />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{l.name}</ItemTitle>
            <ItemDescription>{l.detail}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
