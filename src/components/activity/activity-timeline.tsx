"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, CalendarDays, Loader2, Search, Sparkles, X } from "lucide-react"

import { colorFor, hrefFor, useNewRowIds } from "./activity-feed"
import { useOrganization } from "@/components/auth/organization-provider"
import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getOlderActivity } from "@/lib/auth/activity-actions"
import { activityFilters, dayHeading, describeEvent, type ActivityEventRow, type ActivityKind, type ActivityTone } from "@/lib/activity-events"
import { dueInfo, initials, localDateKey, relativeTime } from "@/lib/dashboard-dates"
import { cn } from "@/lib/utils"

type ReadyWorkspace = Extract<NonNullable<ReturnType<typeof useLiveWorkspace>["result"]>, { status: "ready" }>
type Tab = "everyone" | "for-you"

const toneClass: Record<ActivityTone, string> = {
  green: "bg-emerald-600/12 text-emerald-700",
  purple: "bg-[var(--color-purple-500)]/12 text-[var(--color-purple-600)]",
  amber: "bg-amber-500/15 text-amber-700",
  navy: "bg-[var(--color-navy-500)]/12 text-[var(--color-navy-600)]",
  teal: "bg-[var(--color-teal-500)]/14 text-[var(--color-teal-700)]",
  muted: "bg-muted text-muted-foreground",
}
const dotClass: Record<ActivityTone, string> = {
  green: "bg-emerald-600",
  purple: "bg-[var(--color-purple-500)]",
  amber: "bg-amber-500",
  navy: "bg-[var(--color-navy-500)]",
  teal: "bg-[var(--color-teal-500)]",
  muted: "bg-muted-foreground/50",
}

const timeOfDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" })
const fullDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })

export function ActivityTimeline() {
  const { result, refresh } = useLiveWorkspace()
  const { activeOrganization } = useOrganization()
  if (!result || !activeOrganization) return <TimelineSkeleton />
  if (result.status !== "ready")
    return (
      <div className="roaya-glass grid gap-3 p-6 text-sm">
        <p>Activity could not be loaded.</p>
        <Button className="w-fit" variant="outline" onClick={refresh}>
          Retry
        </Button>
      </div>
    )
  return <Timeline key={activeOrganization.id} organizationId={activeOrganization.id} result={result} />
}

