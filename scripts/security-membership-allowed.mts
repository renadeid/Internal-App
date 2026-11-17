import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { readSupabasePublicEnv } from "../src/lib/supabase/public-env.ts"

// Allowed and denied membership writes for security-org-write only.
// The disposable admin membership is never deleted. Org A and Org B are never written.

const pinnedProjectRef = "xegkavnxtlneorpfptze"
const projectRefName = "COMPANY_HUB_TEST_PROJECT_REF"
const orgA = "5ec0a001-0000-4000-8000-000000000001"
const orgB = "5ec0b001-0000-4000-8000-000000000002"
const orgWrite = "5ec0c001-0000-4000-8000-000000000003"
const memberMembershipId = "5ec0c101-0000-4000-8000-000000000003"

const accounts = [
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
] as const

const orgARoles = [
  { email: "security-admin@company-hub-test.invalid", role: "org_admin" },
  { email: "security-member@company-hub-test.invalid", role: "member" },
  { email: "security-manager@company-hub-test.invalid", role: "member" },
  { email: "security-viewer@company-hub-test.invalid", role: "viewer" },
] as const

type ActorName = (typeof accounts)[number]["name"]
type OrgRole = "org_admin" | "member" | "viewer"

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
const passwordSlots = accounts.map((account) => ({
  name: account.passwordName,
  value: process.env[account.passwordName] ?? "",
}))

let actors: Record<ActorName, Actor> | null = null
let orgAFingerprint = ""
let adminMembershipId = ""
let disposableChanged = false

