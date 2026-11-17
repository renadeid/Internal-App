import "server-only"

import type {
  AccessibleOrganization,
  OrganizationAccess,
} from "@/lib/auth/organization-access"
import { createClient } from "@/lib/supabase/server"

export async function getAccessibleOrganizations(): Promise<OrganizationAccess> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return { status: "ready", organizations: [] }

  const memberships = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)

  if (memberships.error || !memberships.data) return { status: "unavailable" }

  const membershipIds = [
    ...new Set(memberships.data.map((row) => row.organization_id)),
  ]
  if (membershipIds.length === 0) return { status: "ready", organizations: [] }

  const organizations = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", membershipIds)

  if (organizations.error || !organizations.data) return { status: "unavailable" }

  const allowed = new Set(membershipIds)
  const visible: AccessibleOrganization[] = organizations.data
    .filter(
      (organization) =>
        allowed.has(organization.id) && organization.name.trim().length > 0
    )
    .map((organization) => ({
      id: organization.id,
      name: organization.name.trim(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (visible.length === 0) return { status: "unavailable" }
  return { status: "ready", organizations: visible }
}
