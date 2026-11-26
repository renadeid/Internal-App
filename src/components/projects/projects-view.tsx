"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { ArrowUpRight, CalendarDays, LayoutGrid, Plus, Rows3, Search, Star, X } from "lucide-react"

import { colorFor } from "@/components/activity/activity-feed"
import { useOrganization } from "@/components/auth/organization-provider"
import { useProjectCreateLauncher } from "@/components/projects/project-create-launcher"
import { PageIntro } from "@/components/shared/page-intro"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { getOrganizationProjects } from "@/lib/auth/get-organization-projects"
import { subscribeProjectListRefresh } from "@/lib/auth/project-list-refresh"
import type { OrganizationProject, OrganizationProjectsResult, ProjectStatusValue } from "@/lib/auth/organization-projects"
import { initials, localDateKey } from "@/lib/dashboard-dates"
import { projectStatusClass } from "@/lib/presentation"
import {
  buildProjectRows,
  matchesPortfolioFilter,
  portfolioSummary,
  sortProjectRows,
  updatedLabel,
  type PortfolioFilter,
  type PortfolioSort,
  type ProjectRow,
} from "@/lib/project-portfolio"
import type { ProjectStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProjectsSnapshot = {
  status: "loading" | OrganizationProjectsResult["status"]
  projects: OrganizationProject[]
}
type View = "cards" | "table"
type Scope = "all" | "mine"

const statusStripe: Record<ProjectStatusValue, string> = {
  planning: "bg-[var(--color-teal-500)]",
  in_progress: "bg-[var(--color-navy-500)]",
  in_review: "bg-[var(--color-purple-500)]",
  on_hold: "bg-amber-500",
}

export function ProjectsView() {
  const { activeOrganization, mode } = useOrganization()
  const projectCreation = useProjectCreateLauncher()
  const description = activeOrganization
    ? `Projects visible in ${activeOrganization.name}.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its projects."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageIntro title="Projects" description={description} />
        {projectCreation.canCreate ? (
          <Button type="button" className="gap-2" onClick={projectCreation.open}>
            <Plus className="size-4" aria-hidden />
            New project
          </Button>
        ) : null}
      </div>
      {activeOrganization ? (
        <ProjectList key={activeOrganization.id} organizationId={activeOrganization.id} organizationName={activeOrganization.name} />
      ) : null}
    </div>
  )
}

function ProjectList({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const snapshot = useOrganizationProjects(organizationId)

  if (snapshot.status === "loading") return <PortfolioSkeleton />
  if (snapshot.status === "error") return <Status message="Projects could not be loaded." />
  if (snapshot.status === "rejected") return <Status message="This organization is not available for your account." />
  if (snapshot.projects.length === 0) return <Status message={`No projects are visible in ${organizationName}. Private projects stay hidden.`} />
  return <Portfolio organizationId={organizationId} organizationName={organizationName} projects={snapshot.projects} />
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

/** Rendered only in the browser after projects load, so it can read the clock and saved preferences. */
function Portfolio({ organizationId, organizationName, projects }: { organizationId: string; organizationName: string; projects: OrganizationProject[] }) {
  const { result } = useLiveWorkspace()
  const workspace = result?.status === "ready" ? result : null
  const [now] = useState(() => new Date())
  const today = localDateKey(now)
  const pinKey = `roaya-pinned-projects:${organizationId}`
  const [view, setView] = useState<View>(() => readStored("roaya-projects-view", ["cards", "table"] as const, "cards"))
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(pinKey) ?? "[]") as string[])
    } catch {
      return new Set()
    }
  })
  const [scope, setScope] = useState<Scope>("all")
  const [filter, setFilter] = useState<PortfolioFilter>("all")
  const [status, setStatus] = useState<ProjectStatusValue | "all">("all")
  const [sort, setSort] = useState<PortfolioSort>("due")
  const [query, setQuery] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem("roaya-projects-view", view)
    } catch {
      // preferences are optional
    }
  }, [view])
  useEffect(() => {
    try {
      window.localStorage.setItem(pinKey, JSON.stringify([...pinned]))
    } catch {
      // preferences are optional
    }
  }, [pinKey, pinned])

  const rows = useMemo(
    () => buildProjectRows(projects, workspace?.tasks ?? [], workspace?.userId ?? null, today),
    [projects, workspace?.tasks, workspace?.userId, today]
  )
  const archivedCount = rows.filter((row) => row.project.archivedAt).length
  const inScope = rows.filter((row) => (showArchived || !row.project.archivedAt) && (scope === "all" || row.mine))
  const summary = portfolioSummary(inScope)
  const needle = query.trim().toLowerCase()
  const visible = sortProjectRows(
    inScope.filter(
      (row) =>
        matchesPortfolioFilter(row, filter) &&
        (status === "all" || row.project.status === status) &&
        (!needle ||
          [row.project.name, row.project.description, row.project.ownerName ?? "", row.project.leadDepartment ?? "", ...row.team.map((m) => m.name)]
            .join(" ")
            .toLowerCase()
            .includes(needle))
    ),
    sort,
    pinned
  )
  const filtersActive = filter !== "all" || status !== "all" || Boolean(needle)
  const viewKey = [view, scope, filter, status, sort, needle, showArchived].join("|")
  const togglePin = (id: string) =>
    setPinned((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const kpis: { key: PortfolioFilter; label: string; value: number; tone: string }[] = [
    { key: "active", label: "Active", value: summary.active, tone: "text-foreground" },
    { key: "on_hold", label: "On hold", value: summary.onHold, tone: "text-amber-700" },
    { key: "late", label: "Late", value: summary.late, tone: summary.late ? "text-destructive" : "text-foreground" },
  ]

  return (
    <div className="grid gap-5">
      <div className="roaya-rise flex flex-wrap items-center justify-between gap-3" style={{ "--d": 0 } as React.CSSProperties}>
        <div role="tablist" aria-label="Which projects" className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["all", "All projects"],
              ["mine", "My projects"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              disabled={key === "mine" && !workspace}
              onClick={() => setScope(key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                scope === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="View" className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["cards", "Cards", LayoutGrid],
              ["table", "Table", Rows3],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <button
            key={kpi.key}
            type="button"
            aria-pressed={filter === kpi.key}
            onClick={() => setFilter((current) => (current === kpi.key ? "all" : kpi.key))}
            className={cn(
              "roaya-glass roaya-lift roaya-rise grid gap-1 rounded-2xl p-4 text-start",
              filter === kpi.key && "ring-2 ring-primary",
              kpi.key === "late" && kpi.value > 0 && "border-destructive/30 bg-destructive/[0.04]"
            )}
            style={{ "--d": index + 1 } as React.CSSProperties}
          >
            <span className={cn("text-sm font-medium", kpi.key === "late" && kpi.value ? "text-destructive" : "text-muted-foreground")}>{kpi.label}</span>
            <span className={cn("text-3xl font-semibold tracking-tight tabular-nums", kpi.tone)}>{kpi.value}</span>
            <span className="text-xs text-muted-foreground">{filter === kpi.key ? "Showing only these · click to clear" : "Click to filter"}</span>
          </button>
        ))}
        <div className="roaya-glass roaya-rise grid gap-1 rounded-2xl p-4" style={{ "--d": 4 } as React.CSSProperties}>
          <span className="text-sm font-medium text-muted-foreground">Avg. progress</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{workspace ? summary.averageProgress + "%" : "—"}</span>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]"
              style={{ width: (workspace ? summary.averageProgress : 0) + "%" }}
            />
          </div>
        </div>
      </section>

      <div className="roaya-rise flex flex-wrap items-center gap-2" style={{ "--d": 5 } as React.CSSProperties}>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden />
          <Input type="search" className="h-10 ps-9" aria-label="Search projects" placeholder="Search projects, people…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label="Filter by status" className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatusValue | "all")}>
          <option value="all">All statuses</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In progress</option>
          <option value="in_review">In review</option>
          <option value="on_hold">On hold</option>
        </select>
        <select aria-label="Sort projects" className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as PortfolioSort)}>
          <option value="due">Sort: Due date</option>
          <option value="progress">Sort: Progress</option>
          <option value="updated">Sort: Recently updated</option>
          <option value="name">Sort: Name</option>
        </select>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setFilter("all")
              setStatus("all")
              setQuery("")
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden /> Clear
          </button>
        ) : null}
        <span className="ms-auto flex items-center gap-3">
          <span role="status" className="text-xs text-muted-foreground">
            {visible.length} of {inScope.length}
          </span>
          {archivedCount ? (
            <Button type="button" size="sm" variant={showArchived ? "default" : "outline"} aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Showing archived" : `Show archived (${archivedCount})`}
            </Button>
          ) : null}
        </span>
      </div>

      {visible.length === 0 ? (
        <Status
          message={
            scope === "mine" && !filtersActive
              ? "You don’t own or have tasks in any project yet."
              : `No projects in ${organizationName} match these filters.`
          }
        />
      ) : view === "cards" ? (
        <div key={viewKey} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row, index) => (
            <ProjectCard key={row.project.id} row={row} today={today} index={index} pinned={pinned.has(row.project.id)} onPin={togglePin} tasksReady={Boolean(workspace)} />
          ))}
        </div>
      ) : (
        <ProjectTable key={viewKey} rows={visible} today={today} sort={sort} onSort={setSort} pinned={pinned} onPin={togglePin} tasksReady={Boolean(workspace)} />
      )}
    </div>
  )
}

function PinButton({ id, name, pinned, onPin }: { id: string; name: string; pinned: boolean; onPin: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPin(id)}
      aria-pressed={pinned}
      aria-label={(pinned ? "Unpin " : "Pin ") + name}
      title={pinned ? "Unpin" : "Pin to top"}
      className={cn("relative z-10 rounded-md p-1 transition-colors hover:bg-muted", pinned ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-500")}
    >
      <Star className={cn("size-4", pinned && "fill-current")} aria-hidden />
    </button>
  )
}

function DueChip({ row }: { row: ProjectRow }) {
  if (row.due.group === "none") return <span className="text-xs text-muted-foreground">No due date</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        row.late ? "roaya-overdue-pulse bg-destructive/10 text-destructive" : row.due.group === "today" || (row.due.days ?? 99) <= 1 ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"
      )}
    >
      <CalendarDays className="size-3" aria-hidden />
      {row.late ? row.due.label : row.due.group === "today" ? "Due today" : row.due.label === "Tomorrow" ? "Due tomorrow" : "Due " + row.due.label}
    </span>
  )
}

function TeamAvatars({ team, max = 4 }: { team: ProjectRow["team"]; max?: number }) {
  const shown = team.slice(0, max)
  return (
    <span className="flex items-center" aria-label={team.map((m) => m.name).join(", ")} title={team.map((m) => m.name).join(", ")}>
      {shown.map((member, index) => (
        <span
          key={member.id}
          className={cn("flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white", colorFor(member.name), index && "-ms-2")}
          aria-hidden
        >
          {initials(member.name)}
        </span>
      ))}
      {team.length > max ? (
        <span className="-ms-2 flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground" aria-hidden>
          +{team.length - max}
        </span>
      ) : null}
    </span>
  )
}

function ProgressBar({ row, tasksReady }: { row: ProjectRow; tasksReady: boolean }) {
  if (!tasksReady) return <div className="roaya-skeleton h-2 w-full rounded-full" />
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{row.total ? `${row.done} of ${row.total} tasks done` : "No tasks yet"}</span>
        <span className="font-semibold text-foreground tabular-nums">{row.percent}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]" style={{ width: row.percent + "%" }} />
      </div>
    </div>
  )
}

function ProjectCard({ row, today, index, pinned, onPin, tasksReady }: { row: ProjectRow; today: string; index: number; pinned: boolean; onPin: (id: string) => void; tasksReady: boolean }) {
  const { project } = row
  const status = statusLabel(project.status)
  return (
    <article
      className="group roaya-glass roaya-lift roaya-rise relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-5 ps-6 hover:border-primary/30"
      style={{ "--d": Math.min(index, 9) } as React.CSSProperties}
    >
      <span className={cn("absolute inset-y-4 start-0 w-1 rounded-e-full", statusStripe[project.status])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {project.leadDepartment ? <span className="rounded-full bg-[var(--color-teal-500)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--color-teal-700)]">{project.leadDepartment}</span> : null}
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", projectStatusClass[status])}>{status}</span>
          {project.archivedAt ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Archived</span> : null}
        </div>
        <PinButton id={project.id} name={project.name} pinned={pinned} onPin={onPin} />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold">
          <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-focus-within:underline">
            {project.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{project.description || "No description yet."}</p>
      </div>
      <ProgressBar row={row} tasksReady={tasksReady} />
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <TeamAvatars team={row.team} />
        <div className="flex items-center gap-2">
          <DueChip row={row} />
          <ArrowUpRight className="roaya-lift-arrow size-4 text-primary" aria-hidden />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{updatedLabel(project.updatedOn, today)}</p>
    </article>
  )
}

function ProjectTable({
  rows,
  today,
  sort,
  onSort,
  pinned,
  onPin,
  tasksReady,
}: {
  rows: ProjectRow[]
  today: string
  sort: PortfolioSort
  onSort: (sort: PortfolioSort) => void
  pinned: Set<string>
  onPin: (id: string) => void
  tasksReady: boolean
}) {
  const header = (key: PortfolioSort | null, label: string, className = "") => (
    <th scope="col" className={cn("px-4 py-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)} aria-sort={key && sort === key ? "ascending" : undefined}>
      {key ? (
        <button type="button" onClick={() => onSort(key)} className={cn("inline-flex items-center gap-1 tracking-wide uppercase hover:text-foreground", sort === key && "text-foreground")}>
          {label}
          {sort === key ? <span aria-hidden>▾</span> : null}
        </button>
      ) : (
        label
      )}
    </th>
  )
  return (
    <div className="roaya-glass roaya-rise overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {header("name", "Project")}
            {header(null, "Status")}
            {header(null, "Team")}
            {header("progress", "Progress", "w-48")}
            {header("due", "Due")}
            {header("updated", "Updated")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const status = statusLabel(row.project.status)
            return (
              <tr key={row.project.id} className="roaya-rise border-b border-border last:border-0 hover:bg-muted/40" style={{ "--d": Math.min(index, 12) } as React.CSSProperties}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PinButton id={row.project.id} name={row.project.name} pinned={pinned.has(row.project.id)} onPin={onPin} />
                    <span className={cn("size-2 shrink-0 rounded-full", statusStripe[row.project.status])} aria-hidden />
                    <Link href={`/projects/${row.project.id}`} className="truncate font-medium hover:text-primary">
                      {row.project.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", projectStatusClass[status])}>{status}</span>
                </td>
                <td className="px-4 py-3">
                  <TeamAvatars team={row.team} max={3} />
                </td>
                <td className="px-4 py-3">
                  {tasksReady ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]" style={{ width: row.percent + "%" }} />
                      </div>
                      <span className="w-9 text-end text-xs tabular-nums">{row.percent}%</span>
                    </div>
                  ) : (
                    <div className="roaya-skeleton h-1.5 w-full rounded-full" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <DueChip row={row} />
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">{updatedLabel(row.project.updatedOn, today).replace("Updated ", "")}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading projects">
      <span role="status" className="sr-only">
        Loading projects…
      </span>
      <div className="flex justify-between">
        <div className="roaya-skeleton h-11 w-56 rounded-xl" />
        <div className="roaya-skeleton h-11 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="roaya-skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="roaya-glass grid gap-4 rounded-2xl p-5">
            <div className="roaya-skeleton h-5 w-32 rounded-full" />
            <div className="roaya-skeleton h-4 w-2/3 rounded" />
            <div className="roaya-skeleton h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <div className="roaya-skeleton h-7 w-20 rounded-full" />
              <div className="roaya-skeleton h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Status({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
      {message}
    </p>
  )
}

function statusLabel(status: ProjectStatusValue): ProjectStatus {
  if (status === "planning") return "Planning"
  if (status === "in_progress") return "In progress"
  if (status === "in_review") return "In review"
  return "On hold"
}

function useOrganizationProjects(organizationId: string) {
  const store = useMemo(
    () => createProjectsStore(organizationId),
    [organizationId]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createProjectsStore(organizationId: string) {
  const initial: ProjectsSnapshot = { status: "loading", projects: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getOrganizationProjects(organizationId)
          .then((result) => {
            if (requestGeneration !== generation) return
            current = {
              status: result.status,
              projects: result.status === "ready" ? result.projects : [],
            }
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error", projects: [] }
            listeners.forEach((item) => item())
          })
      }
      load()
      const stopRefresh = subscribeProjectListRefresh(load)
      return () => {
        listeners.delete(listener)
        generation += 1
        stopRefresh()
      }
    },
    getSnapshot() {
      return current
    },
    getServerSnapshot() {
      return initial
    },
  }
}
