export const previewSeedCampaignIds = [
  "campaign-launch",
  "campaign-harbor",
  "campaign-demand",
  "campaign-webinar",
] as const

const previewSeedCampaignIdSet = new Set<string>(previewSeedCampaignIds)

const browserPreviewCampaignId =
  /^campaign-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function isPreviewCampaignId(id: string) {
  return previewSeedCampaignIdSet.has(id) || browserPreviewCampaignId.test(id)
}
