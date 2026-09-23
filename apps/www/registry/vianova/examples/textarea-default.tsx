import { Label } from "@/registry/vianova/ui/label";
import { Textarea } from "@/registry/vianova/ui/textarea";

export default function TextareaDefault() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="notes">Analysis notes</Label>
      <Textarea id="notes" placeholder="What did this OD pair show?" />
    </div>
  );
}
