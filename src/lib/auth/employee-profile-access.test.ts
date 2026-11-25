import { beforeEach, expect, it, vi } from "vitest"
import { getEmployeeProfile } from "./employee-profile-actions"
import { getOrganizationProjects } from "./get-organization-projects"
import { getOrganizationTasks } from "./get-organization-tasks"

const state = vi.hoisted(() => ({ role: "member", signedIn: true, allowed: true, targetBelongs: true, tables: [] as string[] }))
vi.mock("./current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.allowed ? [{ id: "org" }] : [] }) }))
vi.mock("./get-organization-people", () => ({ getOrganizationPeople: async () => ({ status: "ready", people: [{ profileId: "employee" }] }) }))
vi.mock("./get-organization-projects", () => ({ getOrganizationProjects: vi.fn(async () => ({ status: "ready", projects: [{ id: "project", ownerId: "employee", archivedAt: null }] })) }))
vi.mock("./get-organization-tasks", () => ({ getOrganizationTasks: vi.fn(async () => ({ status: "ready", tasks: [{ id: "task", projectId: "project", assigneeId: "employee", status: "todo" }] })) }))
vi.mock("@/lib/employee-photos", () => ({}))
vi.mock("@/lib/normalize-employee-photo", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: "actor" } : null }, error: null }) },
  from: (table: string) => {
    state.tables.push(table)
    const filters: Record<string, string> = {}
    const q = {
      select: () => q, eq: (key: string, value: string) => { filters[key] = value; return q }, order: () => q,
      maybeSingle: async () => ({ error: null, data: table === "profiles" ? { job_title: "Designer" } : filters.profile_id === "actor" ? { role: state.role } : state.targetBelongs ? { role: "member", created_at: "2026-11-01" } : null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: [] }).then(resolve),
    }
    return q
  },
}) }))

beforeEach(() => { vi.clearAllMocks(); Object.assign(state, { role: "member", signedIn: true, allowed: true, targetBelongs: true, tables: [] }) })

it.each(["member", "viewer", "admin"])("returns overview only for %s, without querying employee work", async role => {
  state.role = role
  const result = await getEmployeeProfile("org", "employee")
  expect(result.status).toBe("ready")
  if (result.status !== "ready") throw new Error("Expected overview")
  expect(result.profile).toMatchObject({ jobTitle: "Designer", canViewWork: false, projects: [], tasks: [], workUnavailable: false })
  expect(getOrganizationProjects).not.toHaveBeenCalled()
  expect(getOrganizationTasks).not.toHaveBeenCalled()
  expect(state.tables).not.toContain("project_members")
})

it.each(["org_admin", "team_lead"])("returns permitted employee work for %s", async role => {
  state.role = role
  const result = await getEmployeeProfile("org", "employee")
  expect(result.status).toBe("ready")
  if (result.status !== "ready") throw new Error("Expected profile")
  expect(result.profile.canViewWork).toBe(true)
  expect(result.profile.projects).toHaveLength(1)
  expect(result.profile.tasks).toHaveLength(1)
  expect(getOrganizationTasks).toHaveBeenCalledWith("org", "everyone")
  expect(result.profile.canManage).toBe(role === "org_admin")
})

it.each(["signedIn", "allowed", "targetBelongs"] as const)("rejects when %s is false before querying work", async key => {
  state[key] = false
  expect(await getEmployeeProfile("org", "employee")).toEqual({ status: "missing" })
  expect(getOrganizationProjects).not.toHaveBeenCalled()
  expect(getOrganizationTasks).not.toHaveBeenCalled()
})
