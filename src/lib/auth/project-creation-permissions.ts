"use server"

import { createClient } from "@/lib/supabase/server"
import { getOrganizationPeople } from "./get-organization-people"
import type { AdminResult } from "./super-admin-types"

async function managerContext(organizationId: string) {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  const actor = await client.from("organization_memberships").select("role").eq("organization_id", organizationId).eq("profile_id", data.user.id).maybeSingle()
  if (actor.error || !actor.data || !["org_admin", "team_lead"].includes(actor.data.role)) return null
  return client
}

export async function getProjectCreationPermissions(organizationId: string) {
  const client = await managerContext(organizationId)
  if (!client) return { status: "denied" as const }
  const [people, grants] = await Promise.all([
    getOrganizationPeople(organizationId),
    client.from("project_creation_grants").select("profile_id").eq("organization_id", organizationId),
  ])
  if (people.status !== "ready" || grants.error) return { status: "error" as const }
  const granted = new Set(grants.data.map(grant => grant.profile_id))
  return { status: "ready" as const, members: people.people.filter(person => person.role === "member").map(person => ({ id: person.profileId, name: person.name, email: person.email, canCreate: granted.has(person.profileId) })) }
}

export async function setProjectCreationPermission(organizationId: string, profileId: string, allowed: boolean): Promise<AdminResult> {
  const client = await managerContext(organizationId)
  if (!client) return { ok: false, message: "Team lead or Super admin permission is required." }
  if (typeof allowed !== "boolean") return { ok: false, message: "Choose a valid permission." }
  const result = await client.rpc("set_project_creation_permission", { target_organization: organizationId, target_profile: profileId, allow_creation: allowed })
  if (result.error) return { ok: false, message: "Permission could not be saved. Check that this person is still a Member in this workspace." }
  return { ok: true, message: allowed ? "Create project permission granted." : "Create project permission revoked." }
}
