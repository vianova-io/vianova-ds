import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/registry/vianova/ui/navigation-menu";

export default function NavigationMenuDefault() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Analyse</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-56 gap-1 p-2">
              <NavigationMenuLink href="#">Origin-destination</NavigationMenuLink>
              <NavigationMenuLink href="#">Zone activity</NavigationMenuLink>
              <NavigationMenuLink href="#">Road safety</NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
