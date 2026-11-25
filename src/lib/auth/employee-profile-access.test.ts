import { beforeEach, expect, it, vi } from "vitest"
import { getEmployeeProfile } from "./employee-profile-actions"
import { getOrganizationProjects } from "./get-organization-projects"
import { getOrganizationTasks } from "./get-organization-tasks"

const state = vi.hoisted(() => ({ role: "member", signedIn: true, allowed: true, targetBelongs: true, tables: [] as string[] }))
vi.mock("./current-organizations", () => ({ getAccessibleOrganizations: async () => ({ status: "ready", organizations: state.allowed ? [{ id: "org" }] : [] }) }))
vi.mock("./get-organization-people", () => ({ getOrganizationPeople: async () => ({ status: "ready", people: [{ profileId: "employee" }, { profileId: "actor" }] }) }))
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

it.each(["member", "viewer", "admin"])("hides another employee's profile from %s without querying work", async role => {
  state.role = role
  expect(await getEmployeeProfile("org", "employee")).toEqual({ status: "missing" })
  expect(getOrganizationProjects).not.toHaveBeenCalled()
  expect(getOrganizationTasks).not.toHaveBeenCalled()
  expect(state.tables).toEqual(["organization_memberships", "organization_memberships"])
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

it.each(["member", "viewer", "admin"])("allows %s to view their own work without granting access to another employee", async role => {
  state.role = role
  vi.mocked(getOrganizationProjects).mockResolvedValueOnce({ status: "ready", projects: [{ id: "own-project", ownerId: "actor", archivedAt: null }, { id: "other-project", ownerId: "employee", archivedAt: null }] } as Awaited<ReturnType<typeof getOrganizationProjects>>)
  vi.mocked(getOrganizationTasks).mockResolvedValueOnce({ status: "ready", tasks: [{ id: "own-task", projectId: "own-project", assigneeId: "actor" }, { id: "other-task", projectId: "other-project", assigneeId: "employee" }] } as Awaited<ReturnType<typeof getOrganizationTasks>>)
  const own = await getEmployeeProfile("org", "actor")
  expect(own.status).toBe("ready")
  if (own.status !== "ready") throw new Error("Expected own profile")
  expect(own.profile).toMatchObject({ canViewWork: true, isSelf: true, canManage: false })
  expect(own.profile.projects.map(project => project.id)).toEqual(["own-project"])
  expect(own.profile.tasks.map(task => task.id)).toEqual(["own-task"])
  vi.clearAllMocks()
  state.tables = []
  expect(await getEmployeeProfile("org", "employee")).toEqual({ status: "missing" })
  expect(getOrganizationProjects).not.toHaveBeenCalled()
  expect(getOrganizationTasks).not.toHaveBeenCalled()
  expect(state.tables).toEqual(["organization_memberships", "organization_memberships"])
  expect(state.tables).not.toContain("project_members")
})
