import { Button } from "@/registry/vianova/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/registry/vianova/ui/alert-dialog";

export default function AlertDialogDefault() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive">Delete zone set</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this zone set?</AlertDialogTitle>
          <AlertDialogDescription>
            54 districts and every saved view built on them will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
