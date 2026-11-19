import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createOrganizationCampaign,
  getCampaignCreationAccess,
} from "@/lib/auth/campaign-creation-actions"
import { projectSlugFromName } from "@/lib/auth/project-slug"
import {
  getOrganizationCampaignUpdateAccess,
  setOrganizationCampaignStatus,
  updateOrganizationCampaign,
} from "@/lib/auth/campaign-update-actions"
import {
  getOrganizationCampaign,
  getOrganizationCampaigns,
  getOrganizationProjectCampaigns,
} from "@/lib/auth/get-organization-campaigns"
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@/lib/auth/organization-campaigns"

type Row = Record<string, unknown>

type Filter =
  | { op: "eq"; column: string; value: unknown }
  | { op: "is"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }

type RecordedCall = {
  table: string
  operation: "select" | "insert" | "update"
  columns: string | null
  payload: Record<string, unknown> | null
  filters: Filter[]
  options: unknown
  matched: number | null
  resultCount: number | null
  errorCode: string | null
}

type WriteScript = {
  operation: "insert" | "update"
  count: number | null
  error: { code: string; message: string } | null
}

const harness = vi.hoisted(() => {
  const ids = {
    orgA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    orgB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    admin: "11111111-1111-4111-8111-111111111111",
    member: "22222222-2222-4222-8222-222222222222",
    viewer: "33333333-3333-4333-8333-333333333333",
    outsider: "44444444-4444-4444-8444-444444444444",
    activeProject: "55555555-5555-4555-8555-555555555555",
    archivedProject: "66666666-6666-4666-8666-666666666666",
    activeCampaign: "77777777-7777-4777-8777-777777777777",
    archivedCampaign: "88888888-8888-4888-8888-888888888888",
    pausedCampaign: "99999999-9999-4999-8999-999999999999",
    unknown: "abcdefab-cdef-4abc-8abc-abcdefabcdef",
    foreignProject: "12121212-1212-4121-8121-121212121212",
  }

  const calls: RecordedCall[] = []
  const writeScripts: WriteScript[] = []
  const session: { userId: string | null } = { userId: null }
  const clients = { created: 0 }

  const db: Record<string, Row[]> = {
    organizations: [
      { id: ids.orgA, name: "Organization A" },
      { id: ids.orgB, name: "Organization B" },
    ],
    organization_memberships: [
      { organization_id: ids.orgA, profile_id: ids.admin, role: "org_admin" },
      { organization_id: ids.orgA, profile_id: ids.member, role: "member" },
      { organization_id: ids.orgA, profile_id: ids.viewer, role: "member" },
      { organization_id: ids.orgB, profile_id: ids.outsider, role: "org_admin" },
    ],
    projects: [
      {
        id: ids.activeProject,
        organization_id: ids.orgA,
        name: "Active Project",
        archived_at: null,
      },
      {
        id: ids.archivedProject,
        organization_id: ids.orgA,
        name: "Archived Project",
        archived_at: "2026-11-08T12:00:00.000Z",
      },
      {
        id: ids.foreignProject,
        organization_id: ids.orgB,
        name: "Foreign Project",
        archived_at: null,
      },
    ],
    project_members: [
      {
        organization_id: ids.orgA,
        project_id: ids.activeProject,
        profile_id: ids.admin,
        role: "project_manager",
        history_access: "full_history",
        can_edit: true,
      },
      {
        organization_id: ids.orgA,
        project_id: ids.activeProject,
        profile_id: ids.member,
        role: "project_member",
        history_access: "full_history",
        can_edit: false,
      },
      {
        organization_id: ids.orgA,
        project_id: ids.activeProject,
        profile_id: ids.viewer,
        role: "viewer",
        history_access: "full_history",
        can_edit: false,
      },
      {
        organization_id: ids.orgA,
        project_id: ids.archivedProject,
        profile_id: ids.member,
        role: "project_member",
        history_access: "full_history",
        can_edit: false,
      },
    ],
    profiles: [
      { id: ids.admin, full_name: "Admin User", email: "admin@example.test" },
      { id: ids.member, full_name: "Member User", email: "member@example.test" },
      { id: ids.viewer, full_name: "Viewer User", email: "viewer@example.test" },
      { id: ids.outsider, full_name: "Outsider User", email: "outsider@example.test" },
    ],
    campaigns: [
      campaignRow(ids.activeCampaign, ids.activeProject, "active-campaign", "Active Campaign", null),
      campaignRow(
        ids.archivedCampaign,
        ids.activeProject,
        "archived-campaign",
        "Archived Campaign",
        "2026-11-09T12:00:00.000Z"
      ),
      campaignRow(ids.pausedCampaign, ids.archivedProject, "paused-campaign", "Paused Campaign", null),
    ],
  }

  function campaignRow(
    id: string,
    projectId: string,
    slug: string,
    name: string,
    archivedAt: string | null
  ): Row {
    return {
      id,
      organization_id: ids.orgA,
      project_id: projectId,
      slug,
      name,
      description: `${name} description`,
      goals: `${name} goals`,
      owner_id: ids.admin,
      type: "content",
      status: "planning",
      starts_on: "2026-11-01",
      ends_on: "2026-11-30",
      archived_at: archivedAt,
    }
  }

  const baseline = structuredClone(db)

  function parseSelectColumns(table: string, columns: string) {
    const trimmed = columns.trim()
    if (!trimmed) throw new Error("select() requires a column list")
    if (/[*():!]|\./.test(trimmed)) {
      throw new Error(`unsupported select syntax: ${columns}`)
    }
    const names = trimmed.split(",").map((name) => name.trim())
    if (names.length === 0 || names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) {
      throw new Error(`unsupported select syntax: ${columns}`)
    }
    if (new Set(names).size !== names.length) {
      throw new Error(`unsupported select syntax: ${columns}`)
    }
    const sample = db[table]?.[0]
    if (sample) {
      for (const name of names) {
        if (!Object.hasOwn(sample, name)) {
          throw new Error(`select column ${name} is not present on ${table}`)
        }
      }
    }
    return names
  }

  function projectRow(table: string, row: Row, columns: string[]) {
    const projected: Row = {}
    for (const column of columns) {
      if (!Object.hasOwn(row, column)) {
        throw new Error(`select column ${column} is not present on ${table}`)
      }
      projected[column] = row[column]
    }
    return projected
  }

  function takeWriteScript(operation: WriteScript["operation"]) {
    const index = writeScripts.findIndex((script) => script.operation === operation)
    if (index < 0) return null
    return writeScripts.splice(index, 1)[0] ?? null
  }

  function applyFilters(rows: Row[], filters: Filter[]) {
    return rows.filter((row) =>
      filters.every((filter) => {
        const value = row[filter.column]
        if (filter.op === "eq") return value === filter.value
        if (filter.op === "is") {
          return filter.value === null ? value == null : value === filter.value
        }
        if (!Array.isArray(filter.value)) throw new Error("in filter requires an array")
        return filter.value.includes(value)
      })
    )
  }

  class QueryBuilder {
    operation: RecordedCall["operation"] | null = null
    columns: string | null = null
    payload: Record<string, unknown> | null = null
    filters: Filter[] = []
    options: unknown = null
    single = false
    sortColumn: string | null = null
    sortAscending = true
    private pending: Promise<Record<string, unknown>> | null = null

    constructor(private table: string) {}

    select(columns: string) {
      this.operation = "select"
      this.columns = columns
      return this
    }

    insert(payload: Record<string, unknown>) {
      this.operation = "insert"
      this.payload = payload
      return this
    }

    update(payload: Record<string, unknown>, options?: unknown) {
      this.operation = "update"
      this.payload = payload
      this.options = options ?? null
      return this
    }

    eq(column: string, value: unknown) {
      this.filters.push({ op: "eq", column, value })
      return this
    }

    is(column: string, value: unknown) {
      this.filters.push({ op: "is", column, value })
      return this
    }

    in(column: string, value: unknown[]) {
      this.filters.push({ op: "in", column, value })
      return this
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.sortColumn = column
      this.sortAscending = options?.ascending !== false
      return this
    }

    maybeSingle() {
      this.single = true
      return this.run()
    }

    then<TResult1 = Record<string, unknown>, TResult2 = never>(
      onFulfilled?: ((value: Record<string, unknown>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.run().then(onFulfilled, onRejected)
    }

    private run() {
      this.pending ??= new Promise((resolve, reject) => {
        try {
          resolve(this.execute())
        } catch (error) {
          reject(error)
        }
      })
      return this.pending
    }

    private execute() {
      const rows = db[this.table]
      if (!rows) throw new Error(`unexpected table ${this.table}`)
      if (!this.operation) throw new Error(`query on ${this.table} has no operation`)

      let matched = applyFilters(rows, this.filters)
      if (this.sortColumn) {
        const column = this.sortColumn
        matched = [...matched].sort((left, right) =>
          String(left[column]).localeCompare(String(right[column]))
        )
        if (!this.sortAscending) matched.reverse()
      }

      const selectedColumns =
        this.operation === "select" ? parseSelectColumns(this.table, this.columns ?? "") : null
      const projected = selectedColumns
        ? matched.map((row) => projectRow(this.table, row, selectedColumns))
        : matched
      const script = this.operation === "select" ? null : takeWriteScript(this.operation)
      const errorCode = script?.error?.code ?? null
      const resultCount =
        this.operation === "update"
          ? script?.error
            ? null
            : script
              ? script.count
              : matched.length
          : this.operation === "select" && !this.single
            ? matched.length
            : null

      calls.push({
        table: this.table,
        operation: this.operation,
        columns: this.columns,
        payload: this.payload,
        filters: this.filters.map((filter) => ({ ...filter })),
        options: this.options,
        matched: this.operation === "insert" ? null : matched.length,
        resultCount,
        errorCode,
      })

      if (this.operation === "insert") {
        return { data: null, error: script?.error ?? null, count: null }
      }
      if (this.operation === "update") {
        return { data: null, error: script?.error ?? null, count: script?.error ? null : resultCount }
      }
      if (this.single) {
        if (projected.length > 1) {
          return { data: null, error: { code: "PGRST116", message: "multiple rows" }, count: null }
        }
        return { data: projected[0] ? structuredClone(projected[0]) : null, error: null, count: null }
      }
      return { data: structuredClone(projected), error: null, count: matched.length }
    }
  }

  function createMockClient() {
    clients.created += 1
    return {
      auth: {
        getUser: async () => ({
          data: { user: session.userId ? { id: session.userId } : null },
          error: null,
        }),
      },
      from(table: string) {
        return new QueryBuilder(table)
      },
    }
  }

  function scriptWrite(script: WriteScript) {
    if (script.operation === "insert" && !script.error) {
      throw new Error("insert scripts must return an error")
    }
    if (script.error && script.count !== null) {
      throw new Error("error scripts cannot also force a count")
    }
    if (!script.error && script.operation === "update" && typeof script.count !== "number") {
      throw new Error("update count scripts require a count")
    }
    writeScripts.push(script)
  }

  function reset() {
    calls.length = 0
    writeScripts.length = 0
    clients.created = 0
    session.userId = null
    for (const table of Object.keys(baseline)) {
      db[table] = structuredClone(baseline[table])
    }
  }

  return { ids, db, calls, session, clients, createMockClient, scriptWrite, reset }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => harness.createMockClient(),
}))

const ids = harness.ids

function signIn(userId: string | null) {
  harness.reset()
  harness.session.userId = userId
}

function writes() {
  return harness.calls.filter((call) => call.operation !== "select")
}

function lastWrite() {
  const recorded = writes()
  expect(recorded).toHaveLength(1)
  return recorded[0]
}

function permissionDenied() {
  return { code: "42501", message: "permission denied for table campaigns" }
}

function removeOrganizationMembership(profileId: string) {
  harness.db.organization_memberships = harness.db.organization_memberships.filter(
    (row) => row.profile_id !== profileId
  )
}

function duplicateOrganizationMembership(profileId: string) {
  const membership = harness.db.organization_memberships.find((row) => row.profile_id === profileId)
  if (!membership) throw new Error(`missing organization membership for ${profileId}`)
  harness.db.organization_memberships.push({ ...membership, role: "member" })
}

function removeProjectMembership(profileId: string, projectId: string) {
  harness.db.project_members = harness.db.project_members.filter(
    (row) => row.profile_id !== profileId || row.project_id !== projectId
  )
}

function duplicateProjectMembership(profileId: string, projectId: string) {
  const membership = harness.db.project_members.find(
    (row) => row.profile_id === profileId && row.project_id === projectId
  )
  if (!membership) throw new Error(`missing project membership for ${profileId}`)
  harness.db.project_members.push({ ...membership })
}

function addCampaign(id: string, projectId: string, slug: string) {
  const source = harness.db.campaigns.find((row) => row.id === ids.activeCampaign)
  if (!source) throw new Error("missing active campaign fixture")
  harness.db.campaigns.push({
    ...structuredClone(source),
    id,
    project_id: projectId,
    slug,
    name: slug,
  })
}

const validCreate: CreateCampaignInput = {
  organizationId: ids.orgA,
  projectId: ids.activeProject,
  name: "Spring Launch",
  description: "Notes",
  goals: "Goals",
  ownerId: ids.admin,
  type: "content",
  status: "planning",
  startsOn: "2026-11-01",
  endsOn: "2026-11-30",
}

const validUpdate: UpdateCampaignInput = {
  organizationId: ids.orgA,
  campaignId: ids.activeCampaign,
  name: "Spring Launch",
  description: "Notes",
  goals: "Goals",
  ownerId: ids.admin,
  type: "content",
  status: "planning",
  startsOn: "2026-11-01",
  endsOn: "2026-11-30",
}

beforeEach(() => {
  harness.reset()
})

describe("query mock", () => {
  it("applies only the filters that were recorded", async () => {
    const supabase = harness.createMockClient()
    const open = await supabase.from("campaigns").select("id")
    const scoped = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", ids.orgA)
    const otherOrganization = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", ids.orgB)
    const activeOnly = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", ids.activeCampaign)
      .is("archived_at", null)
    const archivedExcluded = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", ids.archivedCampaign)
      .is("archived_at", null)
    const broadUpdate = await supabase
      .from("campaigns")
      .update({ name: "Too broad" }, { count: "exact" })
      .eq("organization_id", ids.orgA)

    expect(open.data).toHaveLength(3)
    expect(scoped.data).toHaveLength(3)
    expect(otherOrganization.data).toHaveLength(0)
    expect(activeOnly.data).toHaveLength(1)
    expect(archivedExcluded.data).toHaveLength(0)
    expect(broadUpdate.count).toBe(3)
    expect(open.data).toEqual([
      { id: ids.activeCampaign },
      { id: ids.archivedCampaign },
      { id: ids.pausedCampaign },
    ])
  })

  it("returns archived_at only when a select list requests it", async () => {
    const supabase = harness.createMockClient()
    const hidden = await supabase
      .from("campaigns")
      .select("id, project_id")
      .eq("id", ids.archivedCampaign)
      .maybeSingle()
    const visible = await supabase
      .from("campaigns")
      .select("id, archived_at")
      .eq("id", ids.archivedCampaign)
      .maybeSingle()

    expect(hidden.data).toEqual({ id: ids.archivedCampaign, project_id: ids.activeProject })
    expect(hidden.data).not.toHaveProperty("archived_at")
    expect(visible.data).toEqual({
      id: ids.archivedCampaign,
      archived_at: "2026-11-09T12:00:00.000Z",
    })
  })

  it("rejects an unsupported select instead of returning the full row", async () => {
    const supabase = harness.createMockClient()
    await expect(supabase.from("campaigns").select("*")).rejects.toThrow(/unsupported select syntax/)
    await expect(supabase.from("campaigns").select("id, projects(name)")).rejects.toThrow(
      /unsupported select syntax/
    )
    await expect(supabase.from("campaigns").select("")).rejects.toThrow(/select\(\) requires a column list/)
    await expect(supabase.from("campaigns").select("id, secret_flag")).rejects.toThrow(/secret_flag/)
    expect(harness.calls).toEqual([])
  })

  it("clears fixture edits and write scripts on reset", async () => {
    harness.db.projects.push({
      id: ids.unknown,
      organization_id: ids.orgA,
      name: "Temporary",
      archived_at: null,
    })
    harness.scriptWrite({ operation: "update", count: 0, error: null })
    harness.reset()

    expect(harness.db.projects.map((project) => project.id)).not.toContain(ids.unknown)
    const updated = await harness
      .createMockClient()
      .from("campaigns")
      .update({ name: "Kept" }, { count: "exact" })
      .eq("id", ids.activeCampaign)
    expect(updated).toMatchObject({ error: null, count: 1 })
  })
})

describe("unauthenticated requests", () => {
  it.each([
    ["getOrganizationCampaigns", () => getOrganizationCampaigns(ids.orgA)],
    ["getOrganizationProjectCampaigns", () => getOrganizationProjectCampaigns(ids.orgA, ids.activeProject)],
    ["getOrganizationCampaign", () => getOrganizationCampaign(ids.orgA, ids.activeCampaign)],
    ["getCampaignCreationAccess", () => getCampaignCreationAccess(ids.orgA, null)],
    ["createOrganizationCampaign", () => createOrganizationCampaign(validCreate)],
    ["getOrganizationCampaignUpdateAccess", () => getOrganizationCampaignUpdateAccess(ids.orgA, ids.activeCampaign)],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign(validUpdate)],
    ["setOrganizationCampaignStatus", () => setOrganizationCampaignStatus({
      organizationId: ids.orgA,
      campaignId: ids.activeCampaign,
      status: "active",
    })],
  ] as const)("%s returns rejected and does not query or write", async (_name, run) => {
    signIn(null)
    await expect(run()).resolves.toEqual({ status: "rejected" })
    expect(harness.clients.created).toBe(1)
    expect(harness.calls).toEqual([])
    expect(writes()).toEqual([])
  })
})

