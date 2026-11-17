import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { readSupabasePublicEnv } from "../src/lib/supabase/public-env.ts"

// Phase 1 denial checks for organization_memberships.
// A write is sent only by an account that does not administer the target organization.
// Inserts use a new membership id and a profile id that belongs to none of the five accounts.
// Duplicate inserts are omitted. The script stops if a seed membership changes and does not repair it.

const pinnedProjectRef = "xegkavnxtlneorpfptze"
const projectRefName = "COMPANY_HUB_TEST_PROJECT_REF"
const orgA = "5ec0a001-0000-4000-8000-000000000001"
const orgB = "5ec0b001-0000-4000-8000-000000000002"

const accountList = [
  {
    name: "admin",
    email: "security-admin@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_ADMIN_PASSWORD",
    label: "security-admin",
  },
  {
    name: "member",
    email: "security-member@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_MEMBER_PASSWORD",
    label: "security-member",
  },
  {
    name: "manager",
    email: "security-manager@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_MANAGER_PASSWORD",
    label: "security-manager",
  },
  {
    name: "viewer",
    email: "security-viewer@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_VIEWER_PASSWORD",
    label: "security-viewer",
  },
  {
    name: "outsider",
    email: "security-outsider@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_OUTSIDER_PASSWORD",
    label: "security-outsider",
  },
] as const

type ActorName = (typeof accountList)[number]["name"]
type OrgName = "A" | "B"
type OrgRole = "org_admin" | "member" | "viewer"

type WriteCase =
  | { kind: "insert"; actor: ActorName; org: OrgName; label: string }
  | {
      kind: "update"
      actor: ActorName
      org: OrgName
      target: ActorName
      role: OrgRole
      label: string
    }
  | { kind: "delete"; actor: ActorName; org: OrgName; target: ActorName; label: string }

const writeCases: WriteCase[] = [
  { kind: "insert", actor: "admin", org: "B", label: "admin insert into Security Org B" },
  { kind: "insert", actor: "outsider", org: "A", label: "outsider insert into Security Org A" },
  { kind: "insert", actor: "member", org: "A", label: "member insert org_admin into Security Org A" },
  { kind: "insert", actor: "member", org: "B", label: "member insert into Security Org B" },
  { kind: "insert", actor: "manager", org: "A", label: "manager insert org_admin into Security Org A" },
  { kind: "insert", actor: "manager", org: "B", label: "manager insert into Security Org B" },
  { kind: "insert", actor: "viewer", org: "A", label: "viewer insert org_admin into Security Org A" },
  { kind: "insert", actor: "viewer", org: "B", label: "viewer insert into Security Org B" },
  {
    kind: "update",
    actor: "member",
    org: "A",
    target: "member",
    role: "org_admin",
    label: "member update own role to org_admin",
  },
  {
    kind: "update",
    actor: "manager",
    org: "A",
    target: "manager",
    role: "org_admin",
    label: "manager update own role to org_admin",
  },
  {
    kind: "update",
    actor: "viewer",
    org: "A",
    target: "viewer",
    role: "org_admin",
    label: "viewer update own role to org_admin",
  },
  {
    kind: "update",
    actor: "member",
    org: "A",
    target: "viewer",
    role: "org_admin",
    label: "member update viewer role to org_admin",
  },
  {
    kind: "update",
    actor: "viewer",
    org: "A",
    target: "member",
    role: "org_admin",
    label: "viewer update member role to org_admin",
  },
  {
    kind: "update",
    actor: "manager",
    org: "A",
    target: "admin",
    role: "member",
    label: "manager update admin role to member",
  },
  {
    kind: "update",
    actor: "outsider",
    org: "A",
    target: "admin",
    role: "member",
    label: "outsider update Security Org A admin",
  },
  {
    kind: "update",
    actor: "admin",
    org: "B",
    target: "outsider",
    role: "member",
    label: "admin update Security Org B outsider",
  },
  { kind: "delete", actor: "member", org: "A", target: "member", label: "member delete own membership" },
  { kind: "delete", actor: "manager", org: "A", target: "manager", label: "manager delete own membership" },
  { kind: "delete", actor: "viewer", org: "A", target: "viewer", label: "viewer delete own membership" },
  { kind: "delete", actor: "member", org: "A", target: "admin", label: "member delete admin membership" },
  { kind: "delete", actor: "outsider", org: "A", target: "admin", label: "outsider delete Security Org A admin" },
  { kind: "delete", actor: "admin", org: "B", target: "outsider", label: "admin delete Security Org B outsider" },
]

