import { BarChart3, Map, Settings } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/registry/vianova/ui/sidebar";

const nav = [
  { title: "Explore", icon: Map },
  { title: "Dashboards", icon: BarChart3 },
  { title: "Settings", icon: Settings },
];

export default function SidebarDefault() {
  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
      <SidebarProvider className="min-h-full">
        <Sidebar collapsible="none" className="h-full">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.title}>
                      <SidebarMenuButton>
                        <n.icon />
                        <span>{n.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
