import type { Database } from "@/lib/supabase/database"

export type OrganizationRole = Database["public"]["Enums"]["org_role"]

export type OrganizationPerson = {
  profileId: string
  name: string
  email: string
  initials: string
  avatarColor: string
  avatarUrl?: string
  role: OrganizationRole
}

export type OrganizationPeopleResult =
  | { status: "ready"; currentUserId: string; people: OrganizationPerson[] }
  | { status: "error" }
  | { status: "rejected" }
