"use client"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { EmptyNote } from "@/components/projects/empty-note"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { activityForProject } from "@/lib/project-records"

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { activity } = useWorkspace()
  const items = activityForProject(activity, projectId)

  if (items.length === 0) {
    return (
      <EmptyNote>
        No activity has been recorded for this project yet.
      </EmptyNote>
    )
  }

  return (
    <ul className="roaya-glass rounded-2xl border border-border bg-card px-4 py-2">
      {items.map((item) => (
        <ActivityFeedItem key={item.id} item={item} />
      ))}
    </ul>
  )
}
