import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveProjectMember, setOrganizationRole } from "@/lib/auth/super-admin-actions"

const state = vi.hoisted(() => ({
  admin: true,
  existing: true,
  failed: false,
  rpcCalls: 0,
  rpcArguments: [] as unknown[][],
  writes: [] as { operation: string; payload: Record<string, unknown>; filters: Record<string, unknown> }[],
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    rpc: async (...args: unknown[]) => { state.rpcCalls++; state.rpcArguments.push(args); return { error: null } },
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let operation = "select"
      let payload: Record<string, unknown> = {}
      const query = {
        select() { return query },
        eq(key: string, value: unknown) { filters[key] = value; return query },
        update(value: Record<string, unknown>) { operation = "update"; payload = value; return query },
        insert(value: Record<string, unknown>) { operation = "insert"; payload = value; return query },
        async maybeSingle() {
          if (table === "organization_memberships") return { data: { role: filters.profile_id === "admin" ? (state.admin ? "org_admin" : "member") : "member" }, error: null }
          if (table === "projects") return { data: { owner_id: "owner", archived_at: null }, error: null }
          if (table === "project_members") return { data: state.existing ? { profile_id: "member" } : null, error: null }
          throw new Error("Unexpected table")
        },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          state.writes.push({ operation, payload, filters: { ...filters } })
          return Promise.resolve({ data: operation === "update" ? [{ profile_id: "member" }] : null, error: state.failed ? { code: "42501" } : null }).then(resolve, reject)
        },
      }
      return query
    },
  }),
}))
const permissions = { edit: false, manageMembers: false, approve: false, manageAssets: false }
beforeEach(() => { state.admin = true; state.existing = true; state.failed = false; state.writes.length = 0; state.rpcCalls = 0; state.rpcArguments.length = 0 })
describe("saving project history access", () => {
 it("sends explicit selected task and status options with the recipient scope", async()=>{
  state.existing=false
  const taskId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  await expect(saveProjectMember("org","project","member",permissions,"invite","assigned_only",{taskIds:[taskId],canUpdateStatus:true})).resolves.toMatchObject({ok:true})
  expect(state.rpcArguments[0]).toEqual(["admin_invite_project_tasks",{target_organization:"org",target_project:"project",target_profile:"member",target_history_access:"assigned_only",selected_tasks:[taskId],allow_status_update:true}])
 })
 it("rejects task options combined with full history before mutation",async()=>{
  await expect(saveProjectMember("org","project","member",permissions,"invite","full_history",{taskIds:[],canUpdateStatus:true})).resolves.toMatchObject({ok:false})
  expect(state.rpcCalls).toBe(0)
 })
  it("updates only mutable columns and scopes the existing membership", async () => {
    await expect(saveProjectMember("org", "project", "member", permissions, "save", "full_history")).resolves.toEqual({ ok: true, message: "Project access saved." })
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]).toEqual({ operation: "update", filters: { organization_id: "org", project_id: "project", profile_id: "member" }, payload: {
      history_access: "full_history", role: "project_member", can_edit: false, can_manage_members: false, can_approve_deliverables: false, can_manage_assets: false,
    } })
  })
  it("inserts identity columns only for a new membership", async () => {
    state.existing = false
    await expect(saveProjectMember("org", "project", "member", permissions, "save", "assigned_only")).resolves.toMatchObject({ ok: true })
    expect(state.writes[0]).toMatchObject({ operation: "insert", payload: { organization_id: "org", project_id: "project", profile_id: "member", history_access: "assigned_only" } })
  })
  it("rejects a non-admin before mutation", async () => {
    state.admin = false
    await expect(saveProjectMember("org", "project", "member", permissions, "save", "full_history")).resolves.toMatchObject({ ok: false })
    expect(state.writes).toEqual([])
  })
  it("reports a denied database update as a failure", async () => {
    state.failed = true
    await expect(saveProjectMember("org", "project", "member", permissions, "save", "full_history")).resolves.toMatchObject({ ok: false })
  })
})


it("does not claim to send an invitation to an existing project member", async () => {
 await expect(saveProjectMember("org", "project", "member", permissions, "invite", "assigned_only")).resolves.toEqual({ ok: false, message: "This member already has project access. Use Save member access to change their permissions." })
 expect(state.writes).toEqual([])
})




describe("in-app invitation creation", () => {
 it("creates a pending invitation after authorizing the admin", async () => {
  state.existing = false
  await expect(saveProjectMember("org", "project", "member", permissions, "invite", "assigned_only")).resolves.toEqual({ ok: true, message: "Project invitation sent in the app." })
  expect(state.rpcCalls).toBe(1)
 })
 it("denies invitation creation for non-admins", async () => {
  state.admin = false; state.existing = false
  await expect(saveProjectMember("org", "project", "member", permissions, "invite", "assigned_only")).resolves.toMatchObject({ ok: false })
  expect(state.rpcCalls).toBe(0)
 })
})


describe("assigning the Admin role", () => {
 it("lets a Super admin assign Owner (Team lead)", async () => {
  await expect(setOrganizationRole("org", "member", "team_lead")).resolves.toMatchObject({ ok: true })
  expect(state.writes[0]).toMatchObject({ payload: { role: "team_lead" } })
 })
 it("lets a Super admin assign the new role", async () => {
  await expect(setOrganizationRole("org", "member", "admin")).resolves.toEqual({ ok: true, message: "Role updated." })
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0]).toMatchObject({ operation: "update", payload: { role: "admin" }, filters: { organization_id: "org", profile_id: "member" } })
 })
 it("does not let a non-Super-admin assign roles", async () => {
  state.admin = false
  await expect(setOrganizationRole("org", "member", "admin")).resolves.toMatchObject({ ok: false })
  expect(state.writes).toEqual([])
 })
})
