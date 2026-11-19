import { beforeEach, describe, expect, it, vi } from "vitest"
import { createOrganizationTask, getTaskCreationAccess, setOrganizationTaskArchived, setOrganizationTaskStatus, updateOrganizationTask } from "@/lib/auth/task-creation-actions"
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", task = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const state = vi.hoisted(() => ({ role: "admin", writes: [] as string[] }))
vi.mock("@/lib/auth/current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Company" }] }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
 auth: { getUser: async () => ({ data: { user: { id: "editor" } } }) },
 from(table: string) {
  let operation = "select"
  const query = {
   select() { return query }, eq() { return query }, is() { return query }, filter() { return query }, in() { return query },
   insert() { operation = "insert"; return query }, update() { operation = "update"; return query },
   async maybeSingle() { return { error: null, data: table === "organization_memberships" ? { role: state.role } : { id: "id", archived_at: null } } },
   then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
    if (operation !== "select") state.writes.push(operation)
    const data = table === "project_members" ? [{ profile_id: "assignee" }] : table === "profiles" ? [{ id: "assignee", full_name: "Employee", email: "employee@example.test" }] : []
    return Promise.resolve({ data, error: null, count: 1 }).then(resolve, reject)
   },
  }
  return query
 },
}) }))
const input = { organizationId: org, projectId: project, title: "Existing task", description: "Edit", priority: "medium" as const, status: "in_progress" as const, dueOn: null, assigneeId: null }
beforeEach(() => { state.role = "admin"; state.writes.length = 0 })
describe("Admin task capabilities", () => {
 it("offers Team lead task creation and editing without archive", async () => {
  state.role = "team_lead"
  await expect(getTaskCreationAccess(org, project)).resolves.toMatchObject({ status: "ready", canCreate: true, canEdit: true, canArchive: false })
  await expect(createOrganizationTask(input)).resolves.toMatchObject({ status: "created" })
  await expect(updateOrganizationTask({ ...input, taskId: task })).resolves.toEqual({ status: "updated" })
  await expect(setOrganizationTaskArchived({ organizationId: org, projectId: project, taskId: task, archived: true })).resolves.toEqual({ status: "denied" })
 })
 it("offers task editing without create or archive controls", async () => {
  await expect(getTaskCreationAccess(org, project)).resolves.toMatchObject({ status: "ready", canCreate: false, canEdit: true, canArchive: false, assignees: [{ id: "assignee", name: "Employee" }] })
 })
 it("denies direct task creation", async () => {
  await expect(createOrganizationTask(input)).resolves.toEqual({ status: "denied" })
  expect(state.writes).toEqual([])
 })
 it("allows updates to an existing task", async () => {
  await expect(updateOrganizationTask({ ...input, taskId: task })).resolves.toEqual({ status: "updated" })
  expect(state.writes).toEqual(["update"])
 })
 it("allows a status update", async () => {
  await expect(setOrganizationTaskStatus({ organizationId: org, projectId: project, taskId: task, status: "done" })).resolves.toEqual({ status: "updated" })
  expect(state.writes).toEqual(["update"])
 })
 it.each([true,false])("denies archive/restore (%s) before writing", async archived => {
  await expect(setOrganizationTaskArchived({ organizationId: org, projectId: project, taskId: task, archived })).resolves.toEqual({ status: "denied" })
  expect(state.writes).toEqual([])
 })
 it("retains Super admin create/archive capabilities", async () => {
  state.role = "org_admin"
  await expect(getTaskCreationAccess(org, project)).resolves.toMatchObject({ status: "ready", canCreate: true, canEdit: true, canArchive: true })
 })
})
