"use server"

import { randomUUID } from "node:crypto"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  CreateProjectInput,
  CreateProjectResult,
  ProjectCreationAccess,
  ProjectDepartmentOption,
} from "@/lib/auth/project-creation"
import { projectSlugFromName } from "@/lib/auth/project-slug"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database"

type OrgRole = Database["public"]["Enums"]["org_role"]

export async function getProjectCreationAccess(
  organizationId: string
): Promise<ProjectCreationAccess> {
  const supabase = await openSelectedOrganization(organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const [membership, departments, managed, members] = await Promise.all([
    supabase.client
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase.client
      .from("departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase.client
      .from("department_memberships")
      .select("department_id")
      .eq("organization_id", organizationId)
      .eq("profile_id", user.id)
      .eq("role", "manager"),
    supabase.client
      .from("organization_memberships")
      .select("profile_id")
      .eq("organization_id", organizationId),
  ])

  if (
    membership.error ||
    departments.error ||
    !departments.data ||
    managed.error ||
    !managed.data ||
    members.error ||
    !members.data
  ) {
    return { status: "error" }
  }
  if (!membership.data) return { status: "rejected" }

  const departmentOptions = departments.data
    .map((department) => ({
      id: department.id,
      name: department.name.trim(),
    }))
    .filter((department) => department.name.length > 0)
  const managedIds = new Set(managed.data.map((row) => row.department_id))
  const delegated = membership.data.role === "member"
    ? await supabase.client.rpc("has_project_creation_permission", { target_organization: organizationId })
    : { data: false, error: null }
  if (delegated.error) return { status: "error" }
  const selectable = selectableDepartments(
    membership.data.role,
    departmentOptions,
    managedIds,
    delegated.data === true
  )
  if (!selectable) {
    return {
      status: "ready",
      canCreate: false,
      reason:
        membership.data.role === "admin" ? "Admins can view and edit existing work, but cannot create projects." : "Ask a Team lead or Super admin to enable Create project in Settings.",
    }
  }
  if (selectable.length === 0) {
    return {
      status: "ready",
      canCreate: false,
      reason: "This organization has no departments yet.",
    }
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

  if (owners.length === 0) {
    return {
      status: "ready",
      canCreate: false,
      reason: "This organization has no members to assign as owner.",
    }
  }

  return {
    status: "ready",
    canCreate: true,
    isSuperAdmin: membership.data.role === "org_admin",
    currentUserId: user.id,
    departments: selectable,
    owners,
  }
}

export async function createOrganizationProject(
  input: CreateProjectInput
): Promise<CreateProjectResult> {
  const name = input.name.trim()
  const description = input.description.trim()
  const slug = projectSlugFromName(name)
  const startsOn = emptyToNull(input.startsOn)
  const dueOn = emptyToNull(input.dueOn)

  if (!name) return { status: "invalid", message: "Enter a project name." }
  if (!slug) {
    return {
      status: "invalid",
      message: "Use a name that contains a letter or number.",
    }
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

  const [membership, department, owner] = await Promise.all([
    supabase.client
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", input.organizationId)
      .eq("profile_id", user.id)
      .maybeSingle(),
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
  ])

  if (membership.error || department.error || owner.error) return { status: "error" }
  if (!membership.data) return { status: "rejected" }
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

  const allowed = await canInsertProject(
    supabase.client,
    input.organizationId,
    user.id,
    membership.data.role,
    input.leadDepartmentId
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  if (input.accessMode) {
    if (membership.data.role !== "org_admin") return { status: "denied" }
    const result = await supabase.client.rpc("admin_create_project", {
      payload: { ...input, slug, name, description, memberIds: input.memberIds ?? [] },
    })
    if (result.error) return result.error.code === "22023"
      ? { status: "invalid", message: "Choose a valid access mode and select at least one member." }
      : mapInsertError(result.error.code)
    return { status: "created", projectId: result.data }
  }

  const projectId = randomUUID()
  const inserted = await supabase.client.from("projects").insert({
    id: projectId,
    organization_id: input.organizationId,
    slug,
    name,
    description,
    lead_department_id: input.leadDepartmentId,
    owner_id: input.ownerId,
    starts_on: startsOn,
    due_on: dueOn,
  })

  if (inserted.error) {
    logProjectInsertError(inserted.error)
    return mapInsertError(inserted.error.code)
  }
  return { status: "created", projectId }
}

function selectableDepartments(
  role: OrgRole,
  departments: ProjectDepartmentOption[],
  managedIds: Set<string>,
  delegated: boolean
) {
  if (role === "org_admin") return departments
  if (role === "member") return delegated ? departments : null
  if (role === "viewer" || role === "admin") return null
  const managed = departments.filter((department) => managedIds.has(department.id))
  return managed.length > 0 ? managed : null
}

async function canInsertProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
  role: OrgRole,
  leadDepartmentId: string
) {
  if (role === "org_admin") return true
  if (role === "viewer" || role === "admin") return false
  if (role === "member") {
    const permission = await supabase.rpc("has_project_creation_permission", { target_organization: organizationId })
    if (permission.error) return "error" as const
    return permission.data === true
  }
  const managed = await supabase
    .from("department_memberships")
    .select("department_id")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .eq("department_id", leadDepartmentId)
    .eq("role", "manager")
    .maybeSingle()
  if (managed.error) return "error" as const
  return Boolean(managed.data)
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

function logProjectInsertError(error: {
  code?: string
  message?: string
  details?: string
  hint?: string
}) {
  if (process.env.NODE_ENV !== "development") return
  console.error("project insert failed", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })
}

function mapInsertError(code: string | undefined): CreateProjectResult {
  if (code === "23505") return { status: "conflict" }
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

function emptyToNull(value: string | null) {
  const text = value?.trim() ?? ""
  return text.length > 0 ? text : null
}

function isDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value)
}
