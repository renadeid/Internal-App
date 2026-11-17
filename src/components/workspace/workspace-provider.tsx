"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

import { initialNotifications } from "@/lib/mock-data/activity"
import { assetPath, kindForType } from "@/lib/mock-data/assets"
import { campaignPath } from "@/lib/mock-data/campaigns"
import { initialProjects } from "@/lib/mock-data/projects"
import { currentUserId, marketingManagerId } from "@/lib/mock-data/team"
import { formatIsoDate, nowStamp } from "@/lib/dates"
import {
  canReviewDeliverable,
  canStartDeliverable,
  canSubmitDeliverable,
  createCampaignRecord,
  getRecordsServerSnapshot,
  getRecordsSnapshot,
  parseRecords,
  subscribeRecords,
  updateRecords,
} from "@/lib/records-store"
import type {
  ActivityItem,
  Asset,
  AssetComment,
  AssetInput,
  AssetVersion,
  Campaign,
  CampaignInput,
  Deliverable,
  DeliverableInput,
  DeliverableStatus,
  Department,
  NewProjectInput,
  NotificationItem,
  Project,
  ProjectUpdate,
  Task,
  TaskInput,
  TaskStatus,
} from "@/lib/types"

type CreatedProject = {
  id: string
  name: string
}

type WorkspaceContextValue = {
  projects: Project[]
  campaigns: Campaign[]
  tasks: Task[]
  deliverables: Deliverable[]
  activity: ActivityItem[]
  assets: Asset[]
  assetComments: AssetComment[]
  assetVersions: AssetVersion[]
  actorId: string
  setActorId: (id: string) => void
  isMarketingManager: boolean
  createProject: (input: NewProjectInput) => Project
  updateProject: (id: string, input: ProjectUpdate) => void
  createCampaign: (input: CampaignInput) => Campaign
  updateCampaign: (id: string, input: CampaignInput) => void
  createTask: (campaignId: string, input: TaskInput) => void
  updateTask: (id: string, input: TaskInput) => void
  setTaskStatus: (id: string, status: TaskStatus) => void
  createDeliverable: (campaignId: string, input: DeliverableInput) => void
  setDeliverableStatus: (id: string, status: DeliverableStatus) => void
  createAsset: (input: AssetInput) => Asset
  updateAsset: (id: string, input: AssetInput) => void
  setAssetArchived: (id: string, archived: boolean) => void
  addAssetComment: (assetId: string, body: string) => void
  setAssetCommentResolved: (id: string, resolved: boolean) => void
  addAssetVersion: (assetId: string, label: string, notes: string) => void
  notifications: NotificationItem[]
  unreadCount: number
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  lastCreated: CreatedProject | null
  dismissLastCreated: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const recordsRaw = useSyncExternalStore(
    subscribeRecords,
    getRecordsSnapshot,
    getRecordsServerSnapshot
  )
  const records = useMemo(() => parseRecords(recordsRaw), [recordsRaw])
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications)
  const [lastCreated, setLastCreated] = useState<CreatedProject | null>(null)
  const [actorId, setActorId] = useState(currentUserId)

  const createProject = useCallback((input: NewProjectInput) => {
    const project: Project = {
      id: `project-${crypto.randomUUID()}`,
      name: input.name,
      description: input.description,
      department: input.department,
      departments: [input.department],
      status: "Planning",
      progress: 0,
      ownerId: input.ownerId,
      memberIds: [input.ownerId],
      team: [{ memberId: input.ownerId, projectRole: "Owner" }],
      updatedLabel: "Added just now",
      startLabel: "Not set",
      deadlineLabel: "Not set",
    }

    setProjects((current) => [project, ...current])
    setLastCreated({ id: project.id, name: project.name })
    setNotifications((current) => [
      {
        id: `notice-${project.id}`,
        title: `created ${project.name}`,
        detail: "Projects",
        timeLabel: "Just now",
        href: `/projects/${project.id}`,
        read: false,
      },
      ...current,
    ])

    return project
  }, [])

  const updateProject = useCallback((id: string, input: ProjectUpdate) => {
    const progress = Math.max(0, Math.min(100, Math.round(input.progress)))
    const departments = withLead(input.department, input.departments)

    setProjects((current) =>
      current.map((project) => {
        if (project.id !== id) return project
        const memberIds = project.memberIds.includes(input.ownerId)
          ? project.memberIds
          : [input.ownerId, ...project.memberIds]
        const team = project.team.some((member) => member.memberId === input.ownerId)
          ? project.team
          : [{ memberId: input.ownerId, projectRole: "Owner" }, ...project.team]

        return {
          ...project,
          name: input.name,
          description: input.description,
          ownerId: input.ownerId,
          department: input.department,
          departments,
          status: input.status,
          progress,
          startLabel: input.startLabel,
          deadlineLabel: input.deadlineLabel,
          memberIds,
          team,
          updatedLabel: "Updated just now",
        }
      })
    )

    setNotifications((current) => [
      {
        id: `notice-edit-${id}-${crypto.randomUUID()}`,
        title: `updated ${input.name}`,
        detail: "Projects",
        timeLabel: "Just now",
        href: `/projects/${id}`,
        read: false,
      },
      ...current,
    ])
  }, [])

  const createCampaign = useCallback((input: CampaignInput) => {
    const campaign = createCampaignRecord(input, `campaign-${crypto.randomUUID()}`)
    updateRecords((current) => ({
      ...current,
      campaigns: [campaign, ...current.campaigns],
      activity: [
        activityEntry(
          campaign.ownerId,
          `created the ${campaign.name} campaign`,
          "Marketing",
          campaignPath(campaign.id),
          campaign.projectId,
          campaign.id
        ),
        ...current.activity,
      ],
    }))
    setNotifications((current) => [
      {
        id: `notice-${campaign.id}`,
        title: `created ${campaign.name}`,
        detail: "Marketing",
        timeLabel: "Just now",
        href: campaignPath(campaign.id),
        read: false,
      },
      ...current,
    ])
    return campaign
  }, [])

  const updateCampaign = useCallback((id: string, input: CampaignInput) => {
    updateRecords((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        campaign.id === id ? { ...campaign, ...input } : campaign
      ),
      tasks: current.tasks.map((task) =>
        task.campaignId === id ? { ...task, projectId: input.projectId } : task
      ),
      deliverables: current.deliverables.map((item) =>
        item.campaignId === id ? { ...item, projectId: input.projectId } : item
      ),
      activity: [
        activityEntry(
          input.ownerId,
          `updated ${input.name}`,
          "Marketing",
          campaignPath(id),
          input.projectId,
          id
        ),
        ...current.activity,
      ],
    }))
  }, [])

  const createTask = useCallback((campaignId: string, input: TaskInput) => {
    updateRecords((current) => {
      const campaign = current.campaigns.find((item) => item.id === campaignId)
      if (!campaign) return current
      const task: Task = {
        id: `task-${crypto.randomUUID()}`,
        title: input.title,
        description: input.description,
        projectId: campaign.projectId,
        campaignId,
        assigneeId: input.assigneeId,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate || undefined,
        dueLabel: input.dueDate ? formatIsoDate(input.dueDate) : "Not set",
      }
      return {
        ...current,
        tasks: [task, ...current.tasks],
        activity: [
          activityEntry(
            input.assigneeId,
            `added “${task.title}”`,
            "Tasks",
            campaignPath(campaignId),
            campaign.projectId,
            campaignId
          ),
          ...current.activity,
        ],
      }
    })
  }, [])

  const updateTask = useCallback((id: string, input: TaskInput) => {
    updateRecords((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              title: input.title,
              description: input.description,
              assigneeId: input.assigneeId,
              priority: input.priority,
              status: input.status,
              dueDate: input.dueDate || undefined,
              dueLabel: input.dueDate ? formatIsoDate(input.dueDate) : "Not set",
            }
          : task
      ),
    }))
  }, [])

  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    updateRecords((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, status } : task
      ),
    }))
  }, [])

  const createDeliverable = useCallback(
    (campaignId: string, input: DeliverableInput) => {
      updateRecords((current) => {
        const campaign = current.campaigns.find((item) => item.id === campaignId)
        if (!campaign) return current
        return {
          ...current,
          deliverables: [
            {
              id: `del-${crypto.randomUUID()}`,
              campaignId,
              projectId: campaign.projectId,
              title: input.title,
              type: input.type,
              creatorId: input.creatorId,
              status: "Draft",
              dueDate: input.dueDate,
              assetId: input.assetId,
            },
            ...current.deliverables,
          ],
        }
      })
    },
    []
  )

  const setDeliverableStatus = useCallback(
    (id: string, status: DeliverableStatus) => {
      updateRecords((current) => {
        const item = current.deliverables.find((entry) => entry.id === id)
        if (!item || !canSetDeliverableStatus(actorId, item, status)) return current
        return {
          ...current,
          deliverables: current.deliverables.map((entry) =>
            entry.id === id ? { ...entry, status } : entry
          ),
          activity: [
            activityEntry(
              actorId,
              `${statusLabel(status)} “${item.title}”`,
              "Deliverables",
              campaignPath(item.campaignId),
              item.projectId,
              item.campaignId
            ),
            ...current.activity,
          ],
        }
      })
    },
    [actorId]
  )

  const createAsset = useCallback((input: AssetInput) => {
    const stamp = nowStamp()
    const asset = assetRecord(input, `asset-${crypto.randomUUID()}`, stamp)
    updateRecords((current) => ({
      ...current,
      assets: [asset, ...current.assets],
      assetVersions: [
        {
          id: `version-${crypto.randomUUID()}`,
          assetId: asset.id,
          number: 1,
          label: "Initial version",
          date: stamp,
          authorId: input.ownerId,
          notes: "Metadata added to the library.",
        },
        ...current.assetVersions,
      ],
      activity: [
        activityEntry(
          input.ownerId,
          `added ${asset.name} to the library`,
          "Assets Library",
          assetPath(asset.id),
          asset.projectId ?? "",
          asset.campaignId ?? ""
        ),
        ...current.activity,
      ],
    }))
    return asset
  }, [])

  const updateAsset = useCallback((id: string, input: AssetInput) => {
    const stamp = nowStamp()
    updateRecords((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === id
          ? {
              ...assetRecord(input, id, stamp),
              createdAt: asset.createdAt,
              archived: asset.archived,
            }
          : asset
      ),
    }))
  }, [])

  const setAssetArchived = useCallback((id: string, archived: boolean) => {
    const stamp = nowStamp()
    updateRecords((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              archived,
              updatedAt: stamp,
              updatedLabel: archived ? "Archived just now" : "Restored just now",
            }
          : asset
      ),
    }))
  }, [])

  const addAssetComment = useCallback((assetId: string, body: string) => {
    const text = body.trim()
    if (!text) return
    updateRecords((current) => ({
      ...current,
      assetComments: [
        {
          id: `comment-${crypto.randomUUID()}`,
          assetId,
          authorId: actorId,
          body: text,
          createdAt: nowStamp(),
          resolved: false,
        },
        ...current.assetComments,
      ],
    }))
  }, [actorId])

  const setAssetCommentResolved = useCallback((id: string, resolved: boolean) => {
    updateRecords((current) => ({
      ...current,
      assetComments: current.assetComments.map((comment) =>
        comment.id === id ? { ...comment, resolved } : comment
      ),
    }))
  }, [])

  const addAssetVersion = useCallback(
    (assetId: string, label: string, notes: string) => {
      const versionLabel = label.trim()
      if (!versionLabel) return
      updateRecords((current) => {
        const numbers = current.assetVersions
          .filter((version) => version.assetId === assetId)
          .map((version) => version.number)
        const number = Math.max(0, ...numbers) + 1
        const stamp = nowStamp()
        return {
          ...current,
          assets: current.assets.map((asset) =>
            asset.id === assetId
              ? { ...asset, updatedAt: stamp, updatedLabel: "Updated just now" }
              : asset
          ),
          assetVersions: [
            {
              id: `version-${crypto.randomUUID()}`,
              assetId,
              number,
              label: versionLabel,
              date: stamp,
              authorId: actorId,
              notes: notes.trim(),
            },
            ...current.assetVersions,
          ],
        }
      })
    },
    [actorId]
  )

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    )
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true }))
    )
  }, [])

  const dismissLastCreated = useCallback(() => {
    setLastCreated(null)
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects,
      campaigns: records.campaigns,
      tasks: records.tasks,
      deliverables: records.deliverables,
      activity: records.activity,
      assets: records.assets,
      assetComments: records.assetComments,
      assetVersions: records.assetVersions,
      actorId,
      setActorId,
      isMarketingManager: actorId === marketingManagerId,
      createProject,
      updateProject,
      createCampaign,
      updateCampaign,
      createTask,
      updateTask,
      setTaskStatus,
      createDeliverable,
      setDeliverableStatus,
      createAsset,
      updateAsset,
      setAssetArchived,
      addAssetComment,
      setAssetCommentResolved,
      addAssetVersion,
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      markNotificationRead,
      markAllNotificationsRead,
      lastCreated,
      dismissLastCreated,
    }),
    [
      projects,
      records,
      actorId,
      createProject,
      updateProject,
      createCampaign,
      updateCampaign,
      createTask,
      updateTask,
      setTaskStatus,
      createDeliverable,
      setDeliverableStatus,
      createAsset,
      updateAsset,
      setAssetArchived,
      addAssetComment,
      setAssetCommentResolved,
      addAssetVersion,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      lastCreated,
      dismissLastCreated,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

function assetRecord(input: AssetInput, id: string, stamp: string): Asset {
  const url = input.url.trim()
  return {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    type: input.type,
    kind: kindForType(input.type),
    url: url || undefined,
    href: url || undefined,
    tags: input.tags,
    ownerId: input.ownerId,
    projectId: input.projectId || undefined,
    campaignId: input.campaignId || undefined,
    visibility: input.visibility,
    collection: input.collection.trim() || "General",
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    updatedLabel: "Updated just now",
  }
}

function withLead(department: Department, departments: Department[]) {
  return departments.includes(department)
    ? departments
    : [department, ...departments]
}

function activityEntry(
  actorId: string,
  summary: string,
  context: string,
  href: ActivityItem["href"],
  projectId: string,
  campaignId: string
): ActivityItem {
  return {
    id: `act-${crypto.randomUUID()}`,
    actorId,
    summary,
    context,
    timeLabel: "Just now",
    href,
    projectId,
    campaignId,
  }
}

function canSetDeliverableStatus(
  actorId: string,
  item: { status: DeliverableStatus; creatorId: string },
  status: DeliverableStatus
) {
  if (status === "Submitted") {
    return canSubmitDeliverable(actorId, item.status, item.creatorId)
  }
  if (status === "In Progress") {
    return canStartDeliverable(actorId, item.status, item.creatorId)
  }
  if (status === "Approved" || status === "Changes Requested") {
    return canReviewDeliverable(actorId, item.status)
  }
  return false
}

function statusLabel(status: DeliverableStatus) {
  if (status === "Submitted") return "submitted"
  if (status === "Approved") return "approved"
  if (status === "Changes Requested") return "requested changes on"
  return "updated"
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context
}
