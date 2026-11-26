"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  FileSearch,
  FileUp,
  FolderPlus,
  Inbox,
  ListTodo,
  Sparkles,
} from "lucide-react"

import { useCurrentIdentity } from "@/components/auth/current-identity-provider"
import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { LiveActivityList } from "@/components/activity/activity-feed"
import { OPEN_ASSISTANT_EVENT } from "@/components/assistant/ask-connect"
import { useProjectCreateLauncher } from "@/components/projects/project-create-launcher"
import { Button } from "@/components/ui/button"
import type { OrganizationTask } from "@/lib/auth/organization-tasks"
import type { OrganizationProject } from "@/lib/auth/organization-projects"
import { dueInfo, initials, localDateKey, longDate, type DueInfo } from "@/lib/dashboard-dates"
import { cn } from "@/lib/utils"

const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
}

const statusStyles: Record<string, string> = {
  todo: "bg-[var(--color-teal-500)]/12 text-[var(--color-teal-700)]",
  in_progress: "bg-[var(--color-navy-500)]/12 text-[var(--color-navy-600)]",
  in_review: "bg-[var(--color-purple-500)]/12 text-[var(--color-purple-600)]",
  done: "bg-emerald-600/12 text-emerald-700",
  planning: "bg-[var(--color-teal-500)]/12 text-[var(--color-teal-700)]",
  active: "bg-[var(--color-navy-500)]/12 text-[var(--color-navy-600)]",
  on_hold: "bg-amber-500/15 text-amber-700",
  completed: "bg-emerald-600/12 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status] ?? "bg-muted text-muted-foreground")}>
      {statusLabels[status] ?? status.replaceAll("_", " ")}
    </span>
  )
}

/** Rolls a number up from 0 once, on first show. Respects reduced motion. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) {
      node.textContent = String(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 900)
      node.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  )
}

type DayTask = OrganizationTask & { due: DueInfo }


function DueBadge({ due }: { due: DueInfo }) {
  if (due.group === "none") return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        due.group === "overdue"
          ? "roaya-overdue-pulse bg-destructive/10 text-destructive"
          : due.group === "today"
            ? "bg-amber-500/15 text-amber-700"
            : "bg-muted text-muted-foreground"
      )}
    >
      {due.label}
    </span>
  )
}


const tile = "roaya-glass roaya-rise rounded-2xl p-5"
const tileDelay = (d: number) => ({ "--d": d }) as React.CSSProperties

function TileTitle({ children, href, action }: { children: React.ReactNode; href?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {href && action ? (
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {action}
        </Link>
      ) : null}
    </div>
  )
}

/** The big navy tile: the single most urgent open task. */
function FocusTile({ task, openCount }: { task: DayTask | undefined; openCount: number }) {
  return (
    <section
      className="roaya-rise relative flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl bg-[linear-gradient(140deg,var(--color-navy-800),var(--color-navy-500)_60%,#4f6d96)] p-6 text-white shadow-[0_18px_40px_-20px_rgb(22_33_58/0.6)] col-span-2 md:row-span-2"
      style={tileDelay(1)}
      aria-labelledby="focus-title"
      data-tour="tasks"
    >
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-[var(--color-teal-500)]/25 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-[var(--color-purple-500)]/25 blur-2xl" />
      <div className="relative">
        <p className="text-xs font-semibold tracking-wide text-[var(--color-teal-300)] uppercase">Focus now</p>
        {task ? (
          <dl className="mt-4 grid gap-4">
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">Project</dt>
              <dd className="mt-1 text-lg leading-snug font-semibold">
                <Link href={"/projects/" + task.projectId} className="hover:underline">
                  {task.projectName || "Project"}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">Task</dt>
              <dd>
                <h2 id="focus-title" className="mt-1 text-2xl leading-tight font-semibold sm:text-3xl">
                  {task.title}
                </h2>
              </dd>
            </div>
          </dl>
        ) : (
          <>
            <h2 id="focus-title" className="mt-3 text-2xl leading-tight font-semibold sm:text-3xl">
              You’re all caught up
            </h2>
            <p className="mt-2 text-sm text-white/70">No open tasks are assigned to you right now.</p>
          </>
        )}
      </div>
      <div className="relative mt-6 grid gap-4">
        {task ? (
          <div className="flex flex-wrap items-center gap-2">
            {task.due.group !== "none" ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  task.due.group === "overdue" ? "roaya-overdue-pulse bg-white/15 text-[#ffd0d0]" : "bg-white/15 text-white"
                )}
              >
                {task.due.group === "overdue" ? task.due.label.replace("late", "overdue") : task.due.label}
              </span>
            ) : null}
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{statusLabels[task.status] ?? task.status}</span>
            {task.priority === "urgent" || task.priority === "high" ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize">{task.priority} priority</span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {task ? (
            <Link
              href={"/tasks/" + task.id}
              className="roaya-lift inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-navy-700)]"
            >
              Open task
              <ArrowUpRight className="roaya-lift-arrow size-4" aria-hidden />
            </Link>
          ) : null}
          <Link href="/tasks" className="inline-flex items-center rounded-xl border border-white/30 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10">
            {openCount > 1 ? `All my tasks (${openCount})` : "All my tasks"}
          </Link>
        </div>
      </div>
    </section>
  )
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
  delay,
}: {
  label: string
  value: number
  hint: string
  icon: typeof ListTodo
  tone: "red" | "navy" | "teal" | "purple"
  href: string
  delay: number
}) {
  const red = tone === "red" && value > 0
  return (
    <Link href={href} className={cn(tile, "roaya-lift flex flex-col justify-between gap-3", red && "border-destructive/30 bg-destructive/[0.04]")} style={tileDelay(delay)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-sm font-medium", red ? "text-destructive" : "text-muted-foreground")}>{label}</p>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            red
              ? "bg-destructive/10 text-destructive"
              : tone === "teal"
                ? "bg-[var(--color-teal-500)]/12 text-[var(--color-teal-700)]"
                : tone === "purple"
                  ? "bg-purple-500/10 text-purple-600"
                  : "bg-navy-500/10 text-navy-600"
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <div>
        <p className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", red && "text-destructive")}>
          <CountUp value={value} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </Link>
  )
}

function AskTile({ delay }: { delay: number }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
      className="roaya-rise roaya-lift relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--color-teal-600),var(--color-navy-500))] p-5 text-start text-white"
      style={tileDelay(delay)}
    >
      <span aria-hidden className="pointer-events-none absolute -right-6 -bottom-8 size-28 rounded-full bg-white/10" />
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
        <Sparkles className="size-4.5" aria-hidden />
      </span>
      <span>
        <span className="block text-base font-semibold">Ask Connect</span>
        <span className="mt-1 block text-xs text-white/75">“Where do I upload a logo?”</span>
      </span>
    </button>
  )
}

