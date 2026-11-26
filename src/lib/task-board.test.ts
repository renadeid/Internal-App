import { describe, expect, it } from "vitest"

import type { OrganizationTask } from "@/lib/auth/organization-tasks"
import { canChangeStatus, groupTasksByDue, quickNextStatus } from "./task-board"

const task = (id: string, overrides: Partial<OrganizationTask> = {}): OrganizationTask => ({
  id,
  projectId: "p",
  projectName: "ayatest",
  title: id,
  description: "",
  status: "todo",
  priority: "medium",
  assigneeId: "u1",
  assigneeName: "Renad",
  dueOn: null,
  archivedAt: null,
  canWrite: true,
  ...overrides,
})

describe("task board", () => {
  const today = "2026-11-26"

  it("groups by due date with overdue first and done last", () => {
    const groups = groupTasksByDue(
      [
        task("later", { dueOn: "2026-12-10" }),
        task("none"),
        task("late-low", { dueOn: "2026-11-25", priority: "low" }),
        task("late-urgent", { dueOn: "2026-11-25", priority: "urgent" }),
        task("very-late", { dueOn: "2026-11-16" }),
        task("today", { dueOn: "2026-11-26" }),
        task("fri", { dueOn: "2026-11-27" }),
        task("finished", { status: "done", dueOn: "2026-11-01" }),
      ],
      today,
      "due"
    )
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "week", "later", "none", "done"])
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["very-late", "late-urgent", "late-low"])
  })

  it("sorts by priority inside a group", () => {
    const [overdue] = groupTasksByDue([task("a", { dueOn: "2026-11-16" }), task("b", { dueOn: "2026-11-25", priority: "urgent" })], today, "priority")
    expect(overdue.tasks.map((t) => t.id)).toEqual(["b", "a"])
  })

  it("only allows To do / In progress changes for people who may update", () => {
    expect(canChangeStatus(task("a"))).toBe(true)
    expect(canChangeStatus(task("a", { canWrite: false, canUpdateStatus: true, status: "in_progress" }))).toBe(true)
    expect(canChangeStatus(task("a", { canWrite: false }))).toBe(false)
    expect(canChangeStatus(task("a", { status: "in_review" }))).toBe(false)
    expect(canChangeStatus(task("a", { status: "done" }))).toBe(false)
    expect(canChangeStatus(task("a", { archivedAt: "2026-11-01" }))).toBe(false)
    expect(quickNextStatus("todo")).toBe("in_progress")
    expect(quickNextStatus("in_progress")).toBe("todo")
    expect(quickNextStatus("in_review")).toBeNull()
  })
})
