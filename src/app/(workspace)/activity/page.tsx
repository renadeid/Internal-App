import type { Metadata } from "next"

import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { PageIntro } from "@/components/shared/page-intro"

export const metadata: Metadata = {
  title: "Activity",
}

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        title="Activity"
        description="What changed across projects, tasks and reviews, day by day. Each item opens the place that work lives."
      />
      <ActivityTimeline />
    </div>
  )
}
