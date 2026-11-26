"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CheckCircle2, FilePlus2, FolderKanban, ListChecks, MessageSquare, Send, Sparkles } from "lucide-react"

import { useLiveWorkspace } from "@/components/workspace/live-workspace-provider"
import { Button } from "@/components/ui/button"
import { initials, relativeTime } from "@/lib/dashboard-dates"

type ActivityRow = {
  id: string
  summary: string
  verb?: string | null
  actorName?: string | null
  isMine?: boolean
  project_id: string | null
  campaign_id: string | null
  asset_id: string | null
  task_id?: string | null
  created_at: string
}

const avatarColors = [
  "bg-[var(--color-navy-500)]",
  "bg-[var(--color-teal-600)]",
  "bg-[var(--color-purple-500)]",
  "bg-[var(--color-navy-700)]",
  "bg-[var(--color-teal-700)]",
  "bg-[var(--color-purple-600)]",
]

function colorFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function iconFor(row: ActivityRow) {
  const text = (row.verb ?? "") + " " + row.summary.toLowerCase()
  if (/approv|complet|done/.test(text)) return CheckCircle2
  if (/submit|sent|request/.test(text)) return Send
  if (/comment|note/.test(text)) return MessageSquare
  if (/asset|upload|file/.test(text) || row.asset_id) return FilePlus2
  if (/task/.test(text) || row.task_id) return ListChecks
  if (/project/.test(text) || row.project_id) return FolderKanban
  return Sparkles
}

function hrefFor(a: ActivityRow) {
  return a.asset_id
    ? "/assets/" + a.asset_id
    : a.campaign_id
      ? "/workspaces/marketing/campaigns/" + a.campaign_id
      : a.project_id
        ? "/projects/" + a.project_id
        : "/activity"
}

const fullDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })

/** Remembers which rows were already shown, so only new ones slide in. */
function useNewRowIds(ids: string[]) {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const key = ids.join(",")
  useEffect(() => {
    const list = key ? key.split(",") : []
    if (seen.current === null) {
      seen.current = new Set(list)
      return
    }
    const added = list.filter((id) => !seen.current!.has(id))
    list.forEach((id) => seen.current!.add(id))
    if (!added.length) return
    const show = window.setTimeout(() => setFresh(new Set(added)), 0)
    const clear = window.setTimeout(() => setFresh(new Set()), 2000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(clear)
    }
  }, [key])
  return fresh
}

export function LiveActivityList({ limit = 100 }: { limit?: number }) {
  const { result, refresh } = useLiveWorkspace()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(tick)
  }, [])
  const rows = result?.status === "ready" ? (result.activity as ActivityRow[]).slice(0, limit) : []
  const fresh = useNewRowIds(rows.map((row) => row.id))

  if (!result)
    return (
      <ul className="grid gap-4" aria-busy="true" aria-label="Loading activity">
        {Array.from({ length: Math.min(limit, 4) }, (_, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="roaya-skeleton size-8 rounded-full" />
            <span className="grid flex-1 gap-2">
              <span className="roaya-skeleton h-3 w-4/5 rounded" />
              <span className="roaya-skeleton h-2.5 w-1/4 rounded" />
            </span>
          </li>
        ))}
      </ul>
    )
  if (result.status !== "ready")
    return (
      <div className="grid gap-3 text-sm">
        <p>Activity could not be loaded.</p>
        <Button className="w-fit" variant="outline" onClick={refresh}>
          Retry
        </Button>
      </div>
    )
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">No activity to show yet.</p>

  return (
    <ul className="divide-y divide-border">
      {rows.map((a) => {
        const name = a.isMine ? "You" : a.actorName || "Someone"
        const Icon = iconFor(a)
        return (
          <li key={a.id} className={"flex gap-3 py-3 " + (fresh.has(a.id) ? "roaya-feed-new" : "")}>
            <span className="relative shrink-0">
              <span
                className={
                  "flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white " +
                  (a.actorName || a.isMine ? colorFor(a.actorName ?? name) : "bg-muted-foreground/40")
                }
                aria-hidden
              >
                {a.actorName ? initials(a.actorName) : a.isMine ? "Y" : "•"}
              </span>
              <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-background bg-card text-primary" aria-hidden>
                <Icon className="size-2.5" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <Link className="text-sm leading-6 hover:text-primary" href={hrefFor(a)}>
                {a.actorName || a.isMine ? <span className="font-medium">{name}: </span> : null}
                {a.summary}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <time dateTime={a.created_at} title={fullDate.format(new Date(a.created_at))}>
                  {relativeTime(a.created_at, now)}
                </time>
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ActivityFeed() {
  return (
    <div className="roaya-glass p-5">
      <LiveActivityList />
    </div>
  )
}
