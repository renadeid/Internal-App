"use client"

import { createContext, useContext, useState } from "react"

import type {
  AccessibleOrganization,
  OrganizationAccess,
} from "@/lib/auth/organization-access"

type OrganizationMode = "unavailable" | "none" | "single" | "multiple"

type OrganizationContextValue = {
  mode: OrganizationMode
  organizations: AccessibleOrganization[]
  activeOrganization: AccessibleOrganization | null
  selectOrganization: (id: string) => void
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

export function OrganizationProvider({
  access,
  children,
}: {
  access: OrganizationAccess
  children: React.ReactNode
}) {
  const organizations = access.status === "ready" ? access.organizations : []
  const [chosenId, setChosenId] = useState<string | null>(null)
  const chosen = organizations.find((organization) => organization.id === chosenId) ?? null
  const activeOrganization =
    organizations.length === 1 ? organizations[0] : chosen

  function selectOrganization(id: string) {
    if (organizations.length < 2) return
    if (!organizations.some((organization) => organization.id === id)) return
    setChosenId(id)
  }

  const mode: OrganizationMode =
    access.status === "unavailable"
      ? "unavailable"
      : organizations.length === 0
        ? "none"
        : organizations.length === 1
          ? "single"
          : "multiple"

  return (
    <OrganizationContext.Provider
      value={{ mode, organizations, activeOrganization, selectOrganization }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const value = useContext(OrganizationContext)
  if (!value) {
    throw new Error(
      "Organization access is only available inside the signed-in workspace."
    )
  }
  return value
}

export function OrganizationCompanyName() {
  const { mode, activeOrganization } = useOrganization()
  if (activeOrganization) return activeOrganization.name
  if (mode === "multiple") return "Select an organization in the sidebar"
  if (mode === "unavailable") return "Organization unavailable"
  return "No organization"
}