describe("cross-organization outsider", () => {
  it.each([
    ["getOrganizationCampaigns", () => getOrganizationCampaigns(ids.orgA)],
    ["getOrganizationProjectCampaigns", () => getOrganizationProjectCampaigns(ids.orgA, ids.activeProject)],
    ["getOrganizationCampaign", () => getOrganizationCampaign(ids.orgA, ids.activeCampaign)],
    ["getCampaignCreationAccess", () => getCampaignCreationAccess(ids.orgA, ids.activeProject)],
    ["createOrganizationCampaign", () => createOrganizationCampaign(validCreate)],
    ["getOrganizationCampaignUpdateAccess", () => getOrganizationCampaignUpdateAccess(ids.orgA, ids.activeCampaign)],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign(validUpdate)],
    ["setOrganizationCampaignStatus", () => setOrganizationCampaignStatus({
      organizationId: ids.orgA,
      campaignId: ids.activeCampaign,
      status: "active",
    })],
  ] as const)("%s returns rejected and does not touch campaigns", async (_name, run) => {
    signIn(ids.outsider)
    await expect(run()).resolves.toEqual({ status: "rejected" })
    expect(harness.calls.some((call) => call.table === "campaigns")).toBe(false)
    expect(writes()).toEqual([])
  })
})

