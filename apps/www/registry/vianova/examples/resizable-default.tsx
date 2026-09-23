import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/registry/vianova/ui/resizable";

// react-resizable-panels v3: the group is horizontal by default and its
// orientation is expressed through aria, not a `direction` prop.
export default function ResizableDefault() {
  return (
    <ResizablePanelGroup className="h-40 w-full rounded-lg border border-border">
      <ResizablePanel defaultSize={35}>
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          Filters
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65}>
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          Map
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
