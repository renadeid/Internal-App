import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/database"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"

/**
 * Browser client for Client Components.
 * In the browser, createBrowserClient returns one shared instance.
 * Do not construct another Supabase client beside this function.
 * The key is the publishable key only.
 */
export function createClient() {
  const { url, publishableKey } = readSupabasePublicEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
