import { describe, expect, it } from "vitest"

import { dayHeading, describeEvent, type ActivityEventRow } from "./activity-events"

const row = (summary: string, verb: string | null, extra: Partial<ActivityEventRow> = {}): ActivityEventRow => ({
  id: "1",
  summary,
  verb,
  project_id: "p",
  campaign_id: null,
  asset_id: null,
  task_id: "t",
  created_at: "2026-11-25T14:00:00Z",
  ...extra,
})

describe("activity events", () => {
  it("describes review events and strips the repeated prefix", () => {
    expect(describeEvent(row("Work submitted for review: i want access on the project", "task_submitted"))).toEqual({
      kind: "reviews",
      action: "Submitted",
      tone: "purple",
      title: "i want access on the project",
    })
    expect(describeEvent(row("Work approved: Workflow check — prepare a draft", "task_approved"))).toMatchObject({ action: "Approved", tone: "green", title: "Workflow check — prepare a draft" })
    expect(describeEvent(row("Changes requested: Workflow check", "task_changes_requested"))).toMatchObject({ action: "Changes requested", tone: "amber" })
  })

  it("handles deliverable approvals, files, projects and unknown verbs", () => {
    expect(describeEvent(row("approved “Launch deck”", "approved", { task_id: null }))).toMatchObject({ kind: "reviews", title: "Launch deck" })
    expect(describeEvent(row("Uploaded logo.png", "asset_uploaded", { asset_id: "a", task_id: null }))).toMatchObject({ kind: "files", tone: "teal" })
    expect(describeEvent(row("Created project Winter", "project_created", { task_id: null }))).toMatchObject({ kind: "projects", action: "Created" })
    expect(describeEvent(row("Something", "status_changed", { task_id: null, project_id: null }))).toMatchObject({ kind: "other", action: "Status changed" })
  })

  it("labels days", () => {
    const today = "2026-11-26"
    expect(dayHeading("2026-11-26", today)).toBe("Today")
    expect(dayHeading("2026-11-25", today)).toBe("Yesterday")
    expect(dayHeading("2026-11-23", today)).toBe("Monday")
    expect(dayHeading("2026-11-16", today)).toBe("Mon 16 Nov")
  })
})