const seedRoles: Record<ActorName, { org: OrgName; role: OrgRole }> = {
  admin: { org: "A", role: "org_admin" },
  member: { org: "A", role: "member" },
  manager: { org: "A", role: "member" },
  viewer: { org: "A", role: "viewer" },
  outsider: { org: "B", role: "org_admin" },
}

type MembershipRow = {
  id: string
  organization_id: string
  profile_id: string
  role: string
}

type Actor = {
  name: ActorName
  email: string
  label: string
  userId: string
  client: SupabaseClient
}

class TestFailure extends Error {}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(projectRoot, ".env.local")
const clients: SupabaseClient[] = []
const passwordSlots = accountList.map((account) => ({
  name: account.passwordName,
  value: process.env[account.passwordName] ?? "",
}))

let actors: Record<ActorName, Actor> | null = null
let seedFingerprint = ""

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8")
  for (const account of accountList) {
    if (new RegExp(`^${account.passwordName}=`, "m").test(envText)) {
      console.error(
        `Configuration: keep ${account.passwordName} out of .env.local. Pass it only in the shell for this command.`
      )
      process.exit(1)
    }
  }
}

const projectRef = process.env[projectRefName]?.trim() ?? ""

if (!projectRef) {
  console.error(
    `Configuration: set ${projectRefName} to the reference id of the company-hub-test project.`
  )
  process.exit(1)
}

for (const account of accountList) {
  const slot = passwordSlots.find((item) => item.name === account.passwordName)
  if (!slot?.value.trim()) {
    console.error(
      `Configuration: set ${account.passwordName} in the shell. Do not prefix it with NEXT_PUBLIC_.`
    )
    process.exit(1)
  }
}

const { url, publishableKey } = readSupabasePublicEnv()
const hostname = new URL(url).hostname

if (projectRef !== pinnedProjectRef || hostname !== `${pinnedProjectRef}.supabase.co`) {
  console.error(
    "Configuration: NEXT_PUBLIC_SUPABASE_URL is not the company-hub-test project."
  )
  process.exit(1)
}

let failed = false

try {
  actors = await signInAll()
  wipePasswords()
  const seedRows = await readSeed()
  assertSeed(seedRows)
  seedFingerprint = fingerprint(seedRows)
  for (const testCase of writeCases) reviewCase(testCase)
  for (const testCase of writeCases) await runCase(testCase)
  const finalRows = await expectSeedUnchanged("the final read")
  for (const row of finalRows) console.log(formatMembership(row))
  console.log("seed memberships unchanged: 5")
  console.log(`denied writes checked: ${writeCases.length}`)
} catch (error) {
  failed = true
  if (error instanceof TestFailure) console.error(error.message)
  else console.error("Membership write checks did not complete.")
} finally {
  wipePasswords()
  for (const client of clients) {
    const { error } = await client.auth.signOut()
    if (error) {
      console.error("Sign-out did not complete.")
      failed = true
    }
  }
}

process.exit(failed ? 1 : 0)

async function signInAll() {
  const signedIn = {} as Record<ActorName, Actor>

  for (const account of accountList) {
    const client = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    clients.push(client)
    const slot = passwordSlots.find((item) => item.name === account.passwordName)
    const password = slot?.value ?? ""
    if (slot) slot.value = ""

    const { error: signInError } = await client.auth.signInWithPassword({
      email: account.email,
      password,
    })

    if (signInError) {
      throw new TestFailure(`Sign-in was rejected for the ${account.label} account.`)
    }

    const { data: userData, error: userError } = await client.auth.getUser()
    const user = userData.user
    if (userError || !user || user.email !== account.email) {
      throw new TestFailure(`getUser() did not return the ${account.label} account.`)
    }

    signedIn[account.name] = {
      name: account.name,
      email: account.email,
      label: account.label,
      userId: user.id,
      client,
    }
  }

  const ids = accountList.map((account) => signedIn[account.name].userId)
  if (new Set(ids).size !== accountList.length) {
    throw new TestFailure("The five security profiles must be five different accounts.")
  }

  return signedIn
}

