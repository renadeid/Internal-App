import type { Metadata } from "next"

import { OrganizationCampaignsView } from "@/components/marketing/organization-campaigns-view"


export const metadata: Metadata = {
  title: "Marketing",
}

export default function MarketingWorkspacePage() {
  return (
    <div className="flex flex-col gap-10">
      <OrganizationCampaignsView />

    </div>
  )
}