describe("campaign reads", () => {
  it("returns an organization member's campaigns scoped to that organization", async () => {
    signIn(ids.viewer)
    const result = await getOrganizationCampaigns(ids.orgA)
    expect(result).toMatchObject({ status: "ready" })
    if (result.status !== "ready") return
    expect(result.campaigns.map((campaign) => campaign.name)).toEqual([
      "Active Campaign",
      "Archived Campaign",
      "Paused Campaign",
    ])
    expect(harness.calls.find((call) => call.table === "campaigns")?.filters).toEqual([
      { op: "eq", column: "organization_id", value: ids.orgA },
    ])
    expect(writes()).toEqual([])
  })

  it("adds the project filter for project campaign reads", async () => {
    signIn(ids.admin)
    const result = await getOrganizationProjectCampaigns(ids.orgA, ids.activeProject)
    expect(result).toMatchObject({ status: "ready" })
    if (result.status !== "ready") return
    expect(result.campaigns.map((campaign) => campaign.name)).toEqual([
      "Active Campaign",
      "Archived Campaign",
    ])
    expect(harness.calls.find((call) => call.table === "campaigns")?.filters).toEqual([
      { op: "eq", column: "organization_id", value: ids.orgA },
      { op: "eq", column: "project_id", value: ids.activeProject },
    ])
  })

  it("rejects a non-uuid project id before opening a client", async () => {
    signIn(ids.admin)
    await expect(getOrganizationProjectCampaigns(ids.orgA, "spring")).resolves.toEqual({
      status: "unavailable",
    })
    expect(harness.clients.created).toBe(0)
  })

  it("returns one campaign for an authorized reader", async () => {
    signIn(ids.admin)
    const result = await getOrganizationCampaign(ids.orgA, ids.activeCampaign)
    expect(result).toMatchObject({
      status: "ready",
      campaign: {
        id: ids.activeCampaign,
        slug: "active-campaign",
        projectName: "Active Project",
        archivedAt: null,
      },
    })
    expect(harness.calls.find((call) => call.table === "campaigns")?.filters).toEqual([
      { op: "eq", column: "organization_id", value: ids.orgA },
      { op: "eq", column: "id", value: ids.activeCampaign },
    ])
  })

  it("returns missing for an unknown campaign id", async () => {
    signIn(ids.admin)
    await expect(getOrganizationCampaign(ids.orgA, ids.unknown)).resolves.toEqual({
      status: "missing",
    })
    expect(writes()).toEqual([])
  })

  it("returns missing for a non-uuid campaign id before opening a client", async () => {
    signIn(ids.admin)
    await expect(getOrganizationCampaign(ids.orgA, "campaign-1")).resolves.toEqual({
      status: "missing",
    })
    expect(harness.clients.created).toBe(0)
  })
})