function QuickActionsTile({ delay }: { delay: number }) {
  const projects = useProjectCreateLauncher()
  // Each action opens its page; the create dialog opens only when its button there is clicked.
  const actions: { key: string; href: string; label: string; hint: string; icon: typeof Inbox }[] = [
    ...(projects.canCreate ? [{ key: "project", href: "/projects", label: "New project", hint: "Go to Projects", icon: FolderPlus }] : []),
    { key: "request", href: "/requests", label: "New request", hint: "Go to Department requests", icon: Inbox },
    { key: "artifact", href: "/artifacts", label: "Import artifact", hint: "Go to Artifact hub", icon: FileUp },
  ]
  return (
    <section className={cn(tile, "col-span-2 flex flex-col")} style={tileDelay(delay)} aria-label="Quick actions">
      <TileTitle>Quick actions</TileTitle>
      <div className={cn("grid flex-1 gap-2", actions.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {actions.map((action, index) => {
          const className = cn(
            "roaya-lift flex flex-col justify-between gap-4 rounded-xl border p-4 text-start",
            index === 0 ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"
          )
          const body = (
            <>
              <span className={cn("flex size-9 items-center justify-center rounded-lg", index === 0 ? "bg-white/15" : "bg-navy-500/10 text-navy-600")}>
                <action.icon className="size-4.5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{action.label}</span>
                <span className={cn("mt-0.5 block text-xs", index === 0 ? "text-primary-foreground/75" : "text-muted-foreground")}>{action.hint}</span>
              </span>
            </>
          )
          return (
            <Link key={action.key} href={action.href} className={className}>
              {body}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function WorkloadTile({ tasks, delay }: { tasks: DayTask[]; delay: number }) {
  const people = [...tasks.reduce((map, task) => {
    const key = task.assigneeId ?? "unassigned"
    const row = map.get(key) ?? { name: task.assigneeName || (task.assigneeId ? "Team member" : "Unassigned"), open: 0, late: 0 }
    row.open++
    if (task.due.group === "overdue") row.late++
    map.set(key, row)
    return map
  }, new Map<string, { name: string; open: number; late: number }>()).values()]
    .sort((a, b) => b.open - a.open)
    .slice(0, 5)
  const max = Math.max(1, ...people.map((p) => p.open))
  return (
    <section className={cn(tile, "col-span-2")} style={tileDelay(delay)} aria-label="Team workload">
      <TileTitle href="/tasks" action="All tasks">
        Team workload
      </TileTitle>
      {people.length ? (
        <ul className="grid gap-3">
          {people.map((person) => (
            <li key={person.name} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy-500)] text-[10px] font-semibold text-white" aria-hidden>
                {initials(person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{person.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {person.open} open{person.late ? <span className="font-semibold text-destructive"> · {person.late} late</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]"
                    style={{ width: (person.open / max) * 100 + "%" }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No open tasks across the team.</p>
      )}
    </section>
  )
}

function TaskListTile({ tasks, delay }: { tasks: DayTask[]; delay: number }) {
  const SHOW = 6
  const rest = tasks.slice(1, SHOW + 1)
  return (
    <section className={cn(tile, "col-span-2")} style={tileDelay(delay)} aria-label="Up next">
      <TileTitle href="/tasks" action="View all">
        Up next
      </TileTitle>
      {rest.length ? (
        <ul className="divide-y divide-border">
          {rest.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-2.5">
              <span
                className={cn("size-2 shrink-0 rounded-full", task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : "bg-border")}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <Link href={"/tasks/" + task.id} className="block truncate text-sm font-medium hover:text-primary">
                  {task.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{task.projectName || "Project"}</p>
              </div>
              <DueBadge due={task.due} />
              <StatusChip status={task.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">{tasks.length ? "That’s your only open task." : "Nothing else is waiting on you."}</p>
      )}
      {tasks.length > SHOW + 1 ? (
        <Link href="/tasks" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
          +{tasks.length - SHOW - 1} more
        </Link>
      ) : null}
    </section>
  )
}

function ActivityTile({ delay }: { delay: number }) {
  return (
    <section className={cn(tile, "col-span-2")} style={tileDelay(delay)} aria-label="Recent activity">
      <TileTitle href="/activity" action="View all">
        Recent activity
      </TileTitle>
      <LiveActivityList limit={5} />
    </section>
  )
}

function ProjectsTile({ projects, tasks, today, delay, wide }: { projects: OrganizationProject[]; tasks: OrganizationTask[]; today: string; delay: number; wide: boolean }) {
  const rows = projects
    .map((project) => {
      const own = tasks.filter((task) => task.projectId === project.id)
      const done = own.filter((task) => task.status === "done").length
      return { project, total: own.length, done, percent: own.length ? Math.round((done / own.length) * 100) : 0, due: dueInfo(project.dueOn, today) }
    })
    .sort((a, b) => (a.due.days ?? 9999) - (b.due.days ?? 9999) || a.project.name.localeCompare(b.project.name))
    .slice(0, wide ? 6 : 4)
  return (
    <section className={cn(tile, "col-span-2", wide && "xl:col-span-4")} style={tileDelay(delay)} aria-label="Projects">
      <TileTitle href="/projects" action="View all">
        Projects
      </TileTitle>
      {rows.length ? (
        <ul className={cn("grid gap-x-8 gap-y-4", wide ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-1")}>
          {rows.map(({ project, total, done, percent, due }) => (
            <li key={project.id}>
              <Link href={"/projects/" + project.id} className="group block rounded-xl p-2 -m-2 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold group-hover:text-primary">{project.name}</span>
                  <StatusChip status={project.status} />
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]"
                    style={{ width: percent + "%" }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{total ? `${done}/${total} done · ${percent}%` : "No tasks yet"}</span>
                  {due.group === "none" ? null : (
                    <span className={cn("flex items-center gap-1", due.group === "overdue" && "font-semibold text-destructive")}>
                      <CalendarDays className="size-3.5" aria-hidden />
                      {due.group === "overdue" ? due.label : due.group === "today" ? "Due today" : "Due " + due.label}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No projects are available to your account yet. Accepted project invitations will appear here.</p>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading your dashboard">
      <span role="status" className="sr-only">
        Loading your workspace…
      </span>
      <div className="grid gap-3">
        <div className="roaya-skeleton h-9 w-64 max-w-full rounded-lg" />
        <div className="roaya-skeleton h-4 w-80 max-w-full rounded" />
      </div>
      <div className="grid auto-rows-[minmax(8.5rem,auto)] grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="roaya-skeleton rounded-2xl col-span-2 md:row-span-2" />
        <div className="roaya-skeleton rounded-2xl" />
        <div className="roaya-skeleton rounded-2xl" />
        <div className="roaya-skeleton rounded-2xl" />
        <div className="roaya-skeleton rounded-2xl" />
        <div className="roaya-skeleton col-span-2 rounded-2xl" />
        <div className="roaya-skeleton col-span-2 rounded-2xl" />
      </div>
    </div>
  )
}

type ReadyWorkspace = Extract<NonNullable<ReturnType<typeof useLiveWorkspace>["result"]>, { status: "ready" }>

export function DashboardView() {
  const { result, refresh } = useLiveWorkspace()
  if (!result) return <DashboardSkeleton />
  if (result.status !== "ready")
    return (
      <div className="roaya-glass grid gap-4 p-6">
        <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
        <p>We could not load your workspace data. Please try again.</p>
        <Button className="w-fit" onClick={refresh}>
          Retry
        </Button>
      </div>
    )
  return <DashboardContent result={result} />
}

/** Rendered only in the browser (after the workspace loads), so the clock is read on the client. */
function DashboardContent({ result }: { result: ReadyWorkspace }) {
  const identity = useCurrentIdentity()
  const [now] = useState(() => new Date())
  const firstName = identity.name.split(/\s+/)[0] || identity.name
  const today = localDateKey(now)
  const organizationWide = result.role === "org_admin" || result.role === "admin"
  const withDue = (task: OrganizationTask): DayTask => ({ ...task, due: dueInfo(task.dueOn, today) })
  const urgency = (a: DayTask, b: DayTask) =>
    (a.due.days ?? 9999) - (b.due.days ?? 9999) || priorityRank(b.priority) - priorityRank(a.priority)

  const myTasks = result.tasks.filter((t) => t.assigneeId === result.userId && t.status !== "done").map(withDue).sort(urgency)
  const scope = organizationWide ? result.tasks.filter((t) => t.status !== "done").map(withDue) : myTasks
  const overdue = scope.filter((t) => t.due.group === "overdue").length
  const week = scope.filter((t) => t.due.group === "today" || t.due.group === "week").length
  const review = scope.filter((t) => t.status === "in_review").length
  const myOverdue = myTasks.filter((t) => t.due.group === "overdue").length
  const myWeek = myTasks.filter((t) => t.due.group === "today" || t.due.group === "week").length

  return (
    <div className="grid gap-6">
      <header className="roaya-rise" style={tileDelay(0)}>
        <h1 className="roaya-page-title">Hi {firstName} 👋</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here’s your {longDate(now)}
          {myOverdue ? (
            <>
              {" · "}
              <span className="font-semibold text-destructive">
                {myOverdue} {myOverdue === 1 ? "task" : "tasks"} overdue
              </span>
            </>
          ) : null}
          {myWeek ? ` · ${myWeek} due this week` : null}
          {!myOverdue && !myWeek ? " · Nothing is due this week." : null}
        </p>
      </header>

      <div className="grid auto-rows-[minmax(8.5rem,auto)] grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <FocusTile task={myTasks[0]} openCount={myTasks.length} />
        <StatTile
          label="Overdue"
          value={overdue}
          hint={organizationWide ? "Across your organization" : "Assigned to you"}
          icon={AlertTriangle}
          tone="red"
          href="/tasks"
          delay={2}
        />
        <StatTile
          label="Due this week"
          value={week}
          hint="Today and the next 6 days"
          icon={CalendarClock}
          tone="teal"
          href="/tasks"
          delay={3}
        />
        <StatTile
          label={organizationWide ? "Open tasks" : "My open tasks"}
          value={scope.length}
          hint={review ? `${review} in review` : organizationWide ? "Across your organization" : "Assigned to you"}
          icon={organizationWide ? ListTodo : FileSearch}
          tone="navy"
          href="/tasks"
          delay={4}
        />
        <AskTile delay={5} />
        <QuickActionsTile delay={6} />
        {organizationWide ? <WorkloadTile tasks={scope} delay={7} /> : <TaskListTile tasks={myTasks} delay={7} />}
        {organizationWide ? <TaskListTile tasks={myTasks} delay={8} /> : null}
        <ActivityTile delay={organizationWide ? 9 : 8} />
        <ProjectsTile projects={result.projects} tasks={result.tasks} today={today} delay={organizationWide ? 10 : 9} wide={organizationWide} />
      </div>
    </div>
  )
}

function priorityRank(priority: string) {
  return priority === "urgent" ? 3 : priority === "high" ? 2 : priority === "medium" ? 1 : 0
}
