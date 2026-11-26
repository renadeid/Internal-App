import type { OrganizationProject } from "@/lib/auth/organization-projects"
import { daysBetween, dueInfo, type DueInfo } from "@/lib/dashboard-dates"

export type PortfolioTask = { projectId: string; status: string; assigneeId: string | null; assigneeName: string | null }

export type ProjectRow = {
  project: OrganizationProject
  total: number
  done: number
  percent: number
  due: DueInfo
  late: boolean
  mine: boolean
  team: { id: string; name: string }[]
}

export type PortfolioFilter = "all" | "active" | "on_hold" | "late"
export type PortfolioSort = "due" | "progress" | "updated" | "name"

/** Adds progress (done / total tasks), due status, team (owner + assignees) and "mine" to each project. */
export function buildProjectRows(projects: OrganizationProject[], tasks: PortfolioTask[], userId: string | null, today: string): ProjectRow[] {
  return projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id)
    const done = own.filter((task) => task.status === "done").length
    const team = new Map<string, string>()
    if (project.ownerId) team.set(project.ownerId, project.ownerName || "Owner")
    for (const task of own) if (task.assigneeId && !team.has(task.assigneeId)) team.set(task.assigneeId, task.assigneeName || "Team member")
    const due = dueInfo(project.dueOn, today)
    return {
      project,
      total: own.length,
      done,
      percent: own.length ? Math.round((done / own.length) * 100) : 0,
      due,
      late: due.group === "overdue" && !project.archivedAt,
      mine: Boolean(userId && (project.ownerId === userId || own.some((task) => task.assigneeId === userId))),
      team: [...team.entries()].map(([id, name]) => ({ id, name })),
    }
  })
}

export function portfolioSummary(rows: ProjectRow[]) {
  const live = rows.filter((row) => !row.project.archivedAt)
  const withTasks = live.filter((row) => row.total > 0)
  return {
    active: live.filter((row) => row.project.status !== "on_hold").length,
    onHold: live.filter((row) => row.project.status === "on_hold").length,
    late: live.filter((row) => row.late).length,
    averageProgress: withTasks.length ? Math.round(withTasks.reduce((sum, row) => sum + row.percent, 0) / withTasks.length) : 0,
  }
}

export function matchesPortfolioFilter(row: ProjectRow, filter: PortfolioFilter) {
  if (filter === "active") return row.project.status !== "on_hold"
  if (filter === "on_hold") return row.project.status === "on_hold"
  if (filter === "late") return row.late
  return true
}

export function sortProjectRows(rows: ProjectRow[], sort: PortfolioSort, pinned: Set<string> = new Set()) {
  const compare = (a: ProjectRow, b: ProjectRow) => {
    if (sort === "progress") return b.percent - a.percent || a.project.name.localeCompare(b.project.name)
    if (sort === "updated") return (b.project.updatedOn ?? "").localeCompare(a.project.updatedOn ?? "") || a.project.name.localeCompare(b.project.name)
    if (sort === "name") return a.project.name.localeCompare(b.project.name)
    return (a.due.days ?? 99999) - (b.due.days ?? 99999) || a.project.name.localeCompare(b.project.name)
  }
  return [...rows].sort((a, b) => Number(pinned.has(b.project.id)) - Number(pinned.has(a.project.id)) || compare(a, b))
}

/** "Updated today", "Updated yesterday", "Updated 3 days ago", then the date. */
export function updatedLabel(updatedOn: string | null | undefined, today: string) {
  const day = (updatedOn ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  const ago = daysBetween(day, today)
  if (ago <= 0) return "Updated today"
  if (ago === 1) return "Updated yesterday"
  if (ago < 30) return `Updated ${ago} days ago`
  const [y, m, d] = day.split("-").map(Number)
  return "Updated " + new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)))
}