describe("campaign creation access", () => {
  it("offers an organization admin the active projects", async () => {
    signIn(ids.admin)
    const result = await getCampaignCreationAccess(ids.orgA, null)
    expect(result).toMatchObject({
      status: "ready",
      canCreate: true,
      projects: [{ id: ids.activeProject, name: "Active Project" }],
    })
  })

  it("offers a project member creation when can_edit is false", async () => {
    signIn(ids.member)
    const result = await getCampaignCreationAccess(ids.orgA, ids.activeProject)
    expect(result).toMatchObject({ status: "ready", canCreate: true, defaultOwnerId: ids.member })
  })

  it("hides creation from a project viewer", async () => {
    signIn(ids.viewer)
    await expect(getCampaignCreationAccess(ids.orgA, ids.activeProject)).resolves.toEqual({
      status: "ready",
      canCreate: false,
    })
    expect(writes()).toEqual([])
  })

  it("hides creation for an archived project", async () => {
    signIn(ids.admin)
    await expect(getCampaignCreationAccess(ids.orgA, ids.archivedProject)).resolves.toEqual({
      status: "ready",
      canCreate: false,
    })
  })

  it("hides creation for a non-uuid project id before opening a client", async () => {
    signIn(ids.admin)
    await expect(getCampaignCreationAccess(ids.orgA, "project-1")).resolves.toEqual({
      status: "ready",
      canCreate: false,
    })
    expect(harness.clients.created).toBe(0)
  })
})

