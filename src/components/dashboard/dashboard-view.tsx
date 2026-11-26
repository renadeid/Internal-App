"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  FileUp,
  Inbox,
  ListTodo,
  Sparkles,
  Upload,
} from "lucide-react"

import { SectionHeading } from "./section-heading"
import { useCurrentIdentity } from "@/components/auth/current-identity-provider"
import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { LiveActivityList } from "@/components/activity/activity-feed"
import { OPEN_ASSISTANT_EVENT } from "@/components/assistant/ask-connect"
import { Button } from "@/components/ui/button"
import type { OrganizationTask } from "@/lib/auth/organization-tasks"
import type { OrganizationProject } from "@/lib/auth/organization-projects"
import { dueInfo, greetingFor, localDateKey, longDate, type DueGroup, type DueInfo } from "@/lib/dashboard-dates"
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

const groupOrder: { group: DueGroup; title: string }[] = [
  { group: "overdue", title: "Overdue" },
  { group: "today", title: "Today" },
  { group: "week", title: "This week" },
  { group: "later", title: "Later" },
  { group: "none", title: "No due date" },
]

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

function MyDay({ tasks, organizationWide }: { tasks: DayTask[]; organizationWide: boolean }) {
  const SHOW = 8
  const groups = groupOrder
    .map((entry) => ({ ...entry, items: tasks.filter((task) => task.due.group === entry.group) }))
    .filter((entry) => entry.items.length)
    .reduce<{ group: DueGroup; title: string; items: DayTask[]; visible: DayTask[]; before: number }[]>((list, entry) => {
      const before = list.reduce((sum, item) => sum + item.visible.length, 0)
      return [...list, { ...entry, before, visible: entry.items.slice(0, Math.max(0, SHOW - before)) }]
    }, [])
  return (
    <section className="roaya-rise lg:col-span-3" style={{ "--d": 3 } as React.CSSProperties} data-tour="tasks" aria-labelledby="my-day-title">
      <SectionHeading title="My day" href="/tasks" action="View all tasks" />
      <span id="my-day-title" className="sr-only">
        My day
      </span>
      <div className="roaya-glass p-5">
        {groups.length ? (
          <div className="grid gap-5">
            {groups.map((entry) => {
              const visible = entry.visible
              if (!visible.length) return null
              return (
                <div key={entry.group}>
                  <h3
                    className={cn(
                      "mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
                      entry.group === "overdue" ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {entry.group === "overdue" ? <span className="size-1.5 rounded-full bg-destructive" aria-hidden /> : null}
                    {entry.title} · {entry.items.length}
                  </h3>
                  <ul className="divide-y divide-border">
                    {visible.map((task) => (
                      <li key={task.id} className="flex items-center gap-3 py-3">
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : "bg-border"
                          )}
                          title={task.priority + " priority"}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <Link href={"/tasks/" + task.id} className="block truncate text-sm font-medium hover:text-primary">
                            {task.title}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {task.projectName || "Project"}
                            {organizationWide && task.assigneeName ? " · " + task.assigneeName : ""}
                          </p>
                        </div>
                        <DueBadge due={task.due} />
                        <StatusChip status={task.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {tasks.length > SHOW ? (
              <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">
                See {tasks.length - SHOW} more
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid justify-items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
            <p className="font-semibold">You’re all caught up</p>
            <p className="text-sm text-muted-foreground">No open tasks are assigned to you right now.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function QuickActions() {
  const actions = [
    { href: "/requests?new=1", label: "New request", icon: Inbox },
    { href: "/assets?upload=1", label: "Upload asset", icon: Upload },
    { href: "/artifacts?import=1", label: "Import artifact", icon: FileUp },
  ] as const
  return (
    <nav aria-label="Quick actions" className="roaya-rise flex flex-wrap gap-2" style={{ "--d": 1 } as React.CSSProperties}>
      {actions.map((action, index) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "roaya-lift inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
            index === 0 ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40"
          )}
        >
          <action.icon className="size-4" aria-hidden />
          {action.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
        className="roaya-lift inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary/40"
      >
        <Sparkles className="size-4 text-[var(--color-teal-600)]" aria-hidden />
        Ask Connect
      </button>
    </nav>
  )
}

function AdminKpis({ open, overdue, week, review }: { open: number; overdue: number; week: number; review: number }) {
  const cards = [
    { label: "Open tasks", value: open, hint: "Across your organization", icon: ListTodo, tone: "navy" },
    { label: "Overdue", value: overdue, hint: overdue ? "Past their due date" : "Nothing is late", icon: AlertTriangle, tone: overdue ? "red" : "navy" },
    { label: "Due this week", value: week, hint: "Today and the next 6 days", icon: CalendarClock, tone: "teal" },
    { label: "In review", value: review, hint: "Waiting for a reviewer", icon: FileSearch, tone: "purple" },
  ] as const
  return (
    <section aria-label="Organization summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <Link
          key={card.label}
          href="/tasks"
          className={cn(
            "roaya-glass roaya-lift roaya-rise grid gap-3 p-5",
            card.tone === "red" && "border-destructive/30 bg-destructive/[0.04]"
          )}
          style={{ "--d": index + 1 } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <p className={cn("text-sm font-medium", card.tone === "red" ? "text-destructive" : "text-muted-foreground")}>{card.label}</p>
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                card.tone === "red"
                  ? "bg-destructive/10 text-destructive"
                  : card.tone === "teal"
                    ? "bg-[var(--color-teal-500)]/12 text-[var(--color-teal-700)]"
                    : card.tone === "purple"
                      ? "bg-purple-500/10 text-purple-600"
                      : "bg-navy-500/10 text-navy-600"
              )}
            >
              <card.icon className="size-5" aria-hidden />
            </span>
          </div>
          <p className={cn("text-3xl font-semibold tracking-tight", card.tone === "red" && "text-destructive")}>
            <CountUp value={card.value} />
          </p>
          <p className="text-sm text-muted-foreground">{card.hint}</p>
        </Link>
      ))}
    </section>
  )
}

function ProjectProgress({
  projects,
  tasks,
  today,
  title,
  delay,
}: {
  projects: OrganizationProject[]
  tasks: OrganizationTask[]
  today: string
  title: string
  delay: number
}) {
  const rows = projects
    .map((project) => {
      const own = tasks.filter((task) => task.projectId === project.id)
      const done = own.filter((task) => task.status === "done").length
      return { project, total: own.length, done, percent: own.length ? Math.round((done / own.length) * 100) : 0, due: dueInfo(project.dueOn, today) }
    })
    .sort((a, b) => (a.due.days ?? 9999) - (b.due.days ?? 9999) || a.project.name.localeCompare(b.project.name))
    .slice(0, 6)
  return (
    <section className="roaya-rise" style={{ "--d": delay } as React.CSSProperties}>
      <SectionHeading title={title} href="/projects" action="View all" />
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project, total, done, percent, due }) => (
            <Link key={project.id} href={"/projects/" + project.id} className="group roaya-glass roaya-lift grid gap-3 p-5 hover:border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">{project.name}</h3>
                <StatusChip status={project.status} />
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>{total ? `${done} of ${total} tasks done` : "No tasks yet"}</span>
                  <span className="font-semibold text-foreground tabular-nums">{percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="roaya-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy-500),var(--color-teal-500))]"
                    style={{ width: percent + "%" }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{project.leadDepartment || "Organization project"}</span>
                {due.group === "none" ? null : (
                  <span className={cn("flex shrink-0 items-center gap-1", due.group === "overdue" && "font-semibold text-destructive")}>
                    <CalendarDays className="size-3.5" aria-hidden />
                    {due.group === "overdue" ? due.label : due.group === "today" ? "Due today" : "Due " + due.label}
                  </span>
                )}
                <ArrowUpRight className="roaya-lift-arrow size-4 shrink-0 text-primary" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="roaya-glass p-6 text-sm text-muted-foreground">
          No projects are available to your account yet. Accepted project invitations will appear here.
        </div>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Loading your dashboard">
      <span role="status" className="sr-only">
        Loading your workspace…
      </span>
      <div className="grid gap-3">
        <div className="roaya-skeleton h-9 w-72 max-w-full rounded-lg" />
        <div className="roaya-skeleton h-4 w-96 max-w-full rounded" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[140, 130, 150, 130].map((width, index) => (
          <div key={index} className="roaya-skeleton h-10 rounded-xl" style={{ width }} />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="roaya-glass grid gap-4 p-5 lg:col-span-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="roaya-skeleton size-2.5 rounded-full" />
              <div className="grid flex-1 gap-2">
                <div className="roaya-skeleton h-3.5 w-2/3 rounded" />
                <div className="roaya-skeleton h-3 w-1/3 rounded" />
              </div>
              <div className="roaya-skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="roaya-glass grid gap-4 p-5 lg:col-span-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="roaya-skeleton size-8 rounded-full" />
              <div className="grid flex-1 gap-2">
                <div className="roaya-skeleton h-3 w-4/5 rounded" />
                <div className="roaya-skeleton h-2.5 w-1/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardView() {
  const identity = useCurrentIdentity()
  const { result, refresh } = useLiveWorkspace()
  const [now] = useState(() => new Date())
  const firstName = identity.name.split(/\s+/)[0] || identity.name

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

  const today = localDateKey(now)
  const organizationWide = result.role === "org_admin" || result.role === "admin"
  const withDue = (task: OrganizationTask): DayTask => ({ ...task, due: dueInfo(task.dueOn, today) })
  const byDue = (a: DayTask, b: DayTask) => (a.due.days ?? 9999) - (b.due.days ?? 9999)

  const myTasks = result.tasks.filter((t) => t.assigneeId === result.userId && t.status !== "done").map(withDue).sort(byDue)
  const myOverdue = myTasks.filter((t) => t.due.group === "overdue").length
  const myToday = myTasks.filter((t) => t.due.group === "today").length
  const myWeek = myTasks.filter((t) => t.due.group === "week").length
  const myReview = myTasks.filter((t) => t.status === "in_review").length

  const orgOpen = result.tasks.filter((t) => t.status !== "done").map(withDue)
  const visibleProjects = result.projects

  const summary: { text: string; tone?: "red" }[] = []
  if (myOverdue) summary.push({ text: `${myOverdue} ${myOverdue === 1 ? "task" : "tasks"} overdue`, tone: "red" })
  if (myToday) summary.push({ text: `${myToday} due today` })
  if (myWeek) summary.push({ text: `${myWeek} due this week` })
  if (myReview) summary.push({ text: `${myReview} waiting for review` })

  return (
    <div className="grid gap-8">
      <header className="roaya-rise grid gap-2" style={{ "--d": 0 } as React.CSSProperties}>
        <h1 className="roaya-page-title">
          {greetingFor(now)}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{longDate(now)}</span>
          {summary.length ? (
            summary.map((part) => (
              <span key={part.text}>
                {" · "}
                <span className={part.tone === "red" ? "font-semibold text-destructive" : undefined}>{part.text}</span>
              </span>
            ))
          ) : (
            <span> · You’re all caught up. Nothing is due this week.</span>
          )}
        </p>
      </header>

      <QuickActions />

      {organizationWide ? (
        <>
          <AdminKpis
            open={orgOpen.length}
            overdue={orgOpen.filter((t) => t.due.group === "overdue").length}
            week={orgOpen.filter((t) => t.due.group === "today" || t.due.group === "week").length}
            review={orgOpen.filter((t) => t.status === "in_review").length}
          />
          <ProjectProgress projects={visibleProjects} tasks={result.tasks} today={today} title="Project progress" delay={5} />
        </>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-5">
        <MyDay tasks={myTasks} organizationWide={false} />
        <section className="roaya-rise lg:col-span-2" style={{ "--d": 4 } as React.CSSProperties}>
          <SectionHeading title="Recent activity" href="/activity" action="View all" />
          <div className="roaya-glass p-5">
            <LiveActivityList limit={6} />
          </div>
        </section>
      </div>

      {organizationWide ? null : (
        <ProjectProgress projects={visibleProjects} tasks={result.tasks} today={today} title="Your projects" delay={5} />
      )}
    </div>
  )
}
