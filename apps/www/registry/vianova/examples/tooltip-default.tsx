import { Info } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/vianova/ui/tooltip";

export default function TooltipDefault() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="About this metric">
              <Info />
            </Button>
          }
        />
        <TooltipContent>Internal trips start and end in the same district.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
