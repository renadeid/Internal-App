"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { useOrganization } from "@/components/auth/organization-provider"
import { BrandLogo } from "@/components/shared/brand-logo"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  isNavActive,
  mainNav,
  utilityNav,
  workspaceNav,
  type NavItem,
} from "@/components/layout/navigation"
import { cn } from "@/lib/utils"

type SidebarPanelProps = {
  collapsed?: boolean
  onNavigate?: () => void
  onToggle?: () => void
}

export function SidebarPanel({
  collapsed = false,
  onNavigate,
  onToggle,
}: SidebarPanelProps) {
  return (
    <div className="roaya-sidebar flex h-full flex-col">
      <div className={cn("flex flex-col gap-2 px-4 py-5", collapsed && "px-3")}>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex w-fit items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Roaya Connect"
        >
          <BrandLogo compact={collapsed} className={collapsed ? undefined : "w-32"} />
          {!collapsed ? <span className="border-s border-navy-200 ps-3 text-xs font-semibold text-navy-600">Connect</span> : null}
        </Link>
        <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
          <OrganizationLabel />
        </div>
      </div>

      <nav aria-label="Primary" data-tour="sidebar" className="flex-1 overflow-y-auto px-3 pb-3">
        <NavGroup items={mainNav} collapsed={collapsed} onNavigate={onNavigate} />
        <p
          className={cn(
            "mt-6 mb-2 px-3 text-xs font-medium text-muted-foreground",
            collapsed && "sr-only"
          )}
        >
          Department workspaces
        </p>
        <NavGroup
          items={workspaceNav}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <Separator className="my-4" />
        <NavGroup
          items={utilityNav}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      {onToggle ? (
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="ghost"
            className={cn("w-full justify-start", collapsed && "justify-center px-0")}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            <span className={cn(collapsed && "sr-only")}>
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function OrganizationLabel() {
  const { mode, organizations, activeOrganization, selectOrganization } =
    useOrganization()

  if (mode === "multiple") {
    return (
      <Select
        items={organizations.map((organization) => ({
          value: organization.id,
          label: organization.name,
        }))}
        value={activeOrganization?.id ?? null}
        onValueChange={(value) => {
          if (value) selectOrganization(value)
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-6 w-full max-w-full justify-between border-0 bg-transparent px-0 py-0 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent"
          aria-label="Select organization"
        >
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent align="start">
          {organizations.map((organization) => (
            <SelectItem key={organization.id} value={organization.id}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const label = activeOrganization
    ? activeOrganization.name
    : mode === "unavailable"
      ? "Organization unavailable"
      : "No organization"

  return (
    <span className="block truncate text-xs text-muted-foreground">{label}</span>
  )
}

function NavGroup({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[]
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href)
        const Icon = item.icon
        const link = (
          <Link
            href={item.href}
            data-tour={"nav" + item.href.replaceAll("/", "-")}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "roaya-nav-link flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-2"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
            {item.badge && !collapsed ? (
              <span className="ml-auto rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                {item.badge}
              </span>
            ) : null}
          </Link>
        )

        return (
          <li key={item.href}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 border-e border-border transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <SidebarPanel collapsed={collapsed} onToggle={onToggle} />
    </aside>
  )
}
