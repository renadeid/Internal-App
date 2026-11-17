"use client"

import { useState } from "react"
import Link from "next/link"

import { ActivityFeedItem } from "@/components/dashboard/activity-item"
import { ActingAs } from "@/components/marketing/acting-as"
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog"
import { DeliverableFormDialog } from "@/components/marketing/deliverable-form-dialog"
import { ProgressMeter } from "@/components/marketing/progress-meter"
import { TaskFormDialog } from "@/components/marketing/task-form-dialog"
import { useWorkspace } from "@/components/workspace/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dateRange, formatIsoDate } from "@/lib/dates"
import { assetPath, visibilityLabel } from "@/lib/mock-data/assets"
import { getMember, marketingManagerId, workspaceRole } from "@/lib/mock-data/team"
import { getProjectName } from "@/lib/mock-data/projects"
import {
  campaignStatusClass,
  deliverableStatusClass,
  priorityClass,
  surfaceClass,
  taskStatusClass,
} from "@/lib/presentation"
import {
  campaignProgress,
  canReviewDeliverable,
  canStartDeliverable,
  canSubmitDeliverable,
} from "@/lib/records-store"
import {
  taskStatuses,
  type Campaign,
  type CampaignInput,
  type Deliverable,
  type DeliverableInput,
  type DeliverableType,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "@/lib/types"

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "tasks", label: "Tasks" },
  { value: "deliverables", label: "Deliverables" },
  { value: "assets", label: "Assets" },
  { value: "activity", label: "Activity" },
] as const

type CampaignTab = (typeof tabs)[number]["value"]

