import { beforeEach, describe, expect, it, vi } from "vitest"
import { getMyProjectInvitations } from "@/lib/auth/project-invitation-actions"
const state = vi.hoisted(() => ({ signedIn: true, unavailable: false, failedOrganization: "", organizations: [{ id: "org-a", name: "Company A" }, { id: "org-b", name: "Company B" }], calls: [] as string[] }))
vi.mock("@/lib/auth/current-organizations", () => ({ getAccessibleOrganizations: async () => state.unavailable ? { status: "unavailable" } : { status: "ready", organizations: state.organizations } }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
 auth: { getUser: async () => ({ error: null, data: { user: state.signedIn ? { id: "recipient" } : null } }) },
 rpc: async (name: string, args: { target_organization: string }) => {
  if (name === "my_project_task_invitations") return { data: [], error: null }
  expect(name).toBe("my_project_invitations")
  state.calls.push(args.target_organization)
  return args.target_organization === state.failedOrganization ? { data: null, error: { code: "42501" } } : { error: null, data: [{ id: "invite-" + args.target_organization, project_id: "project-" + args.target_organization, project_name: "Invited project", history_access: "assigned_only" }] }
 },
}) }))
beforeEach(() => { state.signedIn = true; state.unavailable = false; state.failedOrganization = ""; state.organizations = [{ id: "org-a", name: "Company A" }, { id: "org-b", name: "Company B" }]; state.calls.length = 0 })
describe("recipient invitation inbox", () => {
 it("loads invitations from every authorized organization without requiring a selected organization", async () => {
  const result = await getMyProjectInvitations()
  expect(state.calls).toEqual(["org-a", "org-b"])
  expect(result).toEqual({ status: "ready", invitations: state.organizations.map(org => ({ id: "invite-" + org.id, projectId: "project-" + org.id, projectName: "Invited project", organizationId: org.id, organizationName: org.name, historyAccess: "assigned_only" })) })
 })
 it("requires a signed-in recipient before requesting invitations", async () => {
  state.signedIn = false
  expect(await getMyProjectInvitations()).toEqual({ status: "error" })
  expect(state.calls).toEqual([])
 })
 it("returns an empty inbox when there are no organization memberships", async () => {
  state.organizations = []
  expect(await getMyProjectInvitations()).toEqual({ status: "ready", invitations: [] })
  expect(state.calls).toEqual([])
 })
 it("reports an organization access failure instead of claiming there are no invitations", async () => {
  state.unavailable = true
  expect(await getMyProjectInvitations()).toEqual({ status: "error" })
  expect(state.calls).toEqual([])
 })
 it("reports an invitation RPC failure instead of returning a misleading partial inbox", async () => {
  state.failedOrganization = "org-b"
  expect(await getMyProjectInvitations()).toEqual({ status: "error" })
 })
})
