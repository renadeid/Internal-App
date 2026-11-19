"use client"

import { Menu, Plus } from "lucide-react"

import { HeaderBreadcrumbs } from "@/components/layout/header-breadcrumbs"
import { NotificationsMenu } from "@/components/layout/notifications-menu"
import { SearchField } from "@/components/layout/search-field"
import { UserMenu } from "@/components/layout/user-menu"
import type { UserIdentity } from "@/lib/auth/user-identity"
import { Button } from "@/components/ui/button"

export function Header({
  identity,
  canCreate,
  createLabel,
  onOpenMobileNav,
  onCreate,
}: {
  identity: UserIdentity
  canCreate: boolean
  createLabel: string
  onOpenMobileNav: () => void
  onCreate: () => void
}) {
  return (
    <header className="roaya-masthead sticky top-0 z-30 border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3 lg:gap-4 lg:px-6">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu />
        </Button>
        <HeaderBreadcrumbs />
        <div className="min-w-0 flex-1">
          <SearchField />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            disabled={!canCreate}
            aria-label={canCreate ? "Quick create" : createLabel}
            title={createLabel}
            onClick={canCreate ? onCreate : undefined}
          >
            <Plus />
            <span className="hidden sm:inline">Quick create</span>
          </Button>
          <NotificationsMenu />
          <UserMenu identity={identity} />
        </div>
      </div>
    </header>
  )
}
