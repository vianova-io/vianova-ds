import { ScrollArea } from "@/registry/vianova/ui/scroll-area";
import { Separator } from "@/registry/vianova/ui/separator";

const districts = [
  "Port district", "City centre", "Sainte-Adresse", "Caucriauville",
  "Aplemont", "Bléville", "Dollemard", "Graville", "Mont-Gaillard", "Rouelles",
];

export default function ScrollAreaDefault() {
  return (
    <ScrollArea className="h-40 w-full max-w-xs rounded-md border border-border">
      <div className="p-3">
        {districts.map((d) => (
          <div key={d}>
            <div className="py-1.5 text-sm">{d}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
