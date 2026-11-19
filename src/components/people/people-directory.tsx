"use client"

import { useMemo, useSyncExternalStore } from "react"

import { useOrganization } from "@/components/auth/organization-provider"
import { PageIntro } from "@/components/shared/page-intro"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getOrganizationPeople } from "@/lib/auth/get-organization-people"
import type {
  OrganizationPerson,
  OrganizationPeopleResult,
  OrganizationRole,
} from "@/lib/auth/organization-people"

type PeopleSnapshot = {
  status: "loading" | OrganizationPeopleResult["status"]
  currentUserId: string | null
  people: OrganizationPerson[]
}

export function PeopleDirectory() {
  const { activeOrganization, mode } = useOrganization()
  const description = activeOrganization
    ? `Members of ${activeOrganization.name}.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its members."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="People & onboarding" description={description} />
      {activeOrganization ? (
        <PeopleList
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      ) : null}
    </div>
  )
}

function PeopleList({
  organizationId,
  organizationName,
}: {
  organizationId: string
  organizationName: string
}) {
  const snapshot = useOrganizationPeople(organizationId)

  if (snapshot.status === "loading") {
    return <PeopleMessage message={`Loading people in ${organizationName}…`} />
  }
  if (snapshot.status === "error") {
    return <PeopleMessage message="People could not be loaded." />
  }
  if (snapshot.status === "rejected") {
    return <PeopleMessage message="This organization is not available for your account." />
  }
  if (snapshot.people.length === 0) {
    return <PeopleMessage message={`${organizationName} has no members.`} />
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {snapshot.people.map((person) => (
        <li
          key={person.profileId}
          className="roaya-glass rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: person.avatarColor }}
              >
                {person.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold">{person.name}</h2>
                {person.profileId === snapshot.currentUserId ? (
                  <Badge variant="secondary">You</Badge>
                ) : null}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {organizationRoleLabel(person.role)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{person.email}</p>
        </li>
      ))}
    </ul>
  )
}

function PeopleMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {message}
    </p>
  )
}

function organizationRoleLabel(role: OrganizationRole) {
  if (role === "org_admin") return "Super admin"
  if (role === "admin") return "Admin"
  if (role === "team_lead") return "Owner (Team lead)"
  if (role === "member") return "Member"
  if (role === "viewer") return "Viewer"
  return role
}

function useOrganizationPeople(organizationId: string) {
  const store = useMemo(() => createPeopleStore(organizationId), [organizationId])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

function createPeopleStore(organizationId: string) {
  const initial: PeopleSnapshot = {
    status: "loading",
    currentUserId: null,
    people: [],
  }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const requestGeneration = ++generation
      void getOrganizationPeople(organizationId)
        .then((result) => {
          if (requestGeneration !== generation) return
          current = {
            status: result.status,
            currentUserId: result.status === "ready" ? result.currentUserId : null,
            people: result.status === "ready" ? result.people : [],
          }
          listeners.forEach((item) => item())
        })
        .catch(() => {
          if (requestGeneration !== generation) return
          current = { status: "error", currentUserId: null, people: [] }
          listeners.forEach((item) => item())
        })
      return () => {
        listeners.delete(listener)
        generation += 1
      }
    },
    getSnapshot() {
      return current
    },
    getServerSnapshot() {
      return initial
    },
  }
}
