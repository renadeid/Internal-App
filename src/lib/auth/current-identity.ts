import "server-only"

import { toUserIdentity, type CurrentIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"
import { employeePhotoUrls } from "@/lib/employee-photos"

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, job_title, avatar_color, initials")
    .eq("id", user.id)
    .maybeSingle()

  const membership = await supabase.from("organization_memberships").select("organization_id").eq("profile_id", user.id).limit(1)
  const organizationId = membership.data?.[0]?.organization_id
  const photos = organizationId ? await employeePhotoUrls(organizationId, [user.id]) : new Map<string, string>()
  return {
    ...toUserIdentity({
      authEmail: user.email ?? null,
      fullName: profile?.full_name ?? null,
      profileEmail: profile?.email ?? null,
      jobTitle: profile?.job_title ?? null,
      avatarColor: profile?.avatar_color ?? null,
      initials: profile?.initials ?? null,
    }),
    profileId: user.id,
    avatarUrl: photos.get(user.id),
  }
}
