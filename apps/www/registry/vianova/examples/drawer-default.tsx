import { Button } from "@/registry/vianova/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/vianova/ui/drawer";

export default function DrawerDefault() {
  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="outline">Trip details</Button>} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Port district → City centre</DrawerTitle>
          <DrawerDescription>1,204 trips · 12.4 min median</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  );
}
