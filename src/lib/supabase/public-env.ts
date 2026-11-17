const urlName = "NEXT_PUBLIC_SUPABASE_URL"
const keyName = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

export type SupabasePublicEnv = {
  url: string
  publishableKey: string
}

export function readSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""
  const missing = [
    url ? null : urlName,
    publishableKey ? null : keyName,
  ].filter((name) => name !== null)

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(" and ")}. Set them in .env.local. Use the publishable key, not a secret or service role key.`
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`${urlName} must be an absolute http(s) URL.`)
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${urlName} must use http or https.`)
  }

  assertPublishableKey(publishableKey)

  return { url: parsed.origin, publishableKey }
}

function assertPublishableKey(key: string) {
  if (key.startsWith("sb_secret_")) {
    throw new Error(
      `${keyName} is a secret key. Use the publishable key. This app does not send a privileged key.`
    )
  }

  const role = jwtRole(key)
  if (role === "service_role") {
    throw new Error(
      `${keyName} is a service role key. Use the publishable key. This app does not send a privileged key.`
    )
  }
}

function jwtRole(key: string) {
  const parts = key.split(".")
  if (parts.length !== 3) return null

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { role?: unknown }
    return typeof payload.role === "string" ? payload.role : null
  } catch {
    return null
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
  return atob(padded)
}
