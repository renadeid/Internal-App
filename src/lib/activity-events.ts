import { daysBetween } from "./dashboard-dates"

export type ActivityKind = "reviews" | "projects" | "tasks" | "files" | "requests" | "other"
export type ActivityTone = "green" | "purple" | "amber" | "navy" | "teal" | "muted"

export type ActivityEventRow = {
  id: string
  summary: string
  verb?: string | null
  actorName?: string | null
  isMine?: boolean
  actor_id?: string | null
  project_id: string | null
  campaign_id: string | null
  asset_id: string | null
  task_id?: string | null
  created_at: string
}

export type DescribedEvent = { kind: ActivityKind; action: string; tone: ActivityTone; title: string }

const prefixes = [
  "Work submitted for review: ",
  "Work approved: ",
  "Changes requested: ",
  "Uploaded ",
]

function titleFrom(summary: string) {
  const text = summary.trim()
  for (const prefix of prefixes) if (text.startsWith(prefix)) return text.slice(prefix.length).trim()
  const quoted = text.match(/[“"]([^”"]+)[”"]/)
  if (quoted) return quoted[1].trim()
  return text
}

/** Turns an activity row into a kind (for filters), a short action label, a color and the item's name. */
export function describeEvent(row: ActivityEventRow): DescribedEvent {
  const verb = (row.verb ?? "").toLowerCase()
  const text = row.summary.toLowerCase()
  const title = titleFrom(row.summary)
  if (verb === "task_approved" || verb === "approved" || text.startsWith("work approved")) return { kind: "reviews", action: "Approved", tone: "green", title }
  if (verb === "task_changes_requested" || text.startsWith("changes requested")) return { kind: "reviews", action: "Changes requested", tone: "amber", title }
  if (verb === "task_submitted" || verb === "submitted" || text.startsWith("work submitted")) return { kind: "reviews", action: "Submitted", tone: "purple", title }
  if (verb.includes("request") || text.includes("request")) return { kind: "requests", action: "Request", tone: "amber", title }
  if (row.asset_id || /asset|upload|file|artifact/.test(verb)) return { kind: "files", action: verb.includes("upload") || !verb ? "Uploaded" : humanize(verb), tone: "teal", title }
  if (verb.startsWith("project") || (!row.task_id && row.project_id && /project/.test(text))) return { kind: "projects", action: verb ? humanize(verb.replace(/^project_/, "")) : "Project", tone: "navy", title }
  if (verb.startsWith("task") || row.task_id) return { kind: "tasks", action: verb ? humanize(verb.replace(/^task_/, "")) : "Task", tone: "navy", title }
  return { kind: "other", action: verb ? humanize(verb) : "Update", tone: "muted", title }
}

function humanize(value: string) {
  const words = value.replaceAll("_", " ").trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Update"
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" })
const fullDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

/** "Today", "Yesterday", a weekday within the last week, then "Mon 16 Nov". */
export function dayHeading(dayKey: string, today: string) {
  const ago = daysBetween(dayKey, today)
  const [y, m, d] = dayKey.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (ago === 0) return "Today"
  if (ago === 1) return "Yesterday"
  if (ago > 1 && ago < 7) return weekday.format(date)
  return fullDay.format(date)
}

export const activityFilters: { key: ActivityKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reviews", label: "Reviews" },
  { key: "tasks", label: "Tasks" },
  { key: "projects", label: "Projects" },
  { key: "files", label: "Files" },
  { key: "requests", label: "Requests" },
]
