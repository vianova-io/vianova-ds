import { BarChart3, Layers, Map, Users } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/registry/vianova/ui/breadcrumb";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/registry/vianova/ui/sidebar";
import { AnnouncementBar } from "@/registry/vianova/patterns/announcement-bar";
import { AppShell } from "@/registry/vianova/patterns/app-shell";
import { StatTile } from "@/registry/vianova/patterns/stat-tile";

const NAV = [
  { title: "Explore", icon: Map, active: true },
  { title: "Layers", icon: Layers },
  { title: "Reports", icon: BarChart3 },
  { title: "Team", icon: Users },
];

/**
 * Where the bar actually lives: the shell's `banner` slot, above the header
 * and outside the scroll container. Scroll the content and it stays put.
 */
export default function AnnouncementBarInShell() {
  return (
    // See app-shell-default: `contain: paint` gives the fixed-position sidebar
    // a containing block, or it escapes this box and floats over the page.
    <div className="h-[420px] w-full overflow-hidden rounded-lg border [contain:paint]">
      <AppShell
        sidebarHeader={<div className="px-2 py-1.5 text-sm font-semibold">Vianova</div>}
        banner={
          <AnnouncementBar
            announcement={{
              id: "sm-munich-f061-nov",
              kind: "maintenance",
              title: "Planned maintenance — Munich",
              scope: ["Shared mobility"],
              startsAt: "2026-11-07T22:00:00+01:00",
              endsAt: "2026-11-08T02:00:00+01:00",
              timeZone: "Europe/Berlin",
              href: "#",
            }}
            now={Date.parse("2026-11-07T14:00:00Z")}
            viewerTimeZone="Europe/Lisbon"
          />
        }
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
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Explore</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <StatTile label="Trips" value="1.24" unit="M" delta="+12.4%" trend="up" />
          <StatTile label="Districts" value="54" hint="Le Havre agglomeration" />
          <StatTile label="Operators" value="7" />
          <StatTile label="Zones" value="118" />
          <StatTile label="Vehicles" value="3,402" />
          <StatTile label="Feeds" value="12" />
        </div>
      </AppShell>
    </div>
  );
}
