import "server-only"
import { createClient } from "@supabase/supabase-js"
import { readSupabasePublicEnv } from "@/lib/supabase/public-env"

export const employeePhotoBucket = "employee-photos"
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function employeePhotoPath(organizationId: string, profileId: string) {
  if (!uuid.test(organizationId) || !uuid.test(profileId)) throw new Error("Invalid employee photo path.")
  return `${organizationId}/${profileId}.webp`
}

export function employeePhotoAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Photo storage is not configured.")
  return createClient(readSupabasePublicEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Internal only: callers must first verify access to this organisation and its profiles. */
export async function employeePhotoUrls(organizationId: string, profileIds: string[]) {
  const urls = new Map<string, string>()
  if (!profileIds.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return urls
  try {
    const admin = employeePhotoAdmin()
    for (let i = 0; i < profileIds.length; i += 100) {
      const ids = profileIds.slice(i, i + 100)
      const paths = ids.map(id => employeePhotoPath(organizationId, id))
      const result = await admin.storage.from(employeePhotoBucket).createSignedUrls(paths, 3600)
      for (const item of result.data ?? []) {
        if (!item.error && item.signedUrl && item.path) {
          const id = ids[paths.indexOf(item.path)]
          if (id) urls.set(id, item.signedUrl)
        }
      }
    }
  } catch { /* Keep initials usable when storage is unavailable or a photo is missing. */ }
  return urls
}
