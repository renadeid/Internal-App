"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { CalendarDays, ChevronDown, Columns3, List, Lock, Search, X } from "lucide-react"

import { colorFor } from "@/components/activity/activity-feed"
import { useOrganization } from "@/components/auth/organization-provider"
import { PageIntro } from "@/components/shared/page-intro"
import { Input } from "@/components/ui/input"
import { getOrganizationTasks } from "@/lib/auth/get-organization-tasks"
import { subscribeTaskListRefresh, refreshOrganizationTasks } from "@/lib/auth/task-list-refresh"
import { setOrganizationTaskStatus } from "@/lib/auth/task-creation-actions"
import {
  taskPriorityLabel,
  taskStatusLabel,
  taskStatusValues,
  type OrganizationTask,
  type OrganizationTasksResult,
  type TaskPriorityValue,
  type TaskScope,
  type TaskStatusValue,
} from "@/lib/auth/organization-tasks"
import { initials, localDateKey } from "@/lib/dashboard-dates"
import { canChangeStatus, compareTasks, groupTasksByDue, quickNextStatus, withDue, type DatedTask, type TaskSort } from "@/lib/task-board"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "open" | TaskStatusValue
type PriorityFilter = "all" | TaskPriorityValue
type View = "list" | "board"

type TasksSnapshot = {
  status: "loading" | OrganizationTasksResult["status"]
  tasks: OrganizationTask[]
}

const statusChip: Record<TaskStatusValue, string> = {
  todo: "bg-[var(--color-teal-500)]/12 text-[var(--color-teal-700)]",
  in_progress: "bg-[var(--color-navy-500)]/12 text-[var(--color-navy-600)]",
  in_review: "bg-[var(--color-purple-500)]/12 text-[var(--color-purple-600)]",
  done: "bg-emerald-600/12 text-emerald-700",
}
const statusDot: Record<TaskStatusValue, string> = {
  todo: "bg-[var(--color-teal-500)]",
  in_progress: "bg-[var(--color-navy-500)]",
  in_review: "bg-[var(--color-purple-500)]",
  done: "bg-emerald-600",
}
const priorityBar: Record<TaskPriorityValue, string> = {
  urgent: "bg-destructive",
  high: "bg-amber-500",
  medium: "bg-[var(--color-navy-300)]",
  low: "bg-border",
}

export function OrganizationTasksView() {
  const { activeOrganization, mode } = useOrganization()
  const description = activeOrganization
    ? `Tasks you can read in ${activeOrganization.name}, grouped by when they’re due.`
    : mode === "multiple"
      ? "Select an organization in the sidebar to see its tasks."
      : mode === "unavailable"
        ? "Organization is unavailable."
        : "No organization is available."

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="My tasks" description={description} />
      {activeOrganization ? (
        <OrganizationTaskList key={activeOrganization.id} organizationId={activeOrganization.id} organizationName={activeOrganization.name} />
      ) : null}
    </div>
  )
}

function readView(): View {
  try {
    return window.localStorage.getItem("roaya-tasks-view") === "board" ? "board" : "list"
  } catch {
    return "list"
  }
}

