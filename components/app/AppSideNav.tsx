"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Library, Smartphone, Brain, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "대시보드", href: "/dashboard", icon: Home },
  { label: "명령", href: "/commands", icon: Library },
  { label: "기기", href: "/devices", icon: Smartphone },
  { label: "실행", href: "/runs", icon: Brain },
  { label: "콘텐츠", href: "/content", icon: Play },
]

export function AppSideNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            DoAi.Me
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono group-data-[collapsible=icon]:hidden">
            MVP
          </Badge>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메인</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
