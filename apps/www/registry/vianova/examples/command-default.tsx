import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/registry/vianova/ui/command";

export default function CommandDefault() {
  return (
    <Command className="w-full max-w-sm rounded-lg border border-border">
      <CommandInput placeholder="Search actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Map">
          <CommandItem>Set origin</CommandItem>
          <CommandItem>Set destination</CommandItem>
          <CommandItem>Clear selection</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Export">
          <CommandItem>Download CSV</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