function OrganizationTaskList({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [scope, setScope] = useState<TaskScope>("mine")
  const snapshot = useOrganizationTasks(organizationId, scope)

  return (
    <div className="flex flex-col gap-4">
      {snapshot.status === "loading" ? <TasksSkeleton scope={scope} onScope={setScope} /> : null}
      {snapshot.status === "error" ? <Notice>Tasks could not be loaded.</Notice> : null}
      {snapshot.status === "rejected" ? <Notice>This organization is not available for your account.</Notice> : null}
      {snapshot.status === "unavailable" ? <Notice>These tasks are not available.</Notice> : null}
      {snapshot.status === "ready" ? (
        <TasksWorkspace organizationId={organizationId} organizationName={organizationName} tasks={snapshot.tasks} scope={scope} onScope={setScope} />
      ) : null}
    </div>
  )
}

function ScopeTabs({ scope, onScope }: { scope: TaskScope; onScope: (scope: TaskScope) => void }) {
  return (
    <div role="tablist" aria-label="Whose tasks" className="flex gap-1 rounded-xl border border-border bg-card p-1">
      {(
        [
          ["mine", "Assigned to me"],
          ["everyone", "Everyone"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={scope === key}
          onClick={() => onScope(key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            scope === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Rendered in the browser once tasks load, so it can read the clock and the saved view. */
function TasksWorkspace({
  organizationId,
  organizationName,
  tasks,
  scope,
  onScope,
}: {
  organizationId: string
  organizationName: string
  tasks: OrganizationTask[]
  scope: TaskScope
  onScope: (scope: TaskScope) => void
}) {
  const [now] = useState(() => new Date())
  const today = localDateKey(now)
  const [view, setView] = useState<View>(readView)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [priority, setPriority] = useState<PriorityFilter>("all")
  const [sort, setSort] = useState<TaskSort>("due")
  const [showDone, setShowDone] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, TaskStatusValue>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ taskId: string; message: string } | null>(null)
  const saving = useRef(false)

  useEffect(() => {
    try {
      window.localStorage.setItem("roaya-tasks-view", view)
    } catch {
      // optional preference
    }
  }, [view])

  // Once fresh data arrives, drop optimistic statuses that now match.
  const effective = tasks.map((task) => (overrides[task.id] && overrides[task.id] !== task.status ? { ...task, status: overrides[task.id] } : task))

  async function changeStatus(task: OrganizationTask, next: TaskStatusValue) {
    if (saving.current || next === task.status || !canChangeStatus(task) || !["todo", "in_progress"].includes(next)) return
    saving.current = true
    setPendingId(task.id)
    setRowError(null)
    setOverrides((current) => ({ ...current, [task.id]: next }))
    try {
      const result = await setOrganizationTaskStatus({ organizationId, projectId: task.projectId, taskId: task.id, status: next })
      if (result.status === "updated") refreshOrganizationTasks()
      else {
        setOverrides((current) => {
          const rest = { ...current }
          delete rest[task.id]
          return rest
        })
        setRowError({ taskId: task.id, message: statusError(result) })
      }
    } catch {
      setOverrides((current) => {
        const rest = { ...current }
        delete rest[task.id]
        return rest
      })
      setRowError({ taskId: task.id, message: "The status could not be saved." })
    } finally {
      saving.current = false
      setPendingId(null)
    }
  }

  const needle = query.trim().toLowerCase()
  const filtered = effective.filter(
    (task) =>
      (status === "all" || (status === "open" ? task.status !== "done" : task.status === status)) &&
      (priority === "all" || task.priority === priority) &&
      (!needle || [task.title, task.projectName ?? "", task.assigneeName ?? "", task.description].join(" ").toLowerCase().includes(needle))
  )
  const open = effective.filter((task) => task.status !== "done")
  const overdueCount = withDue(open, today).filter((task) => task.due.group === "overdue").length
  const filtersActive = status !== "all" || priority !== "all" || Boolean(needle)
  const viewKey = [view, scope, status, priority, sort, needle].join("|")
  const common = { today, pendingId, rowError, onStatus: changeStatus, showAssignee: scope === "everyone" }

  return (
    <div className="grid gap-5">
      <div className="roaya-rise flex flex-wrap items-center justify-between gap-3" style={{ "--d": 0 } as React.CSSProperties}>
        <ScopeTabs scope={scope} onScope={onScope} />
        <div role="group" aria-label="View" className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["list", "List", List],
              ["board", "Board", Columns3],
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

      <div className="roaya-rise flex flex-wrap items-center gap-2" style={{ "--d": 1 } as React.CSSProperties}>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden />
          <Input type="search" className="h-10 ps-9" aria-label="Search tasks" placeholder="Search tasks, projects, people…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label="Filter by status" className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          <option value="open">Not done</option>
          {taskStatusValues.map((item) => (
            <option key={item} value={item}>
              {taskStatusLabel(item)}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={priority} onChange={(e) => setPriority(e.target.value as PriorityFilter)}>
          <option value="all">Any priority</option>
          {(["urgent", "high", "medium", "low"] as const).map((item) => (
            <option key={item} value={item}>
              {taskPriorityLabel(item)}
            </option>
          ))}
        </select>
        <select aria-label="Sort tasks" className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)}>
          <option value="due">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="project">Sort: Project</option>
          <option value="title">Sort: Name</option>
        </select>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setStatus("all")
              setPriority("all")
              setQuery("")
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden /> Clear
          </button>
        ) : null}
        <p role="status" className="ms-auto text-xs text-muted-foreground">
          {open.length} open
          {overdueCount ? <span className="font-semibold text-destructive"> · {overdueCount} overdue</span> : null}
        </p>
      </div>

      {tasks.length === 0 ? (
        <Notice>{scope === "mine" ? `No active tasks are assigned to you in ${organizationName}.` : `No active tasks are visible in ${organizationName}.`}</Notice>
      ) : filtered.length === 0 ? (
        <Notice>No tasks match these filters.</Notice>
      ) : view === "list" ? (
        <TaskList key={viewKey} tasks={filtered} sort={sort} showDone={showDone} onShowDone={() => setShowDone((v) => !v)} {...common} />
      ) : (
        <TaskBoard key={viewKey} tasks={filtered} sort={sort} {...common} />
      )}
    </div>
  )
}

type RowProps = {
  today: string
  pendingId: string | null
  rowError: { taskId: string; message: string } | null
  onStatus: (task: OrganizationTask, next: TaskStatusValue) => void
  showAssignee: boolean
}

function DueChip({ task }: { task: DatedTask }) {
  if (task.due.group === "none" || task.status === "done") return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        task.due.group === "overdue"
          ? "roaya-overdue-pulse bg-destructive/10 text-destructive"
          : task.due.group === "today"
            ? "bg-amber-500/15 text-amber-700"
            : "bg-muted text-muted-foreground"
      )}
    >
      <CalendarDays className="size-3" aria-hidden />
      {task.due.label}
    </span>
  )
}

function StatusCircle({ task, pending, onStatus }: { task: DatedTask; pending: boolean; onStatus: RowProps["onStatus"] }) {
  const next = quickNextStatus(task.status)
  const allowed = canChangeStatus(task) && next
  const label = allowed
    ? `Mark ${task.title} as ${taskStatusLabel(next)}`
    : task.status === "in_review"
      ? "Waiting for review"
      : task.status === "done"
        ? "Done"
        : "You can’t change this status"
  return (
    <button
      type="button"
      disabled={!allowed || pending}
      onClick={() => next && onStatus(task, next)}
      aria-label={label}
      title={label}
      className={cn(
        "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
        task.status === "todo" && "border-muted-foreground/40 hover:border-primary",
        task.status === "in_progress" && "border-[var(--color-navy-500)] bg-[conic-gradient(var(--color-navy-500)_0_50%,transparent_50%_100%)]",
        task.status === "in_review" && "border-[var(--color-purple-500)] bg-[conic-gradient(var(--color-purple-500)_0_75%,transparent_75%_100%)]",
        task.status === "done" && "roaya-check-pop border-emerald-600 bg-emerald-600 text-white",
        pending && "animate-pulse",
        allowed ? "cursor-pointer" : "cursor-default"
      )}
    >
      {task.status === "done" ? <span className="text-[10px] font-bold">✓</span> : null}
    </button>
  )
}

function Avatar({ name }: { name: string | null }) {
  if (!name) return null
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white", colorFor(name))} title={name} aria-hidden>
      {initials(name)}
    </span>
  )
}

function TaskList({ tasks, sort, showDone, onShowDone, ...row }: { tasks: OrganizationTask[]; sort: TaskSort; showDone: boolean; onShowDone: () => void } & RowProps) {
  const groups = groupTasksByDue(tasks, row.today, sort)
  let index = 0
  return (
    <div className="grid gap-5">
      {groups.map((group) => {
        const collapsed = group.key === "done" && !showDone
        return (
          <section key={group.key} aria-labelledby={"group-" + group.key} className="roaya-rise" style={{ "--d": 2 } as React.CSSProperties}>
            <h2 id={"group-" + group.key} className={cn("mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase", group.key === "overdue" ? "text-destructive" : "text-muted-foreground")}>
              {group.key === "overdue" ? <span className="size-1.5 rounded-full bg-destructive" aria-hidden /> : null}
              {group.title} · {group.tasks.length}
              {group.key === "done" ? (
                <button type="button" onClick={onShowDone} aria-expanded={showDone} className="ms-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 normal-case tracking-normal hover:bg-muted">
                  {showDone ? "Hide" : "Show"}
                  <ChevronDown className={cn("size-3.5 transition-transform", showDone && "rotate-180")} aria-hidden />
                </button>
              ) : null}
            </h2>
            {collapsed ? null : (
              <ul className="roaya-glass divide-y divide-border overflow-hidden rounded-2xl">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} index={index++} {...row} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TaskRow({ task, index, pendingId, rowError, onStatus, showAssignee }: { task: DatedTask; index: number } & RowProps) {
  const error = rowError?.taskId === task.id ? rowError.message : null
  return (
    <li className="roaya-rise group relative hover:bg-muted/40" style={{ "--d": Math.min(index, 12) } as React.CSSProperties}>
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusCircle task={task} pending={pendingId === task.id} onStatus={onStatus} />
        <span className={cn("h-6 w-1 shrink-0 rounded-full", priorityBar[task.priority])} title={taskPriorityLabel(task.priority) + " priority"} aria-hidden />
        <div className="min-w-0 flex-1">
          <Link
            href={"/tasks/" + task.id}
            className={cn("block truncate text-sm font-medium after:absolute after:inset-0 hover:text-primary", task.status === "done" && "text-muted-foreground line-through")}
          >
            {task.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {task.projectName ?? "Project unavailable"}
            <span className="sr-only"> · {taskPriorityLabel(task.priority)} priority</span>
          </p>
        </div>
        {showAssignee ? <Avatar name={task.assigneeName} /> : null}
        <DueChip task={task} />
        <span className={cn("hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline", statusChip[task.status])}>{taskStatusLabel(task.status)}</span>
      </div>
      {error ? (
        <p role="alert" className="px-4 pb-3 ps-16 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  )
}

const boardColumns: { status: TaskStatusValue; hint?: string }[] = [
  { status: "todo" },
  { status: "in_progress" },
  { status: "in_review", hint: "Moves here when work is submitted" },
  { status: "done", hint: "Moves here when work is approved" },
]

function TaskBoard({ tasks, sort, ...row }: { tasks: OrganizationTask[]; sort: TaskSort } & RowProps) {
  const [dragging, setDragging] = useState<DatedTask | null>(null)
  const [over, setOver] = useState<TaskStatusValue | null>(null)
  const dated = withDue(tasks, row.today)
  return (
    <div className="roaya-rise -mx-1 overflow-x-auto px-1 pb-2" style={{ "--d": 2 } as React.CSSProperties}>
      <div className="grid min-w-[56rem] grid-cols-4 gap-3">
        {boardColumns.map((column, columnIndex) => {
          const items = dated.filter((task) => task.status === column.status).sort(compareTasks(sort))
          const accepts = Boolean(dragging && canChangeStatus(dragging) && ["todo", "in_progress"].includes(column.status) && dragging.status !== column.status)
          return (
            <section
              key={column.status}
              aria-label={taskStatusLabel(column.status)}
              onDragOver={(event) => {
                if (!accepts) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
                setOver(column.status)
              }}
              onDragLeave={() => setOver((current) => (current === column.status ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                if (dragging && accepts) row.onStatus(dragging, column.status)
                setDragging(null)
                setOver(null)
              }}
              className={cn(
                "flex min-h-64 flex-col gap-2 rounded-2xl border border-transparent bg-muted/50 p-2.5 transition-colors",
                over === column.status && "border-primary/50 bg-primary/5",
                dragging && !accepts && column.status !== dragging.status && "opacity-60"
              )}
            >
              <h2 className="flex items-center justify-between px-1.5 pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", statusDot[column.status])} aria-hidden />
                  {taskStatusLabel(column.status)}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-[11px] tabular-nums text-foreground">{items.length}</span>
              </h2>
              {column.hint ? (
                <p className="flex items-center gap-1.5 px-1.5 text-[11px] text-muted-foreground">
                  <Lock className="size-3" aria-hidden />
                  {column.hint}
                </p>
              ) : null}
              {items.map((task, index) => (
                <BoardCard
                  key={task.id}
                  task={task}
                  index={columnIndex * 3 + index}
                  dragging={dragging?.id === task.id}
                  onDragStart={() => setDragging(task)}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  {...row}
                />
              ))}
              {!items.length ? <p className="px-1.5 py-6 text-center text-xs text-muted-foreground">No tasks</p> : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function BoardCard({
  task,
  index,
  dragging,
  onDragStart,
  onDragEnd,
  pendingId,
  rowError,
  onStatus,
  showAssignee,
}: { task: DatedTask; index: number; dragging: boolean; onDragStart: () => void; onDragEnd: () => void } & RowProps) {
  const movable = canChangeStatus(task)
  const next = quickNextStatus(task.status)
  const error = rowError?.taskId === task.id ? rowError.message : null
  return (
    <article
      draggable={movable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", task.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "roaya-rise roaya-lift group relative grid gap-2 rounded-xl border border-border bg-background p-3 shadow-sm",
        movable && "cursor-grab active:cursor-grabbing",
        dragging && "rotate-2 opacity-60 shadow-xl",
        pendingId === task.id && "animate-pulse"
      )}
      style={{ "--d": Math.min(index, 12) } as React.CSSProperties}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-4 w-1 shrink-0 rounded-full", priorityBar[task.priority])} title={taskPriorityLabel(task.priority) + " priority"} aria-hidden />
        <Link href={"/tasks/" + task.id} className={cn("min-w-0 flex-1 text-sm leading-snug font-medium hover:text-primary", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
      </div>
      <p className="truncate text-xs text-muted-foreground">{task.projectName ?? "Project unavailable"}</p>
      <div className="flex items-center justify-between gap-2">
        <DueChip task={task} />
        <span className="ms-auto flex items-center gap-1.5">
          {showAssignee ? <Avatar name={task.assigneeName} /> : null}
          {movable && next ? (
            <button
              type="button"
              disabled={pendingId === task.id}
              onClick={() => onStatus(task, next)}
              className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              {next === "in_progress" ? "Start →" : "← To do"}
            </button>
          ) : null}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  )
}

function TasksSkeleton({ scope, onScope }: { scope: TaskScope; onScope: (scope: TaskScope) => void }) {
  return (
    <div className="grid gap-5" aria-busy="true">
      <span role="status" className="sr-only">
        Loading tasks…
      </span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScopeTabs scope={scope} onScope={onScope} />
        <div className="roaya-skeleton h-11 w-40 rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="roaya-skeleton h-10 w-72 rounded-xl" />
        <div className="roaya-skeleton h-10 w-32 rounded-xl" />
        <div className="roaya-skeleton h-10 w-32 rounded-xl" />
      </div>
      <div className="roaya-skeleton h-3 w-28 rounded" />
      <div className="roaya-glass divide-y divide-border overflow-hidden rounded-2xl">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="roaya-skeleton size-5 rounded-full" />
            <div className="grid flex-1 gap-2">
              <div className="roaya-skeleton h-3.5 w-1/2 rounded" />
              <div className="roaya-skeleton h-3 w-1/4 rounded" />
            </div>
            <div className="roaya-skeleton h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground" aria-live="polite">
      {children}
    </p>
  )
}

function statusError(
  result: Exclude<Awaited<ReturnType<typeof setOrganizationTaskStatus>>, { status: "updated" }>
) {
  if (result.status === "invalid") return result.message
  if (result.status === "denied") return "You do not have permission to change this status."
  if (result.status === "unavailable") return "This task is not available to update."
  if (result.status === "rejected") return "This organization is not available for your account."
  return "The status could not be saved."
}


function useOrganizationTasks(organizationId: string, scope: TaskScope) {
  const store = useMemo(
    () => createTasksStore(organizationId, scope),
    [organizationId, scope]
  )
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

function createTasksStore(organizationId: string, scope: TaskScope) {
  const initial: TasksSnapshot = { status: "loading", tasks: [] }
  let current = initial
  let generation = 0
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      const load = () => {
        const requestGeneration = ++generation
        void getOrganizationTasks(organizationId, scope)
          .then((result) => {
            if (requestGeneration !== generation) return
            current = {
              status: result.status,
              tasks: result.status === "ready" ? result.tasks : [],
            }
            listeners.forEach((item) => item())
          })
          .catch(() => {
            if (requestGeneration !== generation) return
            current = { status: "error", tasks: [] }
            listeners.forEach((item) => item())
          })
      }
      load()
      const stopRefresh = subscribeTaskListRefresh(load)
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
