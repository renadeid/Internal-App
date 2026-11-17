import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { readSupabasePublicEnv } from "../src/lib/supabase/public-env.ts"

// Temporary read-only sign-in check. It prints a result category and no session.

const memberEmail = "security-member@company-hub-test.invalid"
const passwordName = "COMPANY_HUB_SECURITY_MEMBER_PASSWORD"
const pinnedProjectRef = "xegkavnxtlneorpfptze"
const categories = [
  "configuration",
  "invalid-credentials",
  "email-not-confirmed",
  "rate-limited",
  "network",
  "rejected",
] as const

type FailureCategory = (typeof categories)[number]

class AuthCheckFailure extends Error {
  category: FailureCategory

  constructor(category: FailureCategory) {
    super(category)
    this.category = category
  }
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(projectRoot, ".env.local")
let password = ""
let supabase: SupabaseClient | null = null

try {
  if (existsSync(envPath)) {
    const envText = readFileSync(envPath, "utf8")
    if (new RegExp(`^${passwordName}=`, "m").test(envText)) {
      throw new AuthCheckFailure("configuration")
    }
  }

  password = process.env[passwordName] ?? ""
  delete process.env[passwordName]
  if (!password.trim()) throw new AuthCheckFailure("configuration")

  let url = ""
  let publishableKey = ""
  try {
    ;({ url, publishableKey } = readSupabasePublicEnv())
  } catch {
    throw new AuthCheckFailure("configuration")
  }
  if (new URL(url).hostname !== `${pinnedProjectRef}.supabase.co`) {
    throw new AuthCheckFailure("configuration")
  }

  supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: memberEmail,
    password,
  })
  password = ""
  if (signInError) throw new AuthCheckFailure(categoryFor(signInError))

  const { data, error: userError } = await supabase.auth.getUser()
  if (userError || data.user?.email !== memberEmail) throw new AuthCheckFailure("rejected")

  const signedIn = supabase
  supabase = null
  const { error: signOutError } = await signedIn.auth.signOut()
  if (signOutError) throw new AuthCheckFailure("rejected")

  console.log("authentication succeeded")
} catch (error) {
  const category = error instanceof AuthCheckFailure ? error.category : categoryFor(error)
  console.error(`authentication failed (${category})`)
  process.exitCode = 1
} finally {
  password = ""
  delete process.env[passwordName]
  if (supabase) {
    await supabase.auth.signOut().catch(() => {
      if (process.exitCode !== 1) {
        console.error("authentication failed (rejected)")
        process.exitCode = 1
      }
    })
  }
}

function categoryFor(error: unknown): FailureCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("invalid login credentials")) return "invalid-credentials"
  if (message.includes("email not confirmed")) return "email-not-confirmed"
  if (message.includes("too many requests") || message.includes("rate limit")) return "rate-limited"
  if (message.includes("fetch") || message.includes("network")) return "network"
  return "rejected"
}