describe("createOrganizationCampaign", () => {
  it("lets an organization admin insert a derived slug and no archive timestamp", async () => {
    signIn(ids.admin)
    const result = await createOrganizationCampaign(validCreate)
    const write = lastWrite()
    expect(result).toEqual({ status: "created", campaignId: write.payload?.id })
    expect(write).toMatchObject({
      table: "campaigns",
      operation: "insert",
      filters: [],
    })
    expect(write.payload).toMatchObject({
      organization_id: ids.orgA,
      project_id: ids.activeProject,
      slug: projectSlugFromName("Spring Launch"),
      name: "Spring Launch",
      owner_id: ids.admin,
      type: "content",
      status: "planning",
      starts_on: "2026-11-01",
      ends_on: "2026-11-30",
    })
    expect(write.payload).not.toHaveProperty("archived_at")
    expect(write.payload).not.toHaveProperty("created_at")
    expect(write.payload).not.toHaveProperty("updated_at")
  })

  it("lets a project member insert when can_edit is false", async () => {
    signIn(ids.member)
    const result = await createOrganizationCampaign({ ...validCreate, ownerId: ids.member })
    expect(result.status).toBe("created")
    expect(lastWrite().payload).toMatchObject({ owner_id: ids.member })
    expect(
      harness.calls
        .filter((call) => call.table === "project_members")
        .every((call) => !call.columns?.includes("can_edit"))
    ).toBe(true)
  })

  it("denies a project viewer before insert", async () => {
    signIn(ids.viewer)
    await expect(createOrganizationCampaign(validCreate)).resolves.toEqual({ status: "denied" })
    expect(writes()).toEqual([])
  })

  it("rejects an archived project before insert", async () => {
    signIn(ids.admin)
    await expect(
      createOrganizationCampaign({ ...validCreate, projectId: ids.archivedProject })
    ).resolves.toEqual({
      status: "invalid",
      message: "Restore this project before adding a campaign.",
    })
    expect(writes()).toEqual([])
  })

  it("rejects an owner who is not a project member before insert", async () => {
    signIn(ids.admin)
    await expect(
      createOrganizationCampaign({ ...validCreate, ownerId: ids.outsider })
    ).resolves.toEqual({
      status: "invalid",
      message: "Choose an owner who belongs to this project.",
    })
    expect(writes()).toEqual([])
  })

  it.each([
    ["a non-uuid project", { projectId: "project-1" }, "Choose a project."],
    ["an empty name", { name: "   " }, "Enter a campaign name."],
    ["a display type", { type: "Content" }, "Choose a type."],
    ["a display status", { status: "Planning" }, "Choose a status."],
    ["a malformed date", { startsOn: "11/01/2026" }, "Enter the start and end dates as YYYY-MM-DD."],
    ["an end date before the start", { startsOn: "2026-12-05", endsOn: "2026-11-12" }, "The end date must be on or after the start date."],
    ["a non-uuid owner", { ownerId: "owner" }, "Choose an owner from this project."],
  ] as const)("rejects %s before opening a client", async (_label, overrides, message) => {
    signIn(ids.admin)
    await expect(
      createOrganizationCampaign({ ...validCreate, ...overrides } as CreateCampaignInput)
    ).resolves.toEqual({ status: "invalid", message })
    expect(harness.clients.created).toBe(0)
    expect(writes()).toEqual([])
  })
})

describe("campaign update access", () => {
  it("allows an organization admin to edit an active campaign", async () => {
    signIn(ids.admin)
    const result = await getOrganizationCampaignUpdateAccess(ids.orgA, ids.activeCampaign)
    expect(result).toMatchObject({ status: "ready", canEdit: true })
    if (result.status !== "ready" || !result.canEdit) return
    expect(result.owners.map((owner) => owner.id).sort()).toEqual(
      [ids.admin, ids.member, ids.viewer].sort()
    )
  })

  it("allows a project member when can_edit is false", async () => {
    signIn(ids.member)
    await expect(getOrganizationCampaignUpdateAccess(ids.orgA, ids.activeCampaign)).resolves.toMatchObject({
      status: "ready",
      canEdit: true,
    })
  })

  it("hides editing from a project viewer", async () => {
    signIn(ids.viewer)
    await expect(getOrganizationCampaignUpdateAccess(ids.orgA, ids.activeCampaign)).resolves.toEqual({
      status: "ready",
      canEdit: false,
    })
    expect(writes()).toEqual([])
  })

  it("hides editing for an archived campaign", async () => {
    signIn(ids.admin)
    await expect(getOrganizationCampaignUpdateAccess(ids.orgA, ids.archivedCampaign)).resolves.toEqual({
      status: "ready",
      canEdit: false,
    })
  })

  it("hides editing for a campaign on an archived project", async () => {
    signIn(ids.admin)
    await expect(getOrganizationCampaignUpdateAccess(ids.orgA, ids.pausedCampaign)).resolves.toEqual({
      status: "ready",
      canEdit: false,
    })
  })

  it("hides editing for a non-uuid campaign id before opening a client", async () => {
    signIn(ids.admin)
    await expect(getOrganizationCampaignUpdateAccess(ids.orgA, "campaign-1")).resolves.toEqual({
      status: "ready",
      canEdit: false,
    })
    expect(harness.clients.created).toBe(0)
  })
})

