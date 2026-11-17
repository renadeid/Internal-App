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
  { href: "/tasks", label: "My Tasks", icon: ListTodo },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/assets", label: "Assets Library", icon: Images },
  { href: "/artifacts", label: "Artifact Hub", icon: Boxes },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
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
  { href: "/people", label: "People & Onboarding", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

const labels: Record<AppRoute, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/tasks": "My Tasks",
  "/activity": "Activity",
  "/assets": "Assets Library",
  "/artifacts": "Artifact Hub",
  "/knowledge": "Knowledge Base",
  "/workspaces/marketing": "Marketing",
  "/people": "People & Onboarding",
  "/settings": "Settings",
}

export function isNavActive(pathname: string, href: AppRoute) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function breadcrumbLabel(pathname: string) {
  if (pathname in labels) return labels[pathname as AppRoute]
  return "Company Hub"
}
