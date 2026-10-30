"use client";

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
import {
  AnnouncementBar,
  type Announcement,
} from "@/registry/vianova/patterns/announcement-bar";
import { AppShell } from "@/registry/vianova/patterns/app-shell";
import { MaintenanceGate } from "@/registry/vianova/patterns/maintenance-screen";
import { StatTile } from "@/registry/vianova/patterns/stat-tile";

/**
 * One announcement, two states. Before the window the bar warns and VIP works;
 * once it opens the gate closes and there is nothing to do but wait.
 */
const MUNICH: Announcement = {
  id: "sm-munich-f061-nov",
  kind: "maintenance",
  title: "Vianova is down for planned maintenance",
  body: "We are migrating the shared-mobility database for Munich. Nothing is lost — reports and saved views will be exactly where you left them.",
  scope: ["Munich", "Shared mobility"],
  startsAt: "2026-11-07T22:00:00+01:00",
  endsAt: "2026-11-08T02:00:00+01:00",
  timeZone: "Europe/Berlin",
};

const VIEWER = "Europe/Lisbon";
const NAV = [
  { title: "Explore", icon: Map, active: true },
  { title: "Layers", icon: Layers },
  { title: "Reports", icon: BarChart3 },
  { title: "Team", icon: Users },
];

function Shell({ now }: { now: number }) {
  return (
    // See app-shell-default: `contain: paint` gives the fixed-position sidebar
    // a containing block, or it escapes this box and floats over the page.
    <div className="h-[470px] w-full overflow-hidden rounded-lg border [contain:paint]">
      <MaintenanceGate
        announcement={MUNICH}
        now={now}
        viewerTimeZone={VIEWER}
        onRetry={() => {}}
        className="h-full min-h-0 overflow-auto"
      >
        <AppShell
          sidebarHeader={<div className="px-2 py-1.5 text-sm font-semibold">Vianova</div>}
          banner={
            <AnnouncementBar
              announcement={{ ...MUNICH, title: "Planned maintenance — Munich", body: undefined }}
              now={now}
              viewerTimeZone={VIEWER}
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
          </div>
        </AppShell>
      </MaintenanceGate>
    </div>
  );
}

export default function MaintenanceScreenDefault() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Seven hours before the window — the bar warns, VIP still works.
        </p>
        <Shell now={Date.parse("2026-11-07T14:00:00Z")} />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Inside the window — the gate closes. No way past it until the intervention is done.
        </p>
        <Shell now={Date.parse("2026-11-07T23:30:00Z")} />
      </div>
    </div>
  );
}
