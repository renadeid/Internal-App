import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createClient } from "@supabase/supabase-js"

import { readSupabasePublicEnv } from "../src/lib/supabase/public-env.ts"

const orgA = "5ec0a001-0000-4000-8000-000000000001"
const orgB = "5ec0b001-0000-4000-8000-000000000002"
const projectRefName = "COMPANY_HUB_TEST_PROJECT_REF"

const accounts = {
  admin: {
    email: "security-admin@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_ADMIN_PASSWORD",
    userLabel: "security-admin",
    expected: null,
  },
  outsider: {
    email: "security-outsider@company-hub-test.invalid",
    passwordName: "COMPANY_HUB_SECURITY_OUTSIDER_PASSWORD",
    userLabel: "security-outsider",
    expected: { organizationId: orgB, excludedOrganizationId: orgA },
  },
} as const

const accountKey = process.argv[2] ?? "admin"
const account = accounts[accountKey as keyof typeof accounts]

if (!account) {
  console.error("Configuration: choose the admin or outsider account.")
  process.exit(1)
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(projectRoot, ".env.local")

if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8")
  if (new RegExp(`^${account.passwordName}=`, "m").test(envText)) {
    console.error(
      `Configuration: keep ${account.passwordName} out of .env.local. Pass it only in the shell for this command.`
    )
    process.exit(1)
  }
}

const projectRef = process.env[projectRefName]?.trim() ?? ""
const password = process.env[account.passwordName] ?? ""

if (!projectRef) {
  console.error(
    `Configuration: set ${projectRefName} to the reference id of the company-hub-test project.`
  )
  process.exit(1)
}

if (!password.trim()) {
  console.error(
    `Configuration: set ${account.passwordName} in the shell. Do not prefix it with NEXT_PUBLIC_.`
  )
  process.exit(1)
}

const { url, publishableKey } = readSupabasePublicEnv()
const hostname = new URL(url).hostname

if (hostname !== `${projectRef}.supabase.co`) {
  console.error(
    "Configuration: NEXT_PUBLIC_SUPABASE_URL is not the company-hub-test project."
  )
  process.exit(1)
}

const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

let failed = false

try {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  })

  if (signInError) {
    console.error("Sign-in was rejected.")
    failed = true
  } else {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const user = userData.user

    if (userError || !user || user.email !== account.email) {
      console.error(`getUser() did not return the ${account.userLabel} account.`)
      failed = true
    } else {
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("organization_id, profile_id, role")
        .order("organization_id", { ascending: true })

      if (membershipError) {
        console.error(
          `Membership read failed (${safeErrorCode(membershipError.code)}).`
        )
        failed = true
      } else {
        const rows = memberships ?? []
        console.log(`signed in as ${account.email}`)
        console.log(`visible memberships: ${rows.length}`)
        for (const row of rows) {
          console.log(
            `organization_id=${row.organization_id} profile_id=${row.profile_id} role=${row.role}`
          )
        }

        if (
          account.expected &&
          (rows.length !== 1 ||
            rows.filter((row) => row.organization_id === account.expected?.organizationId)
              .length !== 1 ||
            rows.some(
              (row) => row.organization_id === account.expected?.excludedOrganizationId
            ))
        ) {
          console.error(
            "Expected exactly 1 Security Org B membership and 0 Security Org A memberships."
          )
          failed = true
        }
      }
    }
  }
} finally {
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) {
    console.error("Sign-out did not complete.")
    failed = true
  }
}

process.exit(failed ? 1 : 0)

function safeErrorCode(code: string | undefined) {
  if (!code || !/^[A-Za-z0-9_-]{1,40}$/.test(code)) return "unknown"
  return code
}
