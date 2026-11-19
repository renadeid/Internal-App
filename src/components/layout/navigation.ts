import {
  Activity,
  BookOpen,
  Boxes,
  FolderKanban,
  Images,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { AppRoute } from "@/lib/types"

export type NavItem = {
  href: AppRoute
  label: string
  icon: LucideIcon
  badge?: string
}

export const mainNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "My tasks", icon: ListTodo },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/assets", label: "Assets library", icon: Images },
  { href: "/artifacts", label: "Artifact hub", icon: Boxes },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen },
]

export const workspaceNav: NavItem[] = [
  {
    href: "/workspaces/marketing",
    label: "Marketing",
    icon: Megaphone,
    badge: "Active",
  },
]

export const utilityNav: NavItem[] = [
  { href: "/people", label: "People & onboarding", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

const labels: Record<AppRoute, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/tasks": "My tasks",
  "/activity": "Activity",
  "/assets": "Assets library",
  "/artifacts": "Artifact hub",
  "/knowledge": "Knowledge base",
  "/workspaces/marketing": "Marketing",
  "/people": "People & onboarding",
  "/settings": "Settings",
}

export function isNavActive(pathname: string, href: AppRoute) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function breadcrumbLabel(pathname: string) {
  if (pathname in labels) return labels[pathname as AppRoute]
  return "Roaya Connect"
}
