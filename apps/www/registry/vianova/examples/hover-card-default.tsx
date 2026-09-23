import { Button } from "@/registry/vianova/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/registry/vianova/ui/hover-card";

export default function HoverCardDefault() {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link">Port district</Button>} />
      <HoverCardContent className="w-64">
        <p className="text-sm font-medium">Port district</p>
        <p className="mt-1 text-sm text-muted-foreground">
          12,480 trips this week · 14.2 min average duration
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
