"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Clock3, LayoutGrid, List, Megaphone, SquareCheck } from "lucide-react"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ActingAs } from "@/components/marketing/acting-as"
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog"
import { ProgressMeter } from "@/components/marketing/progress-meter"
import { PageIntro } from "@/components/shared/page-intro"
import { MarketingProjects } from "@/components/workspaces/marketing-projects"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { dateRange, formatIsoDate } from "@/lib/dates"
import { campaignPath } from "@/lib/mock-data/campaigns"
import { getMember, team } from "@/lib/mock-data/team"
import { getProjectName } from "@/lib/mock-data/projects"
import { campaignStatusClass, surfaceClass } from "@/lib/presentation"
import { campaignProgress } from "@/lib/records-store"
import {
  campaignStatuses,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
} from "@/lib/types"

type StatusFilter = "All" | CampaignStatus
type ViewMode = "grid" | "list"

const statusFilters: StatusFilter[] = ["All", ...campaignStatuses]

function blankCampaign(ownerId: string): CampaignInput {
  return {
    name: "",
    description: "",
    projectId: "",
    ownerId,
    type: "Content",
    status: "Planning",
    startDate: "",
    endDate: "",
    goals: "",
  }
}

export function MarketingWorkspace() {
  const { projects, campaigns, tasks, deliverables, activity, actorId, createCampaign } =
    useWorkspace()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("All")
  const [projectId, setProjectId] = useState("all")
  const [ownerId, setOwnerId] = useState("all")
  const [view, setView] = useState<ViewMode>("grid")
  const [creating, setCreating] = useState(false)
  const [formSession, setFormSession] = useState(0)

  const projectItems = [
    { value: "all", label: "All projects" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ]
  const ownerItems = [
    { value: "all", label: "All owners" },
    ...team.map((member) => ({ value: member.id, label: member.name })),
  ]

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return campaigns.filter((campaign) => {
      const matchesQuery =
        !needle ||
        campaign.name.toLowerCase().includes(needle) ||
        campaign.description.toLowerCase().includes(needle)
      const matchesStatus = status === "All" || campaign.status === status
      const matchesProject = projectId === "all" || campaign.projectId === projectId
      const matchesOwner = ownerId === "all" || campaign.ownerId === ownerId
      return matchesQuery && matchesStatus && matchesProject && matchesOwner
    })
  }, [campaigns, ownerId, projectId, query, status])

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Active").length
  const pendingApprovals = deliverables.filter((item) => item.status === "Submitted").length
  const upcomingDeadlines =
    tasks.filter((task) => task.campaignId && task.status !== "Done" && task.dueDate).length +
    deliverables.filter((item) => item.status !== "Approved" && item.dueDate).length
  const completedDeliverables = deliverables.filter((item) => item.status === "Approved").length
  const recent = activity.filter((item) => item.campaignId).slice(0, 6)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Preview workspace"
          description="Sample campaigns, approvals, and activity stored in this browser. They are not records from the selected organization."
        />
        <ActingAs />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Campaigns"
          value={activeCampaigns}
          hint="Campaigns currently in motion"
          icon={Megaphone}
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingApprovals}
          hint="Deliverables waiting on review"
          icon={SquareCheck}
          accent="violet"
        />
        <KpiCard
          label="Upcoming Deadlines"
          value={upcomingDeadlines}
          hint="Open campaign work with a due date"
          icon={Clock3}
        />
        <KpiCard
          label="Completed Deliverables"
          value={completedDeliverables}
          hint="Approved and ready to use"
          icon={CheckCircle2}
          accent="violet"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Preview projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sample project cards. They are not projects from the selected
            organization.
          </p>
        </div>
        <MarketingProjects />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Preview campaigns</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {visible.length} of {campaigns.length} campaigns
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setFormSession((current) => current + 1)
              setCreating(true)
            }}
          >
            Create Campaign
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            value={query}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="h-9 max-w-md"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {statusFilters.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={status === item ? "default" : "outline"}
                  aria-pressed={status === item}
                  className="rounded-full"
                  onClick={() => setStatus(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={(value) => {
                if (value) setProjectId(value)
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={ownerItems}
              value={ownerId}
              onValueChange={(value) => {
                if (value) setOwnerId(value)
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter by owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-1" role="group" aria-label="Campaign layout">
              <Button
                type="button"
                size="icon"
                variant={view === "grid" ? "default" : "outline"}
                aria-pressed={view === "grid"}
                aria-label="Grid view"
                onClick={() => setView("grid")}
              >
                <LayoutGrid />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={view === "list" ? "default" : "outline"}
                aria-pressed={view === "list"}
                aria-label="List view"
                onClick={() => setView("list")}
              >
                <List />
              </Button>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className={`${surfaceClass} px-5 py-10 text-sm text-muted-foreground`}>
            No campaigns match these filters.
          </p>
        ) : view === "grid" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                projectName={getProjectName(projects, campaign.projectId)}
                progress={campaignProgress(campaign.id, tasks, deliverables)}
              />
            ))}
          </div>
        ) : (
          <div className={surfaceClass}>
            <ul>
              {visible.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  projectName={getProjectName(projects, campaign.projectId)}
                  progress={campaignProgress(campaign.id, tasks, deliverables)}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates from campaigns across the shared projects.
          </p>
        </div>
        <div className={`${surfaceClass} px-4 py-2 sm:px-5`}>
          {recent.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No campaign activity yet.</p>
          ) : (
            <ul>
              {recent.map((item) => (
                <ActivityFeedItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <CampaignFormDialog
        key={formSession}
        open={creating}
        onOpenChange={setCreating}
        projects={projects}
        initial={blankCampaign(actorId)}
        title="Create campaign"
        submitLabel="Create campaign"
        onSubmit={createCampaign}
      />
    </div>
  )
}

function CampaignCard({
  campaign,
  projectName,
  progress,
}: {
  campaign: Campaign
  projectName: string
  progress: number
}) {
  const owner = getMember(campaign.ownerId)

  return (
    <article className={`${surfaceClass} flex flex-col p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary" className={campaignStatusClass[campaign.status]}>
          {campaign.status}
        </Badge>
        <p className="text-xs text-muted-foreground">{campaign.type}</p>
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight">
        <Link
          href={campaignPath(campaign.id)}
          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {campaign.name}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {campaign.description || "No description yet."}
      </p>
      <dl className="mt-4 grid gap-1 text-sm text-muted-foreground">
        <div>
          <dt className="sr-only">Owner</dt>
          <dd>Owner: {owner.name}</dd>
        </div>
        <div>
          <dt className="sr-only">Project</dt>
          <dd>
            Project:{" "}
            <Link href={`/projects/${campaign.projectId}`} className="hover:underline">
              {projectName}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Due date</dt>
          <dd>Due {campaign.endDate ? formatIsoDate(campaign.endDate) : "not set"}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <ProgressMeter value={progress} label={`${campaign.name} progress`} />
      </div>
    </article>
  )
}

function CampaignRow({
  campaign,
  projectName,
  progress,
}: {
  campaign: Campaign
  projectName: string
  progress: number
}) {
  const owner = getMember(campaign.ownerId)

  return (
    <li className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={campaignPath(campaign.id)}
            className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {campaign.name}
          </Link>
          <Badge variant="secondary" className={campaignStatusClass[campaign.status]}>
            {campaign.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {owner.name} · {projectName} · {dateRange(campaign.startDate, campaign.endDate)}
        </p>
      </div>
      <div className="w-full lg:w-40">
        <ProgressMeter value={progress} label={`${campaign.name} progress`} />
      </div>
    </li>
  )
}
