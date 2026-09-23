import { Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";
import {
  FloatingPanel,
  FloatingPanelActions,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
} from "@/registry/vianova/product/floating-panel";

export default function FloatingPanelDefault() {
  return (
    <div className="flex h-56 w-full items-start justify-start rounded-lg bg-surface-sunken p-3">
      <FloatingPanel className="max-h-full w-64">
        <FloatingPanelHeader className="border-b border-border p-3">
          <FloatingPanelTitle className="px-0">Charts</FloatingPanelTitle>
          <FloatingPanelActions>
            <Button variant="ghost" size="icon-sm" aria-label="Add">
              <Plus />
            </Button>
          </FloatingPanelActions>
        </FloatingPanelHeader>
        <FloatingPanelBody className="p-3 text-sm text-muted-foreground">
          Panels float over the map canvas, so the surface is translucent and the
          body scrolls on its own.
        </FloatingPanelBody>
      </FloatingPanel>
    </div>
  );
}