describe("updateOrganizationCampaign", () => {
  it("updates one active row without slug, archive, organization, or project fields", async () => {
    signIn(ids.admin)
    const result = await updateOrganizationCampaign(validUpdate)
    const write = lastWrite()
    expect(result).toEqual({ status: "updated" })
    expect(write).toMatchObject({
      table: "campaigns",
      operation: "update",
      options: { count: "exact" },
      matched: 1,
      filters: [
        { op: "eq", column: "id", value: ids.activeCampaign },
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "is", column: "archived_at", value: null },
      ],
    })
    expect(write.payload).toEqual({
      name: "Spring Launch",
      description: "Notes",
      goals: "Goals",
      owner_id: ids.admin,
      type: "content",
      status: "planning",
      starts_on: "2026-11-01",
      ends_on: "2026-11-30",
    })
  })

  it("lets a project member update when can_edit is false", async () => {
    signIn(ids.member)
    const result = await updateOrganizationCampaign({ ...validUpdate, ownerId: ids.member })
    expect(result).toEqual({ status: "updated" })
    expect(lastWrite().matched).toBe(1)
    expect(lastWrite().payload).toMatchObject({ owner_id: ids.member })
    expect(
      harness.calls
        .filter((call) => call.table === "project_members")
        .every((call) => call.columns === "role, history_access" || call.columns === "profile_id")
    ).toBe(true)
  })

  it("denies a project viewer before update", async () => {
    signIn(ids.viewer)
    await expect(updateOrganizationCampaign(validUpdate)).resolves.toEqual({ status: "denied" })
    expect(harness.calls.some((call) => call.table === "campaigns" && call.operation === "select")).toBe(true)
    expect(writes()).toEqual([])
  })

  it("rejects an archived campaign before update", async () => {
    signIn(ids.admin)
    await expect(
      updateOrganizationCampaign({ ...validUpdate, campaignId: ids.archivedCampaign })
    ).resolves.toEqual({
      status: "invalid",
      message: "This campaign is archived and cannot be edited.",
    })
    expect(writes()).toEqual([])
  })

  it("rejects a campaign on an archived project before update", async () => {
    signIn(ids.admin)
    await expect(
      updateOrganizationCampaign({ ...validUpdate, campaignId: ids.pausedCampaign })
    ).resolves.toEqual({
      status: "invalid",
      message: "Restore this project before editing a campaign.",
    })
    expect(writes()).toEqual([])
  })

  it("drops a caller-supplied slug from the update payload", async () => {
    signIn(ids.admin)
    const result = await updateOrganizationCampaign({
      ...validUpdate,
      slug: "hacked-slug",
    } as UpdateCampaignInput)
    expect(result).toEqual({ status: "updated" })
    expect(lastWrite().payload).not.toHaveProperty("slug")
  })

  it("rejects an owner who is not a project member before update", async () => {
    signIn(ids.admin)
    await expect(
      updateOrganizationCampaign({ ...validUpdate, ownerId: ids.outsider })
    ).resolves.toEqual({
      status: "invalid",
      message: "Choose an owner who belongs to this project.",
    })
    expect(writes()).toEqual([])
  })

  it.each([
    ["a non-uuid campaign", { campaignId: "campaign-1" }, "This campaign address is not valid."],
    ["an empty name", { name: " " }, "Enter a campaign name."],
    ["a display type", { type: "Content" }, "Choose a type."],
    ["a display status", { status: "Planning" }, "Choose a status."],
    ["a malformed date", { endsOn: "2026/11/30" }, "Enter the start and end dates as YYYY-MM-DD."],
    ["an end date before the start", { startsOn: "2026-12-05", endsOn: "2026-11-12" }, "The end date must be on or after the start date."],
    ["a non-uuid owner", { ownerId: "owner" }, "Choose an owner from this project."],
  ] as const)("rejects %s before opening a client", async (_label, overrides, message) => {
    signIn(ids.admin)
    await expect(
      updateOrganizationCampaign({ ...validUpdate, ...overrides } as UpdateCampaignInput)
    ).resolves.toEqual({ status: "invalid", message })
    expect(harness.clients.created).toBe(0)
    expect(writes()).toEqual([])
  })
})

describe("setOrganizationCampaignStatus", () => {
  it("writes only status for one active row", async () => {
    signIn(ids.admin)
    const result = await setOrganizationCampaignStatus({
      organizationId: ids.orgA,
      campaignId: ids.activeCampaign,
      status: "active",
    })
    const write = lastWrite()
    expect(result).toEqual({ status: "updated" })
    expect(write.payload).toEqual({ status: "active" })
    expect(write.payload).not.toHaveProperty("owner_id")
    expect(write.payload).not.toHaveProperty("slug")
    expect(write.matched).toBe(1)
    expect(write.filters).toEqual([
      { op: "eq", column: "id", value: ids.activeCampaign },
      { op: "eq", column: "organization_id", value: ids.orgA },
      { op: "is", column: "archived_at", value: null },
    ])
  })

  it("lets a project member change status when can_edit is false", async () => {
    signIn(ids.member)
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "on_hold",
      })
    ).resolves.toEqual({ status: "updated" })
    expect(lastWrite().payload).toEqual({ status: "on_hold" })
  })

  it("denies a project viewer before update", async () => {
    signIn(ids.viewer)
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "completed",
      })
    ).resolves.toEqual({ status: "denied" })
    expect(writes()).toEqual([])
  })

  it("rejects an archived campaign before update", async () => {
    signIn(ids.admin)
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.archivedCampaign,
        status: "active",
      })
    ).resolves.toEqual({
      status: "invalid",
      message: "This campaign is archived and cannot be edited.",
    })
    expect(writes()).toEqual([])
  })

  it("rejects a campaign on an archived project before update", async () => {
    signIn(ids.admin)
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.pausedCampaign,
        status: "active",
      })
    ).resolves.toEqual({
      status: "invalid",
      message: "Restore this project before editing a campaign.",
    })
    expect(writes()).toEqual([])
  })

  it("rejects a display status before opening a client", async () => {
    signIn(ids.admin)
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "Active" as "active",
      })
    ).resolves.toEqual({ status: "invalid", message: "Choose a status." })
    expect(harness.clients.created).toBe(0)
  })
})

