import { beforeEach, expect, it, vi } from "vitest"
import { deleteOrganizationProject } from "@/lib/auth/project-update-actions"

const state = vi.hoisted(() => ({ role: "org_admin", selected: true, signedIn: true, result: { data: true as boolean | null, error: null as null | { code: string } }, rpc: vi.fn() }))
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const input = { organizationId: org, projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", confirmationName: "Project" }
vi.mock("@/lib/auth/current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.selected ? [{ id: org }] : [] }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: "user" } : null } }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { role: state.role }, error: null }) }; return q },
  rpc: (...args: unknown[]) => { state.rpc(...args); return Promise.resolve(state.result) },
}) }))
beforeEach(() => { state.role = "org_admin"; state.selected = true; state.signedIn = true; state.result = { data: true, error: null }; state.rpc.mockClear() })
it.each(["admin", "member", "viewer"])("rejects %s before the deletion RPC", async role => {
  state.role = role
  expect(await deleteOrganizationProject(input)).toEqual({ status: "denied" })
  expect(state.rpc).not.toHaveBeenCalled()
})
it("checks organization access and authentication", async () => {
  state.selected = false
  expect(await deleteOrganizationProject(input)).toEqual({ status: "rejected" })
  state.selected = true; state.signedIn = false
  expect(await deleteOrganizationProject(input)).toEqual({ status: "rejected" })
  expect(state.rpc).not.toHaveBeenCalled()
})
it("passes scoped project and confirmation to the authenticated RPC", async () => {
  expect(await deleteOrganizationProject(input)).toEqual({ status: "updated" })
  expect(state.rpc).toHaveBeenCalledWith("admin_delete_project", { target_organization: org, target_project: input.projectId, confirmation_name: "Project" })
})
it("does not report success for missing projects or wrong confirmation", async () => {
  state.result.data = false
  expect(await deleteOrganizationProject(input)).toEqual({ status: "unavailable" })
  state.result.error = { code: "22023" }
  expect(await deleteOrganizationProject(input)).toMatchObject({ status: "invalid" })
})
