import { Plus } from "lucide-react";

import { Button } from "@/registry/vianova/ui/button";

export default function ButtonSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add layer">
        <Plus />
      </Button>
    </div>
  );
}
