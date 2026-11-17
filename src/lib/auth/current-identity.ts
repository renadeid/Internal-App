import "server-only"

import { toUserIdentity, type CurrentIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

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
  }
}
