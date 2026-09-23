import { BarChart3, Layers, Map, Settings, Users } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/registry/vianova/ui/breadcrumb";
import { Button } from "@/registry/vianova/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/registry/vianova/ui/sidebar";
import { AppShell } from "@/registry/vianova/patterns/app-shell";
import { StatTile } from "@/registry/vianova/patterns/stat-tile";

const NAV = [
  { title: "Explore", icon: Map, active: true },
  { title: "Layers", icon: Layers },
  { title: "Reports", icon: BarChart3 },
  { title: "Team", icon: Users },
];

export default function AppShellDefault() {
  return (
    // `contain: paint` is load-bearing, not decoration. Sidebar renders
    // position: fixed, and overflow-hidden does not contain a fixed descendant
    // -- without a containing block the sidebar escapes this box and floats
    // over the whole page, which is exactly what it did on the showcase wall.
    // Paint containment makes this element that containing block.
    // Height is pinned so the inset scrolls inside the demo rather than the page.
    <div className="h-[420px] w-full overflow-hidden rounded-lg border [contain:paint]">
      <AppShell
        sidebarHeader={<div className="px-2 py-1.5 text-sm font-semibold">Vianova</div>}
        sidebar={
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.active} tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        }
        sidebarFooter={
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Settings">
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        }
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Explore</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        headerActions={<Button size="sm">Share</Button>}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <StatTile label="Trips" value="1.24" unit="M" delta="+12.4%" trend="up" />
          <StatTile label="Districts" value="54" hint="Le Havre agglomeration" />
        </div>
      </AppShell>
    </div>
  );
}
