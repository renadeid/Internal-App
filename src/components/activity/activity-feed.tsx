"use client"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { useWorkspace } from "@/components/workspace/workspace-provider"

export function ActivityFeed() {
  const { activity } = useWorkspace()

  return (
    <div className="roaya-glass rounded-2xl border border-border bg-card px-3 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <ul>
        {activity.map((item) => (
          <ActivityFeedItem key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}
