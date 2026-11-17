"use server"

import { isValidCalendarDate } from "@/lib/auth/calendar-date"

import { refreshOrganizationCampaigns } from "@/lib/auth/campaign-list-refresh"
import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import {
  campaignStatusValues,
  campaignTypeValues,
  type CampaignOwnerOption,
  type CampaignStatusValue,
  type CampaignTypeValue,
  type CampaignUpdateAccess,
  type SetCampaignStatusInput,
  type SetCampaignStatusResult,
  type UpdateCampaignInput,
  type UpdateCampaignResult,
} from "@/lib/auth/organization-campaigns"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

export async function getOrganizationCampaignUpdateAccess(
  organizationId: string,
  campaignId: string
): Promise<CampaignUpdateAccess> {
  if (!isUuid(campaignId)) return { status: "ready", canEdit: false }

  const supabase = await openSelectedOrganization(organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const campaign = await loadCampaign(supabase.client, organizationId, campaignId)
  if (campaign.status === "error") return { status: "error" }
  if (campaign.status !== "ready") return { status: "ready", canEdit: false }
  if (campaign.campaign.archived_at) return { status: "ready", canEdit: false }

  const project = await loadProject(
    supabase.client,
    organizationId,
    campaign.campaign.project_id
  )
  if (project.status === "error") return { status: "error" }
  if (project.status !== "ready" || project.project.archived_at) {
    return { status: "ready", canEdit: false }
  }

  const allowed = await canWriteProject(
    supabase.client,
    organizationId,
    campaign.campaign.project_id,
    user.id
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "ready", canEdit: false }

  const owners = await loadOwners(
    supabase.client,
    organizationId,
    campaign.campaign.project_id
  )
  if (owners.status !== "ready") return owners
  if (owners.owners.length === 0) return { status: "error" }

  return { status: "ready", canEdit: true, owners: owners.owners }
}

export async function updateOrganizationCampaign(
  input: UpdateCampaignInput
): Promise<UpdateCampaignResult> {
  const name = input.name.trim()
  const description = input.description.trim()
  const goals = input.goals.trim()

  if (!isUuid(input.campaignId)) {
    return { status: "invalid", message: "This campaign address is not valid." }
  }
  if (!name) return { status: "invalid", message: "Enter a campaign name." }
  if (!isUuid(input.ownerId)) {
    return { status: "invalid", message: "Choose an owner from this project." }
  }
  if (!isType(input.type)) return { status: "invalid", message: "Choose a type." }
  if (!isStatus(input.status)) return { status: "invalid", message: "Choose a status." }
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) {
    return { status: "invalid", message: "Enter the start and end dates as YYYY-MM-DD." }
  }
  if (input.endsOn < input.startsOn) {
    return {
      status: "invalid",
      message: "The end date must be on or after the start date.",
    }
  }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const ready = await readyToUpdate(
    supabase.client,
    input.organizationId,
    input.campaignId,
    user.id,
    input.ownerId
  )
  if (ready) return ready

  const updated = await supabase.client
    .from("campaigns")
    .update(
      {
        name,
        description,
        goals,
        owner_id: input.ownerId,
        type: input.type,
        status: input.status,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
      },
      { count: "exact" }
    )
    .eq("id", input.campaignId)
    .eq("organization_id", input.organizationId)
    .is("archived_at", null)

  if (updated.error) return mapUpdateError(updated.error.code)
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  refreshOrganizationCampaigns()
  return { status: "updated" }
}

export async function setOrganizationCampaignStatus(
  input: SetCampaignStatusInput
): Promise<SetCampaignStatusResult> {
  if (!isUuid(input.campaignId)) {
    return { status: "invalid", message: "This campaign address is not valid." }
  }
  if (!isStatus(input.status)) return { status: "invalid", message: "Choose a status." }

  const supabase = await openSelectedOrganization(input.organizationId)
  if (supabase.status !== "ready") return supabase

  const { data: userData } = await supabase.client.auth.getUser()
  const user = userData.user
  if (!user) return { status: "rejected" }

  const ready = await readyToUpdate(
    supabase.client,
    input.organizationId,
    input.campaignId,
    user.id,
    null
  )
  if (ready) return ready

  const updated = await supabase.client
    .from("campaigns")
    .update({ status: input.status }, { count: "exact" })
    .eq("id", input.campaignId)
    .eq("organization_id", input.organizationId)
    .is("archived_at", null)

  if (updated.error) {
    const mapped = mapUpdateError(updated.error.code)
    if (mapped.status === "conflict") return { status: "error" }
    return mapped
  }
  if (updated.count === 0) return { status: "unavailable" }
  if (updated.count !== 1) return { status: "error" }
  refreshOrganizationCampaigns()
  return { status: "updated" }
}

