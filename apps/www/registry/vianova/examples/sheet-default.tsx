import { Button } from "@/registry/vianova/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/registry/vianova/ui/sheet";

export default function SheetDefault() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open data panel</Button>} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Data layers</SheetTitle>
          <SheetDescription>Toggle what is drawn on the map.</SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm text-muted-foreground">
          Districts, flows and points of interest.
        </div>
      </SheetContent>
    </Sheet>
  );
}
