export const dashboardTimeZone = "Africa/Cairo"

/** Today's date (YYYY-MM-DD) in Roaya's time zone. */
export function localDateKey(now: Date, timeZone = dashboardTimeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

function dayNumber(key: string) {
  const [y, m, d] = key.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return dayNumber(to) - dayNumber(from)
}

export type DueGroup = "overdue" | "today" | "week" | "later" | "none"

export type DueInfo = { group: DueGroup; label: string; days: number | null }

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" })
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

function keyToUtcDate(key: string) {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Groups a due date relative to today: overdue, today, within the next 7 days, later, or none. */
export function dueInfo(dueOn: string | null | undefined, today: string): DueInfo {
  if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { group: "none", label: "No due date", days: null }
  const days = daysBetween(today, dueOn)
  if (days < 0) {
    const late = -days
    return { group: "overdue", label: late === 1 ? "1 day late" : `${late} days late`, days }
  }
  if (days === 0) return { group: "today", label: "Due today", days }
  if (days === 1) return { group: "week", label: "Tomorrow", days }
  if (days <= 6) return { group: "week", label: weekday.format(keyToUtcDate(dueOn)), days }
  return { group: "later", label: shortDate.format(keyToUtcDate(dueOn)), days }
}

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then a short date. */
export function relativeTime(iso: string, now: Date, timeZone = dashboardTimeZone) {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (!Number.isFinite(seconds)) return ""
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  const days = daysBetween(localDateKey(then, timeZone), localDateKey(now, timeZone))
  if (days === 0) return `${hours} h ago`
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(then)
}

export function greetingFor(now: Date, timeZone = dashboardTimeZone) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now))
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export function longDate(now: Date, timeZone = dashboardTimeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now)
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase()
}
