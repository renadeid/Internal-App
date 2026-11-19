"use server"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  OrganizationPeopleResult,
  OrganizationPerson,
  OrganizationRole,
} from "@/lib/auth/organization-people"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

export async function getOrganizationPeople(
  organizationId: string
): Promise<OrganizationPeopleResult> {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return { status: "rejected" }

  const memberships = await supabase
    .from("organization_memberships")
    .select("profile_id, role")
    .eq("organization_id", organizationId)

  if (memberships.error || !memberships.data) return { status: "error" }

  const profileIds = [...new Set(memberships.data.map((row) => row.profile_id))]
  const profiles =
    profileIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_color, initials")
          .in("id", profileIds)

  if (profiles.error || !profiles.data) return { status: "error" }

  const profilesById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  const people = memberships.data.map((membership) =>
    toPerson(
      membership.profile_id,
      membership.role,
      profilesById.get(membership.profile_id) ?? null
    )
  )
  people.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.email.localeCompare(right.email)
  )

  return { status: "ready", currentUserId: user.id, people }
}

function toPerson(
  profileId: string,
  role: OrganizationRole,
  profile: {
    full_name: string
    email: string
    avatar_color: string | null
    initials: string | null
  } | null
): OrganizationPerson {
  if (!profile) {
    return {
      profileId,
      name: "Unknown member",
      email: "No email on this profile",
      initials: "?",
      avatarColor: "#3D5A80",
      role,
    }
  }

  const identity = toUserIdentity({
    authEmail: null,
    fullName: profile.full_name,
    profileEmail: profile.email,
    jobTitle: null,
    avatarColor: profile.avatar_color,
    initials: profile.initials,
  })

  return {
    profileId,
    name: identity.name,
    email: identity.email,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    role,
  }
}
