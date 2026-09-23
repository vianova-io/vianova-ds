import { Button } from "@/registry/vianova/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/vianova/ui/dialog";
import { Input } from "@/registry/vianova/ui/input";
import { Label } from "@/registry/vianova/ui/label";

export default function DialogDefault() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Save view</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save current view</DialogTitle>
          <DialogDescription>
            Filters, map scheme and zoom are stored with the view.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="view-name">Name</Label>
          <Input id="view-name" defaultValue="Le Havre — weekday AM" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
