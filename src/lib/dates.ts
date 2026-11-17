const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function isIsoDate(value: string) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value)
}

export function formatIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value ? value : "Not set"
  const month = months[Number(match[2]) - 1]
  if (!month) return value
  return `${month} ${Number(match[3])}, ${match[1]}`
}

export function dateRange(start: string, end: string) {
  if (!start && !end) return "Dates not set"
  if (!end) return `Starts ${formatIsoDate(start)}`
  if (!start) return `Due ${formatIsoDate(end)}`
  return `${formatIsoDate(start)} – ${formatIsoDate(end)}`
}

export function formatStamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!match) return value || "Not set"
  const date = formatIsoDate(`${match[1]}-${match[2]}-${match[3]}`)
  if (!match[4] || !match[5]) return date
  const hour = Number(match[4])
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${date}, ${hour12}:${match[5]} ${suffix}`
}

export function nowStamp() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function endDateError(start: string, end: string) {
  if (start && end && end < start) {
    return "End date cannot be earlier than the start date."
  }
  return null
}
