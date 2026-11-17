import { readFileSync } from "node:fs"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { initialCampaigns } from "@/lib/mock-data/campaigns"

const getOrganizationCampaign = vi.fn()
const createOrganizationCampaign = vi.fn()
const updateOrganizationCampaign = vi.fn()
const setOrganizationCampaignStatus = vi.fn()

vi.mock("@/components/marketing/campaign-detail", () => ({
  CampaignDetail: function CampaignDetail() {
    return null
  },
}))

vi.mock("@/components/marketing/organization-campaign-record", () => ({
  OrganizationCampaignRecord: function OrganizationCampaignRecord() {
    return null
  },
}))

vi.mock("@/lib/auth/get-organization-campaigns", () => ({
  getOrganizationCampaign: (...args: unknown[]) => getOrganizationCampaign(...args),
}))

vi.mock("@/lib/auth/campaign-creation-actions", () => ({
  createOrganizationCampaign: (...args: unknown[]) => createOrganizationCampaign(...args),
  getCampaignCreationAccess: vi.fn(),
}))

vi.mock("@/lib/auth/campaign-update-actions", () => ({
  updateOrganizationCampaign: (...args: unknown[]) => updateOrganizationCampaign(...args),
  setOrganizationCampaignStatus: (...args: unknown[]) => setOrganizationCampaignStatus(...args),
  getOrganizationCampaignUpdateAccess: vi.fn(),
}))

import { CampaignDetail } from "@/components/marketing/campaign-detail"
import { OrganizationCampaignRecord } from "@/components/marketing/organization-campaign-record"

import CampaignPage from "./page"
import { isPreviewCampaignId, previewSeedCampaignIds } from "./preview-campaign-id"

const browserPreviewId = "campaign-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const bareCampaignId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

describe("preview campaign id classification", () => {
  it("recognizes the four preview seed ids", () => {
    expect(previewSeedCampaignIds).toEqual([
      "campaign-launch",
      "campaign-harbor",
      "campaign-demand",
      "campaign-webinar",
    ])
    expect(initialCampaigns.map((campaign) => campaign.id)).toEqual([...previewSeedCampaignIds])
    for (const id of previewSeedCampaignIds) expect(isPreviewCampaignId(id)).toBe(true)
  })

  it("recognizes a browser-created campaign-<uuid> id", () => {
    expect(isPreviewCampaignId(browserPreviewId)).toBe(true)
    expect(isPreviewCampaignId(`campaign-${bareCampaignId.toUpperCase()}`)).toBe(true)
  })

  it("rejects a bare uuid", () => {
    expect(isPreviewCampaignId(bareCampaignId)).toBe(false)
  })

  it.each([
    "campaign-other",
    "campaign-launch-extra",
    "campaign-",
    "CAMPAIGN-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ])("rejects an unknown campaign- prefix: %s", (id) => {
    expect(isPreviewCampaignId(id)).toBe(false)
  })

  it.each([
    "campaign-123",
    "campaign-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa",
    "campaign-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-extra",
    "campaign- aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "campaign-zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz",
  ])("rejects a malformed uuid: %s", (id) => {
    expect(isPreviewCampaignId(id)).toBe(false)
  })

  it.each(["", "spring", "campaign", "not-a-campaign"])(
    "rejects an empty or unrelated id: %s",
    (id) => {
      expect(isPreviewCampaignId(id)).toBe(false)
    }
  )
})

describe("campaign route selection", () => {
  beforeEach(() => {
    getOrganizationCampaign.mockClear()
    createOrganizationCampaign.mockClear()
    updateOrganizationCampaign.mockClear()
    setOrganizationCampaignStatus.mockClear()
  })

  it("uses the classification helper", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8")
    expect(source).toContain('from "./preview-campaign-id"')
    expect(source).toContain("isPreviewCampaignId(id)")
  })

  it.each([
    ...previewSeedCampaignIds,
    browserPreviewId,
    bareCampaignId,
    "campaign-other",
    "campaign-123",
    "",
  ])("selects the detail component for %s", async (id) => {
    const element = await CampaignPage({ params: Promise.resolve({ id }) })
    expect(element.type).toBe(isPreviewCampaignId(id) ? CampaignDetail : OrganizationCampaignRecord)
    expect(element.props).toEqual({ campaignId: id })
  })

  it("does not call campaign server actions while choosing the route", async () => {
    await CampaignPage({ params: Promise.resolve({ id: browserPreviewId }) })
    await CampaignPage({ params: Promise.resolve({ id: bareCampaignId }) })
    await CampaignPage({ params: Promise.resolve({ id: "campaign-other" }) })
    expect(getOrganizationCampaign).not.toHaveBeenCalled()
    expect(createOrganizationCampaign).not.toHaveBeenCalled()
    expect(updateOrganizationCampaign).not.toHaveBeenCalled()
    expect(setOrganizationCampaignStatus).not.toHaveBeenCalled()
  })
})
