import { Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import { ButtonGroup } from "@/registry/vianova/ui/button-group";

export default function ButtonGroupDefault() {
  return (
    <ButtonGroup>
      <Button variant="outline" size="icon" aria-label="Zoom in">
        <Plus />
      </Button>
      <Button variant="outline" size="icon" aria-label="Zoom out">
        <Minus />
      </Button>
      <Button variant="outline" size="icon" aria-label="Fit to view">
        <Maximize2 />
      </Button>
    </ButtonGroup>
  );
}
