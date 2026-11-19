import type { Database } from "@/lib/supabase/database"

export type TaskStatusValue = Database["public"]["Enums"]["task_status"]
export type TaskPriorityValue = Database["public"]["Enums"]["task_priority"]
export type TaskScope = "mine" | "everyone"

export type OrganizationTask = {
  id: string
  projectId: string
  projectName: string | null
  title: string
  description: string
  status: TaskStatusValue
  priority: TaskPriorityValue
  assigneeId: string | null
  assigneeName: string | null
  dueOn: string | null
  archivedAt: string | null
  canWrite: boolean
  canUpdateStatus?: boolean
}

export type OrganizationTasksResult =
  | { status: "ready"; tasks: OrganizationTask[] }
  | { status: "error" }
  | { status: "rejected" }
  | { status: "unavailable" }

export const taskStatusValues: TaskStatusValue[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
]

export const taskPriorityValues: TaskPriorityValue[] = [
  "low",
  "medium",
  "high",
  "urgent",
]

export type CreateTaskInput = {
  organizationId: string
  projectId: string
  title: string
  description: string
  priority: TaskPriorityValue
  status: TaskStatusValue
  dueOn: string | null
  assigneeId: string | null
}

export type CreateTaskResult =
  | { status: "created"; taskId: string }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type UpdateTaskInput = CreateTaskInput & {
  taskId: string
}

export type UpdateTaskResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type ArchiveTaskInput = {
  organizationId: string
  projectId: string
  taskId: string
  archived: boolean
}

export type ArchiveTaskResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type SetTaskStatusInput = {
  organizationId: string
  projectId: string
  taskId: string
  status: TaskStatusValue
}

export type SetTaskStatusResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type TaskAssigneeOption = {
  id: string
  name: string
}

export type TaskCreationAccess =
  | { status: "error" }
  | { status: "rejected" }
  | { status: "unavailable" }
  | { status: "ready"; canCreate: false }
  | { status: "ready"; canCreate: true; canEdit: true; canArchive: boolean; assignees: TaskAssigneeOption[] }
  | { status: "ready"; canCreate: false; canEdit: true; canArchive: false; assignees: TaskAssigneeOption[] }

export function taskStatusLabel(status: TaskStatusValue) {
  if (status === "todo") return "To do"
  if (status === "in_progress") return "In progress"
  if (status === "in_review") return "In review"
  return "Done"
}

export function taskPriorityLabel(priority: TaskPriorityValue) {
  if (priority === "low") return "Low"
  if (priority === "medium") return "Medium"
  if (priority === "high") return "High"
  return "Urgent"
}
