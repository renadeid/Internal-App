"use server"

import { getAccessibleOrganizations } from "@/lib/auth/current-organizations"
import type {
  OrganizationCampaign,
  OrganizationCampaignResult,
  OrganizationCampaignsResult,
} from "@/lib/auth/organization-campaigns"
import { toUserIdentity } from "@/lib/auth/user-identity"
import { createClient } from "@/lib/supabase/server"

const campaignColumns =
  "id, project_id, slug, name, description, goals, owner_id, type, status, starts_on, ends_on, archived_at"

export async function getOrganizationCampaigns(
  organizationId: string
): Promise<OrganizationCampaignsResult> {
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context
  return loadCampaigns(context.supabase, organizationId, null)
}

export async function getOrganizationProjectCampaigns(
  organizationId: string,
  projectId: string
): Promise<OrganizationCampaignsResult> {
  if (!isUuid(projectId)) return { status: "unavailable" }
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context
  return loadCampaigns(context.supabase, organizationId, projectId)
}

export async function getOrganizationCampaign(
  organizationId: string,
  campaignId: string
): Promise<OrganizationCampaignResult> {
  if (!isUuid(campaignId)) return { status: "missing" }
  const context = await openOrganization(organizationId)
  if (context.status !== "ready") return context

  const row = await context.supabase
    .from("campaigns")
    .select(campaignColumns)
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()

  if (row.error) return { status: "error" }
  if (!row.data) return { status: "missing" }
  const campaigns = await withRelatedLabels(context.supabase, organizationId, [row.data])
  if (!campaigns || !campaigns[0]) return { status: "error" }
  return { status: "ready", campaign: campaigns[0] }
}

async function loadCampaigns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  projectId: string | null
): Promise<OrganizationCampaignsResult> {
  const scoped = supabase
    .from("campaigns")
    .select(campaignColumns)
    .eq("organization_id", organizationId)
  const rows = await (projectId ? scoped.eq("project_id", projectId) : scoped).order("name", {
    ascending: true,
  })

  if (rows.error || !rows.data) return { status: "error" }
  const campaigns = await withRelatedLabels(supabase, organizationId, rows.data)
  if (!campaigns) return { status: "error" }
  return { status: "ready", campaigns }
}

async function openOrganization(organizationId: string) {
  const access = await getAccessibleOrganizations()
  if (access.status !== "ready") return { status: "error" as const }
  const selected = access.organizations.some(
    (organization) => organization.id === organizationId
  )
  if (!selected) return { status: "rejected" as const }
  return { status: "ready" as const, supabase: await createClient() }
}

async function withRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  rows: CampaignRow[]
): Promise<OrganizationCampaign[] | null> {
  const projectIds = [...new Set(rows.map((row) => row.project_id))]
  const ownerIds = [...new Set(rows.map((row) => row.owner_id))]

  const projects =
    projectIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("id", projectIds)
  const owners =
    ownerIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds)

  if (projects.error || !projects.data || owners.error || !owners.data) return null

  const projectNames = new Map(
    projects.data.map((project) => [project.id, project.name.trim()])
  )
  const ownerNames = new Map(
    owners.data.map((owner) => [
      owner.id,
      toUserIdentity({
        authEmail: null,
        fullName: owner.full_name,
        profileEmail: owner.email,
        jobTitle: null,
        avatarColor: null,
        initials: null,
      }).name,
    ])
  )

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: projectNames.get(row.project_id) ?? null,
    slug: row.slug,
    name: row.name.trim(),
    description: row.description.trim(),
    goals: row.goals.trim(),
    ownerId: row.owner_id,
    ownerName: ownerNames.get(row.owner_id) ?? null,
    type: row.type,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    archivedAt: row.archived_at,
  }))
}

type CampaignRow = {
  id: string
  project_id: string
  slug: string
  name: string
  description: string
  goals: string
  owner_id: string
  type: OrganizationCampaign["type"]
  status: OrganizationCampaign["status"]
  starts_on: string
  ends_on: string
  archived_at: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}
