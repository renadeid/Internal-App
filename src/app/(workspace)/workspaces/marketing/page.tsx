import type { Metadata } from "next"

import { OrganizationCampaignsView } from "@/components/marketing/organization-campaigns-view"
import { MarketingWorkspace } from "@/components/marketing/marketing-workspace"

export const metadata: Metadata = {
  title: "Marketing",
}

export default function MarketingWorkspacePage() {
  return (
    <div className="flex flex-col gap-10">
      <OrganizationCampaignsView />
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <MarketingWorkspace />
      </section>
    </div>
  )
}
