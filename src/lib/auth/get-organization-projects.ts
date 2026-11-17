"use server"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  OrganizationProject,
  OrganizationProjectResult,
  OrganizationProjectsResult,
  ProjectStatusValue,
} from "@/lib/auth/organization-projects"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

const projectColumns =
  "id, slug, name, description, lead_department_id, status, owner_id, starts_on, due_on, archived_at, updated_at"

export async function getOrganizationProjects(
  organizationId: string
): Promise<OrganizationProjectsResult> {
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context

  const rows = await context.supabase
    .from("projects")
    .select(projectColumns)
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (rows.error || !rows.data) return { status: "error" }
  const projects = await withRelatedLabels(
    context.supabase,
    organizationId,
    rows.data
  )
  if (!projects) return { status: "error" }
  return { status: "ready", projects }
}

const previewProjectIds = new Set([
  "spring",
  "brand",
  "harbor",
  "demand",
  "onboarding",
  "webinar",
])

export async function getOrganizationProject(
  organizationId: string,
  projectId: string
): Promise<OrganizationProjectResult> {
  if (previewProjectIds.has(projectId)) return { status: "sample" }
  if (!isUuid(projectId)) return { status: "missing" }
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context

  const row = await context.supabase
    .from("projects")
    .select(projectColumns)
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle()

  if (row.error) return { status: "error" }
  if (!row.data) return { status: "missing" }
  const projects = await withRelatedLabels(context.supabase, organizationId, [row.data])
  if (!projects || !projects[0]) return { status: "error" }
  return { status: "ready", project: projects[0] }
}

async function openOrganization(organizationId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" as const }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" as const }
  return { status: "ready" as const, supabase: await createClient() }
}

async function withRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  rows: ProjectRow[]
): Promise<OrganizationProject[] | null> {
  const departmentIds = [...new Set(rows.map((row) => row.lead_department_id))]
  const ownerIds = [...new Set(rows.map((row) => row.owner_id))]

  const departments =
    departmentIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("departments")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("id", departmentIds)
  const owners =
    ownerIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds)

  if (departments.error || !departments.data || owners.error || !owners.data) {
    return null
  }

  const departmentNames = new Map(
    departments.data.map((department) => [department.id, department.name.trim()])
  )
  const ownerNames = new Map(
    owners.data.map((owner) => [
      owner.id,
      toUserIdentity({
        authEmail: null,
        fullName: owner.full_name,
        profileEmail: owner.email,
        jobTitle: null,
        avatarColor: null,
        initials: null,
      }).name,
    ])
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    description: row.description.trim(),
    status: row.status,
    leadDepartmentId: row.lead_department_id,
    leadDepartment: departmentNames.get(row.lead_department_id) || null,
    ownerId: row.owner_id,
    ownerName: ownerNames.get(row.owner_id) ?? null,
    startsOn: row.starts_on,
    dueOn: row.due_on,
    archivedAt: row.archived_at,
    updatedOn: calendarDate(row.updated_at),
  }))
}

type ProjectRow = {
  id: string
  name: string
  description: string
  lead_department_id: string
  status: ProjectStatusValue
  owner_id: string
  starts_on: string | null
  due_on: string | null
  archived_at: string | null
  updated_at: string
}

function calendarDate(value: string) {
  const date = value.split("T")[0] ?? value
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
