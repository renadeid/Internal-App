import { describe, expect, it } from "vitest"

import type { OrganizationProject } from "@/lib/auth/organization-projects"
import { buildProjectRows, matchesPortfolioFilter, portfolioSummary, sortProjectRows, updatedLabel } from "./project-portfolio"

const project = (id: string, name: string, status: OrganizationProject["status"], dueOn: string | null, ownerId = "u1", updatedOn = "2026-11-20"): OrganizationProject => ({
  id,
  name,
  description: "",
  status,
  leadDepartmentId: "d",
  leadDepartment: "Marketing",
  ownerId,
  ownerName: ownerId === "u1" ? "Renad" : "Aya",
  startsOn: null,
  dueOn,
  archivedAt: null,
  updatedOn,
})

const today = "2026-11-26"
const projects = [
  project("a", "ayatest", "planning", "2026-11-27"),
  project("b", "test invite", "planning", "2026-11-19", "u2", "2026-11-25"),
  project("c", "Marketing Test", "on_hold", "2026-11-30", "u2"),
]
const tasks = [
  { projectId: "a", status: "done", assigneeId: "u2", assigneeName: "Aya" },
  { projectId: "a", status: "done", assigneeId: "u3", assigneeName: "Mohamed" },
  { projectId: "a", status: "todo", assigneeId: "u2", assigneeName: "Aya" },
  { projectId: "a", status: "todo", assigneeId: null, assigneeName: null },
  { projectId: "a", status: "in_review", assigneeId: "u1", assigneeName: "Renad" },
  { projectId: "c", status: "todo", assigneeId: "u1", assigneeName: "Renad" },
]

describe("project portfolio", () => {
  const rows = buildProjectRows(projects, tasks, "u1", today)

  it("computes progress, team, late and mine", () => {
    expect(rows[0]).toMatchObject({ total: 5, done: 2, percent: 40, late: false, mine: true })
    expect(rows[0].team.map((m) => m.name)).toEqual(["Renad", "Aya", "Mohamed"])
    expect(rows[1]).toMatchObject({ total: 0, percent: 0, late: true, mine: false })
    expect(rows[1].due.label).toBe("7 days late")
    expect(rows[2].mine).toBe(true)
  })

  it("summarises and filters", () => {
    expect(portfolioSummary(rows)).toEqual({ active: 2, onHold: 1, late: 1, averageProgress: 20 })
    expect(rows.filter((r) => matchesPortfolioFilter(r, "late")).map((r) => r.project.id)).toEqual(["b"])
    expect(rows.filter((r) => matchesPortfolioFilter(r, "on_hold")).map((r) => r.project.id)).toEqual(["c"])
  })

  it("sorts with pinned projects first", () => {
    expect(sortProjectRows(rows, "due").map((r) => r.project.id)).toEqual(["b", "a", "c"])
    expect(sortProjectRows(rows, "progress").map((r) => r.project.id)[0]).toBe("a")
    expect(sortProjectRows(rows, "updated").map((r) => r.project.id)[0]).toBe("b")
    expect(sortProjectRows(rows, "due", new Set(["c"])).map((r) => r.project.id)).toEqual(["c", "b", "a"])
  })

  it("labels updates", () => {
    expect(updatedLabel("2026-11-26", today)).toBe("Updated today")
    expect(updatedLabel("2026-11-25", today)).toBe("Updated yesterday")
    expect(updatedLabel("2026-11-19", today)).toBe("Updated 7 days ago")
    expect(updatedLabel("2026-09-01", today)).toBe("Updated 1 Sept 2026")
    expect(updatedLabel(null, today)).toBe("")
  })
})
