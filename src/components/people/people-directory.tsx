"use client"

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react"

import Link from "next/link"
import { Input } from "@/components/ui/input"

import { useOrganization } from "@/components/auth/organization-provider"
import { PageIntro } from "@/components/shared/page-intro"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
 const [search, setSearch] = useState("")

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

  const role=snapshot.people.find(person=>person.profileId===snapshot.currentUserId)?.role
  const canInspectOthers=role==="org_admin"||role==="team_lead"
  return (
    <div className="grid gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{snapshot.people.length} employees · {canInspectOthers?"Select a person to open their profile.":"You can open your own profile. Employee work details are private."}</p><Input type="search" className="h-11 w-full sm:w-80" aria-label="Search employees" placeholder="Search name or email…" value={search} onChange={e=>setSearch(e.target.value)} /></div><ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {snapshot.people.filter(person => (person.name + " " + person.email).toLowerCase().includes(search.trim().toLowerCase())).map((person) => (
        <li
          key={person.profileId}
          className="roaya-glass rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <EmployeeCardLink profileId={person.profileId} canView={canInspectOthers||person.profileId===snapshot.currentUserId}>
          <div className="flex items-center gap-3">
            <Avatar>
              {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt={person.name} /> : null}
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
          <p className="mt-4 break-all text-xs text-muted-foreground">{person.email}</p>{canInspectOthers||person.profileId===snapshot.currentUserId?<p className="mt-4 text-xs font-medium text-primary">{person.profileId===snapshot.currentUserId?"View your profile":"View employee profile"}</p>:null}</EmployeeCardLink>
        </li>
      ))}
    </ul>{!snapshot.people.some(person => (person.name + " " + person.email).toLowerCase().includes(search.trim().toLowerCase())) ? <p className="py-6 text-sm text-muted-foreground">No employees match your search.</p> : null}</div>
  )
}

function EmployeeCardLink({profileId,canView,children}:{profileId:string;canView:boolean;children:ReactNode}){return canView?<Link href={"/people/"+profileId} className="block h-full rounded-2xl p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">{children}</Link>:<div className="h-full p-5">{children}</div>}

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
