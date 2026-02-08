"use client"

import React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSideNav } from "@/components/app/AppSideNav"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav"
import { GlobalLoader } from "@/components/GlobalLoader"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSideNav />
      <SidebarInset>
        <GlobalLoader />
        <DashboardTopbar />
        <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </main>
        <div data-slot="right-drawer-host" className="hidden" aria-hidden />
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  )
}
