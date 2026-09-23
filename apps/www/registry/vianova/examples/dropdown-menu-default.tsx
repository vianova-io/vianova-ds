import { MoreHorizontal } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/vianova/ui/dropdown-menu";

export default function DropdownMenuDefault() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Actions">
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {/* DropdownMenuLabel renders Base UI's Menu.GroupLabel, which throws
            unless it is inside a Menu.Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem>Download CSV</DropdownMenuItem>
          <DropdownMenuItem>Download GeoJSON</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Copy share link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
