import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/vianova/ui/tabs";

export default function TabsDefault() {
  return (
    <Tabs defaultValue="flows" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="flows">Flows</TabsTrigger>
        <TabsTrigger value="zones">Zones</TabsTrigger>
        <TabsTrigger value="operators">Operators</TabsTrigger>
      </TabsList>
      <TabsContent value="flows" className="pt-3 text-sm text-muted-foreground">
        1,204 origin-destination pairs in the current view.
      </TabsContent>
      <TabsContent value="zones" className="pt-3 text-sm text-muted-foreground">
        54 districts loaded from the Le Havre boundary set.
      </TabsContent>
      <TabsContent value="operators" className="pt-3 text-sm text-muted-foreground">
        6 operators reporting through GBFS.
      </TabsContent>
    </Tabs>
  );
}