describe("post-write results", () => {
  it("returns unavailable when an authorized update matches no row", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: 0, error: null })
    await expect(updateOrganizationCampaign(validUpdate)).resolves.toEqual({ status: "unavailable" })
    expect(lastWrite()).toMatchObject({
      operation: "update",
      matched: 1,
      resultCount: 0,
      errorCode: null,
      options: { count: "exact" },
    })
  })

  it("returns error when an authorized update reports more than one row", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: 2, error: null })
    await expect(updateOrganizationCampaign(validUpdate)).resolves.toEqual({ status: "error" })
    expect(lastWrite()).toMatchObject({ matched: 1, resultCount: 2, errorCode: null })
  })

  it("maps an authorized update permission error to denied", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: null, error: permissionDenied() })
    await expect(updateOrganizationCampaign(validUpdate)).resolves.toEqual({ status: "denied" })
    expect(lastWrite()).toMatchObject({
      operation: "update",
      matched: 1,
      resultCount: null,
      errorCode: "42501",
    })
  })

  it("returns unavailable when an authorized status update matches no row", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: 0, error: null })
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "active",
      })
    ).resolves.toEqual({ status: "unavailable" })
    expect(lastWrite().payload).toEqual({ status: "active" })
    expect(lastWrite().resultCount).toBe(0)
  })

  it("returns error when an authorized status update reports more than one row", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: 2, error: null })
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "active",
      })
    ).resolves.toEqual({ status: "error" })
    expect(lastWrite()).toMatchObject({ payload: { status: "active" }, resultCount: 2 })
  })

  it("maps an authorized status permission error to denied", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "update", count: null, error: permissionDenied() })
    await expect(
      setOrganizationCampaignStatus({
        organizationId: ids.orgA,
        campaignId: ids.activeCampaign,
        status: "active",
      })
    ).resolves.toEqual({ status: "denied" })
    expect(lastWrite().errorCode).toBe("42501")
  })

  it("maps an authorized insert permission error to denied", async () => {
    signIn(ids.admin)
    harness.scriptWrite({ operation: "insert", count: null, error: permissionDenied() })
    await expect(createOrganizationCampaign(validCreate)).resolves.toEqual({ status: "denied" })
    expect(lastWrite()).toMatchObject({
      operation: "insert",
      errorCode: "42501",
      payload: {
        organization_id: ids.orgA,
        project_id: ids.activeProject,
        slug: projectSlugFromName("Spring Launch"),
      },
    })
    expect(writes()).toHaveLength(1)
  })
})