async function readSeed() {
  const current = requireActors()
  const adminRows = await visibleMemberships(current.admin)
  const outsiderRows = await visibleMemberships(current.outsider)
  return [...adminRows, ...outsiderRows]
}

function assertSeed(rows: MembershipRow[]) {
  const current = requireActors()
  if (rows.length !== 5) {
    throw new TestFailure("The seed does not contain the expected five memberships.")
  }

  for (const account of accountList) {
    const expected = seedRoles[account.name]
    const organizationId = orgId(expected.org)
    const matches = rows.filter(
      (row) =>
        row.organization_id === organizationId &&
        row.profile_id === current[account.name].userId &&
        row.role === expected.role
    )
    if (matches.length !== 1) {
      throw new TestFailure(
        `The ${account.label} seed membership does not match its expected organization and role.`
      )
    }
  }

  const orgAIds = new Set(
    accountList.filter((account) => account.name !== "outsider").map((account) => current[account.name].userId)
  )
  const adminRows = rows.filter((row) => row.organization_id === orgA)
  const outsiderRows = rows.filter((row) => row.organization_id === orgB)
  if (
    adminRows.length !== 4 ||
    outsiderRows.length !== 1 ||
    adminRows.some((row) => !orgAIds.has(row.profile_id)) ||
    outsiderRows[0]?.profile_id !== current.outsider.userId
  ) {
    throw new TestFailure("The seed organizations are not isolated to the expected accounts.")
  }
}

function reviewCase(testCase: WriteCase) {
  const organizationId = orgId(testCase.org)
  if (administeredOrg(testCase.actor) === organizationId) {
    throw new TestFailure("Refusing a write against an organization this account administers.")
  }

  if (testCase.kind === "insert") return

  if (seedRoles[testCase.target].org !== testCase.org) {
    throw new TestFailure("Refusing a write aimed at a membership outside its organization.")
  }

  if (testCase.kind === "update" && testCase.role === seedRoles[testCase.target].role) {
    throw new TestFailure("Refusing an update that repeats the seed role.")
  }
}

async function runCase(testCase: WriteCase) {
  reviewCase(testCase)
  if (testCase.kind === "insert") await expectInsertDenied(testCase.actor, testCase.org, testCase.label)
  if (testCase.kind === "update") {
    await expectUpdateDenied(
      testCase.actor,
      testCase.org,
      testCase.target,
      testCase.role,
      testCase.label
    )
  }
  if (testCase.kind === "delete") {
    await expectDeleteDenied(testCase.actor, testCase.org, testCase.target, testCase.label)
  }
}

async function expectInsertDenied(actorName: ActorName, org: OrgName, label: string) {
  const actor = requireActors()[actorName]
  const organizationId = orgId(org)
  assertActorCannotAdminister(actorName, organizationId)
  const blocked = blockedIds()
  const membershipId = freshId(blocked)
  blocked.add(membershipId)
  const profileId = freshId(blocked)

  const { data, error } = await actor.client
    .from("organization_memberships")
    .insert({
      id: membershipId,
      organization_id: organizationId,
      profile_id: profileId,
      role: "org_admin",
    })
    .select("id")

  const reader = org === "A" ? requireActors().admin : requireActors().outsider
  const { data: found, error: readError } = await reader.client
    .from("organization_memberships")
    .select("id")
    .eq("id", membershipId)
  const denied =
    error?.code === "42501" &&
    !(Array.isArray(data) && data.length > 0) &&
    !readError &&
    Array.isArray(found) &&
    found.length === 0

  await expectSeedUnchanged(label)
  if (!denied) {
    throw new TestFailure(
      error?.code === "42501"
        ? `${label} left a membership behind.`
        : `${label} was not denied with 42501.`
    )
  }
  console.log(`${label}: denied (42501)`)
}

async function expectUpdateDenied(
  actorName: ActorName,
  org: OrgName,
  targetName: ActorName,
  role: OrgRole,
  label: string
) {
  const current = requireActors()
  const organizationId = orgId(org)
  assertActorCannotAdminister(actorName, organizationId)

  const { data, error } = await current[actorName].client
    .from("organization_memberships")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("profile_id", current[targetName].userId)
    .select("id, organization_id, profile_id, role")

  const denied = !error && Array.isArray(data) && data.length === 0
  await expectSeedUnchanged(label)
  if (!denied) throw new TestFailure(`${label} was not denied with 0 rows.`)
  console.log(`${label}: denied (0 rows)`)
}

