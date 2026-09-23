"use client";

import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/registry/vianova/ui/sidebar";
import { Separator } from "@/registry/vianova/ui/separator";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * The frame every signed-in page sits in: collapsible sidebar, sticky header
 * bar, scrollable content.
 *
 * The header is sticky and the content scrolls, rather than the page scrolling
 * as a whole. That matters for a product whose main view is a full-bleed map
 * canvas: the canvas must be able to fill the inset exactly, which it cannot
 * do if the document itself is the scroll container.
 */
export function AppShell({
  sidebar,
  sidebarHeader,
  sidebarFooter,
  header,
  headerActions,
  defaultSidebarOpen = true,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** Navigation body. Usually SidebarGroup + SidebarMenu. */
  sidebar: React.ReactNode;
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  /** Left of the header bar, after the trigger. Usually a breadcrumb. */
  header?: React.ReactNode;
  headerActions?: React.ReactNode;
  defaultSidebarOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <Sidebar collapsible="icon">
        {sidebarHeader ? <SidebarHeader>{sidebarHeader}</SidebarHeader> : null}
        <SidebarContent>{sidebar}</SidebarContent>
        {sidebarFooter ? <SidebarFooter>{sidebarFooter}</SidebarFooter> : null}
      </Sidebar>

      <SidebarInset data-slot="app-shell" className={cn("min-w-0", className)} {...props}>
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          {header ? (
            <>
              <Separator orientation="vertical" className="mr-1 h-4" />
              <div className="min-w-0 flex-1">{header}</div>
            </>
          ) : (
            <div className="flex-1" />
          )}
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
