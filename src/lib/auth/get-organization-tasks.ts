"use server"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  OrganizationTask,
  OrganizationTasksResult,
  TaskScope,
} from "@/lib/auth/organization-tasks"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

const taskColumns =
  "id, project_id, title, description, status, priority, assignee_id, due_on, archived_at"

export async function getOrganizationProjectTasks(
  organizationId: string,
  projectId: string
): Promise<OrganizationTasksResult> {
  if (!isUuid(projectId)) return { status: "unavailable" }
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context
  return loadTasks(context.supabase, context.userId, organizationId, {
    projectId,
    scope: "everyone",
    includeArchived: true,
  })
}

export async function getOrganizationTasks(
  organizationId: string,
  scope: TaskScope
): Promise<OrganizationTasksResult> {
  if (scope !== "mine" && scope !== "everyone") return { status: "unavailable" }
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context
  return loadTasks(context.supabase, context.userId, organizationId, {
    projectId: null,
    scope,
    includeArchived: false,
  })
}

async function openOrganization(organizationId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" as const }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" as const }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { status: "rejected" as const }
  return { status: "ready" as const, supabase, userId: data.user.id }
}

async function loadTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  organizationId: string,
  options: { projectId: string | null; scope: TaskScope; includeArchived: boolean }
): Promise<OrganizationTasksResult> {
  const scopedToOrganization = supabase
    .from("tasks")
    .select(taskColumns)
    .eq("organization_id", organizationId)
  const filtered = options.includeArchived
    ? scopedToOrganization
    : scopedToOrganization.is("archived_at", null)
  const scoped = options.projectId
    ? filtered.eq("project_id", options.projectId)
    : filtered
  const assigned =
    options.scope === "mine" ? scoped.eq("assignee_id", userId) : scoped
  const rows = await assigned
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })

  if (rows.error || !rows.data) return { status: "error" }
  const tasks = await withRelatedLabels(
    supabase,
    organizationId,
    userId,
    rows.data
  )
  if (!tasks) return { status: "error" }
  return { status: "ready", tasks }
}

async function withRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
  rows: TaskRow[]
): Promise<OrganizationTask[] | null> {
  const projectIds = [...new Set(rows.map((row) => row.project_id))]
  const assigneeIds = [
    ...new Set(
      rows.flatMap((row) => (row.assignee_id ? [row.assignee_id] : []))
    ),
  ]

  const projects =
    projectIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("projects")
          .select("id, name, archived_at")
          .eq("organization_id", organizationId)
          .in("id", projectIds)
  const assignees =
    assigneeIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assigneeIds)
  const membership = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
  const projectMembers =
    projectIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("project_members")
          .select("project_id, role")
          .eq("organization_id", organizationId)
          .eq("profile_id", userId)
          .in("project_id", projectIds)

  if (
    projects.error ||
    !projects.data ||
    assignees.error ||
    !assignees.data ||
    membership.error ||
    !membership.data ||
    projectMembers.error ||
    !projectMembers.data
  ) {
    return null
  }
  if (membership.data.length > 1) return null

  const orgRole = membership.data[0]?.role ?? null
  const projectNames = new Map(
    projects.data.map((project) => [project.id, project.name.trim()])
  )
  const archivedProjects = new Set(
    projects.data.flatMap((project) =>
      project.archived_at ? [project.id] : []
    )
  )
  const visibleProjects = new Set(projects.data.map((project) => project.id))
  const writableProjects = new Set<string>()
  const ambiguousProjects = new Set<string>()
  for (const member of projectMembers.data) {
    if (writableProjects.has(member.project_id) || ambiguousProjects.has(member.project_id)) {
      writableProjects.delete(member.project_id)
      ambiguousProjects.add(member.project_id)
      continue
    }
    if (member.role !== "viewer") writableProjects.add(member.project_id)
  }
  const assigneeNames = new Map(
    assignees.data.map((assignee) => [
      assignee.id,
      toUserIdentity({
        authEmail: null,
        fullName: assignee.full_name,
        profileEmail: assignee.email,
        jobTitle: null,
        avatarColor: null,
        initials: null,
      }).name,
    ])
  )

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: projectNames.get(row.project_id) ?? null,
    title: row.title.trim(),
    description: row.description.trim(),
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_id
      ? (assigneeNames.get(row.assignee_id) ?? "Not available")
      : null,
    dueOn: row.due_on,
    archivedAt: row.archived_at,
    canWrite: canWriteProjectTask(
      orgRole,
      row.project_id,
      visibleProjects,
      archivedProjects,
      writableProjects,
      ambiguousProjects
    ),
  }))
}

function canWriteProjectTask(
  orgRole: "org_admin" | "member" | "viewer" | null,
  projectId: string,
  visibleProjects: Set<string>,
  archivedProjects: Set<string>,
  writableProjects: Set<string>,
  ambiguousProjects: Set<string>
) {
  if (!orgRole || !visibleProjects.has(projectId) || archivedProjects.has(projectId)) {
    return false
  }
  if (ambiguousProjects.has(projectId)) return false
  if (orgRole === "org_admin") return true
  if (orgRole === "viewer") return false
  return writableProjects.has(projectId)
}

type TaskRow = {
  id: string
  project_id: string
  title: string
  description: string
  status: OrganizationTask["status"]
  priority: OrganizationTask["priority"]
  assignee_id: string | null
  due_on: string | null
  archived_at: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
