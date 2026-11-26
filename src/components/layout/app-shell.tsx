"use client"

import { useState } from "react"
import { LiveWorkspaceProvider } from "@/components/workspace/live-workspace-provider"

import { useOrganization } from "@/components/auth/organization-provider"
import { ProjectInvitationsBanner, ProjectInvitationsProvider } from "@/components/projects/project-invitations"
import { CreateProjectDialog } from "@/components/layout/create-project-dialog"
import { Header } from "@/components/layout/header"
import {
  projectCreationLabel,
  useProjectCreationAccess,
} from "@/components/projects/project-creation-access"
import { Sidebar, SidebarPanel } from "@/components/layout/sidebar"
import { AskConnect } from "@/components/assistant/ask-connect"
import { AssetUploadProvider } from "@/components/assets/asset-upload-manager"
import { ProjectCreateLauncherProvider } from "@/components/projects/project-create-launcher"
import { SpotlightTour } from "@/components/onboarding/spotlight-tour"
import type { UserIdentity } from "@/lib/auth/user-identity"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function AppShell({
  identity,
  children,
}: {
  identity: UserIdentity
  children: React.ReactNode
}) {
  const { activeOrganization } = useOrganization()
  const creation = useProjectCreationAccess(activeOrganization?.id ?? null)
  const canCreate = creation.status === "ready" && creation.canCreate
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <LiveWorkspaceProvider key={identity.email}><ProjectInvitationsProvider key={identity.email}><AssetUploadProvider key={identity.email}>
    <div className="roaya-workspace flex min-h-svh text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-64 gap-0 p-0 sm:max-w-none"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Roaya Connect</SheetTitle>
            <SheetDescription>Primary navigation</SheetDescription>
          </SheetHeader>
          <SidebarPanel onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          identity={identity}
          canCreate={canCreate}
          createLabel={projectCreationLabel(creation)}
          onOpenMobileNav={() => setMobileOpen(true)}
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed(value => !value)}
          onCreate={() => setCreateOpen(true)}
        />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ProjectCreateLauncherProvider value={{ canCreate, open: () => setCreateOpen(true) }}>
            <div className="mx-auto w-full max-w-7xl"><ProjectInvitationsBanner />{children}</div>
          </ProjectCreateLauncherProvider>
        </main>
      </div>
      {activeOrganization && creation.status === "ready" && creation.canCreate ? (
        <CreateProjectDialog
          key={activeOrganization.id}
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
          access={creation}
        />
      ) : null}
      <SpotlightTour userKey={identity.email || identity.name} firstName={identity.name.split(" ")[0]} />
      <AskConnect firstName={identity.name.split(" ")[0]} />
    </div>
    </AssetUploadProvider></ProjectInvitationsProvider></LiveWorkspaceProvider>
  )
}
