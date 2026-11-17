import { Suspense } from "react"
import { connection } from "next/server"
import { redirect } from "next/navigation"

import { CurrentIdentityProvider } from "@/components/auth/current-identity-provider"
import { OrganizationProvider } from "@/components/auth/organization-provider"
import { AppShell } from "@/components/layout/app-shell"
import { WorkspaceProvider } from "@/components/workspace/workspace-provider"
import { getCurrentIdentity } from "@/lib/auth/current-identity"
import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  )
}

async function AuthenticatedWorkspace({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth reads the request cookie and checks token expiry with Date.now().
  // connection() waits for a real request so that work is not part of prerender.
  await connection()
  const [identity, organizations] = await Promise.all([
    getCurrentIdentity(),
    getAccessibleOrganizations(),
  ])

  if (!identity) {
    redirect("/login")
  }

  return (
    <CurrentIdentityProvider identity={identity}>
      <OrganizationProvider access={organizations}>
        <WorkspaceProvider>
          <AppShell identity={identity}>{children}</AppShell>
        </WorkspaceProvider>
      </OrganizationProvider>
    </CurrentIdentityProvider>
  )
}