async function readyToUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  campaignId: string,
  userId: string,
  ownerId: string | null
): Promise<Exclude<SetCampaignStatusResult, { status: "updated" }> | null> {
  const campaign = await loadCampaign(supabase, organizationId, campaignId)
  if (campaign.status === "error") return { status: "error" }
  if (campaign.status !== "ready") return { status: "unavailable" }
  if (campaign.campaign.archived_at) {
    return {
      status: "invalid",
      message: "This campaign is archived and cannot be edited.",
    }
  }

  const project = await loadProject(supabase, organizationId, campaign.campaign.project_id)
  if (project.status === "error") return { status: "error" }
  if (project.status !== "ready") return { status: "unavailable" }
  if (project.project.archived_at) {
    return {
      status: "invalid",
      message: "Restore this project before editing a campaign.",
    }
  }

  const allowed = await canWriteProject(
    supabase,
    organizationId,
    campaign.campaign.project_id,
    userId
  )
  if (allowed === "error") return { status: "error" }
  if (!allowed) return { status: "denied" }

  if (!ownerId) return null
  const owner = await supabase
    .from("project_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("project_id", campaign.campaign.project_id)
    .eq("profile_id", ownerId)
  if (owner.error || !owner.data) return { status: "error" }
  if (owner.data.length === 0) {
    return {
      status: "invalid",
      message: "Choose an owner who belongs to this project.",
    }
  }
  if (owner.data.length !== 1) return { status: "error" }
  return null
}

async function loadCampaign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  campaignId: string
) {
  const campaign = await supabase
    .from("campaigns")
    .select("id, project_id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()
  if (campaign.error) return { status: "error" as const }
  if (!campaign.data) return { status: "missing" as const }
  return { status: "ready" as const, campaign: campaign.data }
}

async function loadProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string
) {
  const project = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle()
  if (project.error) return { status: "error" as const }
  if (!project.data) return { status: "missing" as const }
  return { status: "ready" as const, project: project.data }
}

async function loadOwners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string
): Promise<{ status: "error" } | { status: "ready"; owners: CampaignOwnerOption[] }> {
  const members = await supabase
    .from("project_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
  if (members.error || !members.data) return { status: "error" }

  const profileIds: string[] = []
  const seen = new Set<string>()
  for (const member of members.data) {
    if (seen.has(member.profile_id)) return { status: "error" }
    seen.add(member.profile_id)
    profileIds.push(member.profile_id)
  }

  const profiles =
    profileIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
  if (profiles.error || !profiles.data) return { status: "error" }

  const profilesById = new Map(profiles.data.map((profile) => [profile.id, profile]))
  const owners = profileIds
    .map((profileId) => {
      const profile = profilesById.get(profileId)
      const name = profile
        ? toUserIdentity({
            authEmail: null,
            fullName: profile.full_name,
            profileEmail: profile.email,
            jobTitle: null,
            avatarColor: null,
            initials: null,
          }).name
        : "Unknown member"
      return { id: profileId, name }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  return { status: "ready", owners }
}

async function canWriteProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string,
  userId: string
) {
  const membership = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
  if (membership.error || !membership.data || membership.data.length !== 1) {
    return "error" as const
  }
  if (membership.data[0].role === "org_admin") return true
  if (membership.data[0].role === "viewer") return false

  const projectMember = await supabase
    .from("project_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .eq("profile_id", userId)
  if (projectMember.error || !projectMember.data) return "error" as const
  if (projectMember.data.length !== 1) return false
  return projectMember.data[0].role !== "viewer"
}

async function openSelectedOrganization(organizationId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" as const }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" as const }
  return { status: "ready" as const, client: await createClient() }
}

function mapUpdateError(
  code: string | undefined
): Exclude<UpdateCampaignResult, { status: "updated" }> {
  if (code === "42501") return { status: "denied" }
  if (code === "23505") return { status: "conflict" }
  if (code === "23514" || code === "23503" || code === "P0001") {
    return {
      status: "invalid",
      message: "The campaign did not meet the database rules.",
    }
  }
  return { status: "error" }
}

function isType(value: string): value is CampaignTypeValue {
  return campaignTypeValues.some((type) => type === value)
}

function isStatus(value: string): value is CampaignStatusValue {
  return campaignStatusValues.some((status) => status === value)
}

function isDate(value: string) {
  return isValidCalendarDate(value)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
