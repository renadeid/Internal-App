import { describe, expect, it } from "vitest"

import { daysBetween, dueInfo, greetingFor, initials, localDateKey, relativeTime } from "./dashboard-dates"

describe("dashboard dates", () => {
  it("uses Cairo's calendar day", () => {
    // 23:30 UTC on 25 Nov is already 26 Nov in Cairo (UTC+2)
    expect(localDateKey(new Date("2026-11-25T23:30:00Z"))).toBe("2026-11-26")
  })

  it("counts days across months", () => {
    expect(daysBetween("2026-11-26", "2026-12-01")).toBe(5)
    expect(daysBetween("2026-11-26", "2026-11-16")).toBe(-10)
  })

  it("groups due dates", () => {
    const today = "2026-11-26"
    expect(dueInfo("2026-11-16", today)).toEqual({ group: "overdue", label: "10 days late", days: -10 })
    expect(dueInfo("2026-11-25", today).label).toBe("1 day late")
    expect(dueInfo("2026-11-26", today)).toMatchObject({ group: "today", label: "Due today" })
    expect(dueInfo("2026-11-27", today)).toMatchObject({ group: "week", label: "Tomorrow" })
    expect(dueInfo("2026-11-28", today)).toMatchObject({ group: "week", label: "Sat" })
    expect(dueInfo("2026-12-02", today)).toMatchObject({ group: "week", label: "Wed" })
    expect(dueInfo("2026-12-03", today)).toMatchObject({ group: "later", label: "3 Dec" })
    expect(dueInfo(null, today)).toMatchObject({ group: "none" })
    expect(dueInfo("not a date", today)).toMatchObject({ group: "none" })
  })

  it("formats relative times", () => {
    const now = new Date("2026-11-26T12:00:00Z")
    expect(relativeTime("2026-11-26T11:59:30Z", now)).toBe("just now")
    expect(relativeTime("2026-11-26T11:55:00Z", now)).toBe("5 min ago")
    expect(relativeTime("2026-11-26T10:00:00Z", now)).toBe("2 h ago")
    expect(relativeTime("2026-11-25T14:27:00Z", now)).toBe("yesterday")
    expect(relativeTime("2026-11-23T10:00:00Z", now)).toBe("3 days ago")
    expect(relativeTime("2026-11-10T10:00:00Z", now)).toBe("10 Nov")
  })

  it("greets by Cairo time and builds initials", () => {
    expect(greetingFor(new Date("2026-11-26T07:00:00Z"))).toBe("Good morning")
    expect(greetingFor(new Date("2026-11-26T11:00:00Z"))).toBe("Good afternoon")
    expect(greetingFor(new Date("2026-11-26T18:00:00Z"))).toBe("Good evening")
    expect(initials("Aya Hassan")).toBe("AH")
    expect(initials("renad")).toBe("R")
    expect(initials("")).toBe("?")
  })
})
