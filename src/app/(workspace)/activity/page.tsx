import type { Metadata } from "next"

import { ActivityFeed } from "@/components/activity/activity-feed"
import { PageIntro } from "@/components/shared/page-intro"

export const metadata: Metadata = {
  title: "Activity",
}

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Activity"
        description="What changed across projects, files, and reviews. Each item opens the place that work lives."
      />
      <ActivityFeed />
    </div>
  )
}
