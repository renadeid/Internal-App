import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/supabase/database"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"

/**
 * Server client for Server Components, Server Actions, and Route Handlers.
 * Create a new client for each request. Do not store it in a global.
 * Uses the publishable key so Row Level Security still applies.
 * `src/proxy.ts` refreshes the session. This client reads that cookie and
 * verifies the user with `getUser()`.
 */
export async function createClient() {
  const { url, publishableKey } = readSupabasePublicEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies.
          // The proxy refreshes the session before rendering.
        }
      },
    },
  })
}