if (
  String(orgWrite) === orgA ||
  String(orgWrite) === orgB ||
  String(memberMembershipId) === orgWrite
) {
  console.error("Refusing to use a seed organization as the disposable organization.")
  process.exit(1)
}

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8")
  for (const account of accounts) {
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

for (const account of accounts) {
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
  await verifyInitialFixture()
  await runSequence()
  const current = requireActors()
  const finalRows = await membershipsIn(current.admin, orgA)
  const writeRows = await membershipsIn(current.admin, orgWrite)
  if (finalRows.length !== orgARoles.length || fingerprint(finalRows) !== orgAFingerprint) {
    throw new TestFailure("Security Org A changed. No repair was attempted.")
  }
  if (
    writeRows.length !== 1 ||
    writeRows[0]?.id !== adminMembershipId ||
    writeRows[0]?.profile_id !== current.admin.userId ||
    writeRows[0]?.role !== "org_admin"
  ) {
    throw new TestFailure("security-org-write does not contain only the disposable admin membership.")
  }
  for (const row of [...finalRows, ...writeRows].sort(compareMemberships)) {
    console.log(formatMembership(row))
  }
  console.log(`Org A memberships unchanged: ${finalRows.length}`)
  console.log(`security-org-write memberships: ${writeRows.length}`)
} catch (error) {
  failed = true
  if (error instanceof TestFailure) console.error(error.message)
  else console.error("Membership allowed-write checks did not complete.")
  if (disposableChanged) {
    console.error(
      "Run the security-org-write cleanup script. Security Org A and Security Org B were not targeted."
    )
  }
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

  for (const account of accounts) {
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

  if (signedIn.admin.userId === signedIn.member.userId) {
    throw new TestFailure("The admin and member profiles must be different accounts.")
  }

  return signedIn
}

async function verifyInitialFixture() {
  const current = requireActors()
  const adminOrgs = new Set((await allMemberships(current.admin)).map((row) => row.organization_id))
  const memberOrgs = new Set((await allMemberships(current.member)).map((row) => row.organization_id))

  if (adminOrgs.has(orgB) || memberOrgs.has(orgB)) {
    throw new TestFailure("A session can see Security Org B. No rows were written.")
  }
  if (![...adminOrgs].every((organizationId) => organizationId === orgA || organizationId === orgWrite)) {
    throw new TestFailure("The admin session can see an unexpected organization. No rows were written.")
  }
  if (memberOrgs.size !== 1 || !memberOrgs.has(orgA)) {
    throw new TestFailure("The member can already see security-org-write. Run the cleanup script first.")
  }

  await expectOrgARoles()
  orgAFingerprint = fingerprint(await membershipsIn(current.admin, orgA))

  const writeRows = await membershipsIn(current.admin, orgWrite)
  const memberView = await membershipsIn(current.member, orgWrite)
  if (memberView.length !== 0) {
    throw new TestFailure("The member can already see security-org-write. Run the cleanup script first.")
  }
  if (writeRows.length === 0) {
    throw new TestFailure("security-org-write is missing. Run the create script before this test.")
  }
  if (writeRows.length !== 1 || writeRows[0]?.profile_id !== current.admin.userId || writeRows[0]?.role !== "org_admin") {
    throw new TestFailure("security-org-write must contain only the admin membership before the test writes.")
  }

  adminMembershipId = writeRows[0].id
  if (adminMembershipId === memberMembershipId) {
    throw new TestFailure("Refusing to use the disposable admin membership id for the member row.")
  }

  const existingMemberRow = await membershipsIn(current.admin, orgWrite)
  if (existingMemberRow.some((row) => row.id === memberMembershipId || row.profile_id === current.member.userId)) {
    throw new TestFailure("The disposable member membership already exists. Run the cleanup script first.")
  }
}

async function runSequence() {
  const current = requireActors()

  await expectMemberInsertDenied()
  await expectMemberUpdateDenied(current.admin.userId, "member", "member update disposable admin role")
  await expectMemberDeleteDenied(current.admin.userId, "member delete disposable admin membership")
  await expectAdminRow("org_admin")
  console.log("member insert, update, and delete of the disposable admin: denied")

  disposableChanged = true
  await adminInsertMember()
  await expectWriteRoles([
    { profileId: current.admin.userId, role: "org_admin" },
    { profileId: current.member.userId, role: "member" },
  ])
  console.log("admin insert member: allowed")

  await expectMemberUpdateDenied(current.member.userId, "org_admin", "member update own role to org_admin")
  await expectMemberDeleteDenied(current.member.userId, "member delete own membership")
  await expectWriteRoles([
    { profileId: current.admin.userId, role: "org_admin" },
    { profileId: current.member.userId, role: "member" },
  ])
  console.log("member update and delete before promotion: denied (0 rows)")

  await adminUpdateMember("viewer")
  await expectWriteRoles([
    { profileId: current.admin.userId, role: "org_admin" },
    { profileId: current.member.userId, role: "viewer" },
  ])
  console.log("admin update member to viewer: allowed")

  await expectMemberUpdateDenied(current.member.userId, "org_admin", "viewer update own role to org_admin")
  await expectWriteRoles([
    { profileId: current.admin.userId, role: "org_admin" },
    { profileId: current.member.userId, role: "viewer" },
  ])
  console.log("member update after viewer change: denied (0 rows)")

  await adminUpdateMember("org_admin")
  await expectWriteRoles([
    { profileId: current.admin.userId, role: "org_admin" },
    { profileId: current.member.userId, role: "org_admin" },
  ])
  console.log("admin update member to org_admin: allowed")

  await adminDeleteMember()
  await expectAdminRow("org_admin")
  const memberView = await membershipsIn(current.member, orgWrite)
  if (memberView.length !== 0) {
    throw new TestFailure("The member can still see security-org-write after the member row was deleted.")
  }
  await expectOrgAUntouched()
  console.log("admin delete member: allowed")
}

async function expectMemberInsertDenied() {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  const { data, error } = await current.member.client
    .from("organization_memberships")
    .insert({
      id: memberMembershipId,
      organization_id: orgWrite,
      profile_id: current.member.userId,
      role: "org_admin",
    })
    .select("id, organization_id, profile_id, role")

  const created = Array.isArray(data) && data.length > 0
  if (created) disposableChanged = true
  const stillAbsent = (await membershipsIn(current.admin, orgWrite)).every(
    (row) => row.id !== memberMembershipId && row.profile_id !== current.member.userId
  )
  await expectAdminRow("org_admin")
  if (error?.code !== "42501" || created || !stillAbsent) {
    throw new TestFailure("member insert into security-org-write was not denied with 42501.")
  }
}

async function expectMemberUpdateDenied(profileId: string, role: OrgRole, label: string) {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  const { data, error } = await current.member.client
    .from("organization_memberships")
    .update({ role })
    .eq("organization_id", orgWrite)
    .eq("profile_id", profileId)
    .select("id, organization_id, profile_id, role")

  if (Array.isArray(data) && data.length > 0) disposableChanged = true
  await expectOrgAUntouched()
  if (error || !Array.isArray(data) || data.length !== 0) {
    throw new TestFailure(`${label} was not denied with 0 rows.`)
  }
}

async function expectMemberDeleteDenied(profileId: string, label: string) {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  const actor = current.member
  const deniesAdminMembership = profileId === current.admin.userId
  const deniesOwnMembership = profileId === actor.userId
  const memberActor =
    actor.name === "member" &&
    actor.userId !== current.admin.userId &&
    actor.client !== current.admin.client
  if (!memberActor || (!deniesAdminMembership && !deniesOwnMembership)) {
    throw new TestFailure(
      deniesAdminMembership
        ? "Refusing to delete the disposable admin membership."
        : "Refusing a denied delete from an unexpected actor or membership."
    )
  }

  const { data, error } = await current.member.client
    .from("organization_memberships")
    .delete()
    .eq("organization_id", orgWrite)
    .eq("profile_id", profileId)
    .select("id")

  if (Array.isArray(data) && data.length > 0) disposableChanged = true
  await expectOrgAUntouched()
  if (error || !Array.isArray(data) || data.length !== 0) {
    throw new TestFailure(`${label} was not denied with 0 rows.`)
  }
}

async function adminInsertMember() {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  const { data, error } = await current.admin.client
    .from("organization_memberships")
    .insert({
      id: memberMembershipId,
      organization_id: orgWrite,
      profile_id: current.member.userId,
      role: "member",
    })
    .select("id, organization_id, profile_id, role")

  const rows = asRows(data)
  if (
    error ||
    rows.length !== 1 ||
    rows[0]?.id !== memberMembershipId ||
    rows[0]?.organization_id !== orgWrite ||
    rows[0]?.profile_id !== current.member.userId ||
    rows[0]?.role !== "member"
  ) {
    throw new TestFailure("admin insert of the member did not return the disposable member row.")
  }
  await expectOrgAUntouched()
}

async function adminUpdateMember(role: OrgRole) {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  if (current.member.userId === current.admin.userId) {
    throw new TestFailure("Refusing to update the disposable admin membership.")
  }

  const { data, error } = await current.admin.client
    .from("organization_memberships")
    .update({ role })
    .eq("id", memberMembershipId)
    .eq("organization_id", orgWrite)
    .eq("profile_id", current.member.userId)
    .select("id, organization_id, profile_id, role")

  const rows = asRows(data)
  if (
    error ||
    rows.length !== 1 ||
    rows[0]?.id !== memberMembershipId ||
    rows[0]?.organization_id !== orgWrite ||
    rows[0]?.profile_id !== current.member.userId ||
    rows[0]?.role !== role
  ) {
    throw new TestFailure(`admin update of the member to ${role} did not return that role.`)
  }
  await expectOrgAUntouched()
  await expectAdminRow("org_admin")
}

async function adminDeleteMember() {
  const current = requireActors()
  assertWriteOrganization(orgWrite)
  if (memberMembershipId === adminMembershipId || current.member.userId === current.admin.userId) {
    throw new TestFailure("Refusing to delete the disposable admin membership.")
  }

  const { data, error } = await current.admin.client
    .from("organization_memberships")
    .delete()
    .eq("id", memberMembershipId)
    .eq("organization_id", orgWrite)
    .eq("profile_id", current.member.userId)
    .neq("profile_id", current.admin.userId)
    .select("id, organization_id, profile_id")

  const rows = asRows(data)
  if (
    error ||
    rows.length !== 1 ||
    rows[0]?.id !== memberMembershipId ||
    rows[0]?.organization_id !== orgWrite ||
    rows[0]?.profile_id !== current.member.userId
  ) {
    throw new TestFailure("admin delete of the member did not return the disposable member row.")
  }
  await expectOrgAUntouched()
}

async function expectAdminRow(role: OrgRole) {
  const current = requireActors()
  const rows = await membershipsIn(current.admin, orgWrite)
  const adminRows = rows.filter((row) => row.profile_id === current.admin.userId)
  if (
    adminRows.length !== 1 ||
    adminRows[0]?.id !== adminMembershipId ||
    adminRows[0]?.role !== role ||
    adminRows[0]?.organization_id !== orgWrite
  ) {
    throw new TestFailure("The disposable admin membership changed.")
  }
}

async function expectWriteRoles(expected: { profileId: string; role: OrgRole }[]) {
  const rows = await membershipsIn(requireActors().admin, orgWrite)
  if (rows.length !== expected.length) {
    throw new TestFailure("security-org-write does not have the expected memberships.")
  }
  for (const item of expected) {
    const matches = rows.filter((row) => row.profile_id === item.profileId && row.role === item.role)
    if (matches.length !== 1) {
      throw new TestFailure("security-org-write does not have the expected membership role.")
    }
  }
  await expectAdminRow("org_admin")
  await expectOrgAUntouched()
}

async function expectOrgARoles() {
  const current = requireActors()
  const { data, error } = await current.admin.client.from("profiles").select("id, email")
  if (error) throw new TestFailure(`Profile read failed (${safeErrorCode(error.code)}).`)
  const emails = new Map<string, string>()
  if (!Array.isArray(data)) throw new TestFailure("Profile read returned an unexpected result.")
  for (const row of data) {
    if (!row || typeof row !== "object") throw new TestFailure("Profile read returned an unexpected result.")
    const record = row as Record<string, unknown>
    if (typeof record.id !== "string" || typeof record.email !== "string") {
      throw new TestFailure("Profile read returned an unexpected result.")
    }
    emails.set(record.email, record.id)
  }

  const rows = await membershipsIn(current.admin, orgA)
  if (rows.length !== orgARoles.length) {
    throw new TestFailure("Security Org A does not have its four seed memberships.")
  }
  for (const expected of orgARoles) {
    const profileId = emails.get(expected.email)
    const matches = rows.filter((row) => row.profile_id === profileId && row.role === expected.role)
    if (!profileId || matches.length !== 1) {
      throw new TestFailure(`Security Org A is missing the ${expected.role} membership for ${expected.email}.`)
    }
  }
}

async function expectOrgAUntouched() {
  const rows = await membershipsIn(requireActors().admin, orgA)
  if (fingerprint(rows) !== orgAFingerprint) {
    const details = [...rows].sort(compareMemberships).map((row) => formatMembership(row)).join("\n")
    throw new TestFailure(`Security Org A changed. No repair was attempted.\n${details}`)
  }
}

async function allMemberships(actor: Actor) {
  const { data, error } = await actor.client
    .from("organization_memberships")
    .select("id, organization_id, profile_id, role")
    .order("organization_id", { ascending: true })
  if (error) throw new TestFailure(`Membership read failed (${safeErrorCode(error.code)}).`)
  return asRows(data)
}

async function membershipsIn(actor: Actor, organizationId: string) {
  const { data, error } = await actor.client
    .from("organization_memberships")
    .select("id, organization_id, profile_id, role")
    .eq("organization_id", organizationId)
    .order("profile_id", { ascending: true })
  if (error) throw new TestFailure(`Membership read failed (${safeErrorCode(error.code)}).`)
  const rows = asRows(data)
  if (rows.some((row) => row.organization_id !== organizationId)) {
    throw new TestFailure("Membership read returned a row outside the requested organization.")
  }
  return rows
}

function assertWriteOrganization(organizationId: string) {
  if (organizationId !== orgWrite) {
    throw new TestFailure("Refusing a write outside security-org-write.")
  }
}

function asRows(data: unknown) {
  if (data == null) return []
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
      (role !== undefined && typeof role !== "string")
    ) {
      throw new TestFailure("Membership read returned an unexpected result.")
    }
    return {
      id,
      organization_id: organizationId,
      profile_id: profileId,
      role: typeof role === "string" ? role : "",
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
  if (!actors) throw new TestFailure("Membership allowed-write checks did not complete.")
  return actors
}

function wipePasswords() {
  for (const slot of passwordSlots) slot.value = ""
  for (const account of accounts) delete process.env[account.passwordName]
}

function safeErrorCode(code: string | undefined) {
  if (!code || !/^[A-Za-z0-9_-]{1,40}$/.test(code)) return "unknown"
  return code
}