const taskStatusItems = taskStatuses.map((status) => ({
  value: status,
  label: status,
}))

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const workspace = useWorkspace()
  const campaign = workspace.campaigns.find((item) => item.id === campaignId)
  const [tab, setTab] = useState<CampaignTab>("overview")
  const [editing, setEditing] = useState(false)
  const [editSession, setEditSession] = useState(0)

  if (!campaign) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Campaign not found</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This campaign is not in the workspace. Campaigns created in this
          browser stay in local storage, so a different browser will not see them.
        </p>
        <Link
          href="/workspaces/marketing"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to Marketing
        </Link>
      </div>
    )
  }

  const owner = getMember(campaign.ownerId)
  const projectName = getProjectName(workspace.projects, campaign.projectId)
  const progress = campaignProgress(campaign.id, workspace.tasks, workspace.deliverables)
  const campaignTasks = workspace.tasks.filter((task) => task.campaignId === campaign.id)
  const campaignDeliverables = workspace.deliverables.filter(
    (item) => item.campaignId === campaign.id
  )
  const campaignActivity = workspace.activity.filter((item) => item.campaignId === campaign.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <ActingAs />
      </div>
      <section className={`${surfaceClass} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={campaignStatusClass[campaign.status]}>
                {campaign.status}
              </Badge>
              <Badge variant="secondary">{campaign.type}</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Owner: {owner.name} · Project:{" "}
              <Link
                href={`/projects/${campaign.projectId}`}
                className="font-medium text-foreground hover:underline"
              >
                {projectName}
              </Link>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {dateRange(campaign.startDate, campaign.endDate)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditSession((current) => current + 1)
              setEditing(true)
            }}
          >
            Edit Campaign
          </Button>
        </div>
        <div className="mt-5 max-w-md">
          <ProgressMeter value={progress} label={`${campaign.name} progress`} />
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isCampaignTab(value)) setTab(value)
        }}
      >
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-max justify-start group-data-horizontal/tabs:h-9">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="h-8 flex-none px-3">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="pt-4">
          <Overview
            campaign={campaign}
            taskCount={campaignTasks.length}
            deliverableCount={campaignDeliverables.length}
            approvedCount={campaignDeliverables.filter((item) => item.status === "Approved").length}
          />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <CampaignTasks campaignId={campaign.id} tasks={campaignTasks} />
        </TabsContent>
        <TabsContent value="deliverables" className="pt-4">
          <CampaignDeliverables
            campaignId={campaign.id}
            projectId={campaign.projectId}
            items={campaignDeliverables}
          />
        </TabsContent>
        <TabsContent value="assets" className="pt-4">
          <CampaignAssets
            campaignId={campaign.id}
            deliverables={campaignDeliverables}
          />
        </TabsContent>
        <TabsContent value="activity" className="pt-4">
          <div className={`${surfaceClass} px-4 py-2 sm:px-5`}>
            {campaignActivity.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                No activity on this campaign yet.
              </p>
            ) : (
              <ul>
                {campaignActivity.map((item) => (
                  <ActivityFeedItem key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CampaignFormDialog
        key={editSession}
        open={editing}
        onOpenChange={setEditing}
        projects={workspace.projects}
        initial={toCampaignInput(campaign)}
        title="Edit campaign"
        submitLabel="Save changes"
        onSubmit={(input) => workspace.updateCampaign(campaign.id, input)}
      />
    </div>
  )
}

function Overview({
  campaign,
  taskCount,
  deliverableCount,
  approvedCount,
}: {
  campaign: Campaign
  taskCount: number
  deliverableCount: number
  approvedCount: number
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div className={`${surfaceClass} p-5`}>
        <h2 className="text-sm font-medium">Description</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {campaign.description || "No description yet."}
        </p>
        <h2 className="mt-5 text-sm font-medium">Goals</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {campaign.goals || "No goals yet."}
        </p>
      </div>
      <dl className={`${surfaceClass} grid gap-4 p-5 text-sm`}>
        <div>
          <dt className="text-muted-foreground">Tasks</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{taskCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deliverables</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{deliverableCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Approved</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{approvedCount}</dd>
        </div>
      </dl>
    </div>
  )
}

function CampaignTasks({ campaignId, tasks }: { campaignId: string; tasks: Task[] }) {
  const { actorId, createTask, updateTask, setTaskStatus } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = tasks.find((task) => task.id === editingId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          These tasks also appear on the parent project and in My Tasks.
        </p>
        <Button
          type="button"
          onClick={() => {
            setEditingId(null)
            setSession((current) => current + 1)
            setOpen(true)
          }}
        >
          Create Task
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className={`${surfaceClass} px-5 py-10 text-sm text-muted-foreground`}>
          No tasks on this campaign yet.
        </p>
      ) : (
        <ul className={surfaceClass}>
          {tasks.map((task) => {
            const assignee = getMember(task.assigneeId)
            return (
              <li
                key={task.id}
                className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 lg:flex-row lg:items-start"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{task.title}</p>
                  {task.description ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {assignee.name} ·{" "}
                    <span className={priorityClass[task.priority]}>{task.priority}</span> · Due{" "}
                    {task.dueDate ? formatIsoDate(task.dueDate) : "not set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    items={taskStatusItems}
                    value={task.status}
                    onValueChange={(value) => {
                      if (isTaskStatus(value)) setTaskStatus(task.id, value)
                    }}
                  >
                    <SelectTrigger className="w-36" aria-label={`Status for ${task.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          <span className={taskStatusClass[status]}>{status}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(task.id)
                      setSession((current) => current + 1)
                      setOpen(true)
                    }}
                  >
                    Edit Task
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <TaskFormDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit task" : "Create task"}
        submitLabel={editing ? "Save task" : "Create task"}
        initial={editing ? toTaskInput(editing) : blankTask(actorId)}
        onSubmit={(input) => {
          if (editing) updateTask(editing.id, input)
          else createTask(campaignId, input)
        }}
      />
    </div>
  )
}

function CampaignDeliverables({
  campaignId,
  projectId,
  items,
}: {
  campaignId: string
  projectId: string
  items: Deliverable[]
}) {
  const { actorId, createDeliverable, setDeliverableStatus } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const role = workspaceRole(actorId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Acting as {getMember(actorId).name}, {role}. Creators submit work.
          Maya Chen, the Marketing Manager, approves it or sends it back.
        </p>
        <Button
          type="button"
          onClick={() => {
            setSession((current) => current + 1)
            setOpen(true)
          }}
        >
          Add deliverable
        </Button>
      </div>
      {items.length === 0 ? (
        <p className={`${surfaceClass} px-5 py-10 text-sm text-muted-foreground`}>
          No deliverables on this campaign yet.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <DeliverableCard
              key={item.id}
              item={item}
              actorId={actorId}
              onStatus={(status) => setDeliverableStatus(item.id, status)}
            />
          ))}
        </div>
      )}
      <DeliverableFormDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        campaignId={campaignId}
        initial={blankDeliverable(actorId)}
        onSubmit={(input) => createDeliverable(campaignId, input)}
      />
    </div>
  )
}

