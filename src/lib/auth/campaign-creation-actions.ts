"use server"

import { randomUUID } from "node:crypto"
import { isValidCalendarDate } from "@/lib/auth/calendar-date"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import {
  campaignStatusValues,
  campaignTypeValues,
  type CampaignCreationAccess,
  type CampaignOwnerOption,
  type CampaignStatusValue,
  type CampaignTypeValue,
  type CreateCampaignInput,
  type CreateCampaignResult,
} from "@/lib/auth/organization-campaigns"
import { projectSlugFromName } from "@/lib/auth/project-slug"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

const slugRetries = ["", "-2", "-3", "-4", "-5"]

export async function getCampaignCreationAccess(
  organizationId: string,
  projectId: string | null
): Promise<CampaignCreationAccess> {
  if (projectId && !isUuid(projectId)) return { status: "ready", canCreate: false }

  const supabase = await openSelectedOrganization(organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const membership = await supabase.client
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", user.id)
  if (membership.error || !membership.data) return { status: "error" }
  if (membership.data.length !== 1) return { status: "error" }

  const projects = await supabase.client
    .from("projects")
    .select("id, name, archived_at")
    .eq("organization_id", organizationId)
  if (projects.error || !projects.data) return { status: "error" }

  const active = projects.data.filter((project) => !project.archived_at)
  const activeIds = active.map((project) => project.id)
  const memberships =
    activeIds.length === 0
      ? { data: [], error: null }
      : await supabase.client
          .from("project_members")
          .select("project_id, role")
          .eq("organization_id", organizationId)
          .eq("profile_id", user.id)
          .in("project_id", activeIds)
  if (memberships.error || !memberships.data) return { status: "error" }

  const writableIds = writableProjectIds(
    membership.data[0].role,
    activeIds,
    memberships.data
  )
  const writableProjects = active
    .filter((project) => writableIds.has(project.id))
    .map((project) => ({ id: project.id, name: project.name.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (projectId) {
    const selected = writableProjects.find((project) => project.id === projectId)
    if (!selected) return { status: "ready", canCreate: false }
    const owners = await loadOwners(supabase.client, organizationId, projectId, user.id)
    if (owners.status !== "ready") return owners
    return {
      status: "ready",
      canCreate: true,
      projects: [selected],
      owners: owners.owners,
      defaultOwnerId: owners.defaultOwnerId,
    }
  }

  if (writableProjects.length === 0) return { status: "ready", canCreate: false }
  return {
    status: "ready",
    canCreate: true,
    projects: writableProjects,
    owners: [],
    defaultOwnerId: null,
  }
}

export async function createOrganizationCampaign(
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  const name = input.name.trim()
  const description = input.description.trim()
  const goals = input.goals.trim()
  const slug = projectSlugFromName(name)

  if (!isUuid(input.projectId)) {
    return { status: "invalid", message: "Choose a project." }
  }
  if (!name) return { status: "invalid", message: "Enter a campaign name." }
  if (!slug) {
    return {
      status: "invalid",
      message: "Use a name that contains a letter or number.",
    }
  }
  if (!isType(input.type)) return { status: "invalid", message: "Choose a type." }
  if (!isStatus(input.status)) return { status: "invalid", message: "Choose a status." }
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) {
    return { status: "invalid", message: "Enter the start and end dates as YYYY-MM-DD." }
  }
  if (input.endsOn < input.startsOn) {
    return {
      status: "invalid",
      message: "The end date must be on or after the start date.",
    }
  }
  if (!isUuid(input.ownerId)) {
    return { status: "invalid", message: "Choose an owner from this project." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const campaignId = randomUUID()
  for (const suffix of slugRetries) {
    const ready = await readyToInsert(
      supabase.client,
      input.organizationId,
      input.projectId,
      input.ownerId,
      user.id
    )
    if (ready) return ready

    const inserted = await supabase.client.from("campaigns").insert({
      id: campaignId,
      organization_id: input.organizationId,
      project_id: input.projectId,
      slug: `${slug}${suffix}`,
      name,
      description,
      goals,
      owner_id: input.ownerId,
      type: input.type,
      status: input.status,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    if (!inserted.error) return { status: "created", campaignId }
    if (isSlugConflict(inserted.error)) continue
    return mapInsertError(inserted.error.code)
  }

  return { status: "conflict" }
}

function writableProjectIds(
  orgRole: "org_admin" | "admin" | "team_lead" | "member" | "viewer",
  activeIds: string[],
  memberships: { project_id: string; role: "project_manager" | "project_member" | "viewer" }[]
) {
  const writable = new Set<string>()
  if (orgRole === "viewer" || orgRole === "admin") return writable
  if (orgRole === "org_admin") {
    for (const projectId of activeIds) writable.add(projectId)
    return writable
  }

  const ambiguous = new Set<string>()
  const roles = new Map<string, "project_manager" | "project_member" | "viewer">()
  for (const membership of memberships) {
    if (roles.has(membership.project_id) || ambiguous.has(membership.project_id)) {
      roles.delete(membership.project_id)
      ambiguous.add(membership.project_id)
      continue
    }
    roles.set(membership.project_id, membership.role)
  }
  for (const [projectId, role] of roles) {
    if (!ambiguous.has(projectId) && role !== "viewer" && activeIds.includes(projectId)) {
      writable.add(projectId)
    }
  }
  return writable
}

async function loadOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string,
  userId: string
): Promise<
  | { status: "error" }
  | { status: "ready"; owners: CampaignOwnerOption[]; defaultOwnerId: string | null }
> {
  const members = await supabase
    .from("project_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
  if (members.error || !members.data) return { status: "error" }

  const profileIds: string[] = []
  const seen = new Set<string>()
  for (const member of members.data) {
    if (seen.has(member.profile_id)) return { status: "error" }
    seen.add(member.profile_id)
    profileIds.push(member.profile_id)
  }

  const profiles =
    profileIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
  if (profiles.error || !profiles.data) return { status: "error" }

  const profilesById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  const owners = profileIds
    .map((profileId) => {
      const profile = profilesById.get(profileId)
      const name = profile
        ? toUserIdentity({
            authEmail: null,
            fullName: profile.full_name,
            profileEmail: profile.email,
            jobTitle: null,
            avatarColor: null,
            initials: null,
          }).name
        : "Unknown member"
      return { id: profileId, name }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    status: "ready",
    owners,
    defaultOwnerId: owners.some((owner) => owner.id === userId) ? userId : null,
  }
}

async function readyToInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string,
  ownerId: string,
  userId: string
): Promise<CreateCampaignResult | null> {
  const project = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }
  if (project.data.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before adding a campaign.",
    }
  }

  const allowed = await canWriteProject(supabase, organizationId, projectId, userId)
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  const owner = await supabase
    .from("project_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .eq("profile_id", ownerId)
  if (owner.error || !owner.data) return { status: "error" }
  if (owner.data.length === 0) {
    return {
      status: "invalid",
      message: "Choose an owner who belongs to this project.",
    }
  }
  if (owner.data.length !== 1) return { status: "error" }
  return null
}

async function canWriteProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string,
  userId: string
) {
  const membership = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
  if (membership.error || !membership.data || membership.data.length !== 1) {
    return "error" as const
  }
  if (membership.data[0].role === "org_admin") return true
  if (membership.data[0].role === "viewer" || membership.data[0].role === "admin") return false

  const projectMember = await supabase
    .from("project_members")
    .select("role, history_access")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .eq("profile_id", userId)
  if (projectMember.error || !projectMember.data) return "error" as const
  if (projectMember.data.length !== 1) return false
  return projectMember.data[0].role !== "viewer" && projectMember.data[0].history_access !== "assigned_only"
}

async function openSelectedOrganization(organizationId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" as const }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" as const }
  return { status: "ready" as const, client: await createClient() }
}

function mapInsertError(code: string | undefined): CreateCampaignResult {
  if (code === "42501") return { status: "denied" }
  if (code === "23505") return { status: "conflict" }
  if (code === "23514" || code === "23503" || code === "P0001") {
    return {
      status: "invalid",
      message: "The campaign did not meet the database rules.",
    }
  }
  return { status: "error" }
}

function isSlugConflict(error: { code?: string; message?: string; details?: string }) {
  if (error.code !== "23505") return false
  const text = `${error.details ?? ""} ${error.message ?? ""}`
  return text.includes("campaigns_org_slug_key") || text.includes("(organization_id, slug)")
}

function isType(value: string): value is CampaignTypeValue {
  return campaignTypeValues.some((type) => type === value)
}

function isStatus(value: string): value is CampaignStatusValue {
  return campaignStatusValues.some((status) => status === value)
}

function isDate(value: string) {
  return isValidCalendarDate(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
