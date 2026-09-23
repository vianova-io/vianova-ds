import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/registry/vianova/ui/menubar";

export default function MenubarDefault() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Save view <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Reset filters</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Fit to selection</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Export</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>CSV</MenubarItem>
          <MenubarItem>GeoJSON</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
