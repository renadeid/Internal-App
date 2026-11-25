import { beforeEach, expect, it, vi } from "vitest"
import { getSharedAssets } from "./shared-asset-actions"

const state = vi.hoisted(() => ({ allowed: true, failDepartments: false, queries: [] as { table: string; organization: string }[] }))
vi.mock("./current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.allowed ? [{ id: "org" }] : [] }) }))
vi.mock("@/lib/shared-asset-storage", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "actor" } }, error: null }) },
  rpc: async (name: string) => ({ error: null, data: name === "list_shared_assets" ? [{ id: "marketing-file", ownerId: "marketer" }, { id: "operations-file", ownerId: "operator" }, { id: "general-file", ownerId: "unassigned" }] : { role: "member", canUpload: true, projects: [] } }),
  from: (table: string) => {
    const query = { table, organization: "" }
    state.queries.push(query)
    const data = table === "departments" ? [{ id: "marketing", name: "Marketing" }, { id: "operations", name: "Operations" }, { id: "empty", name: "New department" }] : table === "department_memberships" ? [{ profile_id: "marketer", department_id: "marketing" }, { profile_id: "operator", department_id: "operations" }] : []
    const q = {
      select: () => q, order: () => q, eq: (_key: string, value: string) => { query.organization = value; return q },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: state.failDepartments && table === "departments" ? { message: "Unavailable" } : null }).then(resolve),
    }
    return q
  },
}) }))

beforeEach(() => { Object.assign(state, { allowed: true, failDepartments: false, queries: [] }) })

it("separates department files while retaining unassigned files in All assets", async () => {
  const result = await getSharedAssets("org")
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.message)
  expect(result.assets.map(asset => [asset.id, asset.departmentIds])).toEqual([["marketing-file", ["marketing"]], ["operations-file", ["operations"]], ["general-file", []]])
  expect(result.departments.map(department => department.id)).toEqual(["marketing", "operations", "empty"])
  expect(state.queries.every(query => query.organization === "org")).toBe(true)
})
it("rejects an inaccessible workspace before querying department data", async () => {
  state.allowed = false
  expect((await getSharedAssets("other")).ok).toBe(false)
  expect(state.queries).toEqual([])
})
it("reports department loading failures instead of showing incomplete results", async () => {
  state.failDepartments = true
  expect(await getSharedAssets("org")).toEqual({ ok: false, message: "Asset departments could not be loaded." })
})
