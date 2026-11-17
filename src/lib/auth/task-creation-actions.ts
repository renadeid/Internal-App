"use server"

import { randomUUID } from "node:crypto"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import {
  taskPriorityValues,
  taskStatusValues,
  type ArchiveTaskInput,
  type ArchiveTaskResult,
  type CreateTaskInput,
  type CreateTaskResult,
  type SetTaskStatusInput,
  type SetTaskStatusResult,
  type TaskCreationAccess,
  type UpdateTaskInput,
  type UpdateTaskResult,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/auth/organization-tasks"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

export async function getTaskCreationAccess(
  organizationId: string,
  projectId: string
): Promise<TaskCreationAccess> {
  if (!isUuid(projectId)) return { status: "unavailable" }
  const supabase = await openSelectedOrganization(organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const project = await supabase.client
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }

  const allowed = await canWriteProject(
    supabase.client,
    organizationId,
    projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed || project.data.archived_at) {
    return { status: "ready", canCreate: false }
  }

  const members = await supabase.client
    .from("project_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
  if (members.error || !members.data) return { status: "error" }

  const profileIds = [...new Set(members.data.map((member) => member.profile_id))]
  const profiles =
    profileIds.length === 0
      ? { data: [], error: null }
      : await supabase.client
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
  if (profiles.error || !profiles.data) return { status: "error" }

  const profilesById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  const assignees = profileIds
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

  return { status: "ready", canCreate: true, assignees }
}

export async function createOrganizationTask(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const title = input.title.trim()
  const description = input.description.trim()
  const dueOn = emptyToNull(input.dueOn)
  const assigneeId = emptyToNull(input.assigneeId)

  if (!isUuid(input.projectId)) {
    return { status: "invalid", message: "This project address is not valid." }
  }
  if (!title) return { status: "invalid", message: "Enter a task title." }
  if (!isPriority(input.priority)) {
    return { status: "invalid", message: "Choose a priority." }
  }
  if (!isStatus(input.status)) {
    return { status: "invalid", message: "Choose a status." }
  }
  if (!isDate(dueOn)) {
    return { status: "invalid", message: "Enter the due date as YYYY-MM-DD." }
  }
  if (assigneeId && !isUuid(assigneeId)) {
    return { status: "invalid", message: "Choose an assignee from this project." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const project = await supabase.client
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }
  if (project.data.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before adding a task.",
    }
  }

  const allowed = await canWriteProject(
    supabase.client,
    input.organizationId,
    input.projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  if (assigneeId) {
    const assignee = await supabase.client
      .from("project_members")
      .select("profile_id")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .eq("profile_id", assigneeId)
      .maybeSingle()
    if (assignee.error) return { status: "error" }
    if (!assignee.data) {
      return {
        status: "invalid",
        message: "Choose an assignee who belongs to this project.",
      }
    }
  }

  const taskId = randomUUID()
  const inserted = await supabase.client.from("tasks").insert({
    id: taskId,
    organization_id: input.organizationId,
    project_id: input.projectId,
    title,
    description,
    priority: input.priority,
    status: input.status,
    due_on: dueOn,
    assignee_id: assigneeId,
  })

  if (inserted.error) return mapInsertError(inserted.error.code)
  return { status: "created", taskId }
}

export async function updateOrganizationTask(
  input: UpdateTaskInput
): Promise<UpdateTaskResult> {
  const title = input.title.trim()
  const description = input.description.trim()
  const dueOn = emptyToNull(input.dueOn)
  const assigneeId = emptyToNull(input.assigneeId)

  if (!isUuid(input.projectId) || !isUuid(input.taskId)) {
    return { status: "invalid", message: "This task address is not valid." }
  }
  if (!title) return { status: "invalid", message: "Enter a task title." }
  if (!isPriority(input.priority)) {
    return { status: "invalid", message: "Choose a priority." }
  }
  if (!isStatus(input.status)) {
    return { status: "invalid", message: "Choose a status." }
  }
  if (!isDate(dueOn)) {
    return { status: "invalid", message: "Enter the due date as YYYY-MM-DD." }
  }
  if (assigneeId && !isUuid(assigneeId)) {
    return { status: "invalid", message: "Choose an assignee from this project." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const project = await supabase.client
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }
  if (project.data.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before editing a task.",
    }
  }

  const allowed = await canWriteProject(
    supabase.client,
    input.organizationId,
    input.projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  const task = await supabase.client
    .from("tasks")
    .select("id, archived_at")
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .maybeSingle()
  if (task.error) return { status: "error" }
  if (!task.data) return { status: "unavailable" }
  if (task.data.archived_at) {
    return {
      status: "invalid",
      message: "This task is archived and cannot be edited.",
    }
  }

  if (assigneeId) {
    const assignee = await supabase.client
      .from("project_members")
      .select("profile_id")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .eq("profile_id", assigneeId)
      .maybeSingle()
    if (assignee.error) return { status: "error" }
    if (!assignee.data) {
      return {
        status: "invalid",
        message: "Choose an assignee who belongs to this project.",
      }
    }
  }

  const updated = await supabase.client
    .from("tasks")
    .update(
      {
        title,
        description,
        priority: input.priority,
        status: input.status,
        due_on: dueOn,
        assignee_id: assigneeId,
      },
      { count: "exact" }
    )
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)

  if (updated.error) return mapUpdateError(updated.error.code)
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  return { status: "updated" }
}

export async function setOrganizationTaskArchived(
  input: ArchiveTaskInput
): Promise<ArchiveTaskResult> {
  if (!isUuid(input.projectId) || !isUuid(input.taskId)) {
    return { status: "invalid", message: "This task address is not valid." }
  }
  if (typeof input.archived !== "boolean") {
    return { status: "invalid", message: "Choose whether to archive this task." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const project = await supabase.client
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }
  if (project.data.archived_at) {
    return {
      status: "invalid",
      message: input.archived
        ? "Restore this project before archiving a task."
        : "Restore this project before restoring a task.",
    }
  }

  const allowed = await canWriteProject(
    supabase.client,
    input.organizationId,
    input.projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  const task = await supabase.client
    .from("tasks")
    .select("id, archived_at")
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .maybeSingle()
  if (task.error) return { status: "error" }
  if (!task.data) return { status: "unavailable" }
  if (input.archived ? task.data.archived_at : !task.data.archived_at) {
    return { status: "unavailable" }
  }

  const updated = await supabase.client
    .from("tasks")
    .update(
      { archived_at: input.archived ? new Date().toISOString() : null },
      { count: "exact" }
    )
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .filter("archived_at", input.archived ? "is" : "not.is", null)

  if (updated.error) {
    if (updated.error.code === "42501") return { status: "denied" }
    return { status: "error" }
  }
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  return { status: "updated" }
}

export async function setOrganizationTaskStatus(
  input: SetTaskStatusInput
): Promise<SetTaskStatusResult> {
  if (!isUuid(input.projectId) || !isUuid(input.taskId)) {
    return { status: "invalid", message: "This task address is not valid." }
  }
  if (!isStatus(input.status)) {
    return { status: "invalid", message: "Choose a status." }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const project = await supabase.client
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.projectId)
    .maybeSingle()
  if (project.error) return { status: "error" }
  if (!project.data) return { status: "unavailable" }
  if (project.data.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before changing a task status.",
    }
  }

  const allowed = await canWriteProject(
    supabase.client,
    input.organizationId,
    input.projectId,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  const task = await supabase.client
    .from("tasks")
    .select("id, archived_at")
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .maybeSingle()
  if (task.error) return { status: "error" }
  if (!task.data) return { status: "unavailable" }
  if (task.data.archived_at) {
    return {
      status: "invalid",
      message: "This task is archived and its status cannot be changed.",
    }
  }

  const currentProject = await supabase.client
    .from("projects")
    .select("archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.projectId)
    .maybeSingle()
  if (currentProject.error) return { status: "error" }
  if (!currentProject.data) return { status: "unavailable" }
  if (currentProject.data.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before changing a task status.",
    }
  }

  const updated = await supabase.client
    .from("tasks")
    .update({ status: input.status }, { count: "exact" })
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .is("archived_at", null)

  if (updated.error) return mapUpdateError(updated.error.code)
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  return { status: "updated" }
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
    .maybeSingle()
  if (membership.error) return "error" as const
  if (!membership.data) return false
  if (membership.data.role === "org_admin") return true
  if (membership.data.role === "viewer") return false

  const projectMember = await supabase
    .from("project_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .maybeSingle()
  if (projectMember.error) return "error" as const
  return Boolean(projectMember.data && projectMember.data.role !== "viewer")
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

function mapInsertError(code: string | undefined): CreateTaskResult {
  return mapTaskWriteError(code)
}

function mapUpdateError(code: string | undefined): UpdateTaskResult {
  return mapTaskWriteError(code)
}

function mapTaskWriteError(code: string | undefined): {
  status: "invalid"
  message: string
} | {
  status: "denied"
} | {
  status: "error"
} {
  if (code === "42501") return { status: "denied" }
  if (code === "23514" || code === "P0001" || code === "23503") {
    return {
      status: "invalid",
      message: "The task did not meet the database rules.",
    }
  }
  return { status: "error" }
}

function isPriority(value: string): value is TaskPriorityValue {
  return taskPriorityValues.some((priority) => priority === value)
}

function isStatus(value: string): value is TaskStatusValue {
  return taskStatusValues.some((status) => status === value)
}

function emptyToNull(value: string | null) {
  const text = value?.trim() ?? ""
  return text.length > 0 ? text : null
}

function isDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
