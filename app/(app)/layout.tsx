"use client"

import React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <DashboardTopbar />
        <div className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  )
}
