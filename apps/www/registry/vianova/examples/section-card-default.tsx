import { Button } from "@/registry/vianova/ui/button";
import { Label } from "@/registry/vianova/ui/label";
import { SectionCard } from "@/registry/vianova/patterns/section-card";
import { Switch } from "@/registry/vianova/ui/switch";

export default function SectionCardDefault() {
  return (
    <SectionCard
      className="w-full max-w-lg"
      title="Data retention"
      description="How long raw trip records are kept before aggregation."
      action={
        <Button variant="ghost" size="sm">
          Reset
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
          <Button size="sm">Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="retain-raw" className="font-normal">
            Keep raw records for 90 days
          </Label>
          <Switch id="retain-raw" defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="anonymise" className="font-normal">
            Anonymise on ingest
          </Label>
          <Switch id="anonymise" />
        </div>
      </div>
    </SectionCard>
  );
}
