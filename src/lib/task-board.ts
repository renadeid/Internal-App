import type { OrganizationTask, TaskStatusValue } from "@/lib/auth/organization-tasks"
import { dueInfo, type DueGroup, type DueInfo } from "@/lib/dashboard-dates"

export type TaskSort = "due" | "priority" | "project" | "title"
export type TaskGroupKey = DueGroup | "done"
export type DatedTask = OrganizationTask & { due: DueInfo }

export const taskGroupTitles: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  none: "No due date",
  done: "Done",
}
const groupOrder: TaskGroupKey[] = ["overdue", "today", "week", "later", "none", "done"]
const priorityRank: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 }

/** Statuses a person can set directly. In review and Done come from submitting work and approval. */
export const directStatuses: TaskStatusValue[] = ["todo", "in_progress"]

export function canChangeStatus(task: Pick<OrganizationTask, "status" | "canWrite" | "canUpdateStatus" | "archivedAt">) {
  return Boolean((task.canWrite || task.canUpdateStatus) && !task.archivedAt && directStatuses.includes(task.status))
}

/** Clicking the circle moves To do → In progress and In progress → To do. */
export function quickNextStatus(status: TaskStatusValue): TaskStatusValue | null {
  if (status === "todo") return "in_progress"
  if (status === "in_progress") return "todo"
  return null
}

export function compareTasks(sort: TaskSort) {
  return (a: DatedTask, b: DatedTask) => {
    const byDue = (a.due.days ?? 99999) - (b.due.days ?? 99999)
    const byPriority = (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0)
    const byTitle = a.title.localeCompare(b.title)
    if (sort === "priority") return byPriority || byDue || byTitle
    if (sort === "project") return (a.projectName ?? "").localeCompare(b.projectName ?? "") || byDue || byTitle
    if (sort === "title") return byTitle
    return byDue || byPriority || byTitle
  }
}

/** Groups tasks by due date (Overdue first). Done tasks go to their own group at the end. */
export function groupTasksByDue(tasks: OrganizationTask[], today: string, sort: TaskSort) {
  const dated: DatedTask[] = tasks.map((task) => ({ ...task, due: dueInfo(task.dueOn, today) }))
  const groups = new Map<TaskGroupKey, DatedTask[]>()
  for (const task of dated) {
    const key: TaskGroupKey = task.status === "done" ? "done" : task.due.group
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return groupOrder
    .filter((key) => groups.has(key))
    .map((key) => ({ key, title: taskGroupTitles[key], tasks: [...(groups.get(key) ?? [])].sort(compareTasks(sort)) }))
}

export function withDue(tasks: OrganizationTask[], today: string): DatedTask[] {
  return tasks.map((task) => ({ ...task, due: dueInfo(task.dueOn, today) }))
}
