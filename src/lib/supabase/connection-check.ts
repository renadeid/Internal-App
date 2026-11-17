import "server-only"

import { readSupabasePublicEnv } from "./public-env.ts"

export type SupabaseConnectionFailureReason =
  | "missing-env"
  | "unreachable"
  | "rejected"
  | "unexpected"

export type SupabaseConnectionResult =
  | { ok: true }
  | {
      ok: false
      reason: SupabaseConnectionFailureReason
      message: string
    }

/**
 * Confirms the project URL and publishable key can reach Supabase Auth.
 * Does not query tables and does not use a service role key.
 * Messages are safe to log: they name the variable, never the value.
 */
export async function verifySupabaseConnection(): Promise<SupabaseConnectionResult> {
  let url = ""
  let publishableKey = ""

  try {
    const env = readSupabasePublicEnv()
    url = env.url
    publishableKey = env.publishableKey
  } catch (error) {
    return {
      ok: false,
      reason: "missing-env",
      message:
        error instanceof Error
          ? error.message
          : "Supabase environment is not configured.",
    }
  }

  let response: Response
  try {
    response = await fetch(new URL("/auth/v1/settings", url), {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      cache: "no-store",
    })
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      message:
        "Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL and the network.",
    }
  }

  if (response.status === 401 || response.status === 403) {
    await discardBody(response)
    return {
      ok: false,
      reason: "rejected",
      message:
        "Supabase rejected the publishable key. Check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    }
  }

  if (!response.ok) {
    await discardBody(response)
    return {
      ok: false,
      reason: "unexpected",
      message: `Supabase connectivity check failed with status ${response.status}.`,
    }
  }

  await discardBody(response)
  return { ok: true }
}

async function discardBody(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    // The status is enough. The body is not logged.
  }
}
