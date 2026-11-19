import type { Database } from "@/lib/supabase/database"
export type AccessibleOrganization = {
  role?: Database["public"]["Enums"]["org_role"]
  id: string
  name: string
}

export type OrganizationAccess =
  | { status: "ready"; organizations: AccessibleOrganization[] }
  | { status: "unavailable" }
