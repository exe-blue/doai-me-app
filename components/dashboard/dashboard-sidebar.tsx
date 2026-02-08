"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Smartphone,
  Play,
  Brain,
  Archive,
  Settings as SettingsIcon,
  Rocket,
  Circle,
  BookOpen,
  Library,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const mainItems = [
  { label: "대시보드", href: "/dashboard", icon: Home },
  { label: "온보딩", href: "/onboarding", icon: Rocket },
  { label: "명령", href: "/commands", icon: Library },
  { label: "기기", href: "/devices", icon: Smartphone },
  { label: "실행", href: "/runs", icon: Brain },
  { label: "콘텐츠", href: "/content", icon: Play },
]

const moreItems = [
  { label: "기록 보관소", href: "/dashboard/artifacts", icon: Archive },
  { label: "Playbook", href: "/dashboard/playbooks", icon: BookOpen },
  { label: "세팅", href: "/dashboard/onboarding", icon: Circle },
  { label: "설정/권한", href: "/dashboard/settings", icon: SettingsIcon },
]

export function DashboardSidebar() {
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

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>메인</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>더보기</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {moreItems.map((item) => (
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

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3 group-data-[collapsible=icon]:px-1">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            Op
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-foreground">운영자</span>
            <span className="text-[10px] text-muted-foreground">operator@doai.me</span>
          </div>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <Select defaultValue="node-a">
            <SelectTrigger className="h-7 w-full text-xs">
              <div className="flex items-center gap-1.5">
                <Circle className="size-2 fill-emerald-500 text-emerald-500" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="node-a">노드 A</SelectItem>
              <SelectItem value="node-b">노드 B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
