import { beforeEach, expect, it, vi } from "vitest"
import { createOrganizationProject, getProjectCreationAccess } from "./project-creation-actions"
import { getProjectCreationPermissions, setProjectCreationPermission } from "./project-creation-permissions"

const state = vi.hoisted(() => ({ role: "member", grant: false, grantError: false, signedIn: true, workspace: true, inserts: [] as unknown[], rpcs: [] as string[], targetValid: true }))
vi.mock("./current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.workspace ? [{ id: "org" }] : [] }) }))
vi.mock("./get-organization-people", () => ({ getOrganizationPeople: async () => ({ status: "ready", people: [{ profileId: "member", name: "Member", email: "member@example.test", role: "member" }, { profileId: "viewer", role: "viewer" }] }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: "actor" } : null }, error: null }) },
  rpc: async (name: string) => {
    state.rpcs.push(name)
    if (name === "has_project_creation_permission") return { data: state.grant, error: state.grantError ? { code: "error" } : null }
    return { data: null, error: state.targetValid ? null : { code: "22023" } }
  },
  from: (table: string) => {
    const filters: Record<string, string> = {}
    const q = {
      select: () => q, order: () => q, in: () => q,
      eq: (key: string, value: string) => { filters[key] = value; return q },
      insert: async (payload: unknown) => { state.inserts.push(payload); return { error: null } },
      maybeSingle: async () => ({ error: null, data: table === "organization_memberships" ? { role: state.role, profile_id: "actor" } : table === "departments" ? { id: "department" } : null }),
      then: (resolve: (value: unknown) => unknown) => {
        const data = table === "departments" ? [{ id: "department", name: "Marketing" }] : table === "organization_memberships" ? [{ profile_id: "actor" }] : table === "profiles" ? [{ id: "actor", full_name: "Member", email: "member@example.test" }] : table === "project_creation_grants" ? state.grant ? [{ profile_id: "member" }] : [] : []
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return q
  },
}) }))

const input = { organizationId: "org", name: "New project", description: "Brief", leadDepartmentId: "department", ownerId: "actor", startsOn: null, dueOn: null }
beforeEach(() => { Object.assign(state, { role: "member", grant: false, grantError: false, signedIn: true, workspace: true, inserts: [], rpcs: [], targetValid: true }) })

it("denies Member creation without an explicit grant", async () => {
  expect(await getProjectCreationAccess("org")).toMatchObject({ canCreate: false })
  expect(await createOrganizationProject(input)).toEqual({ status: "denied" })
  expect(state.inserts).toEqual([])
})
it("allows a granted Member to create a project without changing their role", async () => {
  state.grant = true
  expect(await getProjectCreationAccess("org")).toMatchObject({ canCreate: true, isSuperAdmin: false, departments: [{ id: "department", name: "Marketing" }] })
  expect(await createOrganizationProject(input)).toMatchObject({ status: "created" })
  expect(state.inserts).toHaveLength(1)
})
it("rechecks a revoked grant on submission even after opening the dialog", async () => {
  state.grant = true
  expect(await getProjectCreationAccess("org")).toMatchObject({ canCreate: true })
  state.grant = false
  expect(await createOrganizationProject(input)).toEqual({ status: "denied" })
  expect(state.inserts).toEqual([])
})
it("fails closed when permission lookup fails", async () => {
  state.grantError = true
  expect(await createOrganizationProject(input)).toEqual({ status: "error" })
  expect(state.inserts).toEqual([])
})
it.each(["admin", "viewer"])("never grants project creation to %s via a stale Member grant", async role => {
  state.role = role; state.grant = true
  expect(await createOrganizationProject(input)).toEqual({ status: "denied" })
  expect(state.inserts).toEqual([])
})
it("preserves Super admin creation without requiring a grant", async () => {
  state.role = "org_admin"
  expect(await createOrganizationProject(input)).toMatchObject({ status: "created" })
  expect(state.rpcs).not.toContain("has_project_creation_permission")
})
it.each(["org_admin", "team_lead"])("allows %s to manage Member grants", async role => {
  state.role = role; state.grant = true
  expect(await getProjectCreationPermissions("org")).toMatchObject({ status: "ready", members: [{ id: "member", canCreate: true }] })
  expect((await setProjectCreationPermission("org", "member", true)).ok).toBe(true)
  expect((await setProjectCreationPermission("org", "member", false)).ok).toBe(true)
})
it.each(["member", "admin", "viewer"])("denies grant management to %s before the database mutation", async role => {
  state.role = role
  expect(await getProjectCreationPermissions("org")).toEqual({ status: "denied" })
  expect((await setProjectCreationPermission("org", "member", true)).ok).toBe(false)
  expect(state.rpcs).not.toContain("set_project_creation_permission")
})
it("reports a cross-workspace or non-Member target rejected by the database", async () => {
  state.role = "team_lead"; state.targetValid = false
  expect((await setProjectCreationPermission("org", "outsider", true)).ok).toBe(false)
})
it("rejects signed-out creation and grant management", async () => {
  state.signedIn = false
  expect(await createOrganizationProject(input)).toEqual({ status: "rejected" })
  expect((await setProjectCreationPermission("org", "member", true)).ok).toBe(false)
  expect(state.inserts).toEqual([])
  expect(state.rpcs).toEqual([])
})
it("rejects creation in an inaccessible workspace", async () => {
  state.workspace = false; state.grant = true
  expect(await createOrganizationProject(input)).toEqual({ status: "rejected" })
  expect(state.inserts).toEqual([])
})
