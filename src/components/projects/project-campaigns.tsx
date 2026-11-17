"use client"

import Link from "next/link"

import { EmptyNote } from "@/components/projects/empty-note"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { dateRange } from "@/lib/dates"
import { campaignPath } from "@/lib/mock-data/campaigns"
import { getMember } from "@/lib/mock-data/team"
import { campaignStatusClass, surfaceClass } from "@/lib/presentation"
import { campaignsForProject } from "@/lib/project-records"
import { campaignProgress } from "@/lib/records-store"

export function ProjectCampaigns({ projectId }: { projectId: string }) {
  const { campaigns, tasks, deliverables } = useWorkspace()
  const visible = campaignsForProject(campaigns, projectId)

  if (visible.length === 0) {
    return (
      <EmptyNote>
        No campaigns are linked to this project yet. Marketing can add one
        from the Marketing workspace, and it will show up here.
      </EmptyNote>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {visible.map((campaign) => {
        const owner = getMember(campaign.ownerId)
        const progress = campaignProgress(campaign.id, tasks, deliverables)
        const items = deliverables.filter((item) => item.campaignId === campaign.id)
        return (
          <article key={campaign.id} className={`${surfaceClass} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className={campaignStatusClass[campaign.status]}>
                {campaign.status}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {dateRange(campaign.startDate, campaign.endDate)}
              </p>
            </div>
            <h2 className="mt-3 text-base font-semibold tracking-tight">
              <Link
                href={campaignPath(campaign.id)}
                className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {campaign.name}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {campaign.description || "No description yet."}
            </p>
            <p className="mt-4 text-sm">
              <span className="font-medium">Owner: </span>
              {owner.name}
            </p>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-medium text-foreground tabular-nums">{progress}%</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${campaign.name} progress`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <h3 className="mt-4 text-sm font-medium">Deliverables</h3>
            {items.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No deliverables yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.title} · {item.status}
                  </li>
                ))}
              </ul>
            )}
          </article>
        )
      })}
    </div>
  )
}