/** Rendered only in the browser after the workspace loads, so it can read the clock and local storage. */
function Timeline({ organizationId, result }: { organizationId: string; result: ReadyWorkspace }) {
  const storageKey = `roaya-activity-seen:${organizationId}:${result.userId}`
  const [lastVisit] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const [now, setNow] = useState(() => new Date())
  const [tab, setTab] = useState<Tab>("everyone")
  const [filter, setFilter] = useState<ActivityKind | "all">("all")
  const [person, setPerson] = useState("all")
  const [query, setQuery] = useState("")
  const [older, setOlder] = useState<ActivityEventRow[]>([])
  const [hasMore, setHasMore] = useState(result.activity.length >= 100)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState("")

  // Remember when this visit happened, for next time's "New since your last visit" line.
  useEffect(() => {
    const save = () => {
      try {
        window.localStorage.setItem(storageKey, new Date().toISOString())
      } catch {
        // storage can be unavailable (private mode); the divider simply won't show
      }
    }
    window.addEventListener("pagehide", save)
    return () => {
      window.removeEventListener("pagehide", save)
      save()
    }
  }, [storageKey])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(tick)
  }, [])

  const today = localDateKey(now)
  const projectNames = useMemo(() => new Map(result.projects.map((p) => [p.id, p.name])), [result.projects])
  const tasksById = useMemo(() => new Map(result.tasks.map((t) => [t.id, t])), [result.tasks])
  const myTaskIds = useMemo(() => new Set(result.tasks.filter((t) => t.assigneeId === result.userId).map((t) => t.id)), [result.tasks, result.userId])
  const myProjectIds = useMemo(() => new Set(result.projects.filter((p) => p.ownerId === result.userId).map((p) => p.id)), [result.projects, result.userId])

  const all = useMemo(() => {
    const seen = new Set<string>()
    return [...(result.activity as ActivityEventRow[]), ...older]
      .filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)))
      .map((row) => {
        const described = describeEvent(row)
        const forYou = !row.isMine && Boolean((row.task_id && myTaskIds.has(row.task_id)) || (row.project_id && myProjectIds.has(row.project_id)))
        const isNew = Boolean(lastVisit && !row.isMine && row.created_at > lastVisit)
        return { row, ...described, forYou, isNew, day: localDateKey(new Date(row.created_at)), projectName: row.project_id ? (projectNames.get(row.project_id) ?? null) : null }
      })
  }, [result.activity, older, myTaskIds, myProjectIds, lastVisit, projectNames])

  const inTab = all.filter((event) => tab === "everyone" || event.forYou)
  const needle = query.trim().toLowerCase()
  const matches = (event: (typeof all)[number]) =>
    (person === "all" || event.row.actor_id === person || (person === "me" && event.row.isMine)) &&
    (!needle || [event.title, event.row.actorName ?? "", event.projectName ?? "", event.action].join(" ").toLowerCase().includes(needle))
  const counts = Object.fromEntries(activityFilters.map((f) => [f.key, inTab.filter((e) => (f.key === "all" || e.kind === f.key) && matches(e)).length]))
  const visible = inTab.filter((event) => (filter === "all" || event.kind === filter) && matches(event))
  const forYouNew = all.filter((e) => e.forYou && e.isNew).length

  const people = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of all) if (event.row.actor_id && !event.row.isMine && event.row.actorName) map.set(event.row.actor_id, event.row.actorName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all])

  const groups: { day: string; events: typeof visible }[] = []
  for (const event of visible) {
    const last = groups[groups.length - 1]
    if (last && last.day === event.day) last.events.push(event)
    else groups.push({ day: event.day, events: [event] })
  }
  const firstOld = visible.findIndex((e) => !e.isNew)
  const dividerBefore = firstOld > 0 && visible.slice(0, firstOld).some((e) => e.isNew) ? visible[firstOld].row.id : null

  const fresh = useNewRowIds(all.map((e) => e.row.id))
  const viewKey = [tab, filter, person, needle].join("|")
  const filtersActive = filter !== "all" || person !== "all" || Boolean(needle)

  async function loadMore() {
    const oldest = all[all.length - 1]?.row.created_at
    if (!oldest || loadingMore) return
    setLoadingMore(true)
    setLoadError("")
    try {
      const page = await getOlderActivity(organizationId, oldest)
      if (!page.ok) setLoadError("Older activity could not be loaded. Try again.")
      else {
        setOlder((rows) => [...rows, ...(page.activity as ActivityEventRow[])])
        setHasMore(page.hasMore)
      }
    } catch {
      setLoadError("Older activity could not be loaded. Try again.")
    } finally {
      setLoadingMore(false)
    }
  }

  let order = 0
  return (
    <div className="grid gap-5">
      <div className="roaya-rise grid gap-4" style={{ "--d": 0 } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Whose activity" className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(
              [
                ["everyone", "Everyone"],
                ["for-you", "For you"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
                {key === "for-you" && forYouNew ? (
                  <span className="rounded-full bg-[var(--color-teal-500)] px-1.5 text-[11px] font-semibold text-white tabular-nums">{forYouNew}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                className="h-10 ps-9"
                aria-label="Search activity"
                placeholder="Search people, tasks, projects…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter by person"
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="all">Anyone</option>
              <option value="me">You</option>
              {people.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
          {activityFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              disabled={f.key !== "all" && !counts[f.key] && filter !== f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 disabled:opacity-40",
                filter === f.key ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:border-primary/40"
              )}
            >
              {f.label}
              <span className={cn("text-xs tabular-nums", filter === f.key ? "text-primary-foreground/75" : "text-muted-foreground")}>{counts[f.key]}</span>
            </button>
          ))}
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setFilter("all")
                setPerson("all")
                setQuery("")
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden /> Clear
            </button>
          ) : null}
        </div>
      </div>

      <p role="status" className="sr-only">
        {visible.length} {visible.length === 1 ? "event" : "events"}
      </p>

      {groups.length ? (
        <div key={viewKey} className="grid gap-6">
          {groups.map((group) => (
            <section key={group.day} aria-labelledby={"day-" + group.day}>
              {dividerBefore === group.events[0].row.id ? <NewSinceDivider /> : null}
              <h2
                id={"day-" + group.day}
                className="sticky top-16 z-10 -mx-2 mb-2 flex items-center gap-2 rounded-lg bg-background/85 px-2 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {dayHeading(group.day, today)}
                <span className="font-normal normal-case">· {group.events.length}</span>
              </h2>
              <ol className="relative grid gap-2 ps-6 before:absolute before:top-2 before:bottom-2 before:start-[7px] before:w-0.5 before:rounded-full before:bg-border">
                {group.events.map((event) => {
                  const index = order++
                  const task = event.row.task_id ? tasksById.get(event.row.task_id) : undefined
                  const name = event.row.isMine ? "You" : event.row.actorName || "Someone"
                  const href = event.row.task_id ? "/tasks/" + event.row.task_id : hrefFor(event.row)
                  const due = task ? dueInfo(task.dueOn, today) : null
                  return (
                    <li key={event.row.id} className="contents">
                      {dividerBefore === event.row.id && group.events[0].row.id !== event.row.id ? (
                        <div className="roaya-rise -ms-6 flex items-center gap-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--color-teal-700)] uppercase" role="separator">
                          <span className="h-0.5 flex-1 rounded-full bg-[var(--color-teal-500)]/50" />
                          <Sparkles className="size-3.5" aria-hidden />
                          New since your last visit
                          <span className="h-0.5 flex-1 rounded-full bg-[var(--color-teal-500)]/50" />
                        </div>
                      ) : null}
                      <div
                        className={cn("group relative roaya-rise hover:z-30 focus-within:z-30", fresh.has(event.row.id) && "roaya-feed-new")}
                        style={{ "--d": Math.min(index, 10) } as React.CSSProperties}
                      >
                        <span
                          className={cn("absolute top-5 -start-[22px] size-3 rounded-full ring-4 ring-background", dotClass[event.tone])}
                          aria-hidden
                        />
                        <div
                          className={cn(
                            "roaya-glass roaya-lift flex items-start gap-3 rounded-xl p-3.5",
                            event.isNew && "border-[var(--color-teal-500)]/40 bg-[var(--color-teal-500)]/[0.04]"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                              event.row.actorName ? colorFor(event.row.actorName) : "bg-muted-foreground/40"
                            )}
                            aria-hidden
                          >
                            {event.row.actorName ? initials(event.row.actorName) : "•"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="font-semibold">{name}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", toneClass[event.tone])}>{event.action}</span>
                              {event.isNew ? <span className="text-[11px] font-semibold text-[var(--color-teal-700)]">New</span> : null}
                            </p>
                            <Link href={href} className="mt-1 block truncate text-sm font-medium hover:text-primary" title={event.title}>
                              {event.title}
                            </Link>
                            {event.projectName ? (
                              <Link href={"/projects/" + event.row.project_id} className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-primary">
                                {event.projectName}
                              </Link>
                            ) : null}
                          </div>
                          <time
                            dateTime={event.row.created_at}
                            title={fullDate.format(new Date(event.row.created_at))}
                            className="shrink-0 text-xs text-muted-foreground tabular-nums"
                          >
                            {event.day === today ? relativeTime(event.row.created_at, now) : timeOfDay.format(new Date(event.row.created_at))}
                          </time>
                        </div>
                        {task ? (
                          <div className="pointer-events-none invisible absolute end-3 top-full z-20 mt-1 hidden w-64 translate-y-1 rounded-xl border border-border bg-background p-3 opacity-0 shadow-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 md:block">
                            <p className="truncate text-sm font-semibold">{task.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {task.projectName || "Project"}
                              {task.assigneeName ? " · " + task.assigneeName : ""}
                            </p>
                            <p className="mt-2 flex items-center gap-2 text-xs">
                              <span className="rounded-full bg-muted px-2 py-0.5 font-medium capitalize">{task.status.replaceAll("_", " ")}</span>
                              {due && due.group !== "none" ? (
                                <span className={cn(due.group === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}>{due.label}</span>
                              ) : null}
                            </p>
                            <Link href={"/tasks/" + task.id} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                              Open task <ArrowUpRight className="size-3.5" aria-hidden />
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="roaya-glass grid justify-items-center gap-2 p-10 text-center">
          <Sparkles className="size-8 text-primary" aria-hidden />
          <p className="font-semibold">{tab === "for-you" && !filtersActive ? "Nothing for you yet" : "No matching activity"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {tab === "for-you" && !filtersActive
              ? "Updates on tasks assigned to you and projects you own will appear here."
              : "Try another filter, person or search."}
          </p>
        </div>
      )}

      {hasMore ? (
        <div className="grid justify-items-center gap-2">
          <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()} className="gap-2">
            {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {loadingMore ? "Loading…" : "Load older activity"}
          </Button>
          {loadError ? (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : all.length ? (
        <p className="text-center text-xs text-muted-foreground">You’ve reached the beginning of your workspace’s activity.</p>
      ) : null}
    </div>
  )
}

function NewSinceDivider() {
  return (
    <div className="roaya-rise mb-3 flex items-center gap-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--color-teal-700)] uppercase" role="separator">
      <span className="h-0.5 flex-1 rounded-full bg-[var(--color-teal-500)]/50" />
      <Sparkles className="size-3.5" aria-hidden />
      New since your last visit
      <span className="h-0.5 flex-1 rounded-full bg-[var(--color-teal-500)]/50" />
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading activity">
      <span role="status" className="sr-only">
        Loading activity…
      </span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="roaya-skeleton h-11 w-52 rounded-xl" />
        <div className="roaya-skeleton h-10 w-72 rounded-xl" />
      </div>
      <div className="flex gap-2">
        {[60, 90, 70, 90, 60, 90].map((w, i) => (
          <div key={i} className="roaya-skeleton h-8 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="roaya-skeleton h-4 w-28 rounded" />
      <div className="grid gap-2 ps-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="roaya-glass flex items-center gap-3 rounded-xl p-3.5">
            <div className="roaya-skeleton size-9 rounded-full" />
            <div className="grid flex-1 gap-2">
              <div className="roaya-skeleton h-3.5 w-1/3 rounded" />
              <div className="roaya-skeleton h-3 w-2/3 rounded" />
            </div>
            <div className="roaya-skeleton h-3 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
