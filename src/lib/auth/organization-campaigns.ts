import type { Database } from "@/lib/supabase/database"
import type { CampaignStatus } from "@/lib/types"

export type CampaignStatusValue = Database["public"]["Enums"]["campaign_status"]
export type CampaignTypeValue = Database["public"]["Enums"]["campaign_type"]

export type OrganizationCampaign = {
  id: string
  projectId: string
  projectName: string | null
  slug: string
  name: string
  description: string
  goals: string
  ownerId: string
  ownerName: string | null
  type: CampaignTypeValue
  status: CampaignStatusValue
  startsOn: string
  endsOn: string
  archivedAt: string | null
}

export type OrganizationCampaignsResult =
  | { status: "ready"; campaigns: OrganizationCampaign[] }
  | { status: "error" }
  | { status: "rejected" }
  | { status: "unavailable" }

export type OrganizationCampaignResult =
  | { status: "ready"; campaign: OrganizationCampaign }
  | { status: "missing" }
  | { status: "error" }
  | { status: "rejected" }

export const campaignTypeValues: CampaignTypeValue[] = [
  "social_media",
  "email",
  "paid_ads",
  "content",
  "event",
  "other",
]

export const campaignStatusValues: CampaignStatusValue[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
]

export type CreateCampaignInput = {
  organizationId: string
  projectId: string
  name: string
  description: string
  goals: string
  ownerId: string
  type: CampaignTypeValue
  status: CampaignStatusValue
  startsOn: string
  endsOn: string
}

export type CreateCampaignResult =
  | { status: "created"; campaignId: string }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "conflict" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type CampaignProjectOption = {
  id: string
  name: string
}

export type CampaignOwnerOption = {
  id: string
  name: string
}

export type CampaignCreationAccess =
  | { status: "error" }
  | { status: "rejected" }
  | { status: "ready"; canCreate: false }
  | {
      status: "ready"
      canCreate: true
      projects: CampaignProjectOption[]
      owners: CampaignOwnerOption[]
      defaultOwnerId: string | null
    }

export type UpdateCampaignInput = {
  organizationId: string
  campaignId: string
  name: string
  description: string
  goals: string
  ownerId: string
  type: CampaignTypeValue
  status: CampaignStatusValue
  startsOn: string
  endsOn: string
}

export type UpdateCampaignResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "conflict" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type SetCampaignStatusInput = {
  organizationId: string
  campaignId: string
  status: CampaignStatusValue
}

export type SetCampaignStatusResult =
  | { status: "updated" }
  | { status: "invalid"; message: string }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "rejected" }
  | { status: "error" }

export type CampaignUpdateAccess =
  | { status: "error" }
  | { status: "rejected" }
  | { status: "ready"; canEdit: false }
  | {
      status: "ready"
      canEdit: true
      owners: CampaignOwnerOption[]
    }

export function campaignStatusLabel(status: CampaignStatusValue): CampaignStatus {
  if (status === "planning") return "Planning"
  if (status === "active") return "Active"
  if (status === "on_hold") return "On Hold"
  return "Completed"
}

export function campaignTypeLabel(type: CampaignTypeValue) {
  if (type === "social_media") return "Social Media"
  if (type === "email") return "Email"
  if (type === "paid_ads") return "Paid Ads"
  if (type === "content") return "Content"
  if (type === "event") return "Event"
  return "Other"
}