describe("fail-closed authorization", () => {
  it.each([
    ["createOrganizationCampaign", () => createOrganizationCampaign(validCreate)],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign(validUpdate)],
  ] as const)("%s rejects a user with no organization membership before writing", async (_name, run) => {
    signIn(ids.admin)
    removeOrganizationMembership(ids.admin)
    await expect(run()).resolves.toEqual({ status: "rejected" })
    expect(writes()).toEqual([])
    expect(harness.calls).toEqual([
      expect.objectContaining({
        table: "organization_memberships",
        operation: "select",
        columns: "organization_id, role",
        matched: 0,
        filters: [{ op: "eq", column: "profile_id", value: ids.admin }],
      }),
    ])
  })

  it.each([
    ["createOrganizationCampaign", () => createOrganizationCampaign(validCreate)],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign(validUpdate)],
  ] as const)("%s returns error when the user has two organization memberships", async (_name, run) => {
    signIn(ids.admin)
    duplicateOrganizationMembership(ids.admin)
    await expect(run()).resolves.toEqual({ status: "error" })
    expect(writes()).toEqual([])
    expect(
      harness.calls.find((call) => call.table === "organization_memberships" && call.columns === "role")
    ).toMatchObject({
      matched: 2,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "profile_id", value: ids.admin },
      ],
    })
  })

  it.each([
    ["createOrganizationCampaign", () => createOrganizationCampaign({ ...validCreate, ownerId: ids.member })],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign({ ...validUpdate, ownerId: ids.member })],
  ] as const)("%s denies a non-admin with no project membership", async (_name, run) => {
    signIn(ids.member)
    removeProjectMembership(ids.member, ids.activeProject)
    await expect(run()).resolves.toEqual({ status: "denied" })
    expect(writes()).toEqual([])
    expect(
      harness.calls.find((call) => call.table === "project_members" && call.columns === "role, history_access")
    ).toMatchObject({
      matched: 0,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "project_id", value: ids.activeProject },
        { op: "eq", column: "profile_id", value: ids.member },
      ],
    })
  })

  it.each([
    ["createOrganizationCampaign", () => createOrganizationCampaign({ ...validCreate, ownerId: ids.member })],
    ["updateOrganizationCampaign", () => updateOrganizationCampaign({ ...validUpdate, ownerId: ids.member })],
  ] as const)("%s denies a non-admin with two project memberships", async (_name, run) => {
    signIn(ids.member)
    duplicateProjectMembership(ids.member, ids.activeProject)
    await expect(run()).resolves.toEqual({ status: "denied" })
    expect(writes()).toEqual([])
    expect(
      harness.calls.find((call) => call.table === "project_members" && call.columns === "role, history_access")
    ).toMatchObject({
      matched: 2,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "project_id", value: ids.activeProject },
        { op: "eq", column: "profile_id", value: ids.member },
      ],
    })
  })

  it("returns unavailable when the create project belongs to another organization", async () => {
    signIn(ids.admin)
    await expect(
      createOrganizationCampaign({ ...validCreate, projectId: ids.foreignProject })
    ).resolves.toEqual({ status: "unavailable" })
    expect(writes()).toEqual([])
    expect(harness.calls.find((call) => call.table === "projects")).toMatchObject({
      columns: "id, archived_at",
      matched: 0,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "id", value: ids.foreignProject },
      ],
    })
  })

  it("returns unavailable when the create project id is missing", async () => {
    signIn(ids.admin)
    await expect(
      createOrganizationCampaign({ ...validCreate, projectId: ids.unknown })
    ).resolves.toEqual({ status: "unavailable" })
    expect(writes()).toEqual([])
    expect(harness.calls.find((call) => call.table === "projects")).toMatchObject({
      columns: "id, archived_at",
      matched: 0,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "id", value: ids.unknown },
      ],
    })
  })

  it("returns unavailable when the campaign project belongs to another organization", async () => {
    signIn(ids.admin)
    const campaignId = "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd"
    addCampaign(campaignId, ids.foreignProject, "foreign-parent")
    await expect(
      updateOrganizationCampaign({ ...validUpdate, campaignId })
    ).resolves.toEqual({ status: "unavailable" })
    expect(writes()).toEqual([])
    expect(harness.calls.find((call) => call.table === "projects")).toMatchObject({
      columns: "id, archived_at",
      matched: 0,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "id", value: ids.foreignProject },
      ],
    })
  })

  it("returns unavailable when the campaign project id is missing", async () => {
    signIn(ids.admin)
    const campaignId = "dededede-dede-4ded-8ded-dededededede"
    addCampaign(campaignId, ids.unknown, "missing-parent")
    await expect(
      updateOrganizationCampaign({ ...validUpdate, campaignId })
    ).resolves.toEqual({ status: "unavailable" })
    expect(writes()).toEqual([])
    expect(harness.calls.find((call) => call.table === "projects")).toMatchObject({
      columns: "id, archived_at",
      matched: 0,
      filters: [
        { op: "eq", column: "organization_id", value: ids.orgA },
        { op: "eq", column: "id", value: ids.unknown },
      ],
    })
  })
})

describe("calendar date validation", () => {
  it("rejects calendar-invalid dates before accessing Supabase", async () => {
    signIn(ids.admin)
    const created = await createOrganizationCampaign({
      ...validCreate,
      startsOn: "2026-02-01",
      endsOn: "2026-02-31",
    })
    expect(created).toEqual({
      status: "invalid",
      message: "Enter the start and end dates as YYYY-MM-DD.",
    })

    signIn(ids.admin)
    const updated = await updateOrganizationCampaign({
      ...validUpdate,
      startsOn: "2026-02-01",
      endsOn: "2026-02-31",
    })
    expect(updated).toEqual({
      status: "invalid",
      message: "Enter the start and end dates as YYYY-MM-DD.",
    })

    expect(harness.clients.created).toBe(0)
    expect(writes()).toEqual([])
  })
})


describe("assigned-only project visibility", () => {
 it.each([
  ["create campaign", () => createOrganizationCampaign(validCreate)],
  ["update campaign", () => updateOrganizationCampaign(validUpdate)],
  ["change campaign status", () => setOrganizationCampaignStatus({ organizationId: ids.orgA, campaignId: ids.activeCampaign, status: "on_hold" })],
 ] as const)("denies %s for a member without full history", async (_name, run) => {
  signIn(ids.member)
  const membership = harness.db.project_members.find((row) => row.profile_id === ids.member && row.project_id === ids.activeProject)
  if (!membership) throw new Error("Missing project membership fixture")
  membership.history_access = "assigned_only"
  await expect(run()).resolves.toEqual({ status: "denied" })
  expect(writes()).toEqual([])
 })
})


describe("Admin role: view/edit existing work only", () => {
 function signInAdmin() {
  signIn(ids.member)
  const membership = harness.db.organization_memberships.find(row => row.profile_id === ids.member)
  if (!membership) throw new Error("Missing organization membership fixture")
  membership.role = "admin"
 }
 it("does not offer campaign creation to Admin even with an existing project membership", async () => {
  signInAdmin()
  await expect(getCampaignCreationAccess(ids.orgA, ids.activeProject)).resolves.toEqual({ status: "ready", canCreate: false })
  expect(writes()).toEqual([])
 })
 it("denies a direct campaign creation action before writing", async () => {
  signInAdmin()
  await expect(createOrganizationCampaign(validCreate)).resolves.toEqual({ status: "denied" })
  expect(writes()).toEqual([])
 })
 it("lets Admin edit an existing campaign without individual project membership", async () => {
  signInAdmin(); removeProjectMembership(ids.member, ids.activeProject)
  await expect(updateOrganizationCampaign(validUpdate)).resolves.toEqual({ status: "updated" })
  expect(writes()).toHaveLength(1)
 })
 it("lets Admin change the status of an existing campaign", async () => {
  signInAdmin(); removeProjectMembership(ids.member, ids.activeProject)
  await expect(setOrganizationCampaignStatus({ organizationId: ids.orgA, campaignId: ids.activeCampaign, status: "on_hold" })).resolves.toEqual({ status: "updated" })
 })
})
