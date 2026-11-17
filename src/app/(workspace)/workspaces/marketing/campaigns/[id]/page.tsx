import type { Metadata } from "next"

import { OrganizationCampaignRecord } from "@/components/marketing/organization-campaign-record"
import { CampaignDetail } from "@/components/marketing/campaign-detail"
import { initialCampaigns } from "@/lib/mock-data/campaigns"

import { isPreviewCampaignId } from "./preview-campaign-id"

type CampaignPageProps = {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return initialCampaigns.map((campaign) => ({ id: campaign.id }))
}

export async function generateMetadata({
  params,
}: CampaignPageProps): Promise<Metadata> {
  const { id } = await params
  const campaign = initialCampaigns.find((item) => item.id === id)
  return { title: campaign?.name ?? "Campaign" }
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params
  if (isPreviewCampaignId(id)) return <CampaignDetail campaignId={id} />
  return <OrganizationCampaignRecord campaignId={id} />
}