async function expectDeleteDenied(
  actorName: ActorName,
  org: OrgName,
  targetName: ActorName,
  label: string
) {
  const current = requireActors()
  const organizationId = orgId(org)
  assertActorCannotAdminister(actorName, organizationId)

  const { data, error } = await current[actorName].client
    .from("organization_memberships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("profile_id", current[targetName].userId)
    .select("id")

  const denied = !error && Array.isArray(data) && data.length === 0
  await expectSeedUnchanged(label)
  if (!denied) throw new TestFailure(`${label} was not denied with 0 rows.`)
  console.log(`${label}: denied (0 rows)`)
}

async function visibleMemberships(actor: Actor) {
  const { data, error } = await actor.client
    .from("organization_memberships")
    .select("id, organization_id, profile_id, role")
    .order("organization_id", { ascending: true })
    .order("profile_id", { ascending: true })

  if (error) throw new TestFailure(`Membership read failed (${safeErrorCode(error.code)}).`)
  return asRows(data)
}

async function expectSeedUnchanged(label: string) {
  const rows = await readSeed()
  if (fingerprint(rows) !== seedFingerprint) {
    const details = [...rows]
      .sort(compareMemberships)
      .map((row) => formatMembership(row))
      .join("\n")
    throw new TestFailure(`Seed memberships changed after ${label}.\n${details}`)
  }
  return [...rows].sort(compareMemberships)
}

function assertActorCannotAdminister(actorName: ActorName, organizationId: string) {
  if (administeredOrg(actorName) === organizationId) {
    throw new TestFailure("Refusing a write against an organization this account administers.")
  }
}

function administeredOrg(actorName: ActorName) {
  if (actorName === "admin") return orgA
  if (actorName === "outsider") return orgB
  return null
}

function orgId(org: OrgName) {
  return org === "A" ? orgA : orgB
}

function blockedIds() {
  const current = requireActors()
  return new Set<string>([
    orgA,
    orgB,
    ...accountList.map((account) => current[account.name].userId),
  ])
}

function freshId(blocked: Set<string>) {
  const id = crypto.randomUUID()
  if (blocked.has(id)) throw new TestFailure("Generated id collided with the seed.")
  return id
}

function asRows(data: unknown) {
  if (!Array.isArray(data)) throw new TestFailure("Membership read returned an unexpected result.")
  return data.map((row) => {
    if (!row || typeof row !== "object") {
      throw new TestFailure("Membership read returned an unexpected result.")
    }
    const record = row as Record<string, unknown>
    const id = record.id
    const organizationId = record.organization_id
    const profileId = record.profile_id
    const role = record.role
    if (
      typeof id !== "string" ||
      typeof organizationId !== "string" ||
      typeof profileId !== "string" ||
      typeof role !== "string"
    ) {
      throw new TestFailure("Membership read returned an unexpected result.")
    }
    return {
      id,
      organization_id: organizationId,
      profile_id: profileId,
      role,
    }
  })
}

function fingerprint(rows: MembershipRow[]) {
  return [...rows]
    .map((row) => `${row.id}|${row.organization_id}|${row.profile_id}|${row.role}`)
    .sort()
    .join("\n")
}

function compareMemberships(left: MembershipRow, right: MembershipRow) {
  return (
    left.organization_id.localeCompare(right.organization_id) ||
    left.profile_id.localeCompare(right.profile_id)
  )
}

function formatMembership(row: MembershipRow) {
  return `organization_id=${row.organization_id} profile_id=${row.profile_id} role=${row.role}`
}

function requireActors() {
  if (!actors) throw new TestFailure("Membership write checks did not complete.")
  return actors
}

function wipePasswords() {
  for (const slot of passwordSlots) slot.value = ""
  for (const account of accountList) delete process.env[account.passwordName]
}

function safeErrorCode(code: string | undefined) {
  if (!code || !/^[A-Za-z0-9_-]{1,40}$/.test(code)) return "unknown"
  return code
}
