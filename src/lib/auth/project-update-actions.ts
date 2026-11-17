"use server"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  ArchiveProjectInput,
  ArchiveProjectResult,
  ProjectEditAccess,
  ProjectStatusValue,
  UpdateProjectInput,
  UpdateProjectResult,
} from "@/lib/auth/organization-projects"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

const projectStatuses = [
  "planning",
  "in_progress",
  "in_review",
  "on_hold",
] as const satisfies readonly ProjectStatusValue[]

export async function getProjectEditAccess(
  organizationId: string,
  projectId: string
): Promise<ProjectEditAccess> {
  if (!isUuid(projectId)) return { status: "ready", canEdit: false }
  const supabase = await openSelectedOrganization(organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const allowed = await canEditProject(
    supabase.client,
    organizationId,
    projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "ready", canEdit: false }

  const [departments, members] = await Promise.all([
    supabase.client
      .from("departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase.client
      .from("organization_memberships")
      .select("profile_id")
      .eq("organization_id", organizationId),
  ])
  if (departments.error || !departments.data || members.error || !members.data) {
    return { status: "error" }
  }

  const profileIds = [...new Set(members.data.map((row) => row.profile_id))]
  const profiles =
    profileIds.length === 0
      ? { data: [], error: null }
      : await supabase.client
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
  if (profiles.error || !profiles.data) return { status: "error" }

  const profilesById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  return {
    status: "ready",
    canEdit: true,
    departments: departments.data
      .map((department) => ({
        id: department.id,
        name: department.name.trim(),
      }))
      .filter((department) => department.name.length > 0),
    owners: profileIds
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
      .sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export async function updateOrganizationProject(
  input: UpdateProjectInput
): Promise<UpdateProjectResult> {
  const name = input.name.trim()
  const description = input.description.trim()
  const startsOn = emptyToNull(input.startsOn)
  const dueOn = emptyToNull(input.dueOn)

  if (!isUuid(input.projectId)) {
    return { status: "invalid", message: "This project address is not valid." }
  }
  if (!name) return { status: "invalid", message: "Enter a project name." }
  if (!isProjectStatus(input.status)) {
    return { status: "invalid", message: "Choose a project status." }
  }
  if (!isDate(startsOn) || !isDate(dueOn)) {
    return { status: "invalid", message: "Enter dates as YYYY-MM-DD." }
  }
  if (startsOn && dueOn && dueOn < startsOn) {
    return {
      status: "invalid",
      message: "The due date must be on or after the start date.",
    }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const [department, owner, allowed] = await Promise.all([
    supabase.client
      .from("departments")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.leadDepartmentId)
      .maybeSingle(),
    supabase.client
      .from("organization_memberships")
      .select("profile_id")
      .eq("organization_id", input.organizationId)
      .eq("profile_id", input.ownerId)
      .maybeSingle(),
    canEditProject(
      supabase.client,
      input.organizationId,
      input.projectId,
      user.id
    ),
  ])
  if (department.error || owner.error || allowed === "error") return { status: "error" }
  if (!department.data) {
    return {
      status: "invalid",
      message: "Choose a lead department in this organization.",
    }
  }
  if (!owner.data) {
    return {
      status: "invalid",
      message: "Choose an owner who belongs to this organization.",
    }
  }
  if (!allowed) return { status: "denied" }

  const updated = await supabase.client
    .from("projects")
    .update(
      {
        name,
        description,
        status: input.status,
        lead_department_id: input.leadDepartmentId,
        owner_id: input.ownerId,
        starts_on: startsOn,
        due_on: dueOn,
      },
      { count: "exact" }
    )
    .eq("id", input.projectId)
    .eq("organization_id", input.organizationId)

  if (updated.error) return mapUpdateError(updated.error.code)
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  return { status: "updated" }
}

export async function setOrganizationProjectArchived(
  input: ArchiveProjectInput
): Promise<ArchiveProjectResult> {
  if (!isUuid(input.projectId)) {
    return { status: "invalid", message: "This project address is not valid." }
  }
  if (typeof input.archived !== "boolean") {
    return { status: "invalid", message: "Choose whether to archive this project." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const allowed = await canEditProject(
    supabase.client,
    input.organizationId,
    input.projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  const updated = await supabase.client
    .from("projects")
    .update(
      { archived_at: input.archived ? new Date().toISOString() : null },
      { count: "exact" }
    )
    .eq("id", input.projectId)
    .eq("organization_id", input.organizationId)

  if (updated.error) {
    if (updated.error.code === "42501") return { status: "denied" }
    return { status: "error" }
  }
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  return { status: "updated" }
}

async function canEditProject(
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
    .maybeSingle()
  if (membership.error) return "error" as const
  if (!membership.data) return false
  if (membership.data.role === "org_admin") return true
  if (membership.data.role === "viewer") return false

  const projectMember = await supabase
    .from("project_members")
    .select("role, can_edit")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .maybeSingle()
  if (projectMember.error) return "error" as const
  return Boolean(
    projectMember.data &&
      projectMember.data.can_edit &&
      projectMember.data.role !== "viewer"
  )
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

function mapUpdateError(code: string | undefined): UpdateProjectResult {
  if (code === "42501") return { status: "denied" }
  if (code === "23503") {
    return {
      status: "invalid",
      message: "The department or owner is not part of this organization.",
    }
  }
  if (code === "23514") {
    return {
      status: "invalid",
      message: "The project did not meet the database rules.",
    }
  }
  return { status: "error" }
}

function isProjectStatus(value: string): value is ProjectStatusValue {
  return projectStatuses.some((status) => status === value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}

function emptyToNull(value: string | null) {
  const text = value?.trim() ?? ""
  return text.length > 0 ? text : null
}

function isDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value)
}