function DeliverableCard({
  item,
  actorId,
  onStatus,
}: {
  item: Deliverable
  actorId: string
  onStatus: (status: Deliverable["status"]) => void
}) {
  const { assets } = useWorkspace()
  const creator = getMember(item.creatorId)
  const asset = item.assetId ? assets.find((entry) => entry.id === item.assetId) : undefined
  const canStart = canStartDeliverable(actorId, item.status, item.creatorId)
  const canSubmit = canSubmitDeliverable(actorId, item.status, item.creatorId)
  const canReview = canReviewDeliverable(actorId, item.status)

  return (
    <article className={`${surfaceClass} flex flex-col p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={deliverableStatusClass[item.status]}>
          {item.status}
        </Badge>
        <Badge variant="secondary">{item.type}</Badge>
        {item.status === "Approved" ? (
          <Badge className="bg-emerald-600 text-white">Approved</Badge>
        ) : null}
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight">{item.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Creator: {creator.name} · Due {item.dueDate ? formatIsoDate(item.dueDate) : "not set"}
      </p>
      {asset ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Linked asset:{" "}
          <Link href={assetPath(asset.id)} className="hover:underline">
            {asset.name}
          </Link>
        </p>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{reviewNote(item, actorId)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canStart ? (
          <Button type="button" variant="outline" onClick={() => onStatus("In Progress")}>
            Mark in progress
          </Button>
        ) : null}
        {canSubmit ? (
          <Button type="button" onClick={() => onStatus("Submitted")}>
            Submit for review
          </Button>
        ) : null}
        {canReview ? (
          <>
            <Button type="button" onClick={() => onStatus("Approved")}>
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onStatus("Changes Requested")}
            >
              Request changes
            </Button>
          </>
        ) : null}
      </div>
    </article>
  )
}

function CampaignAssets({
  campaignId,
  deliverables,
}: {
  campaignId: string
  deliverables: Deliverable[]
}) {
  const { assets } = useWorkspace()
  const linked = new Set(
    deliverables.map((item) => item.assetId).filter((id): id is string => Boolean(id))
  )
  const visible = assets.filter(
    (asset) =>
      !asset.archived && (asset.campaignId === campaignId || linked.has(asset.id))
  )

  if (visible.length === 0) {
    return (
      <p className={`${surfaceClass} px-5 py-10 text-sm text-muted-foreground`}>
        No assets are linked to this campaign yet. Add one in the Assets
        Library and choose this campaign.
      </p>
    )
  }

  return (
    <ul className={surfaceClass}>
      {visible.map((asset) => (
        <li
          key={asset.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0"
        >
          <div>
            <Link href={assetPath(asset.id)} className="font-medium hover:underline">
              {asset.name}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {asset.type} · {getMember(asset.ownerId).name} · {asset.updatedLabel}
            </p>
          </div>
          {linked.has(asset.id) ? (
            <Badge className="bg-emerald-600 text-white">Linked to a deliverable</Badge>
          ) : (
            <Badge variant="secondary">{visibilityLabel[asset.visibility]}</Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

function reviewNote(item: Deliverable, actorId: string) {
  if (item.status === "Approved") {
    return "This deliverable is approved and counted in campaign progress."
  }
  if (item.status === "Submitted") {
    return actorId === marketingManagerId
      ? "This is waiting on you. Approve it, or send it back to the creator."
      : "Submitted for review. Switch to Maya Chen to approve it or request changes."
  }
  if (item.status === "Changes Requested") {
    return actorId === item.creatorId
      ? "Changes were requested. Revise the work, then submit it again."
      : `Changes were requested. ${getMember(item.creatorId).name} can revise and submit again.`
  }
  if (actorId === item.creatorId) {
    return "You created this. Start it, then submit it when it is ready for review."
  }
  return `Only ${getMember(item.creatorId).name} can submit this. The Marketing Manager reviews it after submission.`
}

function toCampaignInput(campaign: Campaign): CampaignInput {
  return {
    name: campaign.name,
    description: campaign.description,
    projectId: campaign.projectId,
    ownerId: campaign.ownerId,
    type: campaign.type,
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    goals: campaign.goals,
  }
}

function blankTask(assigneeId: string): TaskInput {
  return {
    title: "",
    description: "",
    assigneeId,
    priority: "Medium",
    status: "To do",
    dueDate: "",
  }
}

function toTaskInput(task: Task): TaskInput {
  return {
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? "",
  }
}

function blankDeliverable(creatorId: string): DeliverableInput {
  return {
    title: "",
    type: "Copy" satisfies DeliverableType,
    creatorId,
    dueDate: "",
  }
}

function isCampaignTab(value: unknown): value is CampaignTab {
  return tabs.some((item) => item.value === value)
}

function isTaskStatus(value: string | null): value is TaskStatus {
  return taskStatuses.some((status) => status === value)
}
